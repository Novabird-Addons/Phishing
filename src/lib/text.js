// Textnormalisierung und Homoglyphen. Eigene Tabelle, kein Fremdcode.

// Häufige optische Verwechslungen (Kyrillisch/Griechisch/Sonstiges -> Latein).
const HOMOGLYPHS = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y',
  'і': 'i', 'ї': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'һ': 'h', 'ԛ': 'q',
  'ԝ': 'w', 'ӏ': 'l', 'к': 'k', 'м': 'm', 'т': 't',
  'α': 'a', 'ο': 'o', 'ρ': 'p', 'ν': 'v', 'ι': 'i', 'κ': 'k', 'υ': 'u',
  'ɑ': 'a', 'ɡ': 'g', 'ⅼ': 'l', 'ı': 'i', 'ɩ': 'i',
};

export function stripDiacritics(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** Ersetzt bekannte Homoglyphen durch lateinische Zeichen; Kleinschreibung. */
export function skeleton(s) {
  let out = '';
  for (const ch of stripDiacritics(String(s)).toLowerCase()) {
    out += HOMOGLYPHS[ch] ?? ch;
  }
  return out.replace(/ß/g, 'ss');
}

/** Verwechslungsform für Domain-Labels: rn->m, vv->w, 0->o, 1/i->l. */
export function domainSkeleton(label) {
  return skeleton(label)
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/0/g, 'o')
    .replace(/[1i]/g, 'l');
}

const TITLES = new Set(['dr', 'prof', 'herr', 'frau', 'mr', 'mrs', 'ms', 'dipl', 'ing']);

/**
 * Schlüssel für Personennamen: reihenfolgeunabhängig, ohne Titel/Satzzeichen.
 * "Mustermann, Dr. Max" und "Max Mustermann" ergeben denselben Schlüssel.
 * Gibt '' zurück, wenn weniger als 2 Namensteile übrig bleiben (zu unspezifisch).
 */
export function nameKey(name) {
  if (!name) return '';
  const tokens = skeleton(name)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t && !TITLES.has(t));
  if (tokens.length < 2) return '';
  return tokens.sort().join(' ');
}

/** Sichtbarer Text für Wortlisten: skeleton + Whitespace normalisiert. */
export function normalizeText(s) {
  return skeleton(s).replace(/\s+/g, ' ').trim();
}
