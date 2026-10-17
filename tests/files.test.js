import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  disguisedName, doubleExtension, findZipDirectory, hasBidiControl, inspectArchive, parseZipDirectory, sniffType, typeMismatch,
} from '../source/src/lib/files.js';
import { badTld } from '../source/src/lib/analyzer.js';

/** Minimales ZIP: ein Platzhalter für die Dateidaten, dann Inhaltsverzeichnis und Verzeichnis-Ende. */
function makeZip(entries) {
  const data = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...new Array(26).fill(0)]);
  const central = Buffer.concat(entries.map(({ name, encrypted = false, utf8 = true }) => {
    const n = Buffer.from(name, utf8 ? 'utf8' : 'latin1');
    const h = Buffer.alloc(46);
    h.writeUInt32LE(0x02014b50, 0);
    h.writeUInt16LE((encrypted ? 1 : 0) | (utf8 ? 0x800 : 0), 8);
    h.writeUInt16LE(n.length, 28);
    return Buffer.concat([h, n]);
  }));
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(data.length, 16);
  return new Uint8Array(Buffer.concat([data, central, end]));
}
const readZip = (zip) => {
  const dir = findZipDirectory(zip, 0);
  return parseZipDirectory(zip.subarray(dir.offset, dir.offset + dir.size));
};

test('Doppel-Endung: nur Dokument-Endung vor gefährlicher Endung', () => {
  for (const n of ['rechnung.pdf.exe', 'Scan.JPG.html', 'beleg.pdf   .js', 'foto.jpeg_.scr', 'daten.zip.lnk']) assert.ok(doubleExtension(n), n);
  for (const n of ['Rechnung.2024.pdf', 'backup.tar.gz', 'Protokoll_v1.2.docx', 'bericht.final.pdf', 'archiv.pdf.zip', 'tool.exe']) {
    assert.ok(!doubleExtension(n), n);
  }
});

test('Schreibrichtungs-Trick (RTLO) im Dateinamen', () => {
  assert.ok(hasBidiControl('Rechnung‮fdp.exe'));
  assert.ok(disguisedName('Rechnung‮fdp.exe'));
  assert.ok(!disguisedName('Rechnung März.pdf'));
});

test('Echter Dateityp aus den ersten Bytes', () => {
  const b = (...x) => new Uint8Array(x);
  const s = (str) => new Uint8Array(Buffer.from(str, 'latin1'));
  assert.equal(sniffType(b(0x4d, 0x5a, 0x90, 0x00)), 'exe');
  assert.equal(sniffType(s('%PDF-1.7\n')), 'pdf');
  assert.equal(sniffType(b(0x50, 0x4b, 0x03, 0x04, 0)), 'zip');
  assert.equal(sniffType(b(0x4c, 0, 0, 0, 1, 0x14, 2, 0, 0)), 'lnk');
  assert.equal(sniffType(s('Rar!\x1a\x07')), 'rar');
  assert.equal(sniffType(s('\xEF\xBB\xBF  <!DOCTYPE html><html>')), 'html');
  assert.equal(sniffType(s('#!/bin/sh\necho')), 'script');
  assert.equal(sniffType(s('Hallo Welt, nur Text')), '');
  const iso = new Uint8Array(0x8010); iso.set(Buffer.from('CD001'), 0x8001);
  assert.equal(sniffType(iso), 'iso');
});

test('Getarnter Inhalt: Endung passt nicht zum echten Typ', () => {
  assert.ok(typeMismatch('Rechnung.pdf', 'exe'));
  assert.ok(typeMismatch('Scan.jpg', 'html'));
  assert.ok(typeMismatch('Unterlagen.zip', 'lnk'));
  assert.ok(!typeMismatch('Rechnung.pdf', 'pdf'));
  assert.ok(!typeMismatch('Vertrag.docx', 'zip'));      // Office-Dateien sind ZIP
  assert.ok(!typeMismatch('foto.jpg', 'png'));          // falsch benannte Bilder sind harmlos
  assert.ok(!typeMismatch('deploy.sh', 'script'));      // keine Dokument-Endung
  assert.ok(!typeMismatch('setup.exe', 'exe'));         // ehrlich benannt: meldet riskyAttachment
  assert.ok(!typeMismatch('Rechnung.pdf', ''));
});

test('ZIP-Inhaltsverzeichnis lesen, ohne zu entpacken', () => {
  const zip = makeZip([{ name: 'Rechnung/' }, { name: 'Rechnung/Rechnung_0815.pdf.exe' }, { name: 'liesmich.txt', utf8: false }]);
  const entries = readZip(zip);
  assert.deepEqual(entries.map((e) => e.name), ['Rechnung/Rechnung_0815.pdf.exe', 'liesmich.txt']);
  const r = inspectArchive(entries);
  assert.equal(r.riskyEntry, 'Rechnung_0815.pdf.exe');
  assert.ok(r.disguisedEntry);

  const plain = inspectArchive(readZip(makeZip([{ name: 'tool.js' }, { name: 'doku.pdf', encrypted: true }])));
  assert.equal(plain.riskyEntry, 'tool.js');
  assert.ok(!plain.disguisedEntry && plain.encrypted);

  assert.equal(inspectArchive(readZip(makeZip([{ name: 'Fotos/IMG_1.jpg' }, { name: 'Bericht 2024.pdf' }]))).riskyEntry, '');
  assert.equal(findZipDirectory(new Uint8Array(100), 0), null);
});

test('Verrufene Top-Level-Domains', () => {
  assert.equal(badTld('login.paypal-secure.xyz'), 'xyz');
  assert.equal(badTld('rechnung.ZIP'), 'zip');
  assert.equal(badTld('example.top.'), 'top');
  assert.equal(badTld('sparkasse.de'), '');
  assert.equal(badTld('xyz.com'), '');
});
