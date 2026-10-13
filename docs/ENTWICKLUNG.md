# Novabird-phishing – Entwicklung und Technik

Technische Details, Entscheidungen und Versionsgeschichte. Die Kurzbeschreibung für Nutzer steht im [README](../README.md).

Lokales, offline arbeitendes Phishing-Add-on für Betterbird/Thunderbird (≥ 153). Kein Netzverkehr,
keine Abhängigkeiten, Lizenz MIT (siehe `THIRD_PARTY.md`). Später als Modul für NovaBird gedacht.

## Was es erkennt

Jedes dieser beiden Signale **allein** setzt die Stufe „verdächtig“:

- **Kontakt-Imitation:** Anzeigename gehört zu einem Kontakt (Adressbuch) oder bekanntem Absender, die Adresse ist aber neu.
  (Gleiche Firmendomain, kein Freemailer: kein Alarm.)
- **Antwort ohne Bezug:** „Re:/AW:“ ohne `In-Reply-To`/`References`, oder der Bezug liegt in keinem lokalen Ordner.

Weitere Signale (Gewichte in `src/lib/config.js`): DMARC/SPF/DKIM (nur Header des eigenen Servers),
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

Aufbau: `src/lib/` reine Logik (getestet), `src/background.js` Thunderbird-Anbindung,
`src/content/banner.js` Banner, `tests/e2e/` Marionette-Client + Testprofil.

## Wer gilt als „bekannter“ Absender? (ab v0.2.9)

Nicht schon, wer mehrfach im Postfach vorkommt – sonst würde hartnäckiger Spam mit der Zeit legitimiert. Zwei Stufen
(`src/lib/history.js`):

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

`src/lib/scam.js` erkennt Erpressungs-Mails („Sextortion“) am Inhalt (DE/EN): Behauptung gehackter Geräte/Kamera, Drohung mit
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
und wird per `MutationObserver` wieder angehängt, wenn der Inhalt ersetzt wird (`src/content/banner.js`).
Test: `EXTRA_ADDONS=<conversation-ordner> node tests/e2e/clickthrough.mjs testext phishingset 600`
(Conversation rendert einzelne Mails nur mit `alwaysRender: true`).

## Bekannte Grenzen

- QR-Codes und OCR arbeiten auf **eingebetteten** Bildern (Anhänge, `cid:`), nicht in PDFs.
- **Fremdbilder** (aus dem Netz) werden nie automatisch geladen. Optional (Einstellungen, standardmäßig aus) prüft das Add-on
  Bilder, die *du* nachgeladen hast, durch einen zweiten Abruf (ohne Cookies/Referrer) und braucht dafür die
  Berechtigung „alle Websites“. Weil das Verbindungen nach außen erlaubt, ist die Content-Security-Policy gelockert;
  `tests/no-network.test.js` begrenzt jeden Netzzugriff im Code auf `src/remote.js`.
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

- `src/data/banks-wikidata.js`: 1250 aktive Banken in den 27 EU-Ländern mit offizieller Website aus Wikidata (CC0), davon 686 in
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
- **Einrichtungsdialog** (`onboarding/`) beim ersten Start (`onboardingDone` in storage.local): eigenes Popup-Fenster mittig über dem
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
- Abwehr in `src/content/banner.js`: (1) Sichtbarkeit/Ebene als Inline-Stil mit `!important` (schlägt jede Mail-Regel);
  (2) Kontrolle per `elementFromPoint` an drei Punkten plus Deckkraft/Sichtbarkeit/Filter/clip-path aller Vorfahren, nach dem Zeichnen und
  nach 0,3/1/2,5 s; (3) bei Verdeckung die Stile der Mail abschalten (`<style>`, Stylesheets außer chrome:/moz-extension:, Inline-Stile);
  (4) notfalls Banner fest oben am `<html>` anheften. Eingriff erst, wenn das Banner zweimal im Abstand von 800 ms verdeckt ist –
  NovaBird-Conversation blendet seine Ansicht beim Öffnen kurz mit Deckkraft 0 ein. `data-pp-guard` am Banner zeigt einen Eingriff an.
- Tests: `node tests/e2e/overlay.mjs testext [ordner]` (6 Tricks, mit `EXTRA_ADDONS=testconv` auch mit Conversation; die Testkopie muss im
  Projektordner liegen, weil das Snap-Thunderbird `/tmp` nicht sieht). Ergebnis: alle 6 abgewehrt, mit und ohne Conversation, kein
  Fehleingriff im Durchklick-Test mit Conversation (17/17).

## Build und Namen

`./build-xpi.sh` baut `dist/novabird-phishing-<version>.xpi` (ungesigniert) und behält die neueste Version plus die 3 vorherigen.
Der Name wurde in „Novabird-phishing“ geändert; Add-on-ID (bis 0.2.12 Platzhalter `phishing-pilot@novabird.invalid`, ab 0.5.0 `phishing-addon@novabird`), Banner-Element-ID
und OCR-Datenbank heißen aus Kompatibilitätsgründen weiter „phishing-pilot“. Vor einer Veröffentlichung: echte ID setzen und signieren.

## Offen

- Banner-Redesign (kompakter, rot bei hoher Punktzahl, „Warum?“-Ansicht mit Punkten je Signal).
- Konversationsansicht: Button „Mehr ▾“ öffnet kein Menü (Ursache ungeklärt, Isolationstest mit deaktiviertem Add-on steht aus).
- Betterbird 153 real testen; Fehlalarm-Rate im Alltag über das Schattenprotokoll messen.
- Nicht umgesetzt: weitere Betrugsarten (Vorschuss-, Lotterie-, Liebesbetrug), Erpressungstext in Bildern.
