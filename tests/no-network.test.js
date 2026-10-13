// Das Add-on soll nur an einer einzigen Stelle ins Netz gehen: src/remote.js (nur mit Zustimmung
// und Berechtigung). Dieser Test sperrt alles andere, weil die Content-Security-Policy es nicht mehr tut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../source/src/', import.meta.url).pathname;
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') yield* walk(p); } else if (p.endsWith('.js')) yield p;
  }
}

test('Netzwerk-Aufrufe nur in source/src/remote.js; sonst nur lokale Erweiterungs-URLs', () => {
  for (const file of walk(root)) {
    const rel = path.relative(root, file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource)\b\s*\(?/g)) {
      const line = src.slice(0, m.index).split('\n').length;
      const ctx = src.split('\n')[line - 1];
      if (rel === 'remote.js') continue;
      // erlaubt: fetch auf messenger.runtime.getURL(...) (lokale Datei der Erweiterung) und Kommentare
      if (/^\s*(\/\/|\*)/.test(ctx)) continue;
      assert.ok(/getURL|load\(/.test(ctx) || /^\s*const load = /.test(ctx), `${rel}:${line} Netzzugriff außerhalb von remote.js: ${ctx.trim()}`);
    }
    assert.ok(!/https?:\/\/(?!www\.w3\.org)[a-z0-9.-]+\.[a-z]{2,}/i.test(src.replace(/\/\/.*$/gm, '').replace(/https?:\/\/(example|[a-z0-9.-]*\.test)\b[^'"` ]*/gi, '')) || rel === 'lib/analyzer.js' || rel === 'i18n.js' || rel === 'data/brands.js' || rel === 'lib/domains.js',
      `${rel} enthält eine feste Internet-Adresse`);
  }
});

test('QR-Modul überschreibt die CDN-Adresse der Bibliothek auf die lokale Datei', () => {
  const qr = fs.readFileSync(path.join(root, 'qr.js'), 'utf8');
  assert.match(qr, /locateFile/);
  assert.match(qr, /runtime\.getURL\('src\/vendor\/zxing-wasm\/reader\/zxing_reader\.wasm'\)/);
});

test('Fremdbild-Prüfung läuft nur mit Einstellung und ohne Cookies/Referrer', () => {
  const remote = fs.readFileSync(path.join(root, 'remote.js'), 'utf8');
  assert.match(remote, /credentials: 'omit'/);
  assert.match(remote, /referrerPolicy: 'no-referrer'/);
  const bg = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
  assert.match(bg, /remoteScanAllowed\(config\)/);
});
