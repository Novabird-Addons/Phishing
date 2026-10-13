// Erzeugt src/data/ocr-languages.js: Liste der herunterladbaren OCR-Modelle (tessdata_fast) mit fester
// Version (Commit) und Git-Blob-Prüfsumme. Entwicklungswerkzeug – braucht Netz (GitHub-API).
// Aufruf: node tests/tools/make-ocr-languages.mjs
import fs from 'node:fs';

const REPO = 'tesseract-ocr/tessdata_fast';
const head = await (await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`)).json();
const commit = head[0].sha;
const tree = await (await fetch(`https://api.github.com/repos/${REPO}/git/trees/${commit}?recursive=1`)).json();
if (tree.truncated) throw new Error('Dateiliste unvollständig');
const SKIP = new Set(['deu', 'eng', 'osd', 'equ']);      // mitgeliefert bzw. keine Sprachen
const models = tree.tree
  .filter((x) => /^[^/]+\.traineddata$/.test(x.path))
  .map((x) => ({ code: x.path.replace('.traineddata', ''), size: x.size, sha1: x.sha }))
  .filter((m) => !SKIP.has(m.code))
  .filter((m) => m.size >= 100_000)       // z. B. frk ist im Repo nur 20 Bytes groß (kaputt)
  .sort((a, b) => a.code.localeCompare(b.code));
const out = `// Erzeugt von tests/tools/make-ocr-languages.mjs – nicht von Hand ändern.
// Quelle: https://github.com/${REPO} (Apache-2.0), fester Commit; sha1 = Git-Blob-Prüfsumme der Datei.
export const TESSDATA_COMMIT = '${commit}';
export const TESSDATA_BASE = 'https://raw.githubusercontent.com/${REPO}/${commit}/';
export const OCR_MODELS = ${JSON.stringify(models)};
`;
fs.writeFileSync(new URL('../../source/src/data/ocr-languages.js', import.meta.url), out);
console.log(models.length, 'Modelle, Commit', commit.slice(0, 7));
