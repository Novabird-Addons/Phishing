// Erzeugt ein QR-Code-PNG für Testmails (nur Entwicklung; der Schreiber wird nicht ausgeliefert).
// Aufruf: node make-qr-fixture.mjs <zxing-wasm-paketordner> <text> <ausgabe.png>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [pkgDir, text, out] = process.argv.slice(2);
const writerJs = pathToFileURL(path.join(path.resolve(pkgDir), 'dist/es/writer/index.js')).href;
const { writeBarcode, prepareZXingModule } = await import(writerJs);
const wasmBinary = fs.readFileSync(path.join(path.resolve(pkgDir), 'dist/writer/zxing_writer.wasm'));
await prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
const res = await writeBarcode(text, { format: 'QRCode', scale: 6, withQuietZones: true, ecLevel: 'M' });
if (res.error) throw new Error(res.error);
const blob = res.image;
const buf = Buffer.from(await blob.arrayBuffer());
console.log('Bildtyp:', blob.type, 'Bytes:', buf.length, 'PNG-Signatur:', buf.slice(1, 4).toString());
fs.writeFileSync(out, buf);
