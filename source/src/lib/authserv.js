// Welche Authentication-Results-Kopfzeile stammt vom eigenen Mailserver? Ohne Einstellung zählt sonst die oberste –
// schreibt der eigene Server keine, wäre das eine vom Absender selbst eingefügte ("evil.example; dmarc=pass").
// Deshalb je Konto mitzählen, welche authserv-id neue Mails oben tragen ('' = keine Kopfzeile). Ab MIN_MAILS Mails und
// SHARE Anteil für eine id gilt nur diese; ist das häufigste '', eine nie passende id, sodass alle ignoriert werden.
// Gleiche Regel wie in NovaBird für Android (ProtectionService.trustedAuthserv).
export const NO_AUTHSERV = 'no-authserv.invalid';
const MIN_MAILS = 10;
const SHARE = 0.8;
const MAX_MAILS = 200;   // danach halbieren: ein Wechsel des Anbieters setzt sich wieder durch
const MAX_IDS = 10;      // ein Angreifer kann je Mail eine neue id erfinden

/** authserv-id der obersten Kopfzeile (Text vor dem ersten ';', klein), '' ohne Kopfzeile. */
export function topAuthservId(values) {
  return values?.length ? String(values[0]).split(';')[0].trim().toLowerCase() : '';
}

/** Zählt die id einer neuen Mail. stats: { [accountId]: { [id]: Anzahl } } – wird verändert und zurückgegeben. */
export function noteAuthserv(stats, accountId, id) {
  const counts = (stats[accountId] ??= {});
  counts[id] = (counts[id] ?? 0) + 1;
  let entries = Object.entries(counts);
  if (entries.reduce((s, [, n]) => s + n, 0) >= MAX_MAILS) entries = entries.map(([k, n]) => [k, Math.floor(n / 2)]);
  entries = entries.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, MAX_IDS);
  stats[accountId] = Object.fromEntries(entries);
  return stats;
}

/** Gelernte vertraute ids für das Konto, oder null (zu wenig Mails oder kein klarer Wert: alte Regel). */
export function learnedAuthservIds(stats, accountId) {
  const entries = Object.entries(stats?.[accountId] ?? {});
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (total < MIN_MAILS) return null;
  const [id, n] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (n / total < SHARE) return null;
  return [id || NO_AUTHSERV];
}
