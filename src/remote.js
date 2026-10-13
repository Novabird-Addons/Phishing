// Nachgeladene Fremdbilder prüfen – nur wenn der Nutzer es eingeschaltet und die Host-Berechtigung erteilt hat.
// Ehrlicher Hinweis: Das Bild wird dabei ein zweites Mal geholt (gleiche Adresse und IP wie beim Anzeigen,
// ohne Cookies und ohne Referrer). Der Absender erfährt dadurch nichts, was das Anzeigen nicht schon verraten hat.
import { toImageData, isUsableSize, MAX_IMAGES } from './images.js';

const TIMEOUT_MS = 6_000;
const MAX_BYTES = 4_000_000;

export const REMOTE_ORIGINS = { origins: ['<all_urls>'] };

export async function remoteScanAllowed(config) {
  if (!config.scanRemoteImages) return false;
  try { return await messenger.permissions.contains(REMOTE_ORIGINS); } catch { return false; }
}

/**
 * @param {Array<{src:string,url:string}>} items src = Attribut im HTML (Schlüssel), url = absolute Adresse
 * @returns {Promise<Array<{name:string,key:string,imageData:ImageData}>>}
 */
export async function fetchRemoteImages(items) {
  const out = [];
  for (const it of items.slice(0, MAX_IMAGES)) {
    let url;
    try { url = new URL(it.url); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    try {
      const res = await fetch(url.href, {
        credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'force-cache',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok || !/^image\//i.test(res.headers.get('content-type') || '')) continue;
      const blob = await res.blob();
      if (!isUsableSize(blob.size) || blob.size > MAX_BYTES) continue;
      out.push({ name: url.pathname.split('/').pop(), key: it.src, imageData: await toImageData(blob) });
    } catch (e) {
      console.warn('PhishingPilot: Fremdbild nicht prüfbar', url.hostname, e?.message);
    }
  }
  return out;
}

/**
 * Lädt eine Datei (OCR-Sprachmodell). Wird nur nach ausdrücklicher Zustimmung in den Einstellungen aufgerufen.
 * Es werden keine Daten aus Mails gesendet; keine Cookies, kein Referrer.
 */
export async function downloadBytes(url, { maxBytes = 20_000_000, timeoutMs = 60_000 } = {}) {
  const res = await fetch(url, {
    credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error('Datei ist größer als erwartet');
  return bytes;
}
