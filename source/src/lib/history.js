// Absenderhistorie: wer gilt als "bekannt"? Reines Vorkommen im Postfach genügt nicht – sonst machen
// Spam-Sammlungen oder Kampagnen mit gleichem Absender Phishing "vertraut". Zwei Stufen:
//  - 'sent':      man hat dieser Adresse selbst geschrieben (kann ein Angreifer nicht fälschen) -> voll bekannt
//  - 'recurring': über längere Zeit mehrfach geschrieben und nie aufgefallen -> nur kein "Neuer Absender"-Hinweis
// Fällt eine Mail eines Absenders auf (Junk, eigener Tag, Kopfzeilen- oder Vollprüfung), wird er markiert
// ("flagged") und erreicht die Stufe 'recurring' nicht mehr.

export const MIN_MAILS = 3;
export const MIN_SPAN_DAYS = 14;
const DAY = 86_400_000;
// Rückblick des Erstscans in Monaten (Standard, Obergrenze)
export const HISTORY_MONTHS_DEFAULT = 12;
export const HISTORY_MONTHS_MAX = 18;

/** @param {Record<string, any>} idx @param {{address:string,name?:string}} entry @param {'n'|'sent'} field @param {number|null} dateMs */
export function noteRecord(idx, entry, field, dateMs) {
  if (!entry.address) return;
  const rec = (idx[entry.address] ??= { n: 0, sent: 0, names: [], first: null, last: null });
  rec[field]++;
  if (entry.name && !rec.names.includes(entry.name) && rec.names.length < 5) rec.names.push(entry.name);
  if (Number.isFinite(dateMs)) {
    rec.first = rec.first === null ? dateMs : Math.min(rec.first, dateMs);
    rec.last = rec.last === null ? dateMs : Math.max(rec.last, dateMs);
  }
  return rec;
}

/** Absender ist aufgefallen: zählt nie mehr als 'recurring' (angeschrieben zählt weiterhin). */
export function flagRecord(idx, address) {
  if (!address) return;
  (idx[address] ??= { n: 0, sent: 0, names: [], first: null, last: null }).flagged = true;
}

/** @returns {'sent'|'recurring'|null} */
export function trustLevel(rec) {
  if (!rec) return null;
  if (rec.sent > 0) return 'sent';
  if (rec.flagged) return null;
  return rec.n >= MIN_MAILS && rec.first !== null && rec.last - rec.first >= MIN_SPAN_DAYS * DAY ? 'recurring' : null;
}
export const isEstablished = (rec) => trustLevel(rec) !== null;

/** Monate Rückblick aus der Einstellung, begrenzt auf 1..HISTORY_MONTHS_MAX. */
export function historyMonths(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, HISTORY_MONTHS_MAX) : HISTORY_MONTHS_DEFAULT;
}

/** Sonderfunktionen eines Ordners ('sent', 'junk', ...). Manifest V3 kennt nur noch specialUse, V2 hatte type. */
export const folderUses = (folder) => folder.specialUse ?? (folder.type ? [folder.type] : []);
/** Ordner, die nie in die Historie zählen (Spam, Papierkorb, Vorlagen, Entwürfe, Postausgang). */
export const SKIP_USES = ['junk', 'trash', 'templates', 'drafts', 'outbox'];
export const isSkippedFolder = (folder) => folderUses(folder).some((u) => SKIP_USES.includes(u));
// Konten, deren Mails immer vollständig auf dem Rechner liegen. Nur dort darf der Scan Mails ganz lesen –
// bei IMAP u. a. ist nicht erkennbar, ob eine Offline-Kopie existiert, getFull würde sie vom Server holen.
export const LOCAL_ACCOUNT_TYPES = ['pop3', 'local', 'none'];   // 'local' ab Manifest V3, 'none' davor
// Konten ohne E-Mail-Absender (Feeds, News) zählen nicht
export const SKIP_ACCOUNT_TYPES = ['rss', 'nntp'];

/** Ordner-Schlüssel für die Ausnahmeliste in den Einstellungen. */
export const folderKey = (folder) => `${folder.accountId}:${folder.path}`;
