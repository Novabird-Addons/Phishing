const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  zwnj: '\u200c', zwj: '\u200d', shy: '\u00ad', lrm: '\u200e', rlm: '\u200f',
};

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const MAX_HTML = 400_000;
const MAX_LINKS = 250;

// Alles hier läuft in linearer Zeit. Muster wie /<[^>]*>/ oder /<!--[\s\S]*?-->/ laufen bei einem "<" ohne ">"
// danach von jedem Ansatz bis zum Ende – 400 KB "<a href=" oder "<!--" dauerten so über 15 Sekunden.

/** Ende eines Blocks wie <script>…</script> ab `from` (Index hinter dem schließenden Tag), -1 wenn keiner folgt. */
function blockEnd(html, name, from) {
  const re = new RegExp(`</${name}\\s*>`, 'gi');
  re.lastIndex = from;
  return re.exec(html) ? re.lastIndex : -1;
}

/** Alle Tags der Reihe nach als { tag, start, end }; ein Tag beginnt beim letzten "<" vor seinem ">". */
function* tagsOf(html) {
  let i = html.indexOf('<');
  while (i >= 0) {
    const end = html.indexOf('>', i + 1);
    if (end < 0) return;                 // kein ">" mehr: es folgt kein Tag mehr
    const start = html.lastIndexOf('<', end);
    yield { tag: html.slice(start, end + 1), start, end: end + 1 };
    i = html.indexOf('<', end + 1);
  }
}

const RAW_BLOCK = /^<(script|style|head)\b/i;
export function stripTags(html) {
  let out = '', i = 0;
  let noGt = false, noComment = false;
  const noClose = {};
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0 || noGt) { out += html.slice(i); break; }
    out += html.slice(i, lt) + ' ';
    if (!noComment && html.startsWith('<!--', lt)) {
      const e = html.indexOf('-->', lt + 4);
      if (e >= 0) { i = e + 3; continue; }
      noComment = true;
    }
    const raw = RAW_BLOCK.exec(html.slice(lt, lt + 8));
    if (raw && !noClose[raw[1].toLowerCase()]) {
      const e = blockEnd(html, raw[1], lt);
      if (e >= 0) { i = e; continue; }
      noClose[raw[1].toLowerCase()] = true;
    }
    const gt = html.indexOf('>', lt + 1);
    if (gt < 0) { noGt = true; out = out.slice(0, -1); i = lt; continue; }   // "<" ohne ">": bleibt Text
    i = gt + 1;
  }
  return decodeEntities(out).replace(/\s+/g, ' ').trim();
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? '').trim() : '';
}

/** Höhe eines <img> in Pixeln (nur Attribut); 0 = unbekannt. */
export function imageHeight(tag) {
  const m = tag.match(/\bheight\s*=\s*["']?(\d+(?:\.\d+)?)/i);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

/** Breite eines <img> in Pixeln (Attribut oder style: px/in/pt); 0 = unbekannt. */
export function imageWidth(tag) {
  const attr = tag.match(/\bwidth\s*=\s*["']?(\d+(?:\.\d+)?)/i);
  if (attr) return Math.round(parseFloat(attr[1]));
  const st = tag.match(/\bstyle\s*=\s*["'][^"']*?\bwidth\s*:\s*(\d+(?:\.\d+)?)\s*(px|in|pt)?/i);
  if (!st) return 0;
  const v = parseFloat(st[1]);
  return Math.round(st[2] === 'in' ? v * 96 : st[2] === 'pt' ? v * 96 / 72 : v);
}

/** Links aus HTML: [{ href, text }] (href mit decodierten Entities). */
/** Bei sehr vielen Links Anfang und Ende behalten: Köder stehen sonst hinter harmlosen Füll-Links versteckt. */
function headAndTail(list) {
  return list.length > MAX_LINKS ? [...list.slice(0, 150), ...list.slice(-100)] : list;
}

function firstTag(html, re) {
  for (const { tag } of tagsOf(html)) if (re.test(tag)) return tag;
  return null;
}

export function extractLinks(html) {
  html = html.slice(0, MAX_HTML);
  const links = [];
  let after = 0;   // hinter dem letzten </a>
  for (const { tag, start, end } of tagsOf(html)) {
    if (start < after || !/^<a\b/i.test(tag)) continue;
    const close = blockEnd(html, 'a', end);
    if (close < 0) break;                // kein </a> mehr: kein weiterer Link
    after = close;
    const m = [null, tag.slice(2, -1), html.slice(end, html.lastIndexOf('<', close - 1))];
    const href = m[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!href) continue;
    const img = firstTag(m[2], /^<img\b/i);
    links.push({
      href: decodeEntities((href[1] ?? href[2] ?? href[3] ?? '').trim()),
      text: stripTags(m[2]),
      hasImage: !!img,
      imgWidth: img ? imageWidth(img) : 0,
      imgHeight: img ? imageHeight(img) : 0,
      imgSrc: img ? attr(img, 'src') : '',
      imgAlt: img ? attr(img, 'alt') : '',
    });
  }
  return headAndTail(links);
}

/** Verschleierter Programmcode in angehängtem HTML/SVG: Skript baut den Inhalt erst zur Laufzeit auf.
 *  Dekodier-Funktionen oder lange Base64-/Hex-Ketten im Skript, und daneben kaum sichtbarer Text. */
export function hasObfuscatedScript(html) {
  const scripts = [], handlers = [];
  let after = 0;   // hinter dem letzten </script>
  for (const { tag, start, end } of tagsOf(html)) {
    if (start < after) continue;
    handlers.push(...(tag.match(/\bon(?:load|error|click|focus)\s*=\s*("[^"]*"|'[^']*')/gi) ?? []));
    if (!/^<script\b/i.test(tag)) continue;
    const close = blockEnd(html, 'script', end);
    if (close < 0) break;
    scripts.push(html.slice(end, html.lastIndexOf('<', close - 1)));
    after = close;
  }
  const src = scripts.join('\n') + ' ' + handlers.join(' ');
  if (!src.trim()) return false;
  // Eine gespeicherte echte Webseite hat viel sichtbaren Text – die bleibt außen vor (stripTags lässt Skripte weg)
  if (stripTags(html).length >= 600) return false;
  if (/\b(atob|unescape|String\.fromCharCode)\s*\(/.test(src)) return true;
  if (/["'][A-Za-z0-9+/]{400,}={0,2}["']/.test(src)) return true;
  return /(?:\\x[0-9a-f]{2}|%[0-9a-f]{2}){60,}/i.test(src);
}

/** URLs aus Klartext. */
export function extractTextLinks(text) {
  return headAndTail([...text.slice(0, MAX_HTML).matchAll(/\bhttps?:\/\/[^\s<>"')\]]+/gi)])
    .map((m) => ({ href: m[0].replace(/[.,;:!?]+$/, ''), text: '', hasImage: false, imgWidth: 0, imgHeight: 0, imgSrc: '' }));
}

export function hasPasswordInput(html) {
  return !!firstTag(html, /^<input\b[^>]*\btype\s*=\s*["']?password/i);
}

export function hasImage(html) {
  return /<img\b/i.test(html);
}

/** Grober Hinweis auf versteckten Text (display:none, font-size:0, ...). */
export function hasHiddenText(html) {
  html = html.slice(0, MAX_HTML);
  for (const { tag, end } of tagsOf(html)) {
    if (/^<[a-z0-9]+\b[^>]*style\s*=\s*["'][^"']*(?:display\s*:\s*none|font-size\s*:\s*0(?:px)?\s*(?:;|["'])|visibility\s*:\s*hidden)[^"']*["'][^>]*>$/i.test(tag) &&
      /^[^<]{20}/.test(html.slice(end, end + 20))) return true;
  }
  return false;
}
