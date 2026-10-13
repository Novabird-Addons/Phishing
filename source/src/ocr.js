// Text in Bildern lesen (tesseract-wasm, lokal). Die Bibliothek hält nur ein Sprachmodell pro Worker; deshalb
// gibt es je Sprache einen Worker, die parallel (oder nacheinander) laufen. Die Texte aller Sprachen werden
// vereinigt: Ein Signal feuert, sobald eine Sprache es findet – das Ergebnis ist also nie niedriger als das
// des gefährlicheren Durchlaufs. Die Worker starten bei Bedarf und werden nach kurzer Ruhe beendet.
import { OCRClient } from './vendor/tesseract-wasm/lib.js';
import { MAX_LANGUAGES, modelData } from './ocr-models.js';

const BASE = 'src/vendor/tesseract-wasm/';
const IDLE_MS = 15_000;
const TIMEOUT_MS = 8_000;           // pro Bild und Sprache
export const MIN_OCR_WIDTH = 200;   // kleinere Bilder (Icons, Logos) enthalten selten lesbare Köder-Texte
export const MAX_OCR_IMAGES = 3;

const pool = new Map();             // Sprache -> Promise<OCRClient> (Modell geladen)
let wasmBytes = null;
let idleTimer = null;

// WebAssembly-SIMD erkennen (schneller); sonst Fallback-Build.
const hasSimd = () => WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
const load = async (file) => (await fetch(messenger.runtime.getURL(BASE + file))).arrayBuffer();

function getClient(lang) {
  if (!pool.has(lang)) {
    pool.set(lang, (async () => {
      wasmBytes ??= await load(hasSimd() ? 'tesseract-core.wasm' : 'tesseract-core-fallback.wasm');
      const model = await modelData(lang);
      if (!model) throw new Error(`Modell fehlt: ${lang}`);
      const client = new OCRClient({ workerURL: messenger.runtime.getURL(BASE + 'tesseract-worker.js'), wasmBinary: wasmBytes.slice(0) });
      await client.loadModel(model);
      return client;
    })().catch((e) => { pool.delete(lang); throw e; }));
  }
  return pool.get(lang);
}

/** Beendet alle Worker (nach Ruhezeit oder wenn sich Sprachen/Modelle ändern). */
export async function resetOcr() {
  clearTimeout(idleTimer);
  const clients = [...pool.values()];
  pool.clear();
  wasmBytes = null;
  await Promise.allSettled(clients.map(async (p) => (await p).destroy()));
}

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('OCR-Zeitüberschreitung')), ms)),
]);

async function readLanguage(lang, images) {
  const client = await getClient(lang);
  const texts = {};
  for (const img of images) {
    try {
      await client.loadImage(img.imageData);
      texts[img.key] = (await withTimeout(client.getText(), TIMEOUT_MS)).replace(/\s+/g, ' ').trim();
    } catch (e) {
      console.warn('PhishingPilot: OCR fehlgeschlagen', lang, img.key, e?.message);
    } finally {
      await client.clearImage().catch(() => {});
    }
  }
  return texts;
}

/**
 * Liest den Text der übergebenen Bilder (nur ab MIN_OCR_WIDTH, höchstens MAX_OCR_IMAGES) in jeder Sprache.
 * @param {Array<{key:string, imageData:ImageData}>} images
 * @param {string[]} languages z. B. ['deu','eng']
 * @param {{parallel?: boolean}} options
 * @returns {Promise<{texts: Record<string,string>, languages: string[], ms: number}>} texts: key -> vereinigter Text
 */
export async function ocrImages(images, languages = ['deu', 'eng'], { parallel = true } = {}) {
  const t0 = performance.now();
  const todo = images.filter((i) => i.imageData.width >= MIN_OCR_WIDTH).slice(0, MAX_OCR_IMAGES);
  const langs = [...new Set(languages)].slice(0, MAX_LANGUAGES);
  const texts = {};
  const used = [];
  if (!todo.length) return { texts, languages: used, ms: 0 };

  // Mit nur einem Prozessorkern bringt Parallelität nichts (nur mehr Speicher gleichzeitig).
  let results;
  if (parallel && (navigator.hardwareConcurrency ?? 2) > 1) {
    results = await Promise.allSettled(langs.map((l) => readLanguage(l, todo)));
  } else {
    results = [];
    for (const l of langs) results.push(await Promise.allSettled([readLanguage(l, todo)]).then((r) => r[0]));
  }
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') { console.warn('PhishingPilot: OCR-Sprache nicht verfügbar', langs[i], r.reason?.message); return; }
    used.push(langs[i]);
    for (const [key, text] of Object.entries(r.value)) texts[key] = `${texts[key] ?? ''} ${text}`.trim().slice(0, 1200);
  });

  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => resetOcr(), IDLE_MS);
  return { texts, languages: used, ms: Math.round(performance.now() - t0) };
}
