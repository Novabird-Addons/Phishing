// QR-Codes in Bildern finden (zxing-wasm, Reader-Build, lokal).
import { prepareZXingModule, readBarcodes } from './vendor/zxing-wasm/reader/index.js';

let prepared = false;
function prepare() {
  if (prepared) return;
  prepareZXingModule({
    overrides: {
      // Die WASM-Datei liegt in der Erweiterung; die CDN-Adresse aus share.js wird nie benutzt.
      locateFile: (path) => (path.endsWith('.wasm')
        ? messenger.runtime.getURL('src/vendor/zxing-wasm/reader/zxing_reader.wasm')
        : path),
    },
    fireImmediately: false,
  });
  prepared = true;
}

/** http(s)-Adressen aller QR-Codes in den übergebenen Bildern. @returns {Promise<string[]>} */
export async function findQrUrls(images) {
  if (!images.length) return [];
  prepare();
  const urls = new Set();
  for (const img of images) {
    try {
      const results = await readBarcodes(img.imageData, {
        formats: ['QRCode'], tryHarder: true, tryInvert: true, tryRotate: true, maxNumberOfSymbols: 3,
      });
      for (const r of results) if (r.isValid && /^https?:\/\//i.test(r.text)) urls.add(r.text.trim());
    } catch (e) {
      console.warn('PhishingPilot: QR-Suche in Bild fehlgeschlagen', img.name, e?.message);
    }
  }
  return [...urls];
}
