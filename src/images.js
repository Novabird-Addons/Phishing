// Bilder einer Mail dekodieren (einmal), damit QR-Suche und OCR sie gemeinsam nutzen.
// Es werden nur Bilder aus der Mail selbst gelesen – oder, mit ausdrücklicher Zustimmung, Fremdbilder (siehe remote.js).

export const MAX_IMAGES = 6;
const MIN_BYTES = 1_000;        // kleinere Bilder sind Icons/Pixel
const MAX_BYTES = 4_000_000;
const MAX_SIDE = 1600;          // größere Bilder werden verkleinert (Zeit und Speicher)

export async function toImageData(blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';                       // transparente Bereiche weiß, sonst unlesbar
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return ctx.getImageData(0, 0, w, h);
}

export const isUsableSize = (bytes) => bytes >= MIN_BYTES && bytes <= MAX_BYTES;

/** @returns {Promise<Array<{name:string, key:string, imageData:ImageData}>>} */
export async function loadEmbeddedImages(messageId) {
  const attachments = await messenger.messages.listAttachments(messageId);
  const wanted = attachments
    .filter((a) => /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(a.contentType) && isUsableSize(a.size))
    .slice(0, MAX_IMAGES);
  const images = [];
  for (const att of wanted) {
    try {
      const file = await messenger.messages.getAttachmentFile(messageId, att.partName);
      images.push({ name: att.name, key: String(att.name || '').toLowerCase(), imageData: await toImageData(file) });
    } catch (e) {
      console.warn('PhishingPilot: Bild nicht lesbar', att.name, e?.message);
    }
  }
  return images;
}
