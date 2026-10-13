// Inhaltliche Erkennung von Erpressungs-Mails ("Sextortion"): behauptet Hacking/Kamera-Zugriff, droht mit
// Veröffentlichung, fordert Kryptowährung, setzt eine Frist. Deutsch und Englisch. Eigene Muster.
import { normalizeText } from './text.js';

// Wallet-Adressen: bech32 (bc1…) steht für sich allein; ältere Bitcoin- und Ethereum-Adressen nur mit Kontextwort.
const BECH32 = /\bbc1[a-z0-9]{25,62}\b/i;
const BTC_LEGACY = /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/;
const ETH = /\b0x[0-9a-fA-F]{40}\b/;
const CRYPTO_WORD = /bitcoin|btc|ethereum|\beth\b|wallet|krypto|crypto/;

const CATS = {
  // Behauptung, Geräte/Konten/Kamera übernommen zu haben
  compromise: /zugang zu (ihren|ihrem|ihrer|allen)\b|gehackt|hacker|trojaner|schadsoftware|spionagesoftware|ihre (web)?cam|videokamera|ihrer kamera|(ihr|ihre) (computer|gerat|system|konto)\b.{0,30}(infiziert|gehackt|ubernommen)|(gained|have|got) (full )?access to your|hacked (your|into)|installed (a )?(malware|trojan|rat|keylogger|spyware)|your (web)?cam(era)?\b|(recorded|filmed|captured) you/,
  // Drohung, Videos/Fotos/Kontakte zu veröffentlichen oder weiterzugeben
  exposure: /(veroffentlich|verbreit|weiterleit|teilen|versenden|verschicken)\w* .{0,60}(videos?|fotos?|bilder|aufnahmen|kontakt|freund|verwandte|kollegen|familie)|(videos?|fotos?|aufnahmen|daten) .{0,60}(veroffentlich|verbreit|geteilt|zuganglich|offentlich)|(publish|release|leak|share|send|distribute|expose) .{0,60}(videos?|photos?|footage|recordings?|contacts?|friends|family|colleagues)|(videos?|photos?|footage) .{0,60}(public|everyone|all your contacts)/,
  // Zahlungsaufforderung in Kryptowährung
  crypto: /bitcoin|\bbtc\b|ethereum|kryptowahrung|cryptocurrency|\bwallet\b/,
  // Frist / Ultimatum
  deadline: /\b(\d+|zwei|drei|vier) (stunden|tage|tagen|hours?|days?)\b|letzte (warnung|frist|chance)|final (warning|notice|chance)|\bfrist\b|\bdeadline\b/,
  // "nicht antworten", "keine Polizei"
  noContact: /nicht (auf (diese|meine|die) )?(e-?mail )?antworten|nicht (an )?(die )?polizei|keine polizei|behorden|do not reply|don'?t reply|(not|don'?t) (contact|call) (the )?police|anzeige erstatten/,
};

/**
 * @param {string} text sichtbarer Mailtext (ohne Füllwörter)
 * @param {{isList?: boolean}} opts
 * @returns {{wallet: boolean, cats: string[]} | null} null = kein Erpressungsmuster
 */
export function detectExtortion(text, { isList = false } = {}) {
  if (!text || text.length < 80) return null;
  const norm = normalizeText(text);
  const wallet = BECH32.test(text) ||
    ((BTC_LEGACY.test(text) || ETH.test(text)) && CRYPTO_WORD.test(norm));
  const cats = Object.entries(CATS).filter(([, re]) => re.test(norm)).map(([k]) => k);
  const has = (k) => cats.includes(k);
  const threat = has('compromise') || has('exposure');

  // Newsletter, die über Erpressung berichten, bleiben außen vor – außer beim Volltreffer (Wallet + Hacking + Drohung)
  if (isList) return wallet && has('compromise') && has('exposure') ? { wallet, cats } : null;

  // 1) Wallet-Adresse plus Hacking- oder Drohbehauptung: eindeutig
  if (wallet && threat) return { wallet, cats };
  // 2) Hacking- UND Drohbehauptung zusammen mit Zahlung/Frist
  if (has('compromise') && has('exposure') && (has('crypto') || has('deadline'))) return { wallet, cats };
  // 4) drei oder mehr Merkmale, davon mindestens eine Behauptung/Drohung
  if (threat && cats.length >= 3 && has('crypto')) return { wallet, cats };
  return null;
}
