// Anonymisiert eine Mail (.eml), damit Nutzer Phishing-Beispiele weitergeben können, ohne sich preiszugeben.
// Ersetzt eigene Adressen, Namen und private Domains sowie die Empfänger-Adressen; macht persönliche Kennungen
// in Link-Parametern unkenntlich; entfernt Anhänge außer Bildern. Alles, was die Erkennung auswertet (Absender,
// Reply-To, Authentifizierung, Links, HTML-Aufbau, Bilder), bleibt erhalten. Eigene Umsetzung, ohne Thunderbird-API.
//
// Die Mail wird als "Binär-String" verarbeitet (ein Zeichen = ein Byte), wie messages.getRaw ihn liefert.

const FREEMAIL_HINT = /^(gmail|googlemail|gmx|web|outlook|hotmail|live|msn|yahoo|icloud|me|mac|aol|t-online|freenet|proton|protonmail|mail|posteo|mailbox|yandex|gmx-topmail)\./i;
const RECIPIENT_HEADERS = ['to', 'cc', 'bcc', 'delivered-to', 'x-original-to', 'envelope-to', 'x-envelope-to', 'resent-to', 'x-rcpt-to'];
const PLACEHOLDER_DOMAIN = 'example.invalid';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- Kodierungen ----------
function bytesToBin(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
}
const binToBytes = (bin) => Uint8Array.from(bin, (c) => c.charCodeAt(0) & 0xff);
function decodeCharset(bin, charset) {
  try { return new TextDecoder(charset || 'utf-8').decode(binToBytes(bin)); } catch { return new TextDecoder('latin1').decode(binToBytes(bin)); }
}
const utf8Bin = (str) => bytesToBin(new TextEncoder().encode(str));
function b64decode(s) { try { return atob(s.replace(/[^A-Za-z0-9+/=]/g, '')); } catch { return ''; } }
const b64encode = (bin) => (btoa(bin).match(/.{1,76}/g) ?? ['']).join('\r\n');
function qpDecode(s) {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function qpEncode(bin) {
  const out = [];
  for (const line of bin.split(/\r?\n/)) {
    let enc = '';
    for (let i = 0; i < line.length; i++) {
      const c = line.charCodeAt(i);
      const ch = line[i];
      const last = i === line.length - 1;
      enc += (c === 61 || c > 126 || (c < 32 && c !== 9) || ((c === 32 || c === 9) && last)) ? '=' + c.toString(16).toUpperCase().padStart(2, '0') : ch;
    }
    // weiche Umbrüche nach höchstens 75 Zeichen, ohne eine =XX-Folge zu trennen
    while (enc.length > 75) {
      let cut = 75;
      if (enc[cut - 1] === '=') cut -= 1; else if (enc[cut - 2] === '=') cut -= 2;
      out.push(enc.slice(0, cut) + '=');
      enc = enc.slice(cut);
    }
    out.push(enc);
  }
  return out.join('\r\n');
}

// ---------- Kopfzeilen ----------
function splitHead(raw) {
  const m = raw.match(/\r?\n\r?\n/);
  if (!m) return { head: raw, sep: '', body: '' };
  return { head: raw.slice(0, m.index), sep: m[0], body: raw.slice(m.index + m[0].length) };
}
function headerValue(head, name) {
  const unfolded = head.replace(/\r?\n[ \t]+/g, ' ');
  const m = unfolded.match(new RegExp(`^${esc(name)}:[ \\t]*(.*)$`, 'im'));
  return m ? m[1].trim() : '';
}
function headerValues(head, name) {
  const unfolded = head.replace(/\r?\n[ \t]+/g, ' ');
  return [...unfolded.matchAll(new RegExp(`^${esc(name)}:[ \\t]*(.*)$`, 'gim'))].map((m) => m[1].trim());
}
function param(v, name) {
  const m = String(v).match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i'));
  return m ? (m[1] ?? m[2]) : '';
}
function setHeader(head, name, value) {
  const re = new RegExp(`^${esc(name)}:[^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*`, 'im');
  return re.test(head) ? head.replace(re, `${name}: ${value}`) : `${head}\r\n${name}: ${value}`;
}
function decodeWords(s) {
  return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, cs, enc, txt) =>
    decodeCharset(enc.toLowerCase() === 'b' ? b64decode(txt) : qpDecode(txt.replace(/_/g, ' ')), cs));
}
/** Adressen und Namen aus einer Adresszeile ("Name <a@b>, c@d"). */
function addressesIn(value) {
  const out = [];
  for (const part of decodeWords(value).split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
    const addr = (part.match(/<([^<>\s]+@[^<>\s]+)>/) ?? part.match(/([^\s<>"',;]+@[^\s<>"',;]+)/) ?? [])[1];
    if (!addr) continue;
    const name = part.replace(/<[^>]*>/, '').replace(/["']/g, '').trim();
    out.push({ address: addr.toLowerCase(), name: name.includes('@') ? '' : name });
  }
  return out;
}

// ---------- Ersetzungsregeln ----------
/**
 * @param {string} raw komplette Mail als Binär-String
 * @param {{addresses?: string[], names?: string[]}} own eigene Adressen und Namen (aus den Thunderbird-Konten)
 */
export function buildReplacer(raw, own = {}) {
  const { head } = splitHead(raw);
  const report = { addresses: 0, names: 0, domains: 0, postal: 0, links: 0, attachments: 0 };
  const addrMap = new Map();   // adresse -> Platzhalter
  const nameSet = new Map();   // Name/Namensteil -> Platzhalter
  const add = (address, i) => { if (address && !addrMap.has(address)) addrMap.set(address, i === 0 ? `user@${PLACEHOLDER_DOMAIN}` : `empfaenger${i + 1}@${PLACEHOLDER_DOMAIN}`); };
  const ownAddrs = (own.addresses ?? []).map((a) => a.toLowerCase());
  ownAddrs.forEach((a) => add(a, addrMap.size));
  const people = [];
  for (const h of RECIPIENT_HEADERS) for (const v of headerValues(head, h)) for (const p of addressesIn(v)) { add(p.address, addrMap.size); if (p.name) people.push(p.name); }
  // Namen: eigene zuerst (werden zu "Max Muster"), dann andere Empfänger ("Erika Beispiel")
  const addName = (full, first, last) => {
    const tokens = full.replace(/[^\p{L}\p{N}' -]+/gu, ' ').split(/\s+/).filter((t) => t.length >= 3 && !/^(und|and|von|van|der|die|das|team|info|service|support|kundenservice)$/i.test(t));
    if (tokens.length && !nameSet.has(full)) nameSet.set(full, `${first} ${last}`.trim());
    tokens.forEach((t, i) => { if (!nameSet.has(t)) nameSet.set(t, i === 0 ? first : last); });
  };
  for (const n of own.names ?? []) if (n) addName(n, 'Max', 'Muster');
  for (const n of people) addName(n, 'Erika', 'Beispiel');
  // Namen aus Adressen ableiten (die Anrede nennt oft den ausgeschriebenen Namen): vorname.nachname@… als Ganzes,
  // außerdem jeder Buchstabenteil ab 4 Zeichen (s.nachname@…), außer Funktionswörtern
  const ROLE = /^(info|kontakt|contact|office|mail|post|service|support|team|admin|news|newsletter|hallo|hello|noreply|reply|privat|private|home|familie|family|buero|biz|shop|sales|verkauf|rechnung|billing)$/i;
  [...addrMap.keys()].forEach((a, i) => {
    const mine = i === 0 || ownAddrs.includes(a);
    const parts = a.split('@')[0].split(/[._+\d-]+/).filter(Boolean);
    if (parts.length >= 2 && parts.every((t) => /^\p{L}{3,}$/u.test(t))) {
      addName(parts.map((t) => t[0].toUpperCase() + t.slice(1)).join(' '), mine ? 'Max' : 'Erika', mine ? 'Muster' : 'Beispiel');
    }
    for (const t of parts) {
      if (/^\p{L}{4,}$/u.test(t) && !ROLE.test(t) && !nameSet.has(t)) nameSet.set(t, mine ? 'Muster' : 'Beispiel');
    }
  });
  // lokale Teile eigener Adressen als eigenes Wort ("Hallo swinter"), ab 4 Zeichen
  const locals = [...addrMap.keys()].map((a) => a.split('@')[0]).filter((l) => l.length >= 4 && /[a-z]/i.test(l));
  // eigene private Domains (keine Freemailer): Firmen-/Privatdomain verrät die Person
  const domains = [...new Set(ownAddrs.map((a) => a.split('@')[1]).filter((d) => d && !FREEMAIL_HINT.test(d)))];

  const rules = [];
  for (const [a, p] of [...addrMap].sort((x, y) => y[0].length - x[0].length)) {
    rules.push([new RegExp(esc(a), 'gi'), p, 'addresses']);
    rules.push([new RegExp(esc(a.replace('@', '%40')), 'gi'), p.replace('@', '%40'), 'addresses']);
  }
  for (const d of domains) rules.push([new RegExp(`(?<![\\w.-])${esc(d)}(?![\\w-])`, 'gi'), `eigene-domain.${PLACEHOLDER_DOMAIN}`, 'domains']);
  for (const [n, p] of [...nameSet].sort((x, y) => y[0].length - x[0].length)) {
    rules.push([new RegExp(`(?<![\\p{L}\\p{N}])${esc(n).replace(/\\? /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu'), p, 'names']);
  }
  for (const l of locals) rules.push([new RegExp(`(?<![\\p{L}\\p{N}@._-])${esc(l)}(?![\\p{L}\\p{N}@_-])`, 'giu'), 'max', 'names']);

  const text = (s) => {
    let out = s;
    for (const [re, rep, kind] of rules) out = out.replace(re, () => { report[kind]++; return rep; });
    return out;
  };
  // Postanschriften im Text (Straße + Hausnummer, Postleitzahl + Ort)
  const postal = (s) => s
    .replace(/(?<![\p{L}\p{N}])[\p{Lu}][\p{L}.-]*(?:straße|strasse|str\.|weg|gasse|allee|platz|ring|damm|chaussee)\s*\d{1,4}\s?[a-z]?(?![\p{L}\p{N}])/gu, () => { report.postal++; return 'Musterstraße 1'; })
    .replace(/(?<![\p{L}\p{N}-])(?:D-|A-|CH-)?\d{5}\s+[\p{Lu}][\p{L}-]+(?:\s(?:am|an der|bei|im|in der|ob der)\s[\p{Lu}][\p{L}-]+)?/gu, () => { report.postal++; return '12345 Musterstadt'; });
  return { text, postal, report };
}

/** Persönliche Kennungen in Link-Parametern unkenntlich machen; Weiterleitungsziele (Werte mit http…) bleiben. */
function scrubLinks(s, report) {
  return s.replace(/https?:\/\/[^\s"'<>()]+/gi, (url) => url.replace(/([?&;]|&amp;)([^=&#\s"'<>]+)=([^&#\s"'<>]*)/g, (m, sep, key, val) => {
    let decoded = val;
    try { decoded = decodeURIComponent(val); } catch { /* unverändert */ }
    if (!val || /^https?:/i.test(decoded) || val.length <= 2) return m;
    report.links++;
    return `${sep}${key}=x`;
  }));
}

// ---------- MIME-Teile ----------
function anonymizePart(raw, ctx) {
  const { head: head0, sep, body } = splitHead(raw);
  let head = ctx.text(head0.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (w, cs, enc, txt) => {
    const dec = decodeCharset(enc.toLowerCase() === 'b' ? b64decode(txt) : qpDecode(txt.replace(/_/g, ' ')), cs);
    const rep = ctx.text(dec);
    return rep === dec ? w : `=?UTF-8?B?${btoa(utf8Bin(rep))}?=`;
  }));
  head = head.replace(/^(List-Unsubscribe|List-Unsubscribe-Post):[^\r\n]*(?:\r?\n[ \t][^\r\n]*)*/gim, (h) => scrubLinks(h, ctx.report));
  const ct = headerValue(head, 'Content-Type') || 'text/plain';
  const type = ct.split(';')[0].trim().toLowerCase();
  const cte = headerValue(head, 'Content-Transfer-Encoding').toLowerCase();

  if (type.startsWith('multipart/')) {
    const boundary = param(ct, 'boundary');
    if (!boundary) return head + sep + body;
    const re = new RegExp(`(^|\\r?\\n)(--${esc(boundary)}(--)?)[ \\t]*(\\r?\\n|$)`, 'g');
    let out = '', m, start = 0, inPart = false;
    while ((m = re.exec(body))) {
      out += inPart ? anonymizePart(body.slice(start, m.index), ctx) : body.slice(start, m.index);
      out += m[0];
      if (m[3]) return head + sep + out + body.slice(re.lastIndex);
      inPart = true;
      start = re.lastIndex;
    }
    out += inPart ? anonymizePart(body.slice(start), ctx) : body.slice(start);
    return head + sep + out;
  }
  if (type === 'message/rfc822') return head + sep + anonymizePart(body, ctx);

  if (type.startsWith('text/')) {
    const bin = cte === 'base64' ? b64decode(body) : cte === 'quoted-printable' ? qpDecode(body) : body;
    const str = decodeCharset(bin, param(ct, 'charset'));
    const rep = scrubLinks(ctx.postal(ctx.text(str)), ctx.report);
    if (rep === str) return head + sep + body;
    const out = utf8Bin(rep);
    head = setHeader(head, 'Content-Type', /charset\s*=/i.test(ct) ? ct.replace(/charset\s*=\s*("[^"]*"|[^;\s]+)/i, 'charset=utf-8') : `${ct}; charset=utf-8`);
    if (cte === 'base64') return head + sep + b64encode(out) + '\r\n';
    if (cte === 'quoted-printable') return head + sep + qpEncode(out) + '\r\n';
    head = setHeader(head, 'Content-Transfer-Encoding', /[^\x00-\x7f]/.test(out) ? '8bit' : '7bit');
    return head + sep + out;
  }
  if (type.startsWith('image/')) return head + sep + body;   // Bilder bleiben (QR-Codes, Texterkennung)
  // sonstige Anhänge: Name und Typ bleiben, Inhalt wird entfernt
  ctx.report.attachments++;
  head = setHeader(head, 'Content-Transfer-Encoding', 'base64');
  return head + sep + '\r\n';
}

/**
 * @param {string} raw komplette Mail als Binär-String
 * @param {{addresses?: string[], names?: string[]}} own eigene Adressen und Namen
 * @returns {{raw: string, report: {addresses:number, names:number, domains:number, postal:number, links:number, attachments:number}}}
 */
export function anonymizeEml(raw, own = {}) {
  const ctx = buildReplacer(raw, own);
  let out = anonymizePart(raw, ctx);
  const { head, sep, body } = splitHead(out);
  out = `X-Novabird-Anonymized: 1\r\n${head}${sep}${body}`;
  return { raw: out, report: ctx.report };
}

export { decodeWords as _decodeWords, qpEncode as _qpEncode, qpDecode as _qpDecode };
