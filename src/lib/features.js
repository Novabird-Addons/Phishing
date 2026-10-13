import {
  firstHeader, normalizeHeaders, parseAddressList, parseAuthResults, parseMessageIds,
} from './headers.js';
import {
  extractLinks, extractTextLinks, hasHiddenText, hasImage, hasPasswordInput, stripTags,
} from './html.js';

/**
 * Manche Spam-Mails streuen ein immer gleiches Wort zwischen fast alle anderen (gegen Spamfilter).
 * Gibt es ein Token, das mindestens 20-mal und in mindestens 25 % der Wörter vorkommt, ist es ein Füllwort.
 */
export function detectFiller(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 60) return null;
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  let top = null;
  for (const [t, n] of counts) if (!top || n > top.n) top = { t, n };
  if (top.n >= 20 && top.n / tokens.length >= 0.25 && top.t.length >= 2 && /[\p{L}\p{N}]/u.test(top.t)) return top;
  return null;
}

const INVISIBLE = /[\u200b-\u200f\u2060\ufeff\u034f\u00ad\u2800\u180e\u3164]/g;
const REPLY_SUBJECT = /^\s*(?:re|aw|antw|sv|vs|odp)(?:\[\d+\])?\s*:/i;
const ARCHIVE_EXT = new Set(['zip', '7z', 'rar', 'gz', 'tar', 'iso', 'img']);

export function fileExt(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : '';
}

/** Alle Namen einer Datei, um Doppel-Endungen zu erkennen: a.pdf.exe */
export function doubleExtension(name) {
  return /\.(pdf|docx?|xlsx?|jpe?g|png|txt)\s*\.(exe|scr|js|vbs|bat|cmd|lnk|hta|com|jar)$/i.test(name || '');
}

/**
 * Baut aus rohen Daten ein reines Merkmals-Objekt (kein Zugriff auf Thunderbird).
 * @param {{headers:object, parts:Array<{contentType:string,name?:string,body?:string}>}} input
 */
export function buildFeatures({ headers, parts = [], qrUrls = [], imageTexts = {} }, config = {}) {
  const h = normalizeHeaders(headers);
  const from = parseAddressList(firstHeader(h, 'from'))[0] ?? null;
  const replyTo = parseAddressList(firstHeader(h, 'reply-to'));
  const recipients = [...parseAddressList(firstHeader(h, 'to')), ...parseAddressList(firstHeader(h, 'cc'))].map((a) => a.address);
  const subject = firstHeader(h, 'subject');
  const auth = parseAuthResults(h['authentication-results'], config.trustedAuthservIds);

  const inReplyTo = parseMessageIds(firstHeader(h, 'in-reply-to'));
  const references = parseMessageIds(firstHeader(h, 'references'));

  let textPlain = '', html = '';
  const attachments = [];
  for (const p of parts) {
    const ct = (p.contentType || '').toLowerCase();
    const isAttachment = !!p.name && !(ct.startsWith('text/') && !fileExt(p.name));
    if (isAttachment) {
      const ext = fileExt(p.name);
      attachments.push({
        name: p.name, ext, contentType: ct,
        doubleExt: doubleExtension(p.name),
        loginForm: /html|svg/.test(ext + ct) && hasPasswordInput(p.body || ''),
      });
    } else if (ct === 'text/html') html += (p.body || '') + '\n';
    else if (ct === 'text/plain') textPlain += (p.body || '') + '\n';
  }

  const links = [
    ...(html ? extractLinks(html) : []),
    ...(!html && textPlain ? extractTextLinks(textPlain) : []),
    // Adressen aus QR-Codes in Bildern: wie Links prüfen, aber als solche kennzeichnen
    ...qrUrls.map((href) => ({ href, text: '', hasImage: false, imgWidth: 0, imgHeight: 0, imgSrc: '', qr: true })),
  ];
  let text = (html ? stripTags(html) : textPlain).slice(0, 20_000);
  // Unsichtbare Füllzeichen (Zero-Width, weiche Trennstriche …): zählen und entfernen. Spam streut sie in Mengen ein.
  const invisible = text.match(INVISIBLE) ?? [];
  if (invisible.length) text = text.replace(INVISIBLE, '');
  // Füllwörter entfernen, sonst zerreißen sie Wortgruppen für alle Textprüfungen
  const filler = detectFiller(text);
  if (filler) text = text.split(/\s+/).filter((t) => t !== filler.t).join(' ');

  return {
    from, replyTo, recipients, subject, auth,
    isReplySubject: REPLY_SUBJECT.test(subject),
    inReplyTo, references,
    isList: !!(h['list-unsubscribe'] || h['list-id'] || /bulk|list/i.test(firstHeader(h, 'precedence'))),
    links, text, imageTexts,
    fillerToken: filler?.t ?? null, fillerCount: filler?.n ?? 0,
    invisibleCount: invisible.length, rawTextLength: Math.max(1, invisible.length + text.length),
    bodyLoginForm: html ? hasPasswordInput(html) : false,
    hiddenText: html ? hasHiddenText(html) : false,
    imageOnly: !!html && hasImage(html) && text.length < 40 && links.length > 0,
    attachments,
    hasArchive: attachments.some((a) => ARCHIVE_EXT.has(a.ext)),
  };
}

/** Schlüssel, unter dem der OCR-Text eines Bildes abgelegt wird: Dateiname bei cid:, sonst die Adresse. */
export function imageKey(src) {
  const s = String(src || '');
  if (/^cid:/i.test(s)) return s.slice(4).split('@')[0].toLowerCase();
  return s;
}
