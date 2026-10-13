# tesseract-wasm 0.11.0 + Sprachmodell – unverändert übernommen

| Teil | Version / Quelle | Lizenz | Datei |
|---|---|---|---|
| tesseract-wasm (JS-Client, Worker, WASM-Build) | npm `tesseract-wasm@0.11.0`, https://github.com/robertknight/tesseract-wasm | BSD-2-Clause | `LICENSE-tesseract-wasm-BSD-2-Clause.txt` |
| Tesseract OCR (in der WASM-Datei) | v5.3.0, Commit `080da83` | Apache-2.0 | `LICENSE-tesseract-Apache-2.0.txt` |
| Leptonica (in der WASM-Datei) | v1.83.1, Commit `b667978` | Leptonica-Lizenz (BSD-artig) | `LICENSE-leptonica.txt` |
| Comlink (in `lib.js` und `tesseract-worker.js` eingebettet) | Google LLC | Apache-2.0 | `LICENSE-comlink-Apache-2.0.txt` |
| `deu.traineddata`, `eng.traineddata` | https://github.com/tesseract-ocr/tessdata_fast (fast-Modelle) | Apache-2.0 | gleicher Text wie Tesseract |
| Build-Werkzeug | Emscripten 3.1.31 (Laufzeitteile in der WASM-Datei) | MIT/UIUC bzw. Apache-2.0 mit LLVM-Ausnahme | – |

Änderungen: keine. Die Versionen der eingebauten Bibliotheken stehen in `third_party_versions.mk`.
Prüfsummen: `SHA256SUMS`.

Die WASM-Dateien werden aus dem Add-on geladen (`src/ocr.js`); es gibt keinen Zugriff auf ein CDN.
