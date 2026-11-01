import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAnchors, isAnchor } from '../source/src/lib/anchors.js';
import { buildFeatures } from '../source/src/lib/features.js';
import { analyze, relatedCouldHelp } from '../source/src/lib/analyzer.js';

test('Anker: Bestell-, Sendungs- und Rechnungsnummern', () => {
  assert.deepEqual(extractAnchors('Ihre Bestellung 304-1234567-7654321 wurde versandt', 'Sendungsnummer: 00340434161094015902'),
    ['00340434161094015902', '304-1234567-7654321']);
  assert.deepEqual(extractAnchors('Rechnung Nr. RE-2026-004711', ''), ['RE-2026-004711']);
  assert.deepEqual(extractAnchors('Order #A1B2C3D4E5', 'Tracking: 1Z999AA10123456784'), ['1Z999AA10123456784', 'A1B2C3D4E5']);
  assert.deepEqual(extractAnchors('Auftrags-Nr.: 4711-0815', ''), ['4711-0815']);
});

test('Anker: keine Daten, Telefonnummern ohne Bezeichnung oder Füllziffern', () => {
  assert.deepEqual(extractAnchors('Ihr Konto wurde gesperrt', 'Bestätigen Sie bis 12.10.2026. Telefon 0800 1234567'), []);
  assert.deepEqual(extractAnchors('Bestellung bestätigt', 'Vielen Dank für Ihre Bestellung bei uns.'), []);
  assert.ok(!isAnchor('000000'));
  assert.ok(!isAnchor('1111111'));
  assert.ok(!isAnchor('2026-10-12'));
  assert.equal(extractAnchors('', 'Bestellnummer 12345678 '.repeat(10)).length, 1);
});

test('Bezug nimmt nur Erstkontakt-Hinweise weg, Fälschungshinweise bleiben', () => {
  const mail = (body = '<p>Ihre Sendung 00340434161094015902 kommt morgen.</p>') =>
    buildFeatures({ headers: { from: ['Musterstädter Versand GmbH <info@paket-partner-xy.de>'], to: ['me@x.de'], subject: ['Ihre Sendung'] },
      parts: [{ contentType: 'text/html', body }] });
  const related = { anchor: '00340434161094015902', date: Date.parse('2026-10-20') };
  const without = analyze(mail(), {});
  assert.equal(without.level, 'suspicious');
  assert.ok(relatedCouldHelp(without));
  const withRef = analyze(mail(), { related });
  assert.equal(withRef.level, 'normal');
  assert.deepEqual(withRef.related, related);
  // Link-Täuschung bleibt trotz Bezug
  const fake = analyze(mail('<p>Sendung 00340434161094015902</p><a href="https://evil.example/login">https://www.dhl.de/sendung</a>'), { related });
  assert.ok(fake.signals.some((s) => s.id === 'linkMismatch'));
  assert.notEqual(fake.level, 'normal');
});
