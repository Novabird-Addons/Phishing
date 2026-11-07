# Novabird-phishing – Entwicklung und Technik

Technische Details, Entscheidungen und Versionsgeschichte. Die Kurzbeschreibung für Nutzer steht im [README](../README.md).

Lokales, offline arbeitendes Phishing-Add-on für Betterbird/Thunderbird (≥ 153). Kein Netzverkehr,
keine Abhängigkeiten, Lizenz MIT (siehe `THIRD_PARTY.md`). Später als Modul für NovaBird gedacht.

## Was es erkennt

Jedes dieser beiden Signale **allein** setzt die Stufe „verdächtig“:

- **Kontakt-Imitation:** Anzeigename gehört zu einem Kontakt (Adressbuch) oder bekanntem Absender, die Adresse ist aber neu.
  (Gleiche Firmendomain, kein Freemailer: kein Alarm.)
- **Antwort ohne Bezug:** „Re:/AW:“ ohne `In-Reply-To`/`References`, oder der Bezug liegt in keinem lokalen Ordner.

Weitere Signale (Gewichte in `source/src/lib/config.js`): DMARC/SPF/DKIM (nur Header des eigenen Servers),
Markenname vs. Domain, Lookalike-/Homoglyphen-Domains, Link-Text ≠ Ziel, IP-/Shortener-/Redirect-Links,
Passwortfelder, riskante Anhänge, QR-Codes und Texte in Bildern (lokal dekodiert bzw. per OCR gelesen), Reply-To-Fremddomain, Erstkontakt, Druckwörter. Schwache Signale warnen nie allein.

## Betrieb

- **Schattenmodus (Standard):** bewertet nur, schreibt ein Protokoll (ohne Adressen), kein Banner, kein Tag.
  Export über die Einstellungen. Umschalten auf „Aktiv“ ebenda.
- **Aktiv:** Tag in der Nachrichtenliste, Banner mit Gründen, bei „gefährlich“ Link-Bestätigung.

## Entwicklung

```bash
npm test          # Unit-Tests (Node, schnell)
npm run e2e       # Headless-Thunderbird per Marionette (Snap-Thunderbird, Port 2828)
```

### Arbeitsplätze: Linux und Windows

Bis 0.5.6 wurde nur unter Linux entwickelt. Unter Windows liegt der Klon in **`C:\Claude-phishing`** (Git Bash: `/c/Claude-phishing`);
Shell-Skripte dort in Git Bash starten, nicht in PowerShell.

| | Linux | Windows |
|---|---|---|
| `npm test` | ja | ja (53/53) |
| `./build-xpi.sh` | ja | ja, in Git Bash. Nimmt `python3`, sonst `python` – unter Windows ist `python3` oft nur der Store-Platzhalter |
| `npm run e2e` | ja (Snap-Thunderbird `/snap/bin/thunderbird`, `setsid`, `ss`) | nein – die Skripte setzen Linux und das Snap-Thunderbird voraus |
| `npm run check` | ja | sollte gehen (reines Node), noch nicht geprüft |

- **Pfade in Node-Skripten:** `fileURLToPath(new URL(…, import.meta.url))` statt `.pathname` – unter Windows liefert `.pathname`
  `/C:/…`, daraus wird `C:\C:\…`.
- **Zeilenenden:** `.gitattributes` checkt `*.sh` immer mit LF aus, damit derselbe Ordner auch unter WSL/Linux läuft. Die übrigen
  Textdateien bekommen unter Windows mit `core.autocrlf=true` CRLF; ein dort gebautes XPI ist deshalb nicht byte-gleich mit dem
  Linux-Build (andere SHA-256), funktioniert aber genauso. Releases weiter unter Linux bauen.

Aufbau: `source/src/lib/` reine Logik (getestet), `source/src/background.js` Thunderbird-Anbindung,
`source/src/content/banner.js` Banner, `tests/e2e/` Marionette-Client + Testprofil.

## Wer gilt als „bekannter“ Absender? (ab v0.2.9)

Nicht schon, wer mehrfach im Postfach vorkommt – sonst würde hartnäckiger Spam mit der Zeit legitimiert. Zwei Stufen
(`source/src/lib/history.js`):

| Stufe | Bedingung | Wirkung |
|---|---|---|
| **voll bekannt** | im Adressbuch, oder du hast der Adresse geschrieben | kein Erstkontakt-Hinweis, Bonus −15 (außer bei Fälschungs-Signalen), Inhaltsprüfungen auf Krypto-Werbung/Zufallsdomain/Marke im Text entfallen, Newsletter-Lockerungen |
| **oft empfangen** | mindestens 3 Mails über mindestens 14 Tage, **nie aufgefallen** | nur der Erstkontakt-Hinweis entfällt |

Die Namen etablierter Absender dienen der Kontakt-Imitations-Erkennung („Max Mustermann“ schreibt plötzlich von einer anderen Adresse).

**Erstscan** (beim ersten Start, nach Index-Änderungen, nach „Absenderhistorie neu aufbauen“ und nach Änderung von Rückblick
oder Ausnahme-Ordnern):

1. Kopfdaten (Absender, Empfänger, Datum) aller Ordner im eingestellten **Rückblick** (Standard 12 Monate, höchstens 18).
   Spam, Papierkorb, Entwürfe, Vorlagen, Postausgang und ausgenommene Ordner zählen nicht; Feed- und News-Konten auch nicht.
   Eine Mail, die als Junk markiert ist, unseren Tag „verdächtig/gefährlich“ trägt oder deren Absenderzeile auffällt
   (Marke im Namen bei fremder Domain, Lookalike, Zufallsdomain, Adresse im Anzeigenamen), **markiert** den Absender.
2. Absender, die „oft empfangen“ erreichen, werden mit ihren letzten 2 Mails vom normalen Analyzer geprüft (ohne OCR) –
   **nur bei POP3-Konten und Lokalen Ordnern**. Bei IMAP (und anderen Kontotypen) zeigt die Add-on-API nicht an, ob eine
   Offline-Kopie existiert; der Scan liest dort keine Mail vollständig, damit nichts vom Server geladen wird. Dort gilt nur die
   Kopfzeilen-Prüfung. (Mit einer Experiment-API – NovaBird-DB oder das Offline-Flag – ließe sich das später nachrüsten.)

**Laufend:** Neue Mails zählen erst nach ihrer Bewertung und nur, wenn sie unauffällig sind; auffällige markieren den Absender.
Für noch nicht voll bekannte Absender sucht das Add-on in den Gesendet-Ordnern (nur Kopfdaten, im Rückblick) nach Mails an sie.

„Diesem Absender vertrauen“ fragt nach; bei „gefährlich“ zweistufig und mit der Punktzahl.

## OCR-Sprachen

Standard: Deutsch + Englisch (mitgeliefert, je ein Durchlauf pro Sprache). In den Einstellungen lassen sich bis zu 3 Sprachen
wählen und weitere aus `tesseract-ocr/tessdata_fast` herunterladen – nach Rückfrage, von einem festen Commit und mit
Prüfsumme (Git-Blob-SHA-1). Aus Mails wird dabei nichts gesendet.

Jede Sprache läuft in einem eigenen Worker, standardmäßig parallel (`ocrParallel`). Die Texte aller Sprachen werden vereinigt, das
Ergebnis ist also nie niedriger als das des gefährlicheren Durchlaufs. Messung im Test (Bild 900×320, Thunderbird 157 headless):
2 Sprachen 113 ms nacheinander / 65 ms parallel, 3 Sprachen 211 ms / 63 ms. Neue Liste erzeugen: `node tests/tools/make-ocr-languages.mjs`.

## Inhalt: Erpressung und Füllwörter

`source/src/lib/scam.js` erkennt Erpressungs-Mails („Sextortion“) am Inhalt (DE/EN): Behauptung gehackter Geräte/Kamera, Drohung mit
Veröffentlichung, Kryptowährung und Wallet-Adresse, Frist, „nicht antworten/Polizei“. Wallet + Hacking-/Drohbehauptung oder
mehrere Merkmale zusammen ergeben „gefährlich“ (erzwungen, auch von bekannten Absendern); Newsletter nur beim Volltreffer.
Ein Füllwort, das ≥ 25 % der Wörter ausmacht (Trick gegen Spamfilter), wird gemeldet und vor der Textanalyse entfernt.
Das Banner trägt dann die Überschrift „Erpressungs-Mail (Scam) – nicht bezahlen, nicht antworten“.

## Spam, der an dein Geld will

Für unbekannte Absender: zufällig wirkende Absenderdomain (`zkwd.de`, `5yngrqr7.com`), Anlage-/Krypto-Köder im Text oder im
Bild (mindestens zwei Begriffe plus Dringlichkeit, z. B. Bitcoin + investieren + „jetzt“) und unsichtbare Füllzeichen
(schwach, nur als Begleiter, da auch legitime Newsletter sie nutzen). Fast reine Bild-Mails (< 400 Zeichen Text) laufen durch die OCR.
`node tests/tools/eml-run.mjs <ordner>` zeigt zusätzlich, ob der Provider die Mail selbst als Spam markiert hat (`X-Spam-Flag`).

## Zusammenspiel mit NovaBird-Conversation

Die Konversationsansicht ersetzt den Inhalt des Nachrichtendokuments (`document.body.replaceChildren()`) und baut
`#nbc-root` auf, auch nachträglich. Das Banner hängt sich deshalb als erstes Element in `#nbc-root` (sonst in den `<body>`)
und wird per `MutationObserver` wieder angehängt, wenn der Inhalt ersetzt wird (`source/src/content/banner.js`).
Test: `EXTRA_ADDONS=<conversation-ordner> node tests/e2e/clickthrough.mjs work/testext testdata/phishingset 600`
(Conversation rendert einzelne Mails nur mit `alwaysRender: true`).

## Bekannte Grenzen

- QR-Codes und OCR arbeiten auf **eingebetteten** Bildern (Anhänge, `cid:`), nicht in PDFs.
- **Fremdbilder** (aus dem Netz) werden nie automatisch geladen. Optional (Einstellungen, standardmäßig aus) prüft das Add-on
  Bilder, die *du* nachgeladen hast, durch einen zweiten Abruf (ohne Cookies/Referrer) und braucht dafür die
  Berechtigung „alle Websites“. Weil das Verbindungen nach außen erlaubt, ist die Content-Security-Policy gelockert;
  `tests/no-network.test.js` begrenzt jeden Netzzugriff im Code auf `source/src/remote.js`.
- Ohne die Option sieht das Add-on bei Fremdbildern nur die Struktur (großes Bild als Link auf Fremddomain).
- Zwei-Ebenen-Domains (`co.uk` …) über eine kleine eigene Liste statt Public Suffix List.
- Absenderhistorie wird einmalig aus allen Ordnern aufgebaut und mit neuer Post fortgeschrieben.
- Getestet: Thunderbird 157 (headless). Betterbird 153 noch nicht.

## Fehlalarme: bewusste Ausnahmen (v0.2.7)

Aus einem Test mit 97 legitimen Mails (Shops, Newsletter, Banken, Versand). Diese Muster zählen **nicht** als Signal:
Freemail-Name nur als Wortteil (`drgmail.de`), Link über die eigene Domain des Absenders oder Microsoft-Safelinks,
Listen-Mail mit bestandenem DKIM, deren Linktext die eigene Domain zeigt, Symbol-Leisten (kleine Bilder, ≥ 3 Fremdlinks in der Fußzeile),
Bild-Link, dessen Ziel auch als Textlink vorkommt, Lieferdienste in Listen-Mails, „bestätigt“ als Konto-Wort,
regionale Volksbank-/Sparkassen-Domains (enge Muster `BRAND_PATTERNS` in `analyzer.js`, ohne Wörter wie „secure“/„login“),
Domains mit Ziffern in einem Bindestrich-Teil (`huk24-info.de`), Reply-To = Empfängeradresse. Regressionstest: `tests/analyzer.test.js`.
Bekannt offen: Newsletter, deren Linktext eine andere Domain zeigt und die über einen Tracking-Dienst laufen (ohne SPF/DKIM) bleiben „verdächtig“.

Eigene Testmails prüfen (ohne Inhalte auszugeben): `npm run check -- <ordner> --private --map-file <datei>`;
Details je Mail: `node tests/tools/eml-run.mjs <ordner> --verbose` bzw. `--inspect <Teilstring>`. Ordner mit echten Mails stehen in `.gitignore`.
Der Offline-Lauf kennt keinen Verlauf, daher gilt jeder Absender als Erstkontakt (im Add-on seltener).

## Korrekturen aus dem Code-Review (v0.2.8)

(Ab v0.2.9 zusätzlich: Kontotyp der Lokalen Ordner heißt unter MV3 `local`, nicht `none`.)

- **Ordner-Ausnahmeliste** in den Einstellungen wird wieder angezeigt; vorher leerte jedes Speichern die Liste.
- **Gesendet-Ordner**: Manifest V3 kennt `folder.type` nicht mehr, nur `specialUse`. Deshalb zählte „ich habe ihm geschrieben“ nie, und Papierkorb/Spam/Entwürfe flossen in die Historie ein. Der Index wird einmal neu aufgebaut (SCAN_VERSION 3). Nach dem Erstscan verschickte Mails findet eine gezielte Suche in den Gesendet-Ordnern (ohne neue Berechtigung).
- **Lookalike**: Ein Markenname als Wortteil (teamsport, homeoffice, pineapple) zählt nur noch mit typischem Köder-Rest (secure, login, konto, Ziffern …); als ganzes Wort zwischen Bindestrichen weiterhin. Vom Nutzer vertraute Absender verlieren den Lookalike-Hinweis für ihre eigene Domain (nicht für Links).
- **Linktext**: Dateinamen und Technik-Namen („Rechnung.pdf“, „Node.js“) gelten nicht mehr als Domain.
- **Newsletter-Lockerungen** (fremde Bild-Links, Reply-To, Lieferdienste, Erpressungs-Schwelle, Tracking-Links) gelten nur noch mit gültiger DKIM-Signatur der Absender-Domain (`header.d`) oder bei etablierten Absendern. `List-Unsubscribe` allein kann jeder setzen.
- **Fußzeilen-Icons** heben den Bild-Link-Alarm nur noch auf, wenn es kleine/Social-Icons sind und DKIM zur Absender-Domain passt.
- **Linktext mit Marken-Domain** auf die Absender-Domain (Text „paypal.com“, Link auf den Absender) ist wieder ein Mismatch.
- **Bestätigte Links** bei „gefährlich“ öffnet das Hintergrundskript im Standardbrowser (`windows.openDefaultBrowser`) statt per nachgestelltem Klick; Mittelklick wird ebenfalls abgefangen. Das Kontextmenü „Link öffnen“ wird nicht abgefangen.
- **Schattenprotokoll**: jede Mail nur einmal, Schreibvorgänge nacheinander. Gleichzeitige Bewertungen derselben Mail teilen sich einen Durchlauf (OCR läuft nicht doppelt).

## v0.2.10: Banken und tote Pflicht-Links

- Auslöser: DKB-Phishing („Deutsche Kreditbank-AG“ von einer fremden Domain) blieb unauffällig. Die Markenliste kannte DKB nur als „dkb“.
- Markenliste ergänzt: „Deutsche Kreditbank“ (DKB), comdirect, Consorsbank, Targobank, HypoVereinsbank/UniCredit, Santander,
  Sparda (regionale Domains `sparda-*.de`), Trade Republic, Scalable Capital, apoBank, 1822direkt.
- Kurze Markennamen (DKB, ING, N26, DHL …) zählen bei „Marke im Text“ jetzt mit, aber nur als großgeschriebenes eigenes Wort.
- Neue allgemeine Signale, unabhängig von der Markenliste (nur für unbekannte Absender):
  - `orgNameMismatch` (20): Der Anzeigename behauptet eine Organisation (AG, Bank, Sparkasse, Krankenkasse, Kundenservice,
    Postfach …), und kein Wort davon steckt in der Absenderadresse. In den Testsets: 7 von 7 Treffern Phishing, 0 echte Mails.
  - `nameDomainMismatch` (10, schwach): sonstiger Name ohne Bezug zur Adresse. Bei echten Mails häufig (Personen, Restaurants
    über Buchungsdienste: 16 von 97), deshalb nie allein ein Grund zu warnen.
- Neues Signal `placeholderLinks` (20): mindestens zwei Pflicht-Links (Impressum, Datenschutz, Hilfe, Abmelden …) führen ins Leere (`#`),
  während es echte Links gibt – typisch für Phishing-Baukästen.

## v0.2.11: Absendernamen aus dem eigenen Postfach lernen

Aus etablierten, nie aufgefallenen Absendern entsteht automatisch eine Zuordnung „Name → Domain“ („Galaxus“ → galaxus.de).
Schreibt derselbe Name später von einer **neuen Adresse auf einer anderen Domain**, meldet das Add-on `learnedNameMismatch` (30,
Fälschungs-Signal, kein Bonus). Damit deckt jeder Nutzer „seine“ Firmen ab, ohne Markenliste.

- Gelernt wird nur, wenn der Name zur **Domain** passt (nicht nur zum lokalen Teil der Adresse) und die Domain kein Freemailer ist.
  Ein Phisher („Deutsche Kreditbank-AG“ von kindercomicfestival.de) wird so nie gelernt.
- Kein Treffer bei derselben Domain, bei gleicher Marke unter anderer Endung (galaxus.ch) und bei Adressen, die selbst schon länger schreiben
  (z. B. Newsletter über Versanddienstleister).
- Schlüssel ohne Rechtsform und Füllwörter („Galaxus Deutschland GmbH“ → „galaxus“); rein generische Namen („Info“, „Rechnung“) werden nicht gelernt.

## v0.2.12: Banken aus Wikidata, Paketdienste und Shops

- `source/src/data/banks-wikidata.js`: 1250 aktive Banken in den 27 EU-Ländern mit offizieller Website aus Wikidata (CC0), davon 686 in
  Deutschland (386 Sparkassen) und 80 in Österreich. Neu erzeugen: `node tools/fetch-wikidata-banks.mjs [de at …]` (holt Land für Land;
  nur beim Entwickeln, das Add-on stellt keine Verbindung her).
- **Hauptnutzen: weniger Fehlalarme.** Vorher hätte das Add-on echte Banken von ihrer eigenen Domain gewarnt (Messung über die
  ganze Liste: 385× Lookalike, z. B. `sparkasse-koelnbonn.de`; 239× Marke im Namen, z. B. „Dornbirner Sparkasse“ von `sparkasse.at`;
  63× Zufallsdomain, z. B. `blsk.de`). Jetzt: 0. Auch Banken außerhalb der Liste profitieren: Domains, die nach den Bankmustern
  (`sparkasse-*`, `ksk-*`, `vb-*`, `sparda-*`, ohne Köder-Wörter) der Marke gehören, gelten nicht mehr als Lookalike.
- **Erkennung:** `bankNameMismatch` (25) – Name einer Bank aus der Liste von einer fremden Domain. Höchstens „verdächtig“, weil die Liste
  oft nur die Hauptdomain kennt. Nur Namen mit Bankwort, die nicht nur aus dem Bankwort bestehen (sonst träfe es „Alex“ oder „Bank“).
- **Von Hand ergänzt** (Marken mit eigener Versanddomain): GLS, Österreichische Post, Schweizerische Post, PostNL, La Poste/Colissimo,
  bpost, InPost, MediaMarkt, Saturn, Lidl, Aldi, Kaufland, IKEA, AliExpress, Tchibo, dm, Rossmann, Galaxus. Bewusst nicht: Decathlon
  (Belege kommen über `eu.erply.io`), Temu und Shein (Versanddomains nicht gesichert).
- OCR bleibt: Sie hat eine echte Phishing-Mail mit „OneDrive“-Köderbild (Link auf fremden Hostingdienst) als Erste erkannt.

## v0.5.0: erste öffentliche Version

- Add-on-ID `phishing-addon@novabird` (vorher Platzhalter `phishing-pilot@novabird.invalid` – eine Installation mit der alten ID ist ein anderes Add-on und sollte entfernt werden), Autor „NovaBird“, Repository https://github.com/Novabird-Addons/Phishing.
- Standardmodus **aktiv** (vorher Schattenmodus).
- **Einrichtungsdialog** (`source/onboarding/`) beim ersten Start (`onboardingDone` in storage.local): eigenes Popup-Fenster mittig über dem
  Hauptfenster, Stil wie die Overlays von novabird-send (Palette `#e6ecf5`/`#2f6bd8`, dunkel `#1d1e22`/`#5b9dff`). Bewusst kein
  Experiment-API-Overlay im Hauptfenster: das Add-on bleibt ohne privilegierten Code. In NovaBird kann später das gemeinsame Overlay genutzt werden.
- Adressbücher: `contactBookIds: null` heißt jetzt „alle außer Gesammelte Adressen“ (`lib/contacts.js`, erkannt am übersetzten Namen);
  eine gespeicherte Liste gilt genau. Grund: Thunderbird sammelt dort jede Adresse, an die man schreibt – auch die eines Betrügers.
- „Oft empfangen“ nimmt nur noch den Erstkontakt-Hinweis weg; Organisations- und Banknamen-Prüfung laufen auch dort, und der Erstscan
  markiert solche Absender per Kopfzeilen-Prüfung. Kürzel-Domains (`haspa.de`, `dkb.de`, `sskm.de`) gelten als zum Namen passend.
- Screenshots: `tests/e2e/screenshots.mjs` (erfundene Demo-Mails, Domains `*.example`).

## v0.5.1: Schutz gegen Verdecken des Banners

- Befund (`tests/e2e/overlay.mjs`): Mail-CSS konnte das Banner verdecken – `position:fixed`/`absolute` mit höchstem z-index, negative
  Ränder, `transform`, `<style>` mit `#phishing-pilot-banner{display:none!important}` und `body::before`-Fläche. 5 von 6 Tricks wirkten.
  Thunderbirds eigener Tag im Mailkopf und die Link-Sperre blieben unberührt.
- Abwehr in `source/src/content/banner.js`: (1) Sichtbarkeit/Ebene als Inline-Stil mit `!important` (schlägt jede Mail-Regel);
  (2) Kontrolle per `elementFromPoint` an drei Punkten plus Deckkraft/Sichtbarkeit/Filter/clip-path aller Vorfahren, nach dem Zeichnen und
  nach 0,3/1/2,5 s; (3) bei Verdeckung die Stile der Mail abschalten (`<style>`, Stylesheets außer chrome:/moz-extension:, Inline-Stile);
  (4) notfalls Banner fest oben am `<html>` anheften. Eingriff erst, wenn das Banner zweimal im Abstand von 800 ms verdeckt ist –
  NovaBird-Conversation blendet seine Ansicht beim Öffnen kurz mit Deckkraft 0 ein. `data-pp-guard` am Banner zeigt einen Eingriff an.
- Tests: `node tests/e2e/overlay.mjs work/testext [ordner]` (6 Tricks, mit `EXTRA_ADDONS=work/testconv` auch mit Conversation; die Testkopie muss im
  Projektordner liegen, weil das Snap-Thunderbird `/tmp` nicht sieht). Ergebnis: alle 6 abgewehrt, mit und ohne Conversation, kein
  Fehleingriff im Durchklick-Test mit Conversation (17/17).

## v0.5.2: kompakteres Banner

- Aufbau: Kopfzeile (⚠, Überschrift, Punktzahl „· Links gesperrt“), darunter die zwei stärksten Gründe, Fußzeile mit „+ N weitere Gründe“
  links und „Warum?“/„Diesem Absender vertrauen“ rechts. „Warum?“ zeigt alle Gründe mit Punkten (`+40`). Rand links 6 px (rot `#C62828`,
  gelb `#B07F00`). Eine Variante mit Knopf-Spalte rechts war höher (Text bricht öfter um) und wurde verworfen.
- Höhe gemessen: Standardansicht 100 px statt ~175 px, NovaBird-Conversation 111–146 px statt 180–219 px (Durchklick mit `EXTRA_ADDONS=work/testconv`).
- „Mehr ▾“ in Conversation (ein `<details>`-Element): öffnet mit und ohne unser Add-on, Einträge klickbar – in TB 157 kein Fehler nachstellbar.

## v0.5.3: Englisch

- Einstellungsseite über `source/src/i18n.js` (`opt_*`, `data-i18n`/`data-i18n-html`; HTML nur aus eigenen Texten), Manifest-Beschreibung über
  `source/_locales/{en,de}` (`default_locale: en`).
- README englisch, `README.de.md` deutsch. Screenshots: `TB_LANG=en tests/e2e/restart.sh && node tests/e2e/screenshots.mjs work/testext en`
  → `docs/screenshots/`; ohne `TB_LANG` und mit `de` → `docs/screenshots/de/`. (`restart.sh` setzt für Englisch `LANG` und
  `intl.locale.requested`, weil das Snap-Thunderbird die Sprache aus der Umgebung übernimmt.)
- `placeholderLinks` kennt jetzt auch „help“, „legal“, „cookie“.

## v0.5.4: Anonymisiert speichern

- `source/src/lib/anonymize.js` (rein, getestet in `tests/anonymize.test.js`): MIME-Baum zerlegen, Text-Teile dekodieren (Base64/QP,
  Zeichensatz), ersetzen, als UTF-8 mit gleicher Transferkodierung zurückschreiben; kodierte Kopfzeilen (RFC 2047) einzeln.
  Ersetzt: eigene Adressen/Namen (Thunderbird-Identitäten), alle Empfänger (To/Cc/Delivered-To/X-Original-To/…), Namen aus
  Anzeigenamen und aus Adressen (`vorname.nachname`, Teile ab 4 Zeichen außer Funktionswörtern), eigene Nicht-Freemail-Domains,
  Postanschriften (Straße + Nr., PLZ + Ort), Werte von Link-Parametern (außer Weiterleitungszielen `http…`), auch in List-Unsubscribe.
  Anhänge außer Bildern werden geleert (Name/Typ bleiben). Kopfzeile `X-Novabird-Anonymized: 1`.
- Validierung über legitset+phishingset (114 Mails, eigene Adresse aus To/Delivered-To simuliert): identische Signale vorher/nachher,
  keine eigene Adresse und kein Namensteil der Adresse mehr im Text (Bilddaten ausgenommen).
- Background: Menü `message_list`, `messages.getRaw(BinaryString)`, `downloads.download` nach `novabird-anonym/`, Ergebnisfenster `source/anon/report.html`.
- E2E: `tests/e2e/anonymize.mjs` (Teil von `npm run e2e`): Kontextmenü per Marionette, Datei im Testprofil-Download-Ordner prüfen.

## Ordneraufbau (ab v0.5.4)

- `source/` – das Add-on selbst (kommt ins XPI): `manifest.json`, `_locales/`, `src/`, `options/`, `onboarding/`, `anon/`
- `tests/` – Unit-Tests (`npm test`), E2E-Tests mit headless Thunderbird (`tests/e2e/`), Offline-Werkzeug `tests/tools/eml-run.mjs`
- `tools/` – Generatoren (z. B. Bankliste aus Wikidata)
- `docs/` – diese Datei, Screenshots, Release-Texte
- `build-xpi.sh` – baut `dist/novabird-phishing-<version>.xpi` aus `source/` plus LICENSE, THIRD_PARTY.md, README.md und
  prüft das Paket danach mit `tools/privacy-check.sh` (bei Treffern wird das XPI gelöscht)
- `tools/privacy-check.sh [--history] [xpi …]` – sucht persönliche Daten in den Dateien des Repositorys, in noch nicht
  gepushten Commit-Texten (mit `--history`: in allen Änderungen und Texten) und in XPIs; `npm run privacy` vor jedem Push.
  Die Suchbegriffe stehen nur lokal in `testdata/privacy-patterns.txt` (ein regulärer Ausdruck pro Zeile) – im Repository
  würden sie genau das veröffentlichen, was sie schützen sollen. Ohne Liste überspringt das Skript die Prüfung mit Warnung.
  Anlass: Bis 0.9.0 standen in Code-Kommentaren echte Beispiele aus Testmails und landeten so in den XPIs.
- lokal und nicht im Repository: `dist/` (gebaute XPIs), `testdata/` (`phishingset/`, `legitset/`, `andere addons/` – private Testmails
  und fremde Add-ons), `work/` (`testext/` Testkopie, `testprofile/`, `testconv/` Conversation-Testkopie – wird von den Tests erzeugt,
  kann jederzeit gelöscht werden)

## v0.5.5: nur ein Banner pro Mail

- Befund aus dem Alltag: Banner doppelt. Ursache: Seit 0.5.0 neue Add-on-ID – eine ältere Installation mit der alten ID
  (`phishing-pilot@novabird.invalid`) läuft als eigenes Add-on weiter. Nachgestellt mit zwei Testkopien: 17/17 doppelt.
- Abwehr in `source/src/content/banner.js`: Markierung `data-pp-claim` am Dokument beim Start (zweite Instanz – andere Kopie
  oder doppelte Einbindung – hält sich heraus); zieht sich zurück, wenn ein fremdes `#phishing-pilot-banner` (ältere Version ohne
  Markierung) erscheint. Getestet: zwei neue Kopien und neu + 0.5.1 in beiden Installationsreihenfolgen, jeweils 17/17 genau ein Banner.
- Durchklick-Test meldet doppelte Banner (`DOPPELT(n)`).
- Ordner: lokale Daten in `testdata/`, Testerzeugnisse in `work/`.

## v0.6.0: Anhänge genauer prüfen

Anlass: Rückmeldung eines Nutzers (Doppel-Endungen, gefährliche Archive, Base64-Kennungen von Programmen, verrufene TLDs).
Logik in `source/src/lib/files.js` (rein, getestet in `tests/files.test.js`), Bytes liest `source/src/attachments.js`
(`messages.listAttachments` + `getAttachmentFile`, höchstens 10 Anhänge bis 50 MB, nur Ausschnitte per `Blob.slice`).

| Signal | Gewicht | Stufe | Wann |
|---|---|---|---|
| `disguisedFile` | 60 | erzwingt „gefährlich“ | Dokument-Endung vor gefährlicher Endung, Schreibrichtungs-Steuerzeichen (U+202E u. a.), Inhalt passt nicht zur Endung (Programm/Verknüpfung/Skript/HTML hinter `.pdf`, `.jpg`, `.docx`, `.zip` …), getarnter Name im ZIP |
| `archiveRisky` | 35 | erzwingt „verdächtig“ | ZIP enthält eine Datei mit gefährlicher Endung (`RISKY_EXT`) |
| `badTld` | 8 | schwach | Absender- oder Link-Domain endet auf eine verrufene TLD; nicht bei Kontakten |

- **Doppel-Endung** nur, wenn die *zweite* Endung gefährlich ist: Der vorgeschlagene Ausdruck `\.[a-z0-9]+\.[a-z0-9]+$` hätte
  `Rechnung.2024.pdf`, `backup.tar.gz` und `Protokoll_v1.2.docx` getroffen.
- **Echter Typ statt Base64-Muster:** Die Kennungen aus der Rückmeldung (`TVqQAAM` = „MZ“ eines Windows-Programms in Base64) prüft
  `sniffType()` direkt an den dekodierten ersten Bytes (MZ, ELF, Mach-O, LNK, `#!`, HTML/SVG, ZIP, RAR, 7z, PDF, OLE, ISO …).
  Gemeldet wird nur, wenn eine Dokument-, Bild- oder Archiv-Endung etwas Ausführbares oder eine Webseite verbirgt – falsch benannte
  Bilder oder `deploy.sh` mit `#!` nicht.
- **ZIP:** gelesen wird nur das Inhaltsverzeichnis am Dateiende (kein Entpacken, kein ZIP64, verschachtelte Archive nicht). Nur echte
  `.zip`-Dateien – `.docx`/`.xlsx` sind intern ebenfalls ZIP und enthalten oft SVG-Grafiken. RAR/7z werden nicht geöffnet.
- **TLD-Liste** (`BAD_TLDS` in `analyzer.js`): aus der Rückmeldung plus `.icu`, `.cfd`, `.cyou`, `.rest`, `.buzz`, `.monster`.
  Bewusst schwach, weil es auf `.live`, `.club`, `.biz` usw. auch echte Seiten gibt.
- **„Blockieren“:** Die Add-on-API kann das Öffnen eines Anhangs nicht verhindern; Anhänge zu löschen wäre unumkehrbar.
  Bei „gefährlich“ bleibt es deshalb bei rotem Banner, Tag und gesperrten Links; der Grund sagt ausdrücklich „Nicht öffnen“.
- **Nicht übernommen:** AbuseIPDB (bräuchte Internet und API-Schlüssel, widerspricht „keine Verbindung ins Internet“).
- Der Erstscan der Absenderhistorie liest weiterhin keine Anhänge.
- **Fehlalarm Steam** (`imageLinkForeign`): Fußzeilen-Logo `alt="Valve"` (165×48) verlinkt auf `valvesoftware.com`, Mail von
  `steampowered.com`. Ausnahme `logoOfTarget()`: Bild-Link zählt nicht, wenn ein Wort des Alt-Texts (≥ 4 Zeichen) im Namen der
  Zieldomain steckt **und** DKIM zur Absender-Domain passt (oder der Absender bekannt ist). Köder-Wörter (`BAIT_ALT`: Dokument,
  Rechnung, Datei, OneDrive, Login … sowie `IMAGE_CTA`) heben die Ausnahme auf – sonst käme ein gekapertes Konto mit
  „Dokument“ → `dokumente-portal…` durch. Link-Extraktion liefert dafür `imgAlt`.
- Offen: Regressionstest gegen `testdata/legitset` und `phishingset` (`npm run check`) – lag beim Bau unter Windows nicht vor.

## v0.9.0: Bezug über Anker und lokale KI über NovaBird

Grundsatz (abgestimmt mit dem NovaBird-Thread, Vertrag in [ki-schnittstelle.md](ki-schnittstelle.md)): **Die KI darf
verschärfen, nie entwarnen.** Entwarnen darf nur, was ein Angreifer nicht kennen kann.

- **Bezug über Anker** (`lib/anchors.js`, `findRelated()` in `background.js`): Bestell-/Sendungs-/Rechnungs-/Vorgangs-/
  Kundennummern aus Betreff und Text (bezeichnet, plus UPS `1Z…`, DHL `00340…`/`JJD…`). Nur wenn `relatedCouldHelp()`
  (Warnung, an der `RELATED_DROPS` beteiligt sind): `messages.query` nach `subject` in allen Konten, `body` nur in lokalen
  Konten, 180 Tage zurück. Die frühere Mail zählt bei Gesendet-Ordner, Kontakt/etabliertem Absender oder DKIM einer
  *anderen* Domain + ≥ 12 h älter + unauffälliger Absenderzeile; nie Spam oder mit eigenem Warn-Tag. Ein Phisher
  bräuchte sonst nur eine eigene „Bestellbestätigung“ vorauszuschicken. Entfernt: `firstContact`,
  `nameDomainMismatch`, `orgNameMismatch`, `replyToForeignAuthed`, `aiClaimMismatch`. Fälschungssignale bleiben.
- **KI** (`lib/ai.js`, `askNovaBird()`): `phish:extract` an `novabird-extension@novabird`, Zeitlimit 3,5 s, nur bei
  nicht roten Mails mit mindestens einem Hinweis. `parseAiFacts()` übernimmt nur bekannte Felder (Whitelist, Länge,
  Hostname, echtes bool). Signale: `aiInjection` (35, stark, Fälschungs-Signal, also kein Bonus für Bekannte) und
  `aiClaimMismatch` (25): Organisation/Website passt nicht zur Absender-Domain (`claimFits()`: Domain, Hauptlabel,
  `nameMatchesDomain`, Kürzel, Marke mit eigener Domain) **und** die Mail verlangt Login/Zahlung/Download/Anruf oder macht
  Druck; nicht bei bekannten/„oft empfangenen“ Absendern und nicht zusätzlich zu den Namensregeln. Ohne die Bedingung
  „verlangt etwas“ träfe es Newsletter über fremde Versanddienste (Lieferando von `takeaway.com`).
- Nach `busy` schickt die Extension `phish:result`; `onMessageExternal` (nur deren ID, nicht async) speichert, bewertet
  neu, setzt das Tag und ersetzt ein offenes Banner (`verdictUpdate` an `banner.js`).
- Einstellung `useNovaBirdAi` (Standard an; wirkt erst, wenn in NovaBird die opt-in-„Phishing-Prüfung“ an ist).

## v0.9.0 (vorher 0.6.1): drei neue Erkennungen

- **`obfuscatedHtml` (45, Fälschungs-Signal):** HTML-/SVG-Anhang, dessen Skript dekodiert (`atob`, `unescape`,
  `String.fromCharCode`) oder lange Base64-/Hex-Ketten enthält, während die Seite < 600 Zeichen sichtbaren Text hat
  (`hasObfuscatedScript` in `html.js`). Zusammen mit `riskyAttachment` (HTML-Endung) ergibt das rot, auch von bekannten
  Absendern. Gespeicherte echte Webseiten (viel Text) sind ausgenommen.
- **`calendarForeignLink` (25):** URLs aus `text/calendar`-Teilen und `.ics`-Anhängen (Zeilen erst entfaltet) laufen als
  normale Links mit (Verkürzer, IP, Hosting-Dienste …); zusätzlich meldet das Signal Links auf fremde Domains –
  außer Besprechungsdienste (`MEETING_HOSTS`), gleiche Firma (`sameOrg`), Marken-Domains und bekannte Absender.
- **Erpressung im Bild:** `detectExtortion` läuft zusätzlich über den OCR-Text aller Bilder (ab 80 Zeichen),
  zusammen mit dem Mailtext. Damit ist der offene Punkt „Erpressungstext in Bildern“ umgesetzt.

## v0.9.0 (vorher 0.6.1): leichte Warnungen bei echten Mails reduziert

Vier echte Mails standen auf „verdächtig“ (36–41 Punkte). Befund und Abhilfe (`tests/analyzer.test.js`):

- **PayPal-Beleg:** `Reply-To: max.mustermann@firma-beispiel....` – PayPal trägt die Empfängeradresse *abgeschnitten* ein, der
  Abgleich „Reply-To = Empfänger“ scheiterte. Jetzt gilt eine Adresse mit `..`-Ende, deren Anfang (mit `@`, ≥ 8 Zeichen)
  ein Empfänger-Präfix ist, als Empfänger.
- **Händler über Zahlungsabwickler** (HomeByMe: From `fastspring.com`, Reply-To `homebyme.zendesk.com`): neues schwaches
  Signal `replyToForeignAuthed` (8) statt `replyToForeign` (20), wenn DKIM zur Absender-Domain passt und die
  Antwort-Domain weder Freemail noch Zufallsdomain, Billig-TLD oder Lookalike der Absender-Domain ist. Freemail-Reply-To
  bleibt stark – das ist das BEC-Muster (gekapertes Firmenkonto, Antworten an gmail).
- **Finanz-Newsletter** (Stocktwits): `investmentPromo` entfällt bei `trustedList` (Listen-Header + DKIM zur
  Absender-Domain), sofern die Absenderzeile selbst unauffällig ist (keine `HEADER_SIGNALS`, kein `badTld`) – Krypto-Spam
  kommt von Zufalls-/Billigdomains, die weiter melden.
- Die Signatur-Links auf LinkedIn/Instagram/Facebook/YouTube (DRG-Mail) waren schon vorher ausgenommen (`SOCIAL`);
  die Mail blieb mit `nameDomainMismatch`+`firstContact` (20) unter der Schwelle.

## v0.9.1: Vertrauen-Liste mit Begründung, Prüffehler sichtbar, lange Mails ganz geprüft

Ergebnis einer Durchsicht auf Umgehung und Fehlverhalten (nicht auf XSS: Banner im geschlossenen Shadow-DOM, nur
`textContent`, `onMessageExternal` nur von der NovaBird-ID, `openLink` nur `http(s)`).

- **Fehler sind keine Entwarnung.** Wirft `evaluate()` (Mail nicht lesbar, Fehler in einer Prüfung), antwortet
  `getVerdict` mit `{ level: 'error' }` und das Banner zeigt grau „Prüfung nicht möglich“ (`renderError` in
  `banner.js`). Vorher kam `null` an, also kein Banner – wie bei einer unauffälligen Mail. Im Schattenmodus bleibt es still.
- **Anfang und Ende.** `features.js` kürzt Text über 20.000 Zeichen auf Anfang (14.000) + Ende (6.000); `html.js`
  behält bei mehr als 250 Links die ersten 150 und letzten 100 (`headAndTail`, auch für Klartext-Links). Das HTML
  selbst bleibt bei 400.000 Zeichen gedeckelt (`MAX_HTML`, der Hintergrund schneidet den Body ebenso). Gemessen:
  420 KB mit 14.000 Links in 7 ms.
- **Keine quadratischen Muster.** Die Deckel allein reichten nicht: `/<[^>]*>/`, `/<!--[\s\S]*?-->/`,
  `/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/` u. a. laufen bei einem `<` ohne passendes Ende von *jedem* Ansatz bis zum Ende –
  400 KB `<a href="` oder `<!--` dauerten 16–18 s, ein 100-KB-Anzeigename 5 s (`[\w.+-]+@` ohne `@`). Jetzt geht
  `html.js` die Tags von Hand durch (`tagsOf`: ein Tag reicht vom letzten `<` vor einem `>`; `blockEnd` sucht das
  schließende `</a>`/`</script>` einmal; ist keins mehr da, endet die Suche), und die Muster prüfen nur noch je ein
  einzelnes Tag. `stripTags` merkt sich, wenn kein `>`, `-->` oder Block-Ende mehr folgt. Anzeigenamen über 300 Zeichen
  kürzt `parseAddressList` auf Anfang (200) + Ende (100); `anonymize.js` trennt Adresslisten ohne Lookahead-Muster.
  Alle Fälle jetzt unter 40 ms (Test „Bösartiges HTML bremst die Prüfung nicht“, Grenze 1 s). Gegenprobe alt/neu: echte
  Mails und 20.000 wohlgeformte Zufalls-HTMLs identisch; nur bei kaputtem HTML liefert `stripTags` vereinzelt etwas
  anderen Text (z. B. `<<!--…-->`). Die übrigen Muster (Text ≤ 20.000 Zeichen, Betreff, Kopfzeilen) sind ohne
  verschachtelte Quantoren oder durch Trennzeichen eindeutig. Ein Worker mit Abbruch ist damit nicht nötig.
- **authserv-id je Konto gelernt** (`lib/authserv.js`, wie NovaBird Android `ProtectionService.trustedAuthserv`).
  `onNewMailReceived` zählt die id der obersten `Authentication-Results` jeder neuen Mail (`''` = keine; Gesendet,
  Entwürfe, Vorlagen, Postausgang zählen nicht) in `storage.local.authservStats[accountId]` – eigener Schlüssel, weil
  eine Änderung von `config` alle Caches leert. Ab 10 Mails und ≥ 80 % für eine id gilt `trustedAuthservIds = [id]`,
  ist es `''`, die nie passende `no-authserv.invalid` (alle Kopfzeilen ignoriert). Darunter die alte Regel (oberste).
  Höchstens 10 ids je Konto (ein Angreifer kann je Mail eine neue erfinden), ab 200 Mails halbiert, damit sich ein
  Anbieterwechsel durchsetzt. Die Einstellung „Eigene Mailserver“ hat Vorrang. Gilt für die Bewertung und die
  DKIM-Prüfung früherer Mails beim Bezug. Offen: Server mit wechselnden Namen (`mx01.`/`mx02.anbieter.de`) erreichen
  die 80 % nicht und bleiben bei der alten Regel; ein Abgleich über die Domain wäre möglich, weicht aber von Android ab.
- **Vertrauen hat Grenzen.** `keep` in `analyzer.js` enthält jetzt `dkimFail`, `disguisedFile` und `extortion`.
  Bei „gefährlich“ zeigt das Banner keinen Vertrauen-Knopf (`trust_blocked`), und `trustSender` im Hintergrund gibt
  `false` zurück; das Banner bleibt dann stehen. Freigabe nur über die Einstellungen.
- **Vertrauen-Liste mit Metadaten.** `storage.local.trustMeta[adresse] = { date, score, level, via: 'banner'|'settings',
  reasons: [Texte] }` wird beim Vertrauen über das Banner geschrieben (Gründe als fertige Texte, höchstens 8 × 160 Zeichen,
  lokal gespeichert wie die Adresse selbst). `config.trustedSenders` bleibt die Quelle für den Analyzer und das Format
  älterer Versionen. Die Einstellungsseite rendert daraus die Liste mit „Entfernen“; beim Speichern werden Metadaten zu
  entfernten Adressen gelöscht. Was bewusst **nicht** gebaut wurde: ein lernender Inhaltsfilter (Bayes, Ähnlichkeit) –
  eine gefälschte Rechnung ähnelt der echten absichtlich. Gelernt wird nur, was ein Angreifer nicht fälschen kann
  (Adresse angeschrieben, „wiederkehrend“ ohne Auffälligkeit, Bezug über Anker) oder was der Nutzer ausdrücklich bestätigt.
- Bekannt offen: `hasObfuscatedScript` setzt bei ≥ 600 Zeichen sichtbarem Text aus (gespeicherte Webseiten); 600 Zeichen
  Füllstoff umgehen das. Ein Verhältnis Skript/Text wäre der nächste Schritt, erzeugt aber bei gespeicherten Seiten mit
  großen Skript-Bundles (`atob` ist dort üblich) Fehlalarme.

## v0.9.2: Link-Sperre ab dem Öffnen der Mail

Befund aus dem Android-Review: `guardLink` griff nur bei `state.danger`, und das
setzt erst `render` nach `getVerdict` – während der Prüfung, nach Prüffehlern und ohne Bewertung (mehrere Mails)
waren Links offen, außerdem nur `http(s)` abgefangen. Jetzt entscheidet `src/content/linkpolicy.js` (klassisches
Skript vor `banner.js`, Unit-Test `tests/linkpolicy.test.js`) aus `status` (`pending`/`done`/`unchecked`/`off`),
`danger` und Schema: `allow`, `wait`, `confirmDanger`, `confirmUnchecked`, `blockScheme`. `banner.js` startet mit
`pending`; ein Klick wartet bis 5 s auf die Bewertung (Hinweis „wird noch geprüft“), danach je nach Ergebnis frei,
Rückfrage oder (bei Zeitlimit) „nicht geprüft“. Web-Links öffnet nach der Rückfrage `openLink` im Standardbrowser;
andere Schemata kann nur ein echter Klick öffnen (nach „Öffnen“ darf der nächste Klick auf denselben Link durch).
Rückfragen sind ein eigener Dialog im Shadow-DOM (`#phishing-pilot-ask`), weil `confirm()` im Nachrichtenbereich
unterdrückt wird (siehe 0.5.6) – die alte Rückfrage bei „gefährlich“ lieferte dort still „Abbrechen“. Texte kommen
vorab über `linkInfo` (Schattenmodus: `off`, nichts sichtbar). `getVerdict` vergleicht eine gemerkte Bewertung mit der
`headerMessageId` der angezeigten Mail. Getestet in Thunderbird 153 unter Windows (Testkopie mit 3 s verzögerter
Bewertung): Klick während der Prüfung bei gefährlicher und unauffälliger Mail, `file:`/`mailto:` nach „gefährlich“,
Prüffehler mit Abbrechen und Öffnen – 4/4. Nicht getestet: Konversationsansicht mit mehreren Mails.

Konversationsansicht (Befund der Windows-Desk-Session): Mit NovaBird-Conversation stehen mehrere Mails in einem
Dokument (`#nbc-root`, je Mail `.nbc-card`), `displayedMessageId` liefert aber nur die gewählte. Eine harmlose
gewählte Antwort gab so die Links einer aufgeklappten Phishing-Mail frei. `ppCardStatus` (linkpolicy.js) macht
Links außerhalb von `.nbc-card.selected` zu `unchecked` – sofort Rückfrage, auch während `pending`, auch beim
Mittelklick. Conversation sagt zu, `#nbc-root`, `.nbc-card` und `.selected` stabil zu halten; Mail-Inhalte können
sie nicht setzen (Conversation übernimmt aus Mails nur `href`, `colspan`, `rowspan` – deshalb tragen Links dort
auch keine `class`). Bewusst nicht je Karte nach Message-ID bewertet: die setzt der Absender selbst. Getestet in
Thunderbird 153 mit Conversation 0.15.6 (Testpaket 06g): Phishing-Karte P über gewählter harmloser Antwort A –
Klick und Mittelklick auf P fragen vor und nach der Bewertung, A ist nach 1,5 s frei. Das frische Testprofil ohne
Identität bewertete normal (1,5 s); eine hängende Bewertung war dort nicht nachzustellen.

## Build und Namen

`./build-xpi.sh` baut `dist/novabird-phishing-<version>.xpi` (ungesigniert) und behält die neueste Version plus die 3 vorherigen.
Der Name wurde in „Novabird-phishing“ geändert; Add-on-ID (bis 0.2.12 Platzhalter `phishing-pilot@novabird.invalid`, ab 0.5.0 `phishing-addon@novabird`), Banner-Element-ID
und OCR-Datenbank heißen aus Kompatibilitätsgründen weiter „phishing-pilot“. Vor einer Veröffentlichung: echte ID setzen und signieren.

## Offen

- Banner-Redesign (kompakter, rot bei hoher Punktzahl, „Warum?“-Ansicht mit Punkten je Signal).
- Konversationsansicht: Button „Mehr ▾“ öffnet kein Menü (Ursache ungeklärt, Isolationstest mit deaktiviertem Add-on steht aus).
- Betterbird 153 real testen; Fehlalarm-Rate im Alltag über das Schattenprotokoll messen.
- Nicht umgesetzt: weitere Betrugsarten (Vorschuss-, Lotterie-, Liebesbetrug), Erpressungstext in Bildern.
