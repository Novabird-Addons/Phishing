// Bezug zu früheren Mails: Bestell-, Sendungs-, Rechnungs- und Vorgangsnummern ("Anker").
// Steht dieselbe Nummer in einer früheren, vertrauenswürdigen Mail, kennt der Absender einen echten Vorgang –
// das kann ein Phisher ohne Zugriff auf das Postfach nicht wissen. Die Suche selbst steckt in background.js.

// Bezeichnungen vor einer Nummer (klein, ohne Umlaute verglichen)
const LABELS = [
  'bestellnummer', 'bestell-nr', 'bestellnr', 'bestellung', 'auftragsnummer', 'auftrags-nr', 'auftragsnr', 'auftrag',
  'sendungsnummer', 'sendungs-nr', 'sendungsnr', 'sendung', 'trackingnummer', 'tracking-nummer', 'tracking number',
  'tracking-id', 'tracking id', 'paketnummer', 'paket-nr', 'rechnungsnummer', 'rechnungs-nr', 'rechnungsnr', 'rechnung',
  'vorgangsnummer', 'vorgangs-nr', 'vorgang', 'buchungsnummer', 'buchungs-nr', 'buchungscode', 'reservierungsnummer',
  'vertragsnummer', 'vertrags-nr', 'kundennummer', 'kunden-nr', 'kundennr', 'ticketnummer', 'ticket-nr', 'fallnummer',
  'aktenzeichen', 'order number', 'order no', 'order id', 'order', 'invoice number', 'invoice no', 'invoice',
  'booking reference', 'booking number', 'confirmation number', 'reference number', 'case number', 'ticket',
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+').replace(/-/g, '[ -]?');
// Bezeichnung, optional "Nr."/"No."/"#"/"ID", Trenner, dann die Nummer
const LABELED = new RegExp(
  `(?:^|[^\\p{L}])(?:${LABELS.sort((a, b) => b.length - a.length).map(esc).join('|')})` +
  `\\s*(?:nr\\.?|no\\.?|nummer|number|#|id)?\\s*[:.#]{0,2}\\s*([A-Z0-9][A-Z0-9/-]{4,34}[A-Z0-9])`, 'giu');
// Sendungsnummern, die auch ohne Bezeichnung eindeutig sind (UPS, DHL-Paket, DHL Express/GLS-artige JJD-Nummern)
const BARE = [/\b1Z[0-9A-Z]{16}\b/g, /\bJJD\d{16,22}\b/g, /\b00340\d{15}\b/g];
const DATE = /^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/;

/** Taugt die Zeichenfolge als Anker? Genug Ziffern, nicht nur eine Ziffer wiederholt, kein Datum. */
export function isAnchor(token) {
  const digits = token.replace(/\D/g, '');
  if (digits.length < 5 || token.length < 6 || token.length > 36) return false;
  if (/^(\d)\1+$/.test(digits) || /^0+$/.test(digits)) return false;
  if (DATE.test(token)) return false;
  return true;
}

/**
 * Nummern aus Betreff und Text, höchstens `max`.
 * @param {string} subject @param {string} text
 * @returns {string[]}
 */
export function extractAnchors(subject, text, max = 5) {
  const src = `${subject ?? ''}\n${String(text ?? '').slice(0, 20_000)}`;
  const out = [];
  const push = (t) => {
    const tok = t.replace(/[/-]+$/, '');
    if (isAnchor(tok) && !out.some((x) => x.toLowerCase() === tok.toLowerCase())) out.push(tok);
  };
  for (const re of BARE) for (const m of src.matchAll(re)) push(m[0]);
  for (const m of src.matchAll(LABELED)) push(m[1]);
  return out.slice(0, max);
}
