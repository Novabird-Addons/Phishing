// Prüfsumme heruntergeladener OCR-Modelle. Git benennt Dateien nach SHA-1("blob <Länge>\0" + Inhalt);
// diesen Wert liefert die GitHub-API für jede Datei eines festen Commits (siehe data/ocr-languages.js).
export async function gitBlobSha1(bytes) {
  const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const head = new TextEncoder().encode(`blob ${data.byteLength}\0`);
  const all = new Uint8Array(head.length + data.byteLength);
  all.set(head);
  all.set(data, head.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @throws wenn Größe oder Prüfsumme nicht zum erwarteten Modell passen */
export async function verifyModel(bytes, expected) {
  const size = bytes.byteLength;
  if (size !== expected.size) throw new Error(`Größe stimmt nicht (${size} statt ${expected.size} Bytes)`);
  const sha1 = await gitBlobSha1(bytes);
  if (sha1 !== expected.sha1) throw new Error('Prüfsumme stimmt nicht – Datei wird verworfen');
}
