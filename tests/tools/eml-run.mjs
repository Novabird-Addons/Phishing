// Bewertet .eml-Dateien offline mit der Analyse-Logik (ohne Thunderbird).
// Aufruf: node tests/tools/eml-run.mjs <ordner> [--verbose] [--private] [--map-file datei]
//   --private   gibt nur Nummer, Stufe, Punktzahl und Signal-Kennungen aus (kein Betreff, kein Absender, keine Dateinamen,
//               keine Domains) – damit die Ausgabe unbedenklich weitergegeben werden kann.
//   --map-file  schreibt die Zuordnung Nummer -> Dateiname in eine lokale Datei (wird nicht ausgegeben).
// Nur für Tests: kleiner MIME-Parser, nicht Teil des Add-ons.
import fs from 'node:fs';
import path from 'node:path';
import { buildFeatures } from '../../src/lib/features.js';
import { analyze } from '../../src/lib/analyzer.js';

function decodeBytes(buf, charset) {
  try { return new TextDecoder(charset || 'utf-8').decode(buf); } catch { return buf.toString('latin1'); }
}
function qp(str) {
  const s = str.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) { bytes.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(s.charCodeAt(i) & 0xff);
  }
  return Buffer.from(bytes);
}
function parseHeaders(text) {
  const h = {};
  for (const line of text.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    (h[line.slice(0, i).toLowerCase()] ??= []).push(line.slice(i + 1).trim());
  }
  return h;
}
function decodeWords(s) {
  return s.replace(/=\?([\w-]+)\?([bq])\?([^?]*)\?=/gi, (_, cs, enc, txt) =>
    decodeBytes(enc.toLowerCase() === 'b' ? Buffer.from(txt, 'base64') : qp(txt.replace(/_/g, ' ')), cs));
}
function param(v, name) {
  const m = String(v || '').match(new RegExp(`${name}\\*?\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i'));
  return m ? (m[1] ?? m[2]) : '';
}
function parsePart(raw, parts) {
  const split = raw.search(/\r?\n\r?\n/);
  const head = parseHeaders(raw.slice(0, split < 0 ? raw.length : split));
  const body = split < 0 ? '' : raw.slice(split).replace(/^\r?\n\r?\n/, '');
  const ct = (head['content-type']?.[0] || 'text/plain');
  const type = ct.split(';')[0].trim().toLowerCase();
  if (type.startsWith('multipart/')) {
    const b = param(ct, 'boundary');
    for (const seg of body.split('--' + b).slice(1)) {
      if (seg.startsWith('--')) break;
      parsePart(seg.replace(/^\r?\n/, ''), parts);
    }
    return head;
  }
  const enc = (head['content-transfer-encoding']?.[0] || '').toLowerCase();
  const buf = enc === 'base64' ? Buffer.from(body.replace(/\s+/g, ''), 'base64') : enc === 'quoted-printable' ? qp(body) : Buffer.from(body, 'latin1');
  const disp = head['content-disposition']?.[0] || '';
  const name = decodeWords(param(disp, 'filename') || param(ct, 'name'));
  parts.push({ contentType: type, name: name || undefined, body: type.startsWith('text/') ? decodeBytes(buf, param(ct, 'charset')) : '' });
  return head;
}

const dir = path.resolve(process.argv[2]);
const verbose = process.argv.includes('--verbose');
const rows = [];
for (const f of fs.readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.eml')).sort()) {
  const raw = fs.readFileSync(path.join(dir, f)).toString('latin1');
  const parts = [];
  const headers = parsePart(raw, parts);
  for (const k of Object.keys(headers)) if (['subject', 'from', 'reply-to', 'to'].includes(k)) headers[k] = headers[k].map(decodeWords);
  const t0 = performance.now();
  const features = buildFeatures({ headers, parts });
  const r = analyze(features, { contactsByName: new Map(), contactAddresses: new Set(), contactDomains: new Set(), historyByName: new Map(), history: () => null });
  const ms = performance.now() - t0;
  rows.push({ spamFlag: /^yes/i.test(headers['x-spam-flag']?.[0] ?? ''), sig: r.signals.map((x) => x.id + '(' + x.params.slice(0, 3).join('|') + ')'), f, level: r.level, score: r.score, ms: ms.toFixed(1), ids: r.signals.map((s) => s.id), auth: features.auth, links: features.links.length, att: features.attachments.length, subject: headers.subject?.[0] });
}
const icon = { normal: '  ·', suspicious: ' !!', dangerous: '!!!' };
if (process.argv.includes('--private')) {
  const mapArg = process.argv.indexOf('--map-file');
  if (mapArg > 0) fs.writeFileSync(process.argv[mapArg + 1], rows.map((r, i) => `#${i}\t${r.f}`).join('\n') + '\n');
  const perSignal = {};
  rows.forEach((r, i) => {
    for (const id of r.ids) perSignal[id] = (perSignal[id] ?? 0) + 1;
    console.log(`${icon[r.level]} #${String(i).padStart(3)} ${String(r.score).padStart(3)} ${r.level.padEnd(10)} ${r.spamFlag ? 'ProvSpam' : '        '} ${r.ids.join(',')}`);
  });
  const n = (l) => rows.filter((r) => r.level === l).length;
  console.log(`\n${rows.length} Mails: ${n('dangerous')} gefährlich, ${n('suspicious')} verdächtig, ${n('normal')} unauffällig`);
  console.log('Signale (Anzahl Mails):', Object.entries(perSignal).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  process.exit(0);
}
for (const r of rows) {
  console.log(`${icon[r.level]} ${String(r.score).padStart(3)} ${r.level.padEnd(10)} ${r.spamFlag ? 'ProvSpam' : '        '} ${r.f.slice(0, 44).padEnd(44)}  ${r.ids.join(',')}`);
  if (verbose) console.log('        ' + r.sig.filter((x) => /lookalike|brand|mixed|displayName/.test(x)).join(' '));
  if (verbose) console.log(`        auth=${JSON.stringify({ spf: r.auth.spf, dkim: r.auth.dkim, dmarc: r.auth.dmarc, present: r.auth.present })} links=${r.links} att=${r.att}`);
}
const c = (l) => rows.filter((r) => r.level === l).length;
console.log(`\n${rows.length} Mails: ${c('dangerous')} gefährlich, ${c('suspicious')} verdächtig, ${c('normal')} unauffällig`);

// --inspect <Teilstring>: zeigt Absender, Reply-To, Link-Domains, Textanfang einer Mail.
const ix = process.argv.indexOf('--inspect');
if (ix > 0) {
  for (const f of fs.readdirSync(dir).filter((x) => x.includes(process.argv[ix + 1]))) {
    const raw = fs.readFileSync(path.join(dir, f)).toString('latin1');
    const parts = [];
    const headers = parsePart(raw, parts);
    for (const k of ['subject', 'from', 'reply-to']) if (headers[k]) headers[k] = headers[k].map(decodeWords);
    const ft = buildFeatures({ headers, parts });
    console.log(`\n=== ${f.slice(0, 50)}`);
    console.log('from:', headers.from?.[0], '| reply-to:', headers['reply-to']?.[0] ?? '-', '| list:', ft.isList);
    console.log('links:', [...new Set(ft.links.map((l) => { try { return new URL(l.href).hostname; } catch { return l.href.slice(0, 30); } }))].join(', '));
    console.log('atts:', ft.attachments.map((a) => a.name + ':' + a.ext).join(', ') || '-');
    console.log('text:', ft.text.slice(0, 260).replace(/\s+/g, ' '));
  }
}
