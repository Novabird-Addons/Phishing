# Drittanbieter-Code und -Daten

Stand: 2026-10-11

## Code

Gebündelte Bibliotheken, jeweils unverändert und ohne Build-Abhängigkeiten
(`package.json` enthält nur Test-Skripte für `node --test`). Lizenztexte, Herkunft und
Prüfsummen liegen im jeweiligen Ordner (`README.md`, `LICENSE-*`, `SHA256SUMS`).

| Bibliothek | Version | Lizenz | Pfad |
|---|---|---|---|
| zxing-wasm (Reader-Build, QR-Dekodierung) | 3.1.5 | MIT (Wrapper) | `source/src/vendor/zxing-wasm/` |
| zxing-cpp (Engine in der WASM-Datei) | Commit `2ecec3f` | Apache-2.0, keine NOTICE-Datei | `source/src/vendor/zxing-wasm/` |
| tesseract-wasm (OCR-Client, Worker, WASM) | 0.11.0 | BSD-2-Clause | `source/src/vendor/tesseract-wasm/` |
| Tesseract (Engine in der WASM-Datei) | 5.3.0 | Apache-2.0 | `source/src/vendor/tesseract-wasm/` |
| Leptonica (in der WASM-Datei) | 1.83.1 | Leptonica-Lizenz (BSD-artig) | `source/src/vendor/tesseract-wasm/` |
| Comlink (in den OCR-Skripten eingebettet) | 4.x | Apache-2.0 | `source/src/vendor/tesseract-wasm/` |
| `deu.traineddata` (tessdata_fast) | – | Apache-2.0 | `source/src/vendor/tesseract-wasm/` |

Zusätzliche OCR-Sprachmodelle (`tessdata_fast`, Apache-2.0) werden **nur auf Wunsch des Nutzers** zur Laufzeit von
`raw.githubusercontent.com` geladen (fester Commit, Prüfsumme in `source/src/data/ocr-languages.js`) und lokal gespeichert;
sie sind nicht Teil des Pakets.

Beide WASM-Builds sind mit Emscripten erzeugt; dessen Laufzeitteile stehen unter MIT/UIUC bzw.
Apache-2.0 mit LLVM-Ausnahme.

Der Schreib-Teil von zxing-wasm (enthält Zint, BSD-3-Clause) wird **nicht** ausgeliefert; er dient nur
dem Erzeugen von Testbildern (`tests/tools/make-qr-fixture.mjs`, aus einem separat geladenen npm-Paket).

Die Projekte PhishGuard (MIT), EmailSecurityScanner (MIT), tb-spam-guard und
PhishDetect wurden nur als Ideengeber gelesen. Es wurde **kein Code kopiert**.
Alle Heuristiken sind eigene Implementierungen.

## Daten

| Datei | Herkunft | Lizenz |
|---|---|---|
| `source/src/data/brands.js` | selbst erstellt (öffentlich bekannte Marken-Domains) | wie das Projekt (MIT) |
| `source/src/data/banks-wikidata.js` | [Wikidata](https://www.wikidata.org) (Banken in EU-Ländern mit offizieller Website), erzeugt mit `tools/fetch-wikidata-banks.mjs` | CC0 1.0 (gemeinfrei; Quellenangabe freiwillig) |
| `source/src/data/banks-wikidata.js` | [Wikidata](https://www.wikidata.org) (Banken in EU-Ländern mit offizieller Website), erzeugt mit `tools/fetch-wikidata-banks.mjs` | CC0 1.0 (gemeinfrei; Quellenangabe freiwillig) |
| Homoglyph-Tabelle in `source/src/lib/text.js` | selbst erstellt | wie das Projekt (MIT) |
| Punycode-Dekodierung in `source/src/lib/domains.js` | eigene Umsetzung von RFC 3492 | wie das Projekt (MIT) |

## Bewusst nicht verwendet

- `red.flag.domains` (CC BY-NC-SA 4.0): nicht kommerziell und Share-Alike, nicht
  mit einem frei weitergebbaren Add-on / NovaBird-Modul vereinbar.
- Safe Browsing, OpenPhish u. ä.: Nutzungsbedingungen schließen kommerzielle
  Nutzung aus; zudem sendet das Add-on bewusst keinen Netzverkehr.

## Möglich später (Lizenz vorher prüfen)

- Public Suffix List (MPL-2.0): wäre als Datei bündelbar, MPL-Hinweis nötig.
  Bis dahin: kleine eigene Liste von Zwei-Ebenen-Suffixen in `domains.js`.
- Unicode `confusables.txt` (UTS #39): Unicode-Lizenz, permissiv; bisher
  genügt die eigene Tabelle.
