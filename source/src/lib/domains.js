import { domainSkeleton } from './text.js';

// Zwei-Ebenen-Suffixe, die wir ohne Public Suffix List kennen müssen.
const TWO_LEVEL = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au',
  'co.nz', 'co.jp', 'com.br', 'com.tr', 'co.za', 'com.mx', 'com.cn',
  'co.in', 'com.ar', 'com.ua', 'com.pl', 'co.at', 'or.at',
]);

export const FREEMAIL = new Set([
  'gmail.com', 'googlemail.com', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch',
  'web.de', 'outlook.com', 'outlook.de', 'hotmail.com', 'hotmail.de',
  'live.com', 'live.de', 'msn.com', 'yahoo.com', 'yahoo.de', 'icloud.com',
  'me.com', 'mac.com', 'aol.com', 't-online.de', 'freenet.de', 'proton.me',
  'protonmail.com', 'mail.com', 'posteo.de', 'mailbox.org', 'yandex.com',
  'mail.ru', 'qq.com', '163.com',
]);

export function isIp(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || (host.includes(':') && /^[0-9a-f:]+$/i.test(host)) ||
    /^\[[0-9a-f:]+\]$/i.test(host) || /^(0x[0-9a-f]+|\d{8,10})$/i.test(host);
}

// RFC 3492 (Punycode), eigene Umsetzung.
function punyDecodeLabel(input) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  let n = 128, i = 0, bias = 72;
  const out = [];
  let b = input.lastIndexOf('-');
  if (b < 0) b = 0;
  for (let j = 0; j < b; j++) out.push(input.charCodeAt(j));
  const digit = (c) => (c >= 48 && c <= 57 ? c - 22 : c >= 65 && c <= 90 ? c - 65 : c >= 97 && c <= 122 ? c - 97 : base);
  const adapt = (delta, numPoints, first) => {
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > ((base - tMin) * tMax) >> 1) { delta = Math.floor(delta / (base - tMin)); k += base; }
    return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
  };
  for (let idx = b > 0 ? b + 1 : 0; idx < input.length;) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (idx >= input.length) throw new Error('punycode');
      const d = digit(input.charCodeAt(idx++));
      if (d >= base) throw new Error('punycode');
      i += d * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (d < t) break;
      w *= base - t;
    }
    bias = adapt(i - oldi, out.length + 1, oldi === 0);
    n += Math.floor(i / (out.length + 1));
    i %= out.length + 1;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

/** Wandelt xn--Labels in Unicode um; bei Fehlern bleibt das Label unverändert. */
export function toUnicodeHost(host) {
  return host.toLowerCase().split('.').map((l) => {
    if (!l.startsWith('xn--')) return l;
    try { return punyDecodeLabel(l.slice(4)); } catch { return l; }
  }).join('.');
}

export function hasPunycode(host) {
  return host.toLowerCase().split('.').some((l) => l.startsWith('xn--'));
}

/** Enthält ein Label mehrere Schriftsysteme (Latein + Kyrillisch/Griechisch)? */
export function hasMixedScript(host) {
  return toUnicodeHost(host).split('.').some((label) => {
    const latin = /\p{Script=Latin}/u.test(label);
    const other = /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(label);
    return latin && other;
  });
}

export function registrableDomain(host) {
  host = host.toLowerCase().replace(/\.$/, '');
  if (isIp(host)) return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join('.');
  return TWO_LEVEL.has(last2) ? parts.slice(-3).join('.') : last2;
}

/** "paypal" aus "paypal.com", "bbc" aus "bbc.co.uk". */
export function mainLabel(domain) {
  return domain.split('.')[0];
}

/** Damerau-Levenshtein (optimal string alignment). */
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

const PHISHY_REST = /secure|login|logon|signin|verif|account|konto|update|support|service|help|sicher|confirm|auth|billing|payment|zahlung|kunde|online|portal|security|banking|wallet|unlock|recover|alert|notice/;
/** Rest einer Domain nach Entfernen des Markennamens: kurz, nur Ziffern oder ein typisches Köder-Wort? */
function phishyRest(rest) {
  const r = rest.replace(/-/g, '');
  return r.replace(/\d/g, '').length <= 2 || PHISHY_REST.test(r);
}

/**
 * Prüft, ob `host` eine Nachahmung einer der Ziel-Domains ist.
 * kinds: 'homoglyph' | 'typo' | 'embedded' | 'tld'
 * Gibt null zurück bei exakter Übereinstimmung oder keinem Treffer.
 * `opts.structural=false` schaltet 'embedded' und 'tld' ab (für Kontakt-Domains).
 */
export function lookalike(host, targets, opts = {}) {
  const structural = opts.structural !== false;
  const uni = toUnicodeHost(host);
  const rd = registrableDomain(uni);
  if (targets.includes(rd)) return null;
  const label = mainLabel(rd);
  const lSk = domainSkeleton(label);
  const subLabels = uni.split('.').slice(0, -rd.split('.').length);

  for (const target of targets) {
    const tLabel = mainLabel(target);
    const tSk = domainSkeleton(tLabel);
    if (label !== tLabel && lSk === tSk) return { target, kind: 'homoglyph' };
    if (tLabel.length >= 6 && label.length >= 6 && label !== tLabel &&
        editDistance(lSk, tSk) === 1) return { target, kind: 'typo' };
    if (!structural) continue;
    // Marke als Subdomain fremder Domain: paypal.com.evil.tld, paypal.evil.tld
    if (subLabels.some((l) => l === tLabel || l === target.replace(/\./g, '-'))) {
      return { target, kind: 'embedded' };
    }
    // Marke als Bestandteil: paypal-secure.com, secure-paypal.net (ganzes Wort zwischen Bindestrichen) oder
    // paypalsecure.com, appleid1.com (Wortteil nur mit typischem Phishing-Rest – sonst träfe es teamsport, homeoffice, pineapple)
    if (label !== tLabel && (label.split('-').includes(tLabel) ||
        (tLabel.length >= 5 && !FREEMAIL.has(target) && label.includes(tLabel) && phishyRest(label.replace(tLabel, ''))))) {
      return { target, kind: 'embedded' };
    }
    // gleiche Marke, andere TLD (amazon-Name unter .xyz)
    if (label === tLabel && rd !== target) return { target, kind: 'tld' };
  }
  return null;
}

/**
 * Wirkt der Hauptteil der Domain wie zufällig erzeugt? Zwei einfache, bewusst enge Regeln:
 *  - keine Vokale bei mindestens 4 Zeichen ("zkwd.de"), oder
 *  - mindestens 6 Zeichen und mindestens 2 Wechsel zwischen Ziffer und Buchstabe ("5yngrqr7.com").
 * Marken wie n26, 1und1 oder immobilienscout24 bleiben unauffällig (zu kurz bzw. nur ein Wechsel).
 */
export function looksRandomDomain(host) {
  const whole = mainLabel(registrableDomain(toUnicodeHost(host)));
  if (!/^[a-z0-9-]+$/.test(whole)) return false;
  const joined = whole.replace(/-/g, '');
  if (joined.length >= 4 && !/[aeiouy]/.test(joined)) return true;
  return whole.split('-').some(randomPart);
}
function randomPart(label) {
  const transitions = (label.match(/\d[a-z]|[a-z]\d/g) ?? []).length;
  return label.length >= 6 && transitions >= 2;
}
