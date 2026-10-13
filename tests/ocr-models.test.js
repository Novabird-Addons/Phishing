import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gitBlobSha1, verifyModel } from '../source/src/lib/modelcheck.js';
import { OCR_MODELS, TESSDATA_BASE, TESSDATA_COMMIT } from '../source/src/data/ocr-languages.js';
import { downloadBytes } from '../source/src/remote.js';

test('Git-Blob-Prüfsumme entspricht "git hash-object"', async () => {
  assert.equal(await gitBlobSha1(new TextEncoder().encode('hello world\n')), '3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
});

test('Sprachliste: fester Commit, gültige Prüfsummen, Deutsch/Englisch nicht doppelt, keine Nicht-Sprachen', () => {
  assert.match(TESSDATA_COMMIT, /^[0-9a-f]{40}$/);
  assert.ok(TESSDATA_BASE.includes(TESSDATA_COMMIT), 'URL muss an den Commit gebunden sein (kein "main")');
  assert.ok(OCR_MODELS.length > 100);
  for (const m of OCR_MODELS) {
    assert.match(m.sha1, /^[0-9a-f]{40}$/, m.code);
    assert.ok(m.size >= 100_000, m.code);
    assert.ok(!['deu', 'eng', 'osd', 'equ'].includes(m.code), m.code);
  }
  assert.ok(OCR_MODELS.some((m) => m.code === 'fra'));
});

test('Manipulierte oder falsche Datei wird abgelehnt', async () => {
  const good = new TextEncoder().encode('hello world\n');
  const expected = { size: good.byteLength, sha1: '3b18e512dba79e4c8300dd08aeb37f8e728b8dad' };
  await verifyModel(good, expected);
  const bad = Uint8Array.from(good); bad[0] ^= 1;
  await assert.rejects(verifyModel(bad, expected), /Prüfsumme/);
  await assert.rejects(verifyModel(good.slice(0, 5), expected), /Größe/);
});

test('Echter Download: französisches Modell vom festen Commit passt zur Prüfsumme', async (t) => {
  const fra = OCR_MODELS.find((m) => m.code === 'fra');
  let bytes;
  try { bytes = await downloadBytes(`${TESSDATA_BASE}fra.traineddata`, { maxBytes: fra.size + 1024, timeoutMs: 30_000 }); }
  catch (e) { t.skip('kein Netz: ' + e.message); return; }
  await verifyModel(bytes, fra);
});
