import { registrableDomain } from './domains.js';

/** Header-Dictionary (name -> string[]) mit kleingeschriebenen Schlüsseln. */
export function normalizeHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    out[k.toLowerCase()] = Array.isArray(v) ? v.map(String) : [String(v)];
  }
  return out;
}

export function firstHeader(headers, name) {
  return headers[name.toLowerCase()]?.[0] ?? '';
}

function splitList(str) {
  const parts = [];
  let cur = '', quote = false, angle = 0;
  for (const ch of str) {
    if (ch === '"') quote = !quote;
    else if (!quote && ch === '<') angle++;
    else if (!quote && ch === '>') angle = Math.max(0, angle - 1);
    if (ch === ',' && !quote && angle === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** "Name <a@b.de>, c@d.de" -> [{name, address, domain}] */
export function parseAddressList(str) {
  if (!str) return [];
  const result = [];
  for (const part of splitList(String(str))) {
    const m = part.match(/<([^<>]+)>/);
    let address, name;
    if (m) {
      address = m[1].trim();
      name = part.replace(m[0], '').trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"').trim();
    } else {
      address = part.trim();
      name = '';
    }
    const at = address.lastIndexOf('@');
    if (at < 1 || address.includes(' ')) continue;
    address = address.toLowerCase();
    result.push({ name, address, domain: address.slice(at + 1) });
  }
  return result;
}

export function addressDomain(addr) {
  return registrableDomain(addr.domain);
}

/** Message-IDs ohne spitze Klammern aus References / In-Reply-To. */
export function parseMessageIds(str) {
  if (!str) return [];
  return [...String(str).matchAll(/<([^<>\s]+)>/g)].map((m) => m[1]);
}

const AR_RESULT = /\b(spf|dkim|dmarc)\s*=\s*(pass|fail|softfail|neutral|none|temperror|permerror|policy)\b/gi;

/**
 * Wertet Authentication-Results aus. Nur Header des eigenen Servers zählen:
 * - `trustedIds` leer: nur der oberste Header (vom letzten, eigenen MTA).
 * - sonst: nur Header, deren authserv-id (Teil vor dem ersten ';') passt.
 * Fremde Header kann ein Absender selbst einschleusen und sind nicht vertrauenswürdig.
 */
export function parseAuthResults(values, trustedIds = []) {
  // dkimDomains: Domains (header.d bzw. header.i) gültiger DKIM-Signaturen – für den Abgleich mit dem Absender
  const res = { present: false, spf: null, dkim: null, dmarc: null, authserv: null, dkimDomains: [] };
  if (!values || !values.length) return res;
  const trusted = trustedIds.map((s) => s.toLowerCase());
  let chosen;
  if (trusted.length) {
    chosen = values.filter((v) => {
      const id = v.split(';')[0].trim().toLowerCase();
      return trusted.some((t) => id === t || id.endsWith('.' + t));
    });
  } else {
    chosen = [values[0]];
  }
  for (const v of chosen) {
    res.present = true;
    res.authserv ??= v.split(';')[0].trim();
    for (const m of v.matchAll(AR_RESULT)) {
      const method = m[1].toLowerCase();
      const result = m[2].toLowerCase();
      // DKIM: eine gültige Signatur genügt; sonst erstes Ergebnis behalten.
      if (res[method] === null || (method === 'dkim' && result === 'pass')) res[method] = result;
    }
    for (const part of v.split(';')) {
      if (!/^\s*dkim\s*=\s*pass\b/i.test(part)) continue;
      const d = part.match(/\bheader\.d\s*=\s*"?([a-z0-9.-]+)/i) ?? part.match(/\bheader\.i\s*=\s*"?[^@\s;"]*@([a-z0-9.-]+)/i);
      if (d) res.dkimDomains.push(d[1].toLowerCase());
    }
  }
  return res;
}
