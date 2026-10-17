// Anhänge: Endungen, getarnte Dateinamen, echter Dateityp (erste Bytes) und Inhaltsverzeichnis von ZIP-Archiven.
// Reine Logik ohne Thunderbird-Zugriff; die Bytes liefert background.js.

/** Endungen, die beim Öffnen Code ausführen oder Zugangsdaten abgreifen können. */
export const RISKY_EXT = new Set([
  'html', 'htm', 'xhtml', 'svg', 'iso', 'img', 'lnk', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'hta',
  'exe', 'scr', 'bat', 'cmd', 'ps1', 'msi', 'jar', 'docm', 'xlsm', 'pptm', 'dotm', 'xlam', 'chm', 'one',
  'com', 'pif', 'cpl', 'reg', 'vhd', 'vhdx', 'appx', 'msix', 'url',
]);
export const ARCHIVE_EXT = new Set(['zip', '7z', 'rar', 'gz', 'tar', 'iso', 'img']);
// Endungen, hinter denen man ein harmloses Dokument erwartet ("Rechnung.pdf")
const DOC_EXT = 'pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|csv|jpe?g|png|gif|bmp|tiff?|heic|mp3|mp4|wav|zip|rar|7z';
const DOUBLE_EXT = new RegExp(`\\.(${DOC_EXT})[\\s._-]*\\.([a-z0-9]{1,5})$`, 'i');
// Steuerzeichen für die Schreibrichtung (RTLO u. a.): "Rechnung‮fdp.exe" erscheint als "Rechnungexe.pdf"
const BIDI = /[‪-‮⁦-⁩‎‏]/;

export function fileExt(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : '';
}

/** Dokument-Endung vor einer gefährlichen Endung ("rechnung.pdf.exe", "scan.jpg   .html").
 *  "Rechnung.2024.pdf" oder "backup.tar.gz" zählen nicht – nur gefährliche zweite Endungen. */
export function doubleExtension(name) {
  const m = String(name || '').match(DOUBLE_EXT);
  return !!m && RISKY_EXT.has(m[2].toLowerCase());
}

export const hasBidiControl = (name) => BIDI.test(String(name || ''));

/** Dateiname, der eine andere Endung vortäuscht (Doppel-Endung oder Schreibrichtungs-Trick). */
export const disguisedName = (name) => doubleExtension(name) || hasBidiControl(name);

const startsWith = (b, sig, at = 0) => sig.every((x, i) => b[at + i] === x);
const ascii = (b, at, len) => String.fromCharCode(...b.subarray(at, at + len));

/** Echter Dateityp aus den ersten Bytes ("sniffing"). Nur die Typen, die für die Prüfung zählen; sonst ''. */
export function sniffType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 4) return '';
  if (b[0] === 0x4d && b[1] === 0x5a) return 'exe';                          // MZ: Windows-Programm/DLL
  if (startsWith(b, [0x7f, 0x45, 0x4c, 0x46])) return 'elf';                 // Linux-Programm
  if (startsWith(b, [0x4c, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00])) return 'lnk';   // Windows-Verknüpfung
  if (startsWith(b, [0xca, 0xfe, 0xba, 0xbe]) || startsWith(b, [0xcf, 0xfa, 0xed, 0xfe])) return 'macho';
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return 'zip';  // auch docx/xlsx/jar
  if (ascii(b, 0, 4) === 'Rar!') return 'rar';
  if (startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return '7z';
  if (startsWith(b, [0x1f, 0x8b])) return 'gz';
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf';
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';  // alte Office-Dateien, .msi, .one
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (ascii(b, 0, 4) === 'GIF8') return 'gif';
  if (b.length >= 0x8006 && ascii(b, 0x8001, 5) === 'CD001') return 'iso';
  const head = ascii(b, 0, Math.min(b.length, 512)).replace(/^﻿|^\xEF\xBB\xBF/, '').trimStart().toLowerCase();
  if (head.startsWith('#!')) return 'script';
  if (/^(<!doctype html|<html|<head|<body|<script|<svg|<\?xml[^>]*>\s*<svg)/.test(head)) return 'html';
  return '';
}

// Echte Typen, die ausführbar sind oder Code nachladen – egal, wie die Datei heißt
const EXECUTABLE_TYPES = new Set(['exe', 'elf', 'lnk', 'macho', 'script']);
// Was eine Endung erwarten lässt; nur für harmlos wirkende Endungen (gefährliche Endungen meldet RISKY_EXT ohnehin)
const EXPECTED = {
  pdf: ['pdf'], jpg: ['jpeg'], jpeg: ['jpeg'], png: ['png'], gif: ['gif'],
  docx: ['zip'], xlsx: ['zip'], pptx: ['zip'], odt: ['zip'], ods: ['zip'], odp: ['zip'], zip: ['zip'],
  doc: ['ole'], xls: ['ole'], ppt: ['ole'], rar: ['rar'], '7z': ['7z'], gz: ['gz'], txt: [''], csv: [''], rtf: [''],
};

/** Täuscht eine Dokument-, Bild- oder Archiv-Endung einen Inhalt vor, der Code ausführt oder eine Webseite ist?
 *  ("Rechnung.pdf" ist ein Programm, "Scan.jpg" eine Login-Seite.) Sonstige Abweichungen (falsch benannte Bilder,
 *  "deploy.sh" mit #!) kommen auch bei echten Mails vor und zählen nicht. */
export function typeMismatch(name, realType) {
  const ext = fileExt(name);
  if (!(ext in EXPECTED) || EXPECTED[ext].includes(realType)) return false;
  return EXECUTABLE_TYPES.has(realType) || realType === 'html';
}

const u16 = (b, at) => b[at] | (b[at + 1] << 8);
const u32 = (b, at) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** Sucht im Dateiende den "End of Central Directory"-Eintrag.
 *  @param tail die letzten Bytes der Datei (mindestens 22, höchstens 22 + 65535 reichen immer)
 *  @param tailStart Position von tail[0] in der Datei
 *  @returns {{offset:number, size:number, count:number}|null} Lage des Inhaltsverzeichnisses */
export function findZipDirectory(tail, tailStart) {
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) !== 0x06054b50) continue;
    const count = u16(tail, i + 10), size = u32(tail, i + 12), offset = u32(tail, i + 16);
    if (offset === 0xffffffff || size === 0xffffffff) return null;            // ZIP64: nicht unterstützt
    if (offset + size > tailStart + i) continue;                               // passt nicht, weiter suchen
    return { offset, size, count };
  }
  return null;
}

/** Liest das Inhaltsverzeichnis (Central Directory) eines ZIP: Namen und ob verschlüsselt. Entpackt nichts. */
export function parseZipDirectory(dir, max = 500) {
  const entries = [];
  let p = 0;
  while (p + 46 <= dir.length && entries.length < max && u32(dir, p) === 0x02014b50) {
    const flags = u16(dir, p + 8);
    const nameLen = u16(dir, p + 28), extraLen = u16(dir, p + 30), commentLen = u16(dir, p + 32);
    const raw = dir.subarray(p + 46, p + 46 + nameLen);
    // Bit 11: UTF-8; sonst CP437 – für die Endungen genügt Latin-1
    const name = flags & 0x800 ? new TextDecoder().decode(raw) : String.fromCharCode(...raw);
    if (!name.endsWith('/')) entries.push({ name, encrypted: !!(flags & 1) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Bewertet den Inhalt eines Archivs: erster gefährlicher Eintrag (Endung oder getarnter Name) und ob Einträge
 *  verschlüsselt sind. Verschachtelte Archive werden nicht geöffnet. */
export function inspectArchive(entries) {
  const risky = entries.find((e) => {
    const base = e.name.split('/').pop();
    return RISKY_EXT.has(fileExt(base)) || disguisedName(base);
  });
  return {
    riskyEntry: risky ? risky.name.split('/').pop() : '',
    disguisedEntry: !!risky && disguisedName(risky.name.split('/').pop()),
    encrypted: entries.some((e) => e.encrypted),
    count: entries.length,
  };
}
