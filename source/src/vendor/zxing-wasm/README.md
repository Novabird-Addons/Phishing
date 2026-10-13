# zxing-wasm (Reader-Build) – unverändert übernommen

| | |
|---|---|
| Paket | `zxing-wasm` 3.1.5 (npm, veröffentlicht 2026-10-06) |
| Wrapper-Lizenz | MIT – `LICENSE-zxing-wasm-MIT.txt` |
| Engine | zxing-cpp, Commit `2ecec3f5be0ee803f6e14a5a2c7028c0cfe525b4`, Apache-2.0 – `LICENSE-zxing-cpp-Apache-2.0.txt` (das Repo hat keine NOTICE-Datei) |
| Quelle | `npm pack zxing-wasm@3.1.5` → `dist/es/reader/index.js`, `dist/es/share.js`, `dist/reader/zxing_reader.wasm` |
| Änderungen | keine |
| SHA-256 der WASM-Datei | siehe `SHA256SUMS` |

Die Quelle der WASM-Datei (C++) liegt in https://github.com/zxing-cpp/zxing-cpp, der Wrapper in
https://github.com/Sec-ant/zxing-wasm (Build-Anleitung dort im README).

`share.js` enthält als Standard eine CDN-Adresse für die WASM-Datei. Sie wird **nie** benutzt:
`src/qr.js` überschreibt `locateFile` auf die lokale Datei, und die Content-Security-Policy im
Manifest erlaubt keine Verbindungen außer zur Erweiterung selbst.
