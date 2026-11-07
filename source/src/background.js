// Anbindung an Thunderbird/Betterbird. Die Bewertung selbst steckt in lib/ (rein, getestet).
import { analyze, headerSuspicion, nameMatchesDomain, orgKey, relatedCouldHelp } from './lib/analyzer.js';
import { extractAnchors } from './lib/anchors.js';
import { NOVABIRD_ID, parseAiFacts } from './lib/ai.js';
import { buildFeatures } from './lib/features.js';
import { mergeConfig } from './lib/config.js';
import { nameKey } from './lib/text.js';
import { parseAddressList, normalizeHeaders, parseMessageIds, firstHeader } from './lib/headers.js';
import { FREEMAIL, registrableDomain } from './lib/domains.js';
import {
  LOCAL_ACCOUNT_TYPES, SKIP_ACCOUNT_TYPES, flagRecord, folderKey, folderUses, historyMonths, isEstablished, isSkippedFolder,
  noteRecord, trustLevel,
} from './lib/history.js';
import { contactInfo, trustedBookIds } from './lib/contacts.js';
import { findQrUrls } from './qr.js';
import { ocrImages, resetOcr } from './ocr.js';
import { loadEmbeddedImages } from './images.js';
import { scanAttachments } from './attachments.js';
import { fetchRemoteImages, remoteScanAllowed } from './remote.js';
import { imageKey } from './lib/features.js';
import { t, uiStrings } from './i18n.js';
import { anonymizeEml } from './lib/anonymize.js';
import { learnedAuthservIds, noteAuthserv, topAuthservId } from './lib/authserv.js';

const lang = () => messenger.i18n.getUILanguage();
const TAG_KEYS = { suspicious: 'phishpilot_suspicious', dangerous: 'phishpilot_dangerous' };
const TAG_COLORS = { suspicious: '#D9A400', dangerous: '#C62828' };
const SHADOW_LOG_MAX = 2000;

// ---------- Konfiguration ----------
let configCache = null;
async function getConfig() {
  if (!configCache) {
    const { config } = await messenger.storage.local.get('config');
    configCache = mergeConfig(config);
  }
  return configCache;
}
messenger.storage.onChanged.addListener((changes) => {
  if (changes.config) {
    configCache = null; contactIndex = null; verdictCache.clear(); resetOcr();
    sentFolderCache = null; sentChecked.clear();
  }
});

// ---------- Kontakte (Adressbuch) ----------
let contactIndex = null;
let contactIndexAt = 0;
async function getContacts() {
  if (contactIndex && Date.now() - contactIndexAt < 10 * 60_000) return contactIndex;
  const idx = { byName: new Map(), addresses: new Set(), domains: new Set() };
  try {
    const { contactBookIds } = await getConfig();
    const books = await messenger.addressBooks.list();
    const use = new Set(trustedBookIds(books, contactBookIds));   // Standard: alle außer "Gesammelte Adressen"
    for (const book of books) {
      if (!use.has(book.id)) continue;
      for (const c of await messenger.addressBooks.contacts.list(book.id)) {
        const { names, emails } = contactInfo(c);
        for (const e of emails) {
          idx.addresses.add(e);
          idx.domains.add(registrableDomain(e.slice(e.lastIndexOf('@') + 1)));
        }
        for (const n of names) {
          const k = nameKey(n);
          if (!k) continue;
          if (!idx.byName.has(k)) idx.byName.set(k, new Set());
          emails.forEach((e) => idx.byName.get(k).add(e));
        }
      }
    }
  } catch (e) { console.warn('Adressbuch nicht lesbar', e); }
  contactIndex = idx; contactIndexAt = Date.now();
  return idx;
}
for (const ev of ['onCreated', 'onUpdated', 'onDeleted']) {
  messenger.addressBooks.contacts[ev]?.addListener(() => { contactIndex = null; });
}

// ---------- Absender-Historie ----------
// senderIndex: { [adresse]: { n, sent, names: [..], first, last, flagged? } } (siehe lib/history.js)
// 2: Zeitspanne je Absender (first/last); 3: Gesendet-Ordner per specialUse (MV3 kennt folder.type nicht mehr);
// 4: Rückblick begrenzt, Stufen 'sent'/'recurring', auffällige Absender markiert (Kopfzeilen- und Vollprüfung)
const SCAN_VERSION = 4;
const DAY = 86_400_000;
const FULL_CHECK_MAILS = 2;   // so viele der letzten Mails eines Kandidaten prüft der Scan vollständig
let senderIndex = null;
let saveTimer = null;
async function loadSenderIndex() {
  if (!senderIndex) senderIndex = (await messenger.storage.local.get('senderIndex')).senderIndex ?? {};
  return senderIndex;
}
function saveSenderIndexSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => messenger.storage.local.set({ senderIndex }), 3000);
}
// ---------- Eigener Mailserver je Konto (lib/authserv.js) ----------
// authservStats: { [accountId]: { [authserv-id]: Anzahl } } – eigener Schlüssel, nicht in config (dessen Änderung leert Caches)
let authservStats = null;
let authservTimer = null;
async function loadAuthservStats() {
  if (!authservStats) authservStats = (await messenger.storage.local.get('authservStats')).authservStats ?? {};
  return authservStats;
}
/** Konfiguration mit den vertrauten authserv-ids für dieses Konto: Einstellung vor Gelerntem, sonst alte Regel. */
async function authservConfig(config, accountId) {
  if (config.trustedAuthservIds.length || !accountId) return config;
  const learned = learnedAuthservIds(await loadAuthservStats(), accountId);
  return learned ? { ...config, trustedAuthservIds: learned } : config;
}
const NOT_RECEIVED = ['sent', 'drafts', 'templates', 'outbox'];
async function countAuthserv(folder, messageId) {
  if (!folder?.accountId || folderUses(folder).some((u) => NOT_RECEIVED.includes(u))) return;
  const headers = normalizeHeaders(await messenger.messages.getHeaders(messageId));
  noteAuthserv(await loadAuthservStats(), folder.accountId, topAuthservId(headers['authentication-results']));
  clearTimeout(authservTimer);
  authservTimer = setTimeout(() => messenger.storage.local.set({ authservStats }), 3000);
}

const msgTime = (m) => (m.date instanceof Date ? m.date.getTime() : null);
const historySince = (config) => new Date(Date.now() - historyMonths(config.historyMonths) * 30.44 * DAY);

/** Etablierte Absender (siehe lib/history.js): Namen für die Kontakt-Imitation, Stufe für die Bewertung.
 *  Die Namenslisten werden höchstens jede Minute neu berechnet (bei großen Postfächern sonst bei jeder Mail). */
let viewCache = null, viewIdx = null, viewAt = 0;
function historyView(idx) {
  if (viewCache && viewIdx === idx && Date.now() - viewAt < 60_000) return viewCache;
  viewCache = buildHistoryView(idx); viewIdx = idx; viewAt = Date.now();
  return viewCache;
}
function buildHistoryView(idx) {
  const byName = new Map();
  for (const [addr, rec] of Object.entries(idx)) {
    if (!isEstablished(rec)) continue;
    for (const name of rec.names) {
      const k = nameKey(name);
      if (!k) continue;
      if (!byName.has(k)) byName.set(k, new Map());
      byName.get(k).set(addr, rec.n + rec.sent);
    }
  }
  // Gelernte Absendernamen: etabliert, nie aufgefallen, Name passt zur Domain, keine Freemail-Domain
  const learnedNames = new Map();
  for (const [addr, rec] of Object.entries(idx)) {
    if (!isEstablished(rec)) continue;
    const rd = registrableDomain(addr.slice(addr.lastIndexOf('@') + 1));
    if (FREEMAIL.has(rd)) continue;
    for (const name of rec.names) {
      const k = orgKey(name);
      if (!k || !nameMatchesDomain(name, rd)) continue;
      if (!learnedNames.has(k)) learnedNames.set(k, new Set());
      learnedNames.get(k).add(rd);
    }
  }
  return {
    byName,
    learnedNames,
    lookup: (addr) => {
      const level = trustLevel(idx[addr]);
      return level ? { count: idx[addr].n + idx[addr].sent * 3, level } : null;
    },
  };
}

async function walkFolders(account) {
  const out = [];
  const walk = async (folder) => {
    out.push(folder);
    for (const sub of await messenger.folders.getSubFolders(folder.id, false)) await walk(sub);
  };
  for (const f of await messenger.folders.getSubFolders(account.rootFolder.id, false)) await walk(f);
  return out;
}

/** Kopfdaten aller Mails eines Ordners ab einem Datum (nur die Ordner-Datenbank, nichts vom Server). */
async function* listSince(folderId, since) {
  let page = await messenger.messages.query({ folderId, fromDate: since });
  for (;;) {
    yield* page.messages;
    if (!page.id) return;
    page = await messenger.messages.continueList(page.id);
  }
}

let scanning = null;
/** Es läuft höchstens ein Scan gleichzeitig (Start, Installation und Einstellungen können sich überschneiden). */
function ensureScan(options) {
  scanning ??= scanHistory(options).finally(() => { scanning = null; });
  return scanning;
}

/** Aufbau der Historie aus vorhandenen Mails (läuft im Hintergrund), nur der eingestellte Rückblick.
 *  Stufe 1 (alle Konten): Kopfdaten zählen; Junk, eigene Tags und auffällige Absenderzeilen markieren den Absender.
 *  Stufe 2 (nur POP3/Lokale Ordner): Absender, die "oft empfangen" erreichen, mit ihren letzten Mails voll prüfen.
 *  Bei IMAP u. a. liest der Scan keine Mail vollständig – sonst würden ohne Offline-Kopie Mails vom Server geladen. */
async function scanHistory({ force = false } = {}) {
  const { scanVersion } = await messenger.storage.local.get('scanVersion');
  if (scanVersion === SCAN_VERSION && !force) return;
  const config = await getConfig();
  const excluded = new Set(config.historyExcludedFolders);
  const since = historySince(config);
  const ourTags = Object.values(TAG_KEYS);
  const idx = {};
  const recent = new Map();        // Adresse -> letzte Mails aus lokalen Konten [{ id, t }]
  const headerChecked = new Map(); // Absenderzeile -> auffällig?
  for (const account of await messenger.accounts.list()) {
    if (SKIP_ACCOUNT_TYPES.includes(account.type)) continue;
    const local = LOCAL_ACCOUNT_TYPES.includes(account.type);
    for (const folder of await walkFolders(account)) {
      if (isSkippedFolder(folder) || excluded.has(folderKey(folder))) continue;
      const sent = folderUses(folder).includes('sent');
      for await (const m of listSince(folder.id, since)) {
        if (sent) {
          if (!m.junk) for (const r of m.recipients ?? []) for (const a of parseAddressList(r)) noteRecord(idx, a, 'sent', msgTime(m));
          continue;
        }
        for (const a of parseAddressList(m.author)) {
          noteRecord(idx, a, 'n', msgTime(m));
          const key = String(m.author).toLowerCase();
          if (!headerChecked.has(key)) headerChecked.set(key, headerSuspicion(m.author).length > 0);
          if (m.junk || (m.tags ?? []).some((t) => ourTags.includes(t)) || headerChecked.get(key)) {
            flagRecord(idx, a.address);
          } else if (local) {
            const list = recent.get(a.address) ?? [];
            list.push({ id: m.id, t: msgTime(m) ?? 0 });
            list.sort((x, y) => y.t - x.t);
            recent.set(a.address, list.slice(0, FULL_CHECK_MAILS));
          }
        }
      }
    }
  }
  // Stufe 2: Kandidaten für "oft empfangen" mit dem normalen Analyzer prüfen (ohne OCR, ohne Historie)
  const contacts = await getContacts();
  for (const [addr, list] of recent) {
    if (trustLevel(idx[addr]) !== 'recurring' || contacts.addresses.has(addr)) continue;
    for (const { id } of list) {
      const level = await quickLevel(id, contacts, config).catch(() => 'normal');
      if (level !== 'normal') { flagRecord(idx, addr); break; }
    }
  }
  senderIndex = idx;
  verdictCache.clear();
  await messenger.storage.local.set({ senderIndex: idx, scanVersion: SCAN_VERSION });
}

/** Bewertung ohne Bilder/OCR/Historie, nur für den Scan lokaler Konten. */
async function quickLevel(messageId, contacts, config) {
  const [headers, full] = await Promise.all([messenger.messages.getHeaders(messageId), messenger.messages.getFull(messageId)]);
  const features = buildFeatures({ headers, parts: flattenParts(full) }, config);
  return analyze(features, { contactsByName: contacts.byName, contactAddresses: contacts.addresses, contactDomains: contacts.domains }, config).level;
}

/** Nach dem Erstscan selbst verschickte Mails: Ist ein noch nicht voll bekannter Absender jemand, dem ich geschrieben habe?
 *  Gezielte Suche in den Gesendet-Ordnern (nur Kopfdaten, ohne die Berechtigung "compose"); je Adresse höchstens einmal pro Stunde. */
const sentChecked = new Map();   // Adresse -> Zeitpunkt der letzten Suche
let sentFolderCache = null, sentFolderAt = 0;
async function sentFolders() {
  if (sentFolderCache && Date.now() - sentFolderAt < 10 * 60_000) return sentFolderCache;
  const excluded = new Set((await getConfig()).historyExcludedFolders);
  const out = [];
  for (const account of await messenger.accounts.list()) {
    if (SKIP_ACCOUNT_TYPES.includes(account.type)) continue;
    for (const folder of await walkFolders(account)) {
      if (folderUses(folder).includes('sent') && !excluded.has(folderKey(folder))) out.push(folder);
    }
  }
  sentFolderCache = out; sentFolderAt = Date.now();
  return out;
}
async function noteSentTo(address) {
  if (!address || Date.now() - (sentChecked.get(address) ?? 0) < 60 * 60_000) return;
  sentChecked.set(address, Date.now());
  const idx = await loadSenderIndex();
  if (idx[address]?.sent) return;
  const since = historySince(await getConfig());
  try {
    for (const folder of await sentFolders()) {
      const res = await messenger.messages.query({ folderId: folder.id, recipients: address, fromDate: since });
      if (!res.messages.length) continue;
      for (const m of res.messages) noteRecord(idx, { address }, 'sent', msgTime(m));
      saveSenderIndexSoon();
      return;
    }
  } catch (e) { console.warn('Gesendet-Ordner nicht durchsuchbar', e?.message); }
}

// ---------- Nachricht analysieren ----------
function flattenParts(part, out = []) {
  if (!part) return out;
  if (part.body !== undefined || part.name) {
    out.push({ contentType: part.contentType, name: part.name, body: typeof part.body === 'string' ? part.body.slice(0, 400_000) : '' });
  }
  for (const p of part.parts ?? []) flattenParts(p, out);
  return out;
}

async function threadFoundLocally(features) {
  if (!features.isReplySubject) return undefined;
  const ids = [...features.inReplyTo, ...features.references.slice(-3)];
  if (!ids.length) return undefined;
  for (const id of new Set(ids)) {
    const res = await messenger.messages.query({ headerMessageId: id });
    if (res.messages.length) return true;
  }
  return false;
}

// ---------- Bezug zu früheren Mails (Bestell-, Sendungs-, Rechnungsnummern; lib/anchors.js) ----------
// Gesucht wird im Betreff aller Konten (Kopfdaten) und im Text nur bei lokalen Konten – bei IMAP würde eine
// Volltextsuche ohne Offline-Kopie Mails vom Server holen. Die frühere Mail zählt nur, wenn ein Angreifer sie
// nicht selbst vorbereitet haben kann: selbst verschickt, von einem Kontakt/etablierten Absender, oder per DKIM
// bestätigt von einer *anderen* Domain, mindestens 12 Stunden älter und unauffällig.
const RELATED_DAYS = 180;
const RELATED_DKIM_MIN_AGE = 12 * 60 * 60_000;
async function findRelated(header, features, contacts, idx) {
  const anchors = extractAnchors(features.subject, features.text, 3);
  if (!anchors.length) return null;
  const date = msgTime(header) ?? Date.now();
  const range = { fromDate: new Date(date - RELATED_DAYS * DAY), toDate: new Date(date) };
  const config = await getConfig();
  const excluded = new Set(config.historyExcludedFolders);
  const localIds = (await messenger.accounts.list(false)).filter((a) => LOCAL_ACCOUNT_TYPES.includes(a.type)).map((a) => a.id);
  const fromRd = features.from ? registrableDomain(features.from.domain) : '';
  for (const anchor of anchors) {
    const queries = [{ subject: anchor, ...range }, ...localIds.map((accountId) => ({ accountId, body: anchor, ...range }))];
    for (const q of queries) {
      const res = await messenger.messages.query(q).catch(() => ({ messages: [] }));
      for (const m of res.messages) {
        if (m.id === header.id || m.headerMessageId === header.headerMessageId) continue;
        if (m.junk || (m.tags ?? []).some((k) => Object.values(TAG_KEYS).includes(k))) continue;
        if (m.folder && (isSkippedFolder(m.folder) || excluded.has(folderKey(m.folder)))) continue;
        if (await trustedEarlier(m, date, fromRd, contacts, idx)) return { anchor, date: msgTime(m) };
      }
    }
  }
  return null;
}
async function trustedEarlier(m, date, fromRd, contacts, idx) {
  const t = msgTime(m);
  if (t === null || t >= date) return false;
  if (m.folder && folderUses(m.folder).includes('sent')) return true;
  const author = parseAddressList(m.author)[0]?.address;
  if (!author) return false;
  if (contacts.addresses.has(author) || trustLevel(idx[author])) return true;
  if (date - t < RELATED_DKIM_MIN_AGE || headerSuspicion(m.author).length) return false;
  const f = buildFeatures({ headers: await messenger.messages.getHeaders(m.id), parts: [] }, await authservConfig(await getConfig(), m.folder?.accountId));
  const rd = f.from ? registrableDomain(f.from.domain) : '';
  return !!rd && rd !== fromRd && f.auth.dmarc !== 'fail' && (f.auth.dkimDomains ?? []).some((d) => registrableDomain(d) === rd);
}

// ---------- Lokale KI über die NovaBird-Extension (docs/ki-schnittstelle.md) ----------
// Die Extension fragt ihr eingestelltes Modell nur, wenn es lokal läuft, und liefert geprüfte Fakten. Ohne Extension,
// ohne eingeschaltete "Phishing-Prüfung" oder bei Fehlern bleibt es bei den Regeln.
const AI_TIMEOUT = 3500;
const aiFacts = new Map();        // messageId -> geprüfte Fakten (auch aus nachgereichtem phish:result)
let novabirdAbsentUntil = 0;      // Extension nicht installiert: eine Minute lang nicht erneut fragen
async function askNovaBird(messageId) {
  if (aiFacts.has(messageId)) return aiFacts.get(messageId);
  if (Date.now() < novabirdAbsentUntil) return null;
  let res;
  try {
    res = await Promise.race([
      messenger.runtime.sendMessage(NOVABIRD_ID, { type: 'phish:extract', messageId }),
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: 'timeout' }), AI_TIMEOUT)),
    ]);
  } catch { novabirdAbsentUntil = Date.now() + 60_000; return null; }
  const facts = parseAiFacts(res);
  // "busy": das Ergebnis kommt später als phish:result; bis dahin zählt nur die regelbasierte injection
  if (facts && res?.ok === true) rememberAiFacts(messageId, facts);
  return facts;
}
function rememberAiFacts(messageId, facts) {
  aiFacts.set(messageId, facts);
  if (aiFacts.size > 500) aiFacts.delete(aiFacts.keys().next().value);
}
// Nachgereichtes Ergebnis nach "busy". Nur von der NovaBird-Extension; Listener bewusst nicht async.
messenger.runtime.onMessageExternal.addListener((msg, sender) => {
  if (sender?.id !== NOVABIRD_ID || msg?.type !== 'phish:result' || !Number.isInteger(msg.messageId)) return;
  const facts = parseAiFacts(msg);
  if (!facts) return;
  rememberAiFacts(msg.messageId, facts);
  reevaluate(msg.messageId).catch((e) => console.warn('Neubewertung nach KI-Ergebnis', e?.message));
});
/** Bewertung neu rechnen, Tag anpassen und ein offenes Banner ersetzen. */
async function reevaluate(messageId) {
  verdictCache.delete(messageId);
  const verdict = await evaluate(messageId);
  const config = await getConfig();
  if (config.mode === 'shadow') return;
  if (config.tagMessages && verdict.level !== 'normal') { await ensureTags(); await applyTag(messageId, verdict.level); }
  for (const tab of await messenger.tabs.query({})) {
    const shown = await messenger.messageDisplay.getDisplayedMessages(tab.id).catch(() => null);
    if (shown?.messages?.length === 1 && shown.messages[0].id === messageId) {
      await messenger.tabs.sendMessage(tab.id, { type: 'verdictUpdate', verdict: verdict.level === 'normal' ? null : bannerPayload(verdict) }).catch(() => {});
    }
  }
}

const verdictCache = new Map();
// Ergebnisse der Fremdbild-Prüfung (nur mit Zustimmung): messageId -> { imageTexts, qrUrls }
const remoteExtras = new Map();

/** Welche eingebetteten Bilder lohnen OCR? Bilder, die als Link dienen, und Mails, die fast nur aus Bildern bestehen. */
function ocrCandidates(images, features) {
  const linked = new Set(features.links.filter((l) => l.hasImage && !l.text && l.imgSrc).map((l) => imageKey(l.imgSrc)));
  const mostlyImages = features.text.length < 400;   // Werbung besteht oft aus einem großen Bild mit wenig Text
  return images.filter((i) => linked.has(i.key) || mostlyImages);
}

/** Bewertung einer Mail. Gleichzeitige Aufrufe (neue Mail + Anzeige) teilen sich eine laufende Bewertung,
 *  damit Bilder, QR-Suche und OCR nicht doppelt laufen. */
function evaluate(messageId) {
  if (!verdictCache.has(messageId)) {
    const p = computeVerdict(messageId).catch((e) => { verdictCache.delete(messageId); throw e; });
    verdictCache.set(messageId, p);
    if (verdictCache.size > 500) verdictCache.delete(verdictCache.keys().next().value);
  }
  return verdictCache.get(messageId);
}

// Woran eine laufende Bewertung gerade arbeitet (für den Hinweis bei langsamer Prüfung, siehe getVerdict)
const verdictStep = new Map();
async function computeVerdict(messageId) {
  const step = (s) => verdictStep.set(messageId, s);
  try { return await computeVerdictSteps(messageId, step); } finally { verdictStep.delete(messageId); }
}
async function computeVerdictSteps(messageId, step) {
  step('Mail lesen');
  const config = await getConfig();
  const [header, headers, full] = await Promise.all([
    messenger.messages.get(messageId),
    messenger.messages.getHeaders(messageId),
    messenger.messages.getFull(messageId),
  ]);
  const extra = remoteExtras.get(messageId);
  step('Bilder und QR-Codes');
  const images = await loadEmbeddedImages(messageId).catch((e) => { console.warn('Bilder nicht lesbar', e?.message); return []; });
  const qrUrls = [...await findQrUrls(images).catch((e) => { console.warn('QR-Suche fehlgeschlagen', e?.message); return []; }), ...(extra?.qrUrls ?? [])];
  step('Anhänge');
  const attachmentScan = await scanAttachments(messageId).catch((e) => { console.warn('Anhänge nicht lesbar', e?.message); return {}; });
  const features = buildFeatures({ headers, parts: flattenParts(full), qrUrls, attachmentScan }, await authservConfig(config, header.folder?.accountId));
  let ocrLanguages = extra?.languages ?? [];
  let ocrMs = 0;
  if (config.ocr) {
    step('Texterkennung (OCR)');
    const ocr = await ocrImages(ocrCandidates(images, features), config.ocrLanguages, { parallel: config.ocrParallel });
    ocrMs = ocr.ms;
    features.imageTexts = { ...ocr.texts, ...(extra?.imageTexts ?? {}) };
    ocrLanguages = [...new Set([...ocr.languages, ...ocrLanguages])];
  } else if (extra) features.imageTexts = { ...extra.imageTexts };
  step('Adressbücher und Absender-Historie');
  const contacts = await getContacts();
  const idx = await loadSenderIndex();
  if (features.from && trustLevel(idx[features.from.address]) !== 'sent' && !contacts.addresses.has(features.from.address)) {
    await noteSentTo(features.from.address);
  }
  const hist = historyView(idx);
  const ctx = {
    contactsByName: contacts.byName, contactAddresses: contacts.addresses, contactDomains: contacts.domains,
    historyByName: hist.byName, history: hist.lookup, learnedNames: hist.learnedNames,
    threadFound: await threadFoundLocally(features),
  };
  let verdict = analyze(features, ctx, config);
  // KI nur bei Mails mit Hinweisen (unbekannte Absender haben immer mindestens "Neuer Absender"), nicht bei klar roten
  if (config.useNovaBirdAi && verdict.level !== 'dangerous' && verdict.signals.length && !config.trustedSenders.includes(features.from?.address)) {
    step('lokale KI');
    const ai = await askNovaBird(messageId);
    if (ai) { ctx.ai = ai; verdict = analyze(features, ctx, config); }
  }
  if (relatedCouldHelp(verdict)) {
    step('Bezug zu früheren Mails');
    const related = await findRelated(header, features, contacts, idx).catch((e) => { console.warn('Bezug-Suche', e?.message); return null; });
    if (related) verdict = analyze(features, { ...ctx, related }, config);
  }
  return { ...verdict, messageId, headerMessageId: header.headerMessageId, author: features.from?.address, ocrLanguages, ocrMs };
}

// ---------- Tags ----------
async function ensureTags() {
  const existing = new Set((await messenger.messages.tags.list()).map((x) => x.key));
  for (const level of ['suspicious', 'dangerous']) {
    const key = TAG_KEYS[level];
    if (!existing.has(key)) await messenger.messages.tags.create(key, t(lang(), 'tag_' + level), TAG_COLORS[level]);
  }
}
async function applyTag(messageId, level) {
  if (level === 'normal') return;
  const msg = await messenger.messages.get(messageId);
  const keep = (msg.tags ?? []).filter((k) => !Object.values(TAG_KEYS).includes(k));
  await messenger.messages.update(messageId, { tags: [...keep, TAG_KEYS[level]] });
}

// ---------- Schattenmodus: Protokoll ohne Adressen ----------
// Jede Mail nur einmal (nicht bei jedem Anzeigen erneut); Schreibvorgänge nacheinander, damit keiner verloren geht.
let shadowQueue = Promise.resolve();
function shadowLog(verdict) {
  shadowQueue = shadowQueue.then(async () => {
    const { shadowLog: log = [] } = await messenger.storage.local.get('shadowLog');
    if (verdict.headerMessageId && log.some((e) => e.id === verdict.headerMessageId)) return;
    log.push({
      t: Date.now(), id: verdict.headerMessageId, score: verdict.score, level: verdict.level,
      signals: verdict.signals.map((s) => s.id),
    });
    await messenger.storage.local.set({ shadowLog: log.slice(-SHADOW_LOG_MAX) });
  }).catch((e) => console.warn('Schattenprotokoll', e?.message));
  return shadowQueue;
}

// ---------- Ereignisse ----------
messenger.messages.onNewMailReceived.addListener(async (folder, list) => {
  const config = await getConfig();
  const idx = await loadSenderIndex();
  const skipFolder = new Set(config.historyExcludedFolders).has(folderKey(folder));
  for (const m of list.messages) {
    try {
      const verdict = await evaluate(m.id);
      await countAuthserv(folder, m.id).catch((e) => console.warn('authserv-id', e?.message));
      if (config.mode === 'shadow') await shadowLog(verdict);
      else if (config.tagMessages) { await ensureTags(); await applyTag(m.id, verdict.level); }
      // erst nach der Bewertung zählen, und nur unauffällige Mails; Spam und auffällige Mails markieren den Absender
      if (!skipFolder) {
        for (const a of parseAddressList(m.author)) {
          if (m.junk || verdict.level !== 'normal') flagRecord(idx, a.address);
          else noteRecord(idx, a, 'n', msgTime(m));
        }
      }
    } catch (e) { console.warn('Bewertung fehlgeschlagen', e); }
  }
  saveSenderIndexSoon();
}, true);

function reasons(verdict) {
  const out = verdict.signals.map((s) => {
    const key = 'sig_' + s.id + (s.id === 'lookalikeDomain' ? '_' + s.params[2] : '');
    return { id: s.id, weight: s.weight, text: t(lang(), key, s.params) };
  });
  // Bezug gefunden, aber trotzdem eine Warnung: zeigen, damit klar ist, dass er berücksichtigt wurde
  if (verdict.related) {
    const day = new Date(verdict.related.date).toLocaleDateString(lang());
    out.push({ id: 'related', weight: 0, text: t(lang(), 'info_related', [verdict.related.anchor, day]) });
  }
  return out;
}

function bannerPayload(verdict) {
  return { level: verdict.level, score: verdict.score, kind: verdict.signals.some((s) => s.id === 'extortion') ? 'extortion' : null, reasons: reasons(verdict), ui: uiStrings(lang()), ocrLanguages: verdict.ocrLanguages ?? [], ocrMs: verdict.ocrMs ?? 0 };
}

const SLOW_VERDICT_MS = 10_000;
// In einem Testaufbau antwortete getDisplayedMessages nie. Dann lieber nach kurzer Zeit "nicht geprüft" (Links fragen
// nach) als ewig warten. Bewusst kein Ersatz über zuletzt gemeldete Anzeigen (onMessagesDisplayed): kommt die Meldung
// verspätet, bekäme eine Mail die Bewertung der vorigen – eine Phishing-Mail womöglich "harmlos".
const DISPLAYED_TIMEOUT_MS = 3000;
async function displayedMessageId(sender) {
  if (!sender.tab) return null;
  let timer;
  const shown = await Promise.race([
    messenger.messageDisplay.getDisplayedMessages(sender.tab.id),
    new Promise((resolve) => { timer = setTimeout(() => resolve(null), DISPLAYED_TIMEOUT_MS); }),
  ]).finally(() => clearTimeout(timer));
  if (!shown) {
    console.warn(`Novabird-phishing: Thunderbird nennt die angezeigte Mail nicht (nach ${DISPLAYED_TIMEOUT_MS / 1000} s) – Mail gilt als nicht geprüft`);
    return null;
  }
  return shown.messages.length === 1 ? shown.messages[0].id : null;
}

// req: woran die Anfrage gerade arbeitet (für den Hinweis bei langsamer Bearbeitung im onMessage-Listener)
async function handleMessage(msg, sender, req = {}) {
  req.step = 'Einstellungen laden';
  const config = await getConfig();
  if (msg.type === 'showDownloads') { await messenger.downloads.showDefaultFolder(); return true; }
  if (msg.type === 'rescanHistory') { await ensureScan({ force: true }); return true; }   // aus den Einstellungen
  // Vom Nutzer im Banner-Dialog bestätigter Link (bei "gefährlich"): im Standardbrowser öffnen. Ein nachgestellter
  // Klick aus dem Skript wäre ein "untrusted" Event, das Thunderbird nicht zuverlässig als Link-Klick behandelt.
  if (msg.type === 'openLink') {
    let url;
    try { url = new URL(msg.url); } catch { return false; }
    if (!sender.tab || !/^https?:$/.test(url.protocol)) return false;
    await messenger.windows.openDefaultBrowser(url.href);
    return true;
  }
  // Texte und Modus für die Link-Sperre im Banner, bevor die Bewertung fertig ist
  if (msg.type === 'linkInfo') return { ui: uiStrings(lang()), off: config.mode === 'shadow' };
  req.step = 'angezeigte Mail ermitteln';
  const id = await displayedMessageId(sender);
  if (id === null) return null;
  req.id = id;
  req.step = 'Bewertung';

  if (msg.type === 'getVerdict') {
    let verdict;
    try {
      verdict = await evaluate(id);
      // Gehört die gemerkte Bewertung noch zu dieser Mail? (ids sind je Sitzung eindeutig; Absicherung, falls
      // Thunderbird eine id nach Reparatur eines Ordners doch einer anderen Mail zuordnet)
      if (verdict.headerMessageId !== (await messenger.messages.get(id)).headerMessageId) {
        verdictCache.delete(id);
        verdict = await evaluate(id);
      }
    } catch (e) {
      // Prüfung gescheitert (Mail nicht lesbar, interner Fehler): nicht stumm "keine Warnung" zeigen, sondern "ungeprüft"
      console.error('Bewertung fehlgeschlagen', e?.message, e?.stack);
      return { verdict: config.mode === 'shadow' ? null : { level: 'error', ui: uiStrings(lang()) }, remote: false };
    }
    if (config.mode === 'shadow') { await shadowLog(verdict); return { verdict: null, remote: false }; }
    return {
      verdict: verdict.level === 'normal' ? null : bannerPayload(verdict),
      // Soll das Skript nachgeladene Fremdbilder melden? (Einstellung + Berechtigung + noch nicht geprüft)
      remote: !remoteExtras.has(id) && await remoteScanAllowed(config),
    };
  }

  if (msg.type === 'remoteImages') {
    if (config.mode === 'shadow' || remoteExtras.has(id) || !await remoteScanAllowed(config)) return null;
    const fetched = await fetchRemoteImages(msg.items ?? []);
    const extra = { imageTexts: {}, qrUrls: [], languages: [] };
    if (fetched.length) {
      extra.qrUrls = await findQrUrls(fetched).catch(() => []);
      if (config.ocr) {
        const ocr = await ocrImages(fetched, config.ocrLanguages, { parallel: config.ocrParallel });
        extra.imageTexts = ocr.texts;
        extra.languages = ocr.languages;
      }
    }
    remoteExtras.set(id, extra);
    verdictCache.delete(id);
    const verdict = await evaluate(id);
    return verdict.level === 'normal' ? null : bannerPayload(verdict);
  }

  if (msg.type === 'trustSender') {
    const verdict = await evaluate(id);
    // "gefährlich" lässt sich nicht per Klick entwarnen – nur bewusst über die Einstellungen
    if (verdict.level === 'dangerous') return false;
    if (verdict.author && !config.trustedSenders.includes(verdict.author)) {
      const { config: stored = {}, trustMeta = {} } = await messenger.storage.local.get(['config', 'trustMeta']);
      stored.trustedSenders = [...(stored.trustedSenders ?? []), verdict.author];
      // Warum und wann vertraut wurde, damit sich der Eintrag in den Einstellungen später einordnen und löschen lässt
      trustMeta[verdict.author] = {
        date: Date.now(), score: verdict.score, level: verdict.level, via: 'banner',
        reasons: reasons(verdict).map((r) => r.text.slice(0, 160)).slice(0, 8),
      };
      await messenger.storage.local.set({ config: stored, trustMeta });
    }
    // Warn-Tag dieser Mail entfernen, damit auch die Nachrichtenliste nicht mehr warnt
    const shown = await messenger.messages.get(id).catch(() => null);
    if (shown?.tags?.some((k) => Object.values(TAG_KEYS).includes(k))) {
      await messenger.messages.update(id, { tags: shown.tags.filter((k) => !Object.values(TAG_KEYS).includes(k)) });
    }
    return true;
  }
  return null;
}

messenger.runtime.onMessage.addListener(async (msg, sender) => {
  // Hängt eine Anfrage des Banners? Hinweis in der Fehlerkonsole (Extras → Entwicklerwerkzeuge), gemessen ab Eingang –
  // also auch, wenn es schon vor der eigentlichen Bewertung stockt. Die Link-Sperre bleibt solange zu und fragt nach.
  const req = { step: 'Anfrage angenommen', id: null };
  const watched = msg?.type === 'getVerdict' || msg?.type === 'linkInfo';
  const started = Date.now();
  const where = () => (req.id !== null && verdictStep.get(req.id)) || req.step;
  const slow = watched && setTimeout(() => console.warn(`Novabird-phishing: ${msg.type}${req.id !== null ? ` (Mail ${req.id})` : ''} dauert über ${SLOW_VERDICT_MS / 1000} s, gerade: ${where()}`), SLOW_VERDICT_MS);
  try {
    return await handleMessage(msg ?? {}, sender, req);
  } catch (e) {
    console.error('PhishingPilot onMessage', msg?.type, e.message, e.stack);
    return null;
  } finally {
    if (watched) {
      clearTimeout(slow);
      if (Date.now() - started > SLOW_VERDICT_MS) console.warn(`Novabird-phishing: ${msg.type} nach ${Date.now() - started} ms fertig`);
    }
  }
});

// ---------- Mails anonymisiert speichern (Rechtsklick in der Nachrichtenliste) ----------
// Damit Nutzer Phishing-Beispiele weitergeben können: eigene Adressen/Namen, Empfänger, private Domains, Postanschriften
// und persönliche Link-Kennungen werden ersetzt, Anhänge außer Bildern geleert (lib/anonymize.js).
const ANON_MENU = 'pp-anonymize';
const ANON_MAX = 50;
async function setupMenus() {
  await messenger.menus.removeAll().catch(() => {});
  messenger.menus.create({ id: ANON_MENU, title: t(lang(), 'anon_menu'), contexts: ['message_list'] });
}
async function ownIdentity() {
  const addresses = [], names = [];
  for (const account of await messenger.accounts.list(false)) {
    for (const id of account.identities ?? []) {
      if (id.email) addresses.push(id.email.toLowerCase());
      if (id.name) names.push(id.name);
    }
  }
  return { addresses: [...new Set(addresses)], names: [...new Set(names)] };
}
async function saveAnonymized(messages) {
  const own = await ownIdentity();
  const total = { addresses: 0, names: 0, domains: 0, postal: 0, links: 0, attachments: 0 };
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  let saved = 0, error = null;
  for (const [i, m] of messages.slice(0, ANON_MAX).entries()) {
    try {
      const raw = await messenger.messages.getRaw(m.id, { data_format: 'BinaryString' });
      const { raw: anon, report } = anonymizeEml(typeof raw === 'string' ? raw : await raw.text(), own);
      for (const k in total) total[k] += report[k] ?? 0;
      const url = URL.createObjectURL(new Blob([Uint8Array.from(anon, (c) => c.charCodeAt(0) & 0xff)], { type: 'message/rfc822' }));
      await messenger.downloads.download({ url, filename: `novabird-anonym/sample-${stamp}-${i + 1}.eml`, saveAs: false, conflictAction: 'uniquify' });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      saved++;
    } catch (e) { error = e?.message ?? String(e); console.warn('Anonymisieren fehlgeschlagen', error); }
  }
  const q = new URLSearchParams({ n: String(saved), r: JSON.stringify(total), e: error ?? '' });
  await messenger.windows.create({ url: messenger.runtime.getURL(`anon/report.html?${q}`), type: 'popup', width: 480, height: 330 });
}
messenger.menus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== ANON_MENU) return;
  let list = info.selectedMessages;
  const messages = [...(list?.messages ?? [])];
  while (list?.id && messages.length < ANON_MAX) { list = await messenger.messages.continueList(list.id); messages.push(...list.messages); }
  await saveAnonymized(messages).catch((e) => console.warn('Anonymisieren', e?.message));
});

// ---------- Einrichtungsdialog (einmalig): vertrauenswürdige Adressbücher wählen ----------
// Auch nach einem Update einmal, solange der Haftungshinweis noch nicht bestätigt ist (ab 0.9.1)
const ONBOARDING = { width: 520, height: 680 };
async function showOnboardingOnce() {
  const { onboardingDone, disclaimerAccepted } = await messenger.storage.local.get(['onboardingDone', 'disclaimerAccepted']);
  if (onboardingDone && disclaimerAccepted) return;
  const url = messenger.runtime.getURL('onboarding/onboarding.html');
  for (const w of await messenger.windows.getAll({ populate: true })) {
    if (w.tabs?.some((tab) => tab.url === url)) { await messenger.windows.update(w.id, { focused: true }); return; }
  }
  // mittig über dem Hauptfenster, leicht nach oben versetzt (wie ein Overlay)
  const main = (await messenger.windows.getAll({ windowTypes: ['normal'] })).find((w) => w.focused) ??
    (await messenger.windows.getAll({ windowTypes: ['normal'] }))[0];
  const pos = main ? {
    left: Math.round(main.left + (main.width - ONBOARDING.width) / 2),
    top: Math.round(main.top + Math.max(40, (main.height - ONBOARDING.height) / 3)),
  } : {};
  await messenger.windows.create({ url, type: 'popup', ...ONBOARDING, ...pos });
}

// Beim Start des Hintergrundskripts (auch nach Installation/Update), nur wenn der Index fehlt oder veraltet ist
ensureScan().catch(console.warn);
setupMenus().catch((e) => console.warn('Menü', e?.message));
showOnboardingOnce().catch((e) => console.warn('Einrichtungsdialog', e?.message));
