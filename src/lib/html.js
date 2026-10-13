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

export function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]*>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
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
export function extractLinks(html) {
  html = html.slice(0, MAX_HTML);
  const links = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m;
  while ((m = re.exec(html)) && links.length < MAX_LINKS) {
    const href = m[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!href) continue;
    const img = m[2].match(/<img\b[^>]*>/i);
    links.push({
      href: decodeEntities((href[1] ?? href[2] ?? href[3] ?? '').trim()),
      text: stripTags(m[2]),
      hasImage: !!img,
      imgWidth: img ? imageWidth(img[0]) : 0,
      imgHeight: img ? imageHeight(img[0]) : 0,
      imgSrc: img ? attr(img[0], 'src') : '',
    });
  }
  return links;
}

/** URLs aus Klartext. */
export function extractTextLinks(text) {
  return [...text.slice(0, MAX_HTML).matchAll(/\bhttps?:\/\/[^\s<>"')\]]+/gi)]
    .slice(0, MAX_LINKS)
    .map((m) => ({ href: m[0].replace(/[.,;:!?]+$/, ''), text: '', hasImage: false, imgWidth: 0, imgHeight: 0, imgSrc: '' }));
}

export function hasPasswordInput(html) {
  return /<input\b[^>]*\btype\s*=\s*["']?password/i.test(html);
}

export function hasImage(html) {
  return /<img\b/i.test(html);
}

/** Grober Hinweis auf versteckten Text (display:none, font-size:0, ...). */
export function hasHiddenText(html) {
  return /<[a-z0-9]+\b[^>]*style\s*=\s*["'][^"']*(?:display\s*:\s*none|font-size\s*:\s*0(?:px)?\s*(?:;|["'])|visibility\s*:\s*hidden)[^"']*["'][^>]*>[^<]{20,}/i
    .test(html.slice(0, MAX_HTML));
}
