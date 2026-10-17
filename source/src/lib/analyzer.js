import {
  FREEMAIL, hasMixedScript, hasPunycode, isIp, lookalike, looksRandomDomain, mainLabel, registrableDomain, toUnicodeHost,
} from './domains.js';
import { addressDomain } from './headers.js';
import { buildFeatures, imageKey } from './features.js';
import { RISKY_EXT } from './files.js';
import { detectExtortion } from './scam.js';
import { domainSkeleton, nameKey, normalizeText, skeleton } from './text.js';
import { mergeConfig } from './config.js';
import BRANDS from '../data/brands.js';
import WIKIDATA_BANKS from '../data/banks-wikidata.js';

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly',
  'cutt.ly', 'shorturl.at', 'tiny.cc', 'rb.gy', 'lnkd.in', 'bit.do', 't.ly',
  'clck.ru', 'v.gd', 'shorte.st', 'adf.ly', 'urlz.fr', 'qr.net', 'tr.ee', 'soo.gd', 's.id', 'bl.ink', 'ift.tt', 'dlvr.it', 'bitly.com', 'vk.cc', 'cli.re',
]);
const PRESSURE = [
  'dringend', 'sofort', 'ihr konto', 'gesperrt', 'verifizieren', 'bestatigen sie', 'letzte warnung',
  'innerhalb von 24', 'passwort lauft ab', 'zahlung fehlgeschlagen', 'konnte nicht zugestellt',
  'urgent', 'immediately', 'suspended', 'verify your', 'final notice', 'your account will',
  'unusual activity', 'security alert', 'confirm your',
];
// Dienste, auf denen jeder Seiten oder Weiterleitungen anlegen kann (häufig für Phishing missbraucht).
const ABUSED_HOST = [
  /^apis\.google\.com$/, /(^|\.)storage\.googleapis\.com$/, /(^|\.)s3[.-][a-z0-9.-]*amazonaws\.com$/,
  /\.web\.app$/, /\.firebaseapp\.com$/, /\.pages\.dev$/, /\.workers\.dev$/, /\.r2\.dev$/,
  /\.netlify\.app$/, /\.github\.io$/, /\.weebly\.com$/, /\.wixsite\.com$/, /\.blogspot\.com$/,
  /(^|\.)saga\.so$/, /\.notion\.site$/, /\.canva\.site$/, /\.carrd\.co$/, /\.framer\.(website|app)$/,
  /\.webflow\.io$/, /\.typedream\.app$/, /\.softr\.app$/, /\.bubbleapps\.io$/, /^sites\.google\.com$/,
  /\.glitch\.me$/, /\.herokuapp\.com$/, /(^|\.)ipfs\.io$/, /\.blob\.core\.windows\.net$/,
];
// Häufige, legitime Ziele von Signatur-Icons (Bild-Links).
const SOCIAL = new Set(['linkedin.com', 'xing.com', 'facebook.com', 'instagram.com', 'youtube.com', 'twitter.com', 'x.com', 'kununu.com', 'whatsapp.com']);
// Aufforderungen auf Köder-Bildern ("Dokument anzeigen"), ohne Diakritika und Leerzeichen verglichen.
const IMAGE_CTA = ['anzeigen', 'offnen', 'freigegeben', 'zugesandt', 'herunterladen', 'download', 'viewdocument',
  'reviewdocument', 'opendocument', 'jetztprufen', 'jetztanmelden', 'anmelden', 'signin', 'login', 'verify', 'bestatigen'];
const compact = (s) => skeleton(s).replace(/[^\p{L}\p{N}]+/gu, '');
// Wörter, mit denen Köder-Bilder beschriftet sind – ein solches Bild ist nie "das Logo der Zielseite"
const BAIT_ALT = /dokument|document|datei|file|rechnung|invoice|scan|pdf|fax|freigabe|share|onedrive|sharepoint|dropbox|docusign|voicemail|nachricht|message|konto|account|login|sign/;
/** Logo, dessen Alt-Text die Zieldomain nennt ("Valve" -> valvesoftware.com): ein Hinweis auf eine Schwesterfirma, kein Köder. */
function logoOfTarget(alt, rd) {
  const label = skeleton(mainLabel(rd)).replace(/[^a-z0-9]+/g, '');
  const a = skeleton(alt || '');
  if (BAIT_ALT.test(a) || IMAGE_CTA.some((w) => compact(alt || '').includes(w))) return false;
  return a.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').some((w) => w.length >= 4 && !ORG_KEY_STOP.has(w) && label.includes(w));
}
// Anlage-/Krypto-Köder (Spam, der an das Geld will): mindestens zwei verschiedene Begriffe plus Dringlichkeit/Verlockung
const INVEST_TERMS = ['bitcoin', 'krypto', 'crypto', 'ethereum', 'trading', 'forex', 'rendite', 'investier', 'invest in', 'anlagetipp',
  'passives einkommen', 'passive income', 'garantiert', 'reich werden', 'verdopp', 'handelsplattform', 'broker', 'einstiegspunkt', 'abschwung'];
const INVEST_HOOKS = ['jetzt', 'idealer', 'einstieg', 'chance', 'nur noch', 'heute', 'limited', 'exklusiv', 'dringend', 'now', '!!'];
const ACCOUNT_WORDS = ['konto', 'zahlung', 'abonnement', 'passwort', 'payment', 'account', 'subscription', 'verifiz', 'bestatigen', 'sperr', 'gekundigt', 'abgelaufen'];
const PASSWORD_HINT = /passwor|kennwort|password/i;
const LEVELS = ['normal', 'suspicious', 'dangerous'];
// Top-Level-Domains, die überdurchschnittlich oft für Spam/Phishing genutzt werden (billig oder kostenlos, kaum Kontrolle).
// Nur ein schwaches Signal: Es gibt dort auch echte Seiten. .zip/.mov sehen zudem wie Dateinamen aus.
const BAD_TLDS = new Set(['zip', 'mov', 'click', 'surf', 'live', 'sbs', 'date', 'pw', 'quest', 'biz', 'top', 'gq', 'ml', 'cf', 'ga',
  'tk', 'bid', 'xyz', 'country', 'stream', 'download', 'loan', 'win', 'men', 'club', 'work', 'icu', 'cfd', 'cyou', 'rest', 'buzz', 'monster']);
export function badTld(host) {
  const tld = String(host || '').toLowerCase().replace(/\.$/, '').split('.').pop();
  return BAD_TLDS.has(tld) ? tld : '';
}

// Lieferdienste werden in Shop-Mails ständig erwähnt ("wird von Hermes zugestellt"), das ist kein Markenvorgeben
const CARRIERS = new Set(['dhl', 'deutschepost', 'hermes', 'dpd', 'ups', 'gls', 'fedex', 'postat', 'postch', 'postnl', 'laposte', 'bpost', 'inpost']);
// Microsoft/Anbieter-Linkumschreiber, die jeden Link über eine eigene Domain führen
const LINK_WRAPPERS = /(^|\.)(safelinks\.protection\.outlook\.com|safelink\.emails\.azure\.net)$/i;
// Regionale Banken haben eigene Domains (vb-mittelhessen.de); enge Muster, ohne typische Phishing-Wörter
const BRAND_PATTERNS = { volksbank: /^(vb|vr|vrb|rb)-[a-z0-9-]+\.de$|^[a-z0-9-]*(volksbank|raiffeisenbank|vrbank)[a-z0-9-]*\.de$/, sparkasse: /^(sparkasse|ksk|s)-[a-z0-9-]+\.de$|^[a-z0-9-]*sparkasse[a-z0-9-]*\.de$/,
  sparda: /^sparda-[a-z0-9-]+\.de$/ };
const PHISHY_WORDS = /secure|login|konto|verif|update|support|service|sicher|confirm|account|online-?banking/;
// Banken in EU-Ländern (Wikidata): Domain -> Namen, Namensschlüssel -> Domains
const BANK_NAMES_BY_DOMAIN = new Map();
const BANK_DOMAINS_BY_KEY = new Map();
function brandOwns(b, rd) {
  if (b.domains.includes(rd)) return true;
  // Wikidata-Bank, deren Name die Marke enthält ("Dornbirner Sparkasse" auf sparkasse.at, "UniCredit Bank Austria" auf bankaustria.at)
  const wd = BANK_NAMES_BY_DOMAIN.get(rd);
  if (wd && b.names.some((n) => wd.includes(n))) return true;
  const re = BRAND_PATTERNS[b.id];
  return !!(re && re.test(rd) && !PHISHY_WORDS.test(rd));
}
/** Lookalike-Treffer, der in Wahrheit der Marke selbst gehört (regionale Banken: sparkasse-koelnbonn.de)? */
function ownedLookalike(hit, rd) {
  const b = BRANDS.find((x) => x.domains.includes(hit.target));
  return !!(b && brandOwns(b, rd)) || BANK_NAMES_BY_DOMAIN.has(rd);
}
const brandDomains = BRANDS.flatMap((b) => b.domains);
// Anzeigename ohne jeden Bezug zur Absender-Domain. Bei Personen und Diensten über Versanddienstleister häufig (schwach),
// bei Namen, die eine Organisation behaupten ("Deutsche Kreditbank-AG" von kindercomicfestival.de), ein starkes Zeichen.
const NAME_STOP = new Set(['der', 'die', 'das', 'und', 'ihr', 'ihre', 'von', 'the', 'and', 'team', 'service', 'info', 'news',
  'newsletter', 'kundenservice', 'support', 'gmbh', 'noreply', 'mail', 'online', 'deutschland', 'germany']);
const ORG_WORDS = new Set(['ag', 'gmbh', 'kg', 'eg', 'bank', 'postfach', 'kundenportal', 'kundenservice', 'kundendienst', 'support',
  'service', 'abrechnungsstelle', 'verwaltung', 'sicherheit', 'security', 'finanzamt', 'behorde', 'kundenkonto']);
const ORG_SUFFIX = /(bank|kasse|versicherung|service|portal|zentrale|abteilung)$/;
// Aus dem eigenen Postfach gelernte Absendernamen ("Galaxus" schreibt von galaxus.de). Schlüssel ohne Rechtsform und Füllwörter.
const ORG_KEY_STOP = new Set([...NAME_STOP, 'ag', 'gmbh', 'kg', 'eg', 'se', 'co', 'inc', 'ltd', 'llc', 'sa', 'bv', 'nv', 'de', 'com',
  'kundendienst', 'postfach', 'rechnung', 'rechnungen', 'bestellung', 'versand', 'no', 'reply', 'do', 'not', 'mitteilung',
  'benachrichtigung', 'alerts', 'alert', 'hello', 'hallo', 'sales', 'marketing', 'office', 'buchhaltung', 'shop']);
export function orgKey(name) {
  const words = skeleton(name || '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter((t) => t.length >= 2 && !ORG_KEY_STOP.has(t));
  const key = words.join(' ');
  return key.replace(/ /g, '').length >= 4 ? key : '';
}
/** Passt der Name zur Domain selbst (nicht nur zum lokalen Teil der Adresse)? Nur dann wird gelernt. */
export function nameMatchesDomain(name, rd) {
  const label = skeleton(mainLabel(rd)).replace(/[^a-z0-9]+/g, '');
  const words = skeleton(name || '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter((t) => t.length >= 3 && !ORG_KEY_STOP.has(t));
  return label.length >= 3 && words.some((w) => label.includes(w) || (w.length >= 4 && label.includes(w.slice(0, 4))));
}

// Für die Namensprüfung nur Namen mit Bankwort, die nicht nur aus dem Bankwort bestehen – sonst träfe es Vornamen
// ("Alex", eine niederländische Bank) oder Gattungsbegriffe ("Bank", "Banca", "Volksbank").
const BANK_WORD = /bank|banca|banco|banque|kasse|caixa|caisse|cassa|pankki|bankas|sporitel|kasa|kredit|credit|giro|raiffeisen|saasto|spar/;
const BANK_GENERIC = new Set(['bank', 'banka', 'banca', 'banco', 'banque', 'pankki', 'bankas', 'volksbank', 'raiffeisenbank', 'sparkasse',
  'caixa', 'kasa', 'kreditbank', 'landesbank', 'privatbank', 'sparbank', 'direktbank', 'onlinebank']);
for (const bank of WIKIDATA_BANKS) {
  const names = [bank.n, ...(bank.a ?? [])];
  for (const d of bank.d) BANK_NAMES_BY_DOMAIN.set(d, `${BANK_NAMES_BY_DOMAIN.get(d) ?? ''} ${names.map((n) => skeleton(n)).join(' ')}`);
  for (const n of names) {
    const k = orgKey(n);
    if (!k || BANK_GENERIC.has(k) || !BANK_WORD.test(k)) continue;
    if (!BANK_DOMAINS_BY_KEY.has(k)) BANK_DOMAINS_BY_KEY.set(k, new Set());
    bank.d.forEach((d) => BANK_DOMAINS_BY_KEY.get(k).add(d));
  }
}

/** Ist die Domain ein Kürzel des Namens? ("haspa" = HAmburger SPArkasse, "dkb" = Deutsche KreditBank, "sskm") –
 *  gleicher Anfangsbuchstabe, höchstens 6 Zeichen, Buchstaben in dieser Reihenfolge im Namen. */
function isAcronymOf(label, name) {
  const letters = skeleton(name).replace(/[^a-z0-9]+/g, '');
  if (label.length < 2 || label.length > 6 || label[0] !== letters[0]) return false;
  let i = 0;
  for (const ch of letters) if (ch === label[i]) i++;
  return i === label.length;
}

function nameDomainRelation(name, address) {
  const tokens = skeleton(name).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
  const dom = skeleton(address).replace(/[^a-z0-9]+/g, '');
  const words = tokens.filter((t) => t.length >= 3 && !NAME_STOP.has(t));
  if (!words.length) return null;                                   // nur Füllwörter ("Info", "Service-Team"): keine Aussage
  if (words.some((t) => dom.includes(t) || (t.length >= 4 && dom.includes(t.slice(0, 4))))) return null;
  const rd = registrableDomain(address.slice(address.lastIndexOf('@') + 1));
  if (isAcronymOf(skeleton(mainLabel(rd)).replace(/[^a-z0-9]+/g, ''), name) || BANK_NAMES_BY_DOMAIN.has(rd)) return null;
  return tokens.some((t) => ORG_WORDS.has(t) || ORG_SUFFIX.test(t)) ? 'org' : 'other';
}
// Kurze Markennamen (DKB, ING, N26, DHL …) träfen als Wortteil zu oft; sie zählen nur als großgeschriebenes eigenes Wort
const shortBrandRe = new Map();
function shortBrandIn(raw, name) {
  if (!shortBrandRe.has(name)) {
    const esc = name.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    shortBrandRe.set(name, new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'u'));
  }
  return shortBrandRe.get(name).test(raw);
}
// Pflicht-Links, die ins Leere führen (href="#"): typisch für Phishing-Baukästen, die nur den Köder-Link befüllen
const LEGAL_LINK = /impressum|datenschutz|imprint|privacy|agb|nutzungsbedingungen|terms|hilfe|\bhelp\b|faq|kontakt|contact|legal|cookie|abmelden|abbestellen|unsubscribe/i;
const DEAD_HREF = /^\s*(#.*)?$|^\s*javascript:/i;

function maxLevel(a, b) { return LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b; }

function hostOf(href) {
  try {
    const u = new URL(href);
    if (!/^https?:$/.test(u.protocol)) return null;
    return { url: u, host: u.hostname.replace(/^\[|\]$/g, '').toLowerCase() };
  } catch { return null; }
}

// Endungen, die im Linktext Dateinamen oder Technik-Namen sind ("Rechnung.pdf", "Node.js"), keine Domains
const FILE_ENDINGS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt', 'csv',
  'xml', 'json', 'zip', 'rar', 'gz', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'htm', 'html',
  'php', 'asp', 'aspx', 'jsp', 'cgi', 'js', 'ts', 'css', 'exe', 'msi', 'dmg', 'apk', 'mp3', 'mp4', 'm4a', 'mov', 'avi',
  'wav', 'ogg', 'ics', 'vcf', 'eml', 'msg', 'log', 'bak', 'dll', 'jar', 'py', 'sh', 'md']);

function textDomain(text) {
  for (const m of text.matchAll(/(?:https?:\/\/)?((?:[a-z0-9-]+\.)+([a-z]{2,}))(?::\d+)?(?=[\/\s?#),;:!.]|$)/gi)) {
    // mit "http(s)://" davor ist es sicher eine Adresse, sonst keine Dateiendung
    if (/^https?:/i.test(m[0]) || !FILE_ENDINGS.has(m[2].toLowerCase())) return m[1].toLowerCase();
  }
  return null;
}

/**
 * Bewertet eine Nachricht.
 * @param features Ergebnis von buildFeatures
 * @param ctx { contactsByName: Map<key,Set<addr>>, contactAddresses:Set, contactDomains:Set,
 *              historyByName: Map<key,Map<addr,count>>, history:(addr)=>{count}|null,
 *              threadFound: boolean|undefined, ownDomains?:string[] }
 */
export function analyze(features, ctx = {}, userConfig = {}) {
  const cfg = mergeConfig(userConfig);
  const signals = [];
  const add = (id, params = []) => signals.push({ id, weight: cfg.weights[id] ?? 0, params });
  const f = features;
  const from = f.from;
  if (!from) return result([], cfg);

  const fromRd = addressDomain(from);
  const hist = ctx.history?.(from.address) ?? null;
  const isContact = !!ctx.contactAddresses?.has(from.address);
  // Voll bekannt nur Kontakte und Adressen, denen man geschrieben hat. "Oft empfangen" (level 'recurring') nimmt
  // nur den Erstkontakt-Hinweis weg – sonst würde hartnäckiger Spam mit der Zeit legitimiert.
  const histLevel = hist ? (hist.level ?? 'sent') : null;
  const known = isContact || histLevel === 'sent';
  const userDomains = [...new Set([...(ctx.contactDomains ?? []), ...(ctx.ownDomains ?? []), ...cfg.ownDomains])];
  // List-Unsubscribe kann jeder Absender setzen. Lockerungen für Newsletter gelten deshalb nur, wenn der eigene
  // Server eine gültige DKIM-Signatur der Absender-Domain meldet oder der Absender etabliert ist.
  const dkimAligned = (f.auth.dkimDomains ?? []).some((d) => registrableDomain(d) === fromRd);
  const trustedList = f.isList && (dkimAligned || known);

  // --- Authentifizierung (nur eigener Server) ---
  if (f.auth.dmarc === 'fail') add('dmarcFail');
  else if (f.auth.spf === 'fail' || f.auth.spf === 'softfail') add('spfFail', [f.auth.spf]);
  if (f.auth.dkim === 'fail') add('dkimFail');

  // --- Kontakt-Imitation: Name bekannt, Adresse neu ---
  const key = nameKey(from.name);
  if (key) {
    const addrs = new Set(ctx.contactsByName?.get(key) ?? []);
    for (const [addr, count] of ctx.historyByName?.get(key) ?? []) if (count >= 2) addrs.add(addr);
    if (addrs.size && !addrs.has(from.address)) {
      const sameOrg = [...addrs].some((a) => {
        const rd = registrableDomain(a.slice(a.lastIndexOf('@') + 1));
        return rd === fromRd && !FREEMAIL.has(rd);
      });
      if (!sameOrg) add('contactImpersonation', [from.name, [...addrs][0]]);
    }
  }

  // --- Gelernter Absendername von neuer Domain ("Galaxus" schreibt sonst von galaxus.de) ---
  // Nur für neue Adressen: Wer selbst schon länger schreibt (z. B. über einen Versanddienstleister), ist nicht gemeint.
  if (ctx.learnedNames && !hist && !isContact && !signals.some((s) => s.id === 'contactImpersonation')) {
    const k = orgKey(from.name);
    const rds = k ? ctx.learnedNames.get(k) : null;
    if (rds && !rds.has(fromRd) && ![...rds].some((rd) => mainLabel(rd) === mainLabel(fromRd))) {
      add('learnedNameMismatch', [from.name.slice(0, 60), [...rds][0]]);
    }
  }

  // --- Thread-Prüfung ---
  if (f.isReplySubject && !(f.isList && known)) {
    if (!f.inReplyTo.length && !f.references.length) add('replyNoThread');
    else if (ctx.threadFound === false) add('replyThreadUnknown');
  }

  // --- Absender-Domain ---
  const fromHost = toUnicodeHost(from.domain);
  let lookalikeHit = null;
  let brandHit = lookalike(fromHost, brandDomains);
  if (brandHit && ownedLookalike(brandHit, fromRd)) brandHit = null;
  if (brandHit) lookalikeHit = { where: 'sender', host: registrableDomain(fromHost), ...brandHit };
  else if (userDomains.length) {
    const own = lookalike(fromHost, userDomains, { structural: false });
    if (own) lookalikeHit = { where: 'sender', host: registrableDomain(fromHost), ...own };
  }
  if (hasMixedScript(from.domain)) add('mixedScript', [fromHost]);

  // --- Marke im Anzeigenamen, aber fremde Domain ---
  const nameNorm = ' ' + domainSkeleton(from.name).replace(/[^a-z0-9&]+/g, ' ') + ' ';
  let brandClaimed = false;
  for (const b of BRANDS) {
    if (b.names.some((n) => nameNorm.includes(' ' + domainSkeleton(n) + ' ')) && !brandOwns(b, fromRd)) {
      add('brandNameMismatch', [b.id, fromRd]);
      brandClaimed = true;
      break;
    }
  }
  // Name einer Bank aus der Wikidata-Liste, aber eine fremde Domain (höchstens "verdächtig": die Liste kennt oft nur die Hauptdomain)
  if (!brandClaimed && !known) {
    const k = orgKey(from.name);
    const rds = k ? BANK_DOMAINS_BY_KEY.get(k) : null;
    if (rds && !rds.has(fromRd) && !BANK_NAMES_BY_DOMAIN.has(fromRd)) { add('bankNameMismatch', [from.name.slice(0, 60), [...rds][0]]); brandClaimed = true; }
  }
  // auch bei "oft empfangen" (nur voll bekannte Absender sind ausgenommen): allein reicht es dort nicht für eine Warnung,
  // weil der Erstkontakt-Hinweis fehlt – zusammen mit anderen Hinweisen aber schon
  if (!brandClaimed && !known && from.name) {
    const rel = nameDomainRelation(from.name, from.address);
    if (rel === 'org') add('orgNameMismatch', [from.name.slice(0, 60), fromRd]);
    else if (rel === 'other') add('nameDomainMismatch', [from.name.slice(0, 60), fromRd]);
  }
  const nameMail = from.name.match(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/);
  if (nameMail && registrableDomain(nameMail[1].toLowerCase()) !== fromRd) add('displayNameEmail', [nameMail[0]]);

  // --- Reply-To ---
  // Gleicher Firmenname unter anderer Endung (enjoy.eset.com → eset.de) zählt als dieselbe Firma – aber nur, wenn
  // der Absender per DKIM bestätigt oder bekannt ist; sonst könnte ein Betrüger einfach paypal.<neue-endung> eintragen.
  const sameOrg = (rd) => (dkimAligned || known) && rd && mainLabel(rd).length >= 3 && mainLabel(rd) === mainLabel(fromRd);
  const foreignReply = f.replyTo.find((r) => { const rd = addressDomain(r); return rd !== fromRd && !sameOrg(rd) && !(f.recipients ?? []).includes(r.address); });
  if (foreignReply && !trustedList) add('replyToForeign', [foreignReply.address]);

  // --- Links ---
  let imageBrand = null, imageCtaWord = null, qrLink = null, imageLink = null, mismatch = null, ipLink = null, shortener = null, userinfo = null, redirect = null, abused = null;
  const linkHosts = new Set();
  const imgForeign = [], textLinkRds = new Set();
  for (const l of f.links) {
    const h = hostOf(l.href);
    if (!h) continue;
    const rd = registrableDomain(toUnicodeHost(h.host));
    linkHosts.add(h.host);
    const td = l.text ? textDomain(l.text) : null;
    const tdRd = td ? registrableDomain(td) : null;
    // Link auf die eigene Domain des Absenders ist kein Täuschungsversuch – außer der Text nennt eine Marken-Domain
    if (!mismatch && td && tdRd !== rd && (rd !== fromRd || brandDomains.includes(tdRd)) && !LINK_WRAPPERS.test(h.host) &&
        !(trustedList && dkimAligned && tdRd === fromRd)) mismatch = [td, h.host];
    if (!ipLink && isIp(h.host)) ipLink = [h.host];
    if (!shortener && SHORTENERS.has(rd)) shortener = [rd];
    // QR-Code im Bild, dessen Ziel nichts mit dem Absender zu tun hat (umgeht Link-Scanner)
    // Text im Bild (OCR): Marke im Bild, Link führt woanders hin
    const ocrText = l.hasImage && !l.text ? f.imageTexts?.[imageKey(l.imgSrc)] : '';
    if (ocrText && !imageBrand && !l.qr) {
      const flat = domainSkeleton(ocrText).replace(/[^\p{L}\p{N}]+/gu, '');
      for (const b of BRANDS) {
        const name = b.names.find((n) => { const c = domainSkeleton(n).replace(/[^\p{L}\p{N}]+/gu, ''); return c.length >= 5 && flat.includes(c); });
        if (name && !b.domains.includes(rd) && !b.domains.includes(fromRd)) { imageBrand = [name[0].toUpperCase() + name.slice(1), h.host]; break; }
      }
      if (rd !== fromRd) imageCtaWord = IMAGE_CTA.find((w) => compact(ocrText).includes(w)) ?? imageCtaWord;
    }
    if (!qrLink && l.qr && rd !== fromRd && !brandDomains.includes(rd)) qrLink = [h.host];
    // Großes, textloses Bild als Link auf eine fremde Domain (typisch: Screenshot einer "Datei-Freigabe")
    if (l.hasImage && !l.text && rd !== fromRd) imgForeign.push({ rd, small: /(?:^|\D)(\d{1,2}|[1-5]\d|6[0-4])x(\d{1,2}|[1-5]\d|6[0-4])(?:\D|$)/.test(l.imgSrc ?? '') });
    if (l.text && rd !== fromRd) textLinkRds.add(rd);
    if (!imageLink && !trustedList && l.hasImage && !l.text && (l.imgWidth >= 150 || (l.imgWidth === 0 && (l.imgHeight === 0 || l.imgHeight >= 100))) && rd !== fromRd &&
        !SOCIAL.has(rd) && !brandDomains.includes(rd) && !((dkimAligned || known) && logoOfTarget(l.imgAlt, rd)) && !(l.imgSrc && /(?:^|\D)([1-5]?\d|6[0-4])x([1-5]?\d|6[0-4])(?:\D|$)/.test(l.imgSrc))) imageLink = [h.host, rd];
    if (!abused && ABUSED_HOST.some((re) => re.test(h.host))) abused = [h.host];
    if (!userinfo && (h.url.username || h.url.password)) userinfo = [h.host];
    if (!redirect && /[?&](?:url|u|redirect|redir|target|dest|link|goto)=https?(?::|%3a)/i.test(h.url.search)) redirect = [h.host];
  }
  if (mismatch) add('linkMismatch', mismatch);
  const dead = f.links.filter((l) => DEAD_HREF.test(l.href) && LEGAL_LINK.test(l.text));
  if (dead.length >= 2 && f.links.some((l) => hostOf(l.href))) add('placeholderLinks', [dead.map((l) => l.text).slice(0, 3).join(', ')]);
  if (ipLink) add('ipLink', ipLink);
  if (shortener) add('shortener', shortener);
  if (abused) add('abusedHost', abused);
  // Fußzeile mit mehreren kleinen Symbol-Links (Social Media usw.) oder Ziel auch als Textlink vorhanden: üblich bei
  // Newslettern. Nur kleine bzw. bekannte Symbole zählen – sonst ließe sich die Warnung mit drei Icons abschalten.
  const footerIcons = imgForeign.filter((x) => x.rd !== imageLink?.[1] && (x.small || SOCIAL.has(x.rd))).length;
  if (imageLink && ((footerIcons >= 3 && dkimAligned) || textLinkRds.has(imageLink[1]))) imageLink = null;
  if (imageLink) add('imageLinkForeign', [imageLink[0]]);
  if (qrLink) add('qrForeignLink', qrLink);
  if (imageBrand) add('imageBrandMismatch', imageBrand);
  if (imageCtaWord && (imageLink || imageBrand)) add('imageCta', [imageCtaWord]);
  if (userinfo) add('urlUserinfo', userinfo);
  if (redirect) add('redirectParam', redirect);
  if (!lookalikeHit) {
    for (const host of [...linkHosts].slice(0, 15)) {
      const brandLink = lookalike(toUnicodeHost(host), brandDomains);
      const hit = (brandLink && !ownedLookalike(brandLink, registrableDomain(toUnicodeHost(host))) ? brandLink : null) ||
        (userDomains.length && lookalike(toUnicodeHost(host), userDomains, { structural: false }));
      if (hit) { lookalikeHit = { where: 'link', host: registrableDomain(host), ...hit }; break; }
      if (hasPunycode(host) && hasMixedScript(host)) add('mixedScript', [toUnicodeHost(host)]);
    }
  }
  if (lookalikeHit) add('lookalikeDomain', [lookalikeHit.host, lookalikeHit.target, lookalikeHit.where]);

  // --- Formulare und Anhänge ---
  const loginAtt = f.attachments.find((a) => a.loginForm);
  if (loginAtt) add('loginForm', [loginAtt.name]);
  else if (f.bodyLoginForm) add('loginForm', ['']);
  const risky = f.attachments.find((a) => RISKY_EXT.has(a.ext));
  if (risky) add('riskyAttachment', [risky.name]);
  // Getarnt: Doppel-Endung/Schreibrichtungs-Trick im Namen, oder der Inhalt ist etwas anderes als die Endung sagt
  const disguised = f.attachments.find((a) => a.disguised || a.typeMismatch || a.archive?.disguisedEntry);
  if (disguised) add('disguisedFile', [disguised.archive?.disguisedEntry ? disguised.archive.riskyEntry : disguised.name]);
  const inArchive = f.attachments.find((a) => a.archive?.riskyEntry && !a.archive.disguisedEntry);
  if (inArchive) add('archiveRisky', [inArchive.name, inArchive.archive.riskyEntry]);
  if (f.hasArchive && PASSWORD_HINT.test(f.text)) add('passwordArchive');

  // --- Marke im Betreff/Textanfang bei fremdem Absender (Marke im Text ist oft mit Leerzeichen getarnt) ---
  const lowered = normalizeText(f.text);
  if (!brandClaimed && !known) {
    const headRaw = f.subject + ' ' + f.text.slice(0, 300) + ' ' + Object.values(f.imageTexts ?? {}).join(' ').slice(0, 300);
    const head = normalizeText(headRaw).replace(/[^\p{L}\p{N}]+/gu, '');
    const accountish = ACCOUNT_WORDS.some((w) => head.includes(w));
    const linkRds = new Set([...linkHosts].map((h) => registrableDomain(h)));
    const hit = BRANDS.find((b) => accountish && !(trustedList && CARRIERS.has(b.id)) && !brandOwns(b, fromRd) && !b.domains.some((d) => linkRds.has(d)) &&
      b.names.some((n) => { const c = skeleton(n).replace(/[^\p{L}\p{N}]+/gu, ''); return c.length >= 5 ? head.includes(c) : c.length >= 2 && shortBrandIn(headRaw, n); }));
    if (hit) add('brandInContent', [hit.id]);
  }

  // --- Absender-Domain wirkt zufällig erzeugt (nur bei unbekannten Absendern) ---
  if (!known && !isContact && looksRandomDomain(from.domain) && !FREEMAIL.has(fromRd) && !brandDomains.includes(fromRd) && !BANK_NAMES_BY_DOMAIN.has(fromRd)) {
    add('randomDomain', [fromRd]);
  }

  // --- Anlage-/Krypto-Werbung (auch aus Bildtext/OCR) von unbekannten Absendern ---
  if (!known && !isContact) {
    const pitch = normalizeText(`${f.subject} ${f.text} ${Object.values(f.imageTexts ?? {}).join(' ')}`);
    const terms = INVEST_TERMS.filter((t) => pitch.includes(t));
    if (terms.length >= 2 && INVEST_HOOKS.some((h) => pitch.includes(h))) add('investmentPromo', [terms.slice(0, 3).join(', ')]);
  }

  // --- Inhalt: Erpressung ("Sextortion") und Füllwort-Trick ---
  if (detectExtortion(f.text, { isList: trustedList })) add('extortion');
  if (f.fillerToken) add('fillerText', [f.fillerToken]);
  if (f.invisibleCount >= 40) add('invisiblePadding', [f.invisibleCount]);   // schwach: Preheader-Padding nutzen auch legitime Newsletter

  // --- Verrufene Top-Level-Domains (Absender oder Links): schwach, verstärkt nur andere Hinweise ---
  const badTlds = [...new Set([from.domain, ...linkHosts].map(badTld).filter(Boolean))];
  if (badTlds.length && !isContact) add('badTld', [badTlds.map((x) => '.' + x).join(', ')]);

  // --- Schwache Signale ---
  const pressure = PRESSURE.filter((w) => lowered.includes(w));
  if (pressure.length >= 2) add('pressureWords', [pressure.slice(0, 2).join(', ')]);
  if (f.imageOnly) add('imageOnly');
  if (f.hiddenText) add('hiddenText');

  // --- Erstkontakt und Kombination ---
  if (!known && !hist && !isContact) {
    add('firstContact');
    if (signals.some((s) => ['brandNameMismatch', 'lookalikeDomain', 'linkMismatch', 'loginForm'].includes(s.id))) {
      add('firstContactClaims');
    }
  }

  // --- Ausnahmen: vom Nutzer als vertrauenswürdig markierte Absender ---
  const keep = new Set(['dmarcFail', 'spfFail', 'lookalikeDomain', 'mixedScript']);
  let list = signals;
  // Die Absender-Domain selbst hat der Nutzer bestätigt; Lookalike-Links in der Mail bleiben sichtbar.
  if (cfg.trustedSenders.includes(from.address)) {
    list = signals.filter((s) => keep.has(s.id) && !(s.id === 'lookalikeDomain' && s.params[2] === 'sender'));
  }

  return result(list, cfg, { known, hist, isContact });
}

// Signale, die sich allein aus der Absenderzeile ergeben (für den Erstscan, der Mails nicht ganz lesen soll)
export const HEADER_SIGNALS = ['brandNameMismatch', 'bankNameMismatch', 'orgNameMismatch', 'lookalikeDomain', 'randomDomain', 'displayNameEmail', 'mixedScript'];

/** Kopfzeilen-Prüfung einer Absenderzeile ("Name <adresse>"): auffällige Signal-Kennungen oder []. */
export function headerSuspicion(author) {
  const f = buildFeatures({ headers: { from: [author] }, parts: [] });
  if (!f.from) return [];
  return analyze(f, {}).signals.map((s) => s.id).filter((id) => HEADER_SIGNALS.includes(id));
}

function result(signals, cfg, sender = {}) {
  let score = signals.reduce((sum, s) => sum + s.weight, 0);

  // Bekannte Absender: Bonus, außer bei Hinweisen auf Fälschung oder Übernahme.
  // Fälschung (DMARC, Lookalike) oder Kontoübernahme (fremde Bild-/Hosting-Links, Formulare, riskante Anhänge)
  const spoofy = signals.some((s) => ['learnedNameMismatch', 'dmarcFail', 'spfFail', 'lookalikeDomain', 'replyToForeign', 'mixedScript',
    'imageLinkForeign', 'qrForeignLink', 'extortion', 'imageBrandMismatch', 'abusedHost', 'linkMismatch', 'loginForm', 'riskyAttachment', 'disguisedFile', 'archiveRisky'].includes(s.id));
  if (sender.known && !spoofy) score += cfg.knownSenderBonus;

  // Nur schwache Signale: nie eine Warnung.
  const strong = signals.some((s) => !cfg.weak.includes(s.id));
  if (!strong) score = Math.min(score, cfg.thresholds.suspicious - 1);

  score = Math.max(0, Math.min(100, Math.round(score)));
  let level = score >= cfg.thresholds.dangerous ? 'dangerous'
    : score >= cfg.thresholds.suspicious ? 'suspicious' : 'normal';
  for (const s of signals) if (cfg.force[s.id]) level = maxLevel(level, cfg.force[s.id]);

  signals = signals.filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight);
  return { score, level, signals };
}
