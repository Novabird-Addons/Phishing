// OCR-Sprachmodelle: Deutsch und Englisch liegen im Add-on, weitere werden auf Wunsch geladen
// und in IndexedDB abgelegt (gleicher Speicher für Hintergrundskript und Einstellungsseite).
import { OCR_MODELS, TESSDATA_BASE } from './data/ocr-languages.js';
import { verifyModel } from './lib/modelcheck.js';
import { downloadBytes } from './remote.js';

export const BUNDLED = ['deu', 'eng'];
export const MAX_LANGUAGES = 3;

const DB = 'phishing-pilot-ocr';
const STORE = 'models';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally { db.close(); }
}

export const modelInfo = (code) => OCR_MODELS.find((m) => m.code === code) ?? null;
export const installedLanguages = async () => (await tx('readonly', (s) => s.getAllKeys())) ?? [];

/** Modelldaten als frische ArrayBuffer-Kopie oder null, wenn nicht vorhanden. */
export async function modelData(code) {
  if (BUNDLED.includes(code)) {
    const res = await fetch(messenger.runtime.getURL(`src/vendor/tesseract-wasm/${code}.traineddata`));
    return res.arrayBuffer();
  }
  const rec = await tx('readonly', (s) => s.get(code));
  return rec ? rec.data.slice(0) : null;
}

/** Lädt ein Modell vom festen Commit, prüft Größe und Prüfsumme und speichert es. */
export async function installLanguage(code) {
  const info = modelInfo(code);
  if (!info) throw new Error(`Unbekannte Sprache: ${code}`);
  const bytes = await downloadBytes(`${TESSDATA_BASE}${code}.traineddata`, { maxBytes: info.size + 1024 });
  await verifyModel(bytes, info);
  await tx('readwrite', (s) => s.put({ data: bytes.buffer, size: info.size, sha1: info.sha1, installedAt: Date.now() }, code));
}

export const removeLanguage = (code) => tx('readwrite', (s) => s.delete(code));
