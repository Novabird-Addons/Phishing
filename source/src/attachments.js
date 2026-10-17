// Anhänge einer Mail prüfen, ohne sie zu öffnen: echter Dateityp (erste Bytes) und Inhaltsverzeichnis von ZIP-Archiven.
// Gelesen wird nur aus der Mail selbst; entpackt oder ausgeführt wird nichts.
import { fileExt, findZipDirectory, parseZipDirectory, sniffType } from './lib/files.js';

const MAX_ATTACHMENTS = 10;
const MAX_BYTES = 50_000_000;   // größere Anhänge werden nicht angefasst
const HEAD_BYTES = 0x8010;      // reicht auch für die ISO-Kennung bei 0x8001
const ZIP_TAIL = 22 + 65_535;   // das Verzeichnis-Ende liegt immer in diesem Bereich
const ZIP_DIR_MAX = 2_000_000;

const bytesOf = async (blob, start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer());

/** Nur echte ZIP-Archive öffnen: Office-Dateien (.docx …) sind intern auch ZIP und enthalten z. B. SVG-Grafiken. */
const isZipArchive = (name, realType) => realType === 'zip' && ['zip', ''].includes(fileExt(name));

async function zipEntries(file) {
  const tailStart = Math.max(0, file.size - ZIP_TAIL);
  const dir = findZipDirectory(await bytesOf(file, tailStart, file.size), tailStart);
  if (!dir || dir.size > ZIP_DIR_MAX) return null;
  return parseZipDirectory(await bytesOf(file, dir.offset, dir.offset + dir.size));
}

/** @returns {Promise<Object<string, {realType:string, archive?:{entries:Array}}>>} Ergebnis je Anhangsname */
export async function scanAttachments(messageId) {
  const list = (await messenger.messages.listAttachments(messageId))
    .filter((a) => a.name && a.size > 0 && a.size <= MAX_BYTES)
    .slice(0, MAX_ATTACHMENTS);
  const out = {};
  for (const att of list) {
    try {
      const file = await messenger.messages.getAttachmentFile(messageId, att.partName);
      const realType = sniffType(await bytesOf(file, 0, HEAD_BYTES));
      const entries = isZipArchive(att.name, realType) ? await zipEntries(file) : null;
      out[att.name] = { realType, ...(entries ? { archive: { entries } } : {}) };
    } catch (e) {
      console.warn('PhishingPilot: Anhang nicht lesbar', att.name, e?.message);
    }
  }
  return out;
}
