import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymizeEml, _qpEncode, _qpDecode } from '../src/lib/anonymize.js';

const utf8 = (s) => Buffer.from(s, 'utf8').toString('latin1');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const decodeAll = (raw) => {
  // grob: alle Base64- und QP-Blöcke der Ausgabe lesbar machen, um nach Resten zu suchen
  let text = raw;
  for (const m of raw.matchAll(/Content-Transfer-Encoding: base64\r?\n(?:[^\r\n]+\r?\n)*?\r?\n([A-Za-z0-9+/=\r\n]+)/g)) text += Buffer.from(m[1].replace(/\s+/g, ''), 'base64').toString('utf8');
  return text + _qpDecode(raw);
};

const MAIL = utf8([
  'From: "PayPal Service" <service@konto-hilfe.example>',
  'To: =?UTF-8?B?' + b64('Jürgen Musterle') + '?= <j.musterle@familie-musterle.de>',
  'Delivered-To: j.musterle@familie-musterle.de',
  'Received: from mx.example by mail.example for <j.musterle@familie-musterle.de>; Mon, 1 Jan 2026',
  'Subject: Ihr Konto, Herr Musterle',
  'List-Unsubscribe: <https://news.example/unsub?uid=8812734&list=7>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="XYZ"',
  '',
  '--XYZ',
  'Content-Type: text/html; charset=utf-8',
  'Content-Transfer-Encoding: base64',
  '',
  b64('<p>Sehr geehrter Herr Musterle,</p><p>Jürgen Musterle<br>Lindenstraße 12<br>35390 Gießen</p>' +
    '<a href="https://paypal-check.example/login?id=a8f7e6d5&amp;next=https%3A%2F%2Fevil.example%2Fx">www.paypal.com</a>' +
    '<p>Ihre Adresse j.musterle@familie-musterle.de</p>'),
  '--XYZ',
  'Content-Type: text/plain; charset=iso-8859-1',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Hallo J=FCrgen, bitte best=E4tigen: https://x.example/a?token=ZZZ123 (j.musterle@familie-musterle.de)',
  '--XYZ',
  'Content-Type: application/pdf; name="Rechnung.pdf"',
  'Content-Transfer-Encoding: base64',
  'Content-Disposition: attachment; filename="Rechnung.pdf"',
  '',
  b64('%PDF-1.4 vertraulich Kundennummer 4711'),
  '--XYZ',
  'Content-Type: image/png; name="qr.png"',
  'Content-Transfer-Encoding: base64',
  '',
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  '--XYZ--',
  '',
].join('\r\n'));

test('Anonymisieren: Adressen, Namen, Domains, Postanschrift, Link-Kennungen, Anhänge', () => {
  const { raw, report } = anonymizeEml(MAIL, { addresses: ['j.musterle@familie-musterle.de'], names: ['Jürgen Musterle'] });
  const all = decodeAll(raw);
  for (const leak of ['musterle', 'Musterle', 'Jürgen', 'familie-musterle', 'Lindenstraße', '35390', 'a8f7e6d5', 'ZZZ123', '8812734', 'Kundennummer']) {
    assert.ok(!all.includes(leak), 'noch enthalten: ' + leak);
  }
  // was die Erkennung braucht, bleibt
  assert.ok(raw.includes('From: "PayPal Service" <service@konto-hilfe.example>'));
  assert.ok(all.includes('paypal-check.example/login'));
  assert.ok(all.includes('next=https%3A%2F%2Fevil.example%2Fx'), 'Weiterleitungsziel bleibt');
  assert.ok(all.includes('www.paypal.com'));
  assert.ok(raw.includes('filename="Rechnung.pdf"'), 'Anhang-Name bleibt');
  assert.ok(raw.includes('iVBORw0KGgo'), 'Bild bleibt');
  assert.ok(raw.includes('--XYZ--'), 'MIME-Struktur bleibt');
  assert.ok(raw.startsWith('X-Novabird-Anonymized: 1'));
  assert.ok(report.addresses > 0 && report.names > 0 && report.postal >= 2 && report.links >= 3 && report.attachments === 1);
});

test('Anonymisieren: ohne Treffer bleibt der Text byte-genau gleich; QP-Kodierung rundet sauber', () => {
  const plain = utf8('From: a@b.example\r\nTo: c@d.example\r\nSubject: Hallo\r\n\r\nNur Text ohne Namen.\r\n');
  const { raw } = anonymizeEml(plain, {});
  assert.equal(raw.replace(/^X-Novabird-Anonymized: 1\r\n/, ''), plain.replace('c@d.example', 'user@example.invalid'));
  const s = utf8('Grüße = 100 % ' + 'x'.repeat(120) + ' Ende ');
  assert.equal(_qpDecode(_qpEncode(s)), s);
});
