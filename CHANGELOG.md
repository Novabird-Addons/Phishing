# Änderungen

## 0.9.0 – Bezug zu früheren Mails, lokale KI über NovaBird, weniger Fehlalarme (2026-11-01)

Fasst die nicht veröffentlichten Zwischenstände 0.6.1 zusammen.

### Lokale KI über die NovaBird-Extension (optional)

- Ist die **NovaBird-Extension** installiert und dort die **Phishing-Prüfung** eingeschaltet, fragt der Phishing-Schutz deren KI. Das Modell liefert nur Fakten: als wer sich die Mail ausgibt, was sie verlangt (Anmelden, Zahlen, Herunterladen, Anrufen) und ob sie Druck macht. Die Bewertung treffen weiter die Regeln.
- Neu: **„Tritt als Organisation auf, die nicht zur Absender-Domain passt“** – wenn die Mail zugleich etwas verlangt oder drängt. Erkennt auch Marken, die in keiner Liste stehen, und Telefonbetrug („Microsoft-Sicherheitszentrum, rufen Sie an“).
- Neu: **Versteckte Anweisungen an KI-Assistenten** in der Mail („ignoriere alle Anweisungen …“) werden gemeldet, auch bei bekannten Absendern.
- Die KI kann **nur verschärfen, nie entwarnen** – eingeschleuste Texte wie „diese Mail ist sicher“ bewirken nichts.
- **Keine Cloud:** NovaBird nutzt dafür nur ein Modell im eigenen Rechner oder Netz (Ollama, NovaBird Helper). Ist dort ein Cloud-Dienst eingestellt, bleibt die Prüfung aus.
- Ohne NovaBird läuft alles wie bisher. Abschaltbar in den Einstellungen („Lokale KI der NovaBird-Extension mitnutzen“).
- Kommt das KI-Ergebnis später (Modell noch nicht geladen), wird das Banner nachträglich ergänzt.
- Schnittstelle: `docs/ki-schnittstelle.md`.

### Einstellungen

- **Neu gegliedert** in Abschnitte (Schutz · Lokale KI · Bilder und Texterkennung · Absender und Verlauf · Vertrauen und Ausnahmen), passend zu hellem und dunklem Thema.
- **Status der lokalen KI** mit farbigem Punkt: grün „Verbunden“ bzw. „Eingerichtet (lokal)“ mit Modellname; gelb, wenn in NovaBird die Phishing-Prüfung aus ist, ein Cloud-Dienst eingestellt ist oder das Modell nicht antwortet; grau ohne NovaBird.
- Mit der NovaBird-Extension erscheinen die Einstellungen unter **Einstellungen → NovaBird** als eigener Reiter „Phishing-Schutz“; in der Add-on-Verwaltung steht dann ein Verweis dorthin („Hier anzeigen“ zeigt sie trotzdem). Ohne NovaBird bleibt alles wie bisher.
- Eigenes Add-on-Symbol (Schild).

### Bezug zu früheren Mails

- Neu: **Bezug über Bestell-, Sendungs- und Rechnungsnummern.** Schreibt ein neuer Absender (z. B. ein Paketdienst) und nennt eine Nummer, die schon in einer früheren, vertrauenswürdigen Mail stand, zählen die Hinweise „Neuer Absender“ und „Name passt nicht zur Domain“ nicht mehr. Als vertrauenswürdig gilt eine selbst verschickte Mail, eine von Kontakten oder etablierten Absendern oder eine per DKIM bestätigte Mail einer anderen Firma, die mindestens 12 Stunden älter ist. Fälschungshinweise (DMARC, nachgemachte Domain, Link-Täuschung, getarnte Anhänge) bleiben immer. Gesucht wird nur, wenn sonst gewarnt würde: im Betreff aller Konten, im Text nur bei lokalen Konten (keine Abrufe vom Server).

### Neue Erkennungen

- Neu: **Verschleierter Programmcode in HTML-Anhängen** (Dekodier-Funktionen wie `atob`, lange kodierte Ketten, kaum sichtbarer Text) wird rot gemeldet – typisch für gefälschte Login-Seiten als „Rechnung.html“. Gespeicherte echte Webseiten mit viel Text bleiben außen vor.
- Neu: **Kalender-Einladungen (.ics)** werden geprüft. Links darin laufen durch alle Link-Prüfungen; ein Link auf eine Domain ohne Bezug zum Absender wird gemeldet. Besprechungsdienste (Zoom, Teams, Webex, Calendly …) sind ausgenommen.
- Neu: **Erpressungstext in Bildern** wird erkannt – die Texterkennung lief schon, jetzt läuft auch die Erpressungs-Prüfung über den Bildtext.

### Weniger leichte Warnungen bei echten Mails

Aus vier echten Mails, die fälschlich „Vorsicht“ bekamen (PayPal-Beleg, HomeByMe-Abo über FastSpring, DRG-Newsletter, Stocktwits):

- Trägt der Absender die **Empfängeradresse abgeschnitten** als Antwortadresse ein (PayPal: `name@domain....`), zählt das nicht mehr als fremde Antwortadresse.
- **Antwortadresse auf fremder Domain** ist nur noch ein schwacher Hinweis, wenn der Absender per DKIM bestätigt ist und die Antwortadresse unauffällig ist (Zahlungsabwickler → Helpdesk des Händlers). Antworten an Freemail-Adressen (typisch für Chef-Betrug) oder Zufallsdomains bleiben ein starkes Signal.
- **Anlage-/Krypto-Werbung** in abonnierten Newslettern (Abmelde-Header und DKIM zur Absender-Domain, unauffällige Absenderzeile) wird nicht mehr gemeldet – Börsendienste wie Stocktwits schreiben ständig über Trading. Von Zufalls- oder Billigdomains wird weiter gewarnt.

## 0.6.0 – Anhänge genauer prüfen (2026-10-17)

Auf Anregung aus einer Nutzer-Rückmeldung.

- Neu: **Getarnte Anhänge** werden rot gemeldet. Erkannt werden:
  - eine Dokument-Endung vor einer gefährlichen Endung (`Rechnung.pdf.exe`, `Scan.jpg   .html`),
  - Steuerzeichen, die die Schreibrichtung umdrehen (aus `Rechnung[RTLO]fdp.exe` wird auf dem Bildschirm `Rechnungexe.pdf`),
  - Dateien, deren Inhalt nicht zur Endung passt: Das Add-on liest die ersten Bytes jedes Anhangs. Ist eine „Rechnung.pdf“ in Wahrheit ein Windows-Programm oder ein „Scan.jpg“ eine Webseite, gibt es eine Warnung.
  - „Rechnung.2024.pdf“ oder „backup.tar.gz“ zählen nicht.
- Neu: **Blick in ZIP-Dateien**, ohne sie zu entpacken. Liegt darin ein Programm, Skript oder eine Webseite, gibt es mindestens „Vorsicht“, auch von bekannten Absendern; rot wird es zusammen mit weiteren Hinweisen oder bei getarntem Namen.
- Neu: **Verrufene Domain-Endungen** (`.xyz`, `.top`, `.tk`, `.zip` …) beim Absender oder in Links zählen als schwacher Hinweis – nie allein ein Grund zu warnen, aber sie verstärken andere.
- Weniger Fehlalarme: Ein Logo, dessen Beschriftung die verlinkte Seite nennt (Steam-Mail mit „Valve“-Logo auf `valvesoftware.com`), gilt nicht mehr als Bild-Köder – sofern die Mail per DKIM vom Absender bestätigt ist. Beschriftungen wie „Dokument anzeigen“ zählen nie als Logo.
- Mehr gefährliche Endungen: `.com`, `.pif`, `.cpl`, `.reg`, `.vhd(x)`, `.appx`, `.msix`, `.url`.
- Entwicklung: Unit-Tests und `build-xpi.sh` laufen jetzt auch unter Windows (Git Bash).

## 0.5.6 – „Diesem Absender vertrauen“ funktioniert wieder (2026-10-14)

- Behoben: Ein Klick auf „Diesem Absender vertrauen“ bewirkte nichts – die Rückfrage wurde als Browser-Dialog gestellt, den Thunderbird im Nachrichtenbereich (z. B. in NovaBird-Conversation) unterdrückt. Die Rückfrage erscheint jetzt direkt im Banner („Abbrechen“ / „Ja, vertrauen“, bei roten Warnungen weiterhin zweistufig). Danach verschwinden das Banner und auch das Warn-Tag in der Nachrichtenliste.
- Weniger Fehlalarme: Antwortadresse mit gleichem Firmennamen unter anderer Endung (z. B. Absender `enjoy.eset.com`, Antwort an `eset.de`) gilt nicht mehr als fremde Domain – sofern der Absender per DKIM bestätigt oder bekannt ist. Unterdomains galten schon vorher als gleich.

## 0.5.5 – nur ein Banner pro Mail (2026-10-13)

- Behoben: Das Warn-Banner erschien doppelt, wenn zusätzlich eine ältere Version mit der früheren Add-on-ID installiert war (seit 0.5.0 hat das Add-on eine neue ID, die alte Installation wird deshalb nicht ersetzt). Es erscheint jetzt immer genau ein Banner. **Ältere Versionen bitte trotzdem unter „Add-ons und Themes“ entfernen.**

## 0.5.4 – Phishing-Beispiele anonymisiert speichern (2026-10-13)

- Neu: Rechtsklick auf eine Mail → „Anonymisiert als .eml speichern (Phishing-Beispiel)“. Ersetzt eigene Adressen und Namen (aus den Thunderbird-Konten und abgeleitet aus Adressen wie vorname.nachname@…), alle Empfänger, private Domains, Postanschriften und persönliche Link-Kennungen; leert Anhänge außer Bildern. Danach zeigt ein Fenster, was ersetzt wurde.
- Geprüft an 114 echten Mails: Die Erkennung findet nach dem Anonymisieren exakt dieselben Signale; die eigene Adresse und der eigene Name kommen nicht mehr vor.
- Neue Berechtigungen „Menüs“ und „Downloads“ (Thunderbird fragt beim Update einmal nach).

## 0.5.3 – Englisch (2026-10-13)

- README auf Englisch (deutsche Fassung: `README.de.md`), Screenshots auf Englisch (deutsche unter `docs/screenshots/de/`).
- Einstellungsseite und Add-on-Beschreibung jetzt zweisprachig (Deutsch/Englisch, je nach Sprache von Thunderbird). Banner, Gründe, Tags und Einrichtungsdialog waren es schon.
- Einstellungen zeigen nach dem Speichern „Gespeichert.“.
- Tote Pflicht-Links werden auch mit englischen Bezeichnungen erkannt („Help“, „Legal notice“, „Cookies“).

## 0.5.2 – kompakteres Banner (2026-10-13)

- Das Warn-Banner ist rund 40 % niedriger (z. B. 100 statt 175 Pixel; in NovaBird-Conversation 111–146 statt 180–219 Pixel), ohne Informationen wegzulassen: Überschrift und Punktzahl in einer Zeile, die zwei wichtigsten Gründe immer sichtbar, Knöpfe in der Fußzeile.
- **„Warum?“** zeigt alle Gründe mit den **Punkten je Grund**.
- Kräftiger farbiger Rand links (rot bzw. dunkelgelb) für gute Sichtbarkeit.
- Geprüft: Der „Mehr ▾“-Knopf von NovaBird-Conversation funktioniert mit dem Banner (in Thunderbird 157 nicht nachstellbar).

## 0.5.1 – Banner lässt sich nicht mehr verdecken (2026-10-13)

- **Sicherheitskorrektur:** Eine Phishing-Mail konnte das Warn-Banner mit eigenem CSS überdecken oder ausblenden (z. B. eine weiße Fläche mit „Alles in Ordnung“). Getestet mit 6 Tricks, vorher wirkten 5 davon. Jetzt bleibt das Banner immer sichtbar: Es setzt seine Sichtbarkeit unverrückbar, prüft nach dem Einblenden, ob es wirklich oben liegt, und schaltet sonst die Stile dieser Mail ab.
- Mit NovaBird-Conversation getestet: dessen Einblend-Animation löst keinen Eingriff aus.

## 0.5.0 – erste öffentliche Version (2026-10-13)

Lokaler Phishing-Schutz für Thunderbird/Betterbird, komplett offline.

- **Warnungen in zwei Stufen:** rot („Warnung“, Links gesperrt mit Rückfrage) und gelb („Vorsicht“), mit Tag in der Nachrichtenliste und „Warum?“-Ansicht mit Punkten je Grund.
- **Absender:** Marke oder Organisation im Namen, aber fremde Adresse; nachgemachte Domains (Lookalike, gemischte Schriftzeichen); Kontakt-Imitation; Antworten ohne vorherige Mail.
- **Links und Bilder:** angezeigte gegen echte Linkadresse, Link-Verkürzer, Hosting-Dienste für Fake-Seiten, Bild-Links auf fremde Seiten, Texterkennung in Bildern (lokal, Deutsch/Englisch, weitere Sprachen auf Wunsch), QR-Codes.
- **Inhalt:** Erpressungs-Mails, Krypto-/Anlage-Lockangebote, Füllwort-Tricks, Pflicht-Links ins Leere.
- **Lernt aus dem eigenen Postfach** (nur Kopfdaten der letzten 12 Monate): Angeschriebene gelten als bekannt, Namen regelmäßiger Absender werden gemerkt; auffällige Mails werden nie gelernt.
- **Markenwissen:** rund 90 häufig gefälschte Marken (Banken, Paketdienste, Shops, Behörden) plus rund 1.250 Banken aus den EU-Ländern (Wikidata, CC0) – vor allem, um echte Banken nicht fälschlich zu warnen.
- **Einrichtungsdialog beim ersten Start:** Auswahl der vertrauenswürdigen Adressbücher; „Gesammelte Adressen“ ist standardmäßig aus.
- **Einstellungen:** Aktiv- oder Beobachtungsmodus (Standard: aktiv), Adressbücher, Ordner-Ausnahmen, Rückblick der Absenderhistorie, OCR-Sprachen, vertraute Absender.

Die Versionen 0.1–0.2.12 waren interne Testversionen; Details in [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md).
