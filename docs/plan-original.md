# Phishing-Pilot – Plan (Kurzfassung)

Stand: 11.10.2026

## Ziel

Ein Betterbird-Add-on, das verdächtige Mails lokal und offline per Heuristik erkennt. Es nutzt keine externen Dienste und keine Lizenzfeeds und ist damit auch in der Praxis einsetzbar. Der Bayes-Junk-Filter bleibt aktiv, und serverseitiger Spamschutz wird nicht ersetzt.

## Ablauf

1. **Neue Mail** (`onNewMailReceived`)
2. **Merkmale** aus Headern, Links, Anhängen und Absenderhistorie (Adressbuch, Kontakt-/Such-Pilot)
3. **Score** über die Heuristik, < 20 ms pro Mail
4. **Ergebnis** speichern; als Aktion Tag setzen, optional Junk oder Quarantäne
5. **Banner** beim Öffnen (`messageDisplayScripts`) mit Gründen und Link-Schutz
6. **Rückmeldung** des Nutzers → Ausnahmen

## Signale

| Signal | Gewicht |
|---|---|
| DMARC/SPF/DKIM fehlgeschlagen (`Authentication-Results` des eigenen Servers) | hoch |
| Absendername passt nicht zur Domain (z. B. „Sparkasse“ von gmail.com) | hoch |
| Lookalike-Domain (Tippfehler, Homoglyphen, Punycode, Marke als Subdomain) | hoch |
| Link-Text-Domain ≠ Link-Ziel | hoch |
| Login-Formular oder HTML-Anhang mit Login-Feldern | hoch |
| Riskante Anhänge (.html, .svg, .iso, .lnk, .js, Makros, ZIP mit Passwort) | hoch |
| Erstkontakt (+ Bezug auf Marke/Kontakt) | mittel (hoch) |
| Reply-To / Return-Path auf fremde Domain | mittel |
| IP-Links, URL-Shortener, Redirects | mittel |
| Druck-/Lockwörter DE/EN, nur Bild + Link, versteckter Text | niedrig |

Eine Markenliste (Banken, Paketdienste, Behörden) wird als JSON mitgeliefert. Eigene Domains lassen sich ergänzen.

## Bewertung

| Score | Stufe | Aktion |
|---|---|---|
| < 30 | unauffällig | – |
| 30–59 | verdächtig | Tag, gelbes Banner |
| ≥ 60 | gefährlich | rotes Banner, Links gesperrt bis Klick; optional Junk/Quarantäne |

- Bekannte Absender senken den Score. Ein DMARC-Fail hebt diesen Bonus wieder auf.
- Schwache Signale lösen allein nie eine Warnung aus.
- Gewichte stehen in einer Konfigurationsdatei und werden am Testkorpus kalibriert.

## Oberfläche

- Banner mit den 2–3 stärksten Gründen im Klartext
- Hover zeigt die echte Zieldomain
- Markierung „Erstkontakt“
- Spalten-Icon in der Nachrichtenliste
- „Warum?“-Dialog
- Einstellungen
- Sprachen DE/EN

## Datenschutz / ATN

- Kein Netzverkehr
- Berechtigungen: `messagesRead`, `messagesModify`, `messagesTag`, `accountsRead`, `addressBooks` (`messagesMove` nur bei Quarantäne)
- Gespeichert werden nur Scores, Signale und Ausnahmen

## Meilensteine

1. **Grundgerüst:** Skelett, Merkmalsextraktion, Testkorpus (ca. 500 legitime + 200 Phishing-Mails als .eml), Node-Testskript
2. **Heuristik v1:** Signale, Scoring, Ausnahmen, 4 Wochen Schattenmodus
   → *Gate:* Fehlalarme „gefährlich“ < 0,5 %, „verdächtig“ < 3 %, Erkennung > 80 %
3. **Oberfläche und Release:** ATN oder GitHub, später als Modul in NextBird

## Option KI – Bewertung: später

Kommt erst in Frage, wenn die Heuristik stabil läuft und genug Rückmeldungen als Trainingsdaten vorliegen. Sie wird nur übernommen, wenn sie messbar besser ist.

- **Merkmalsmodell** (< 1 MB): ersetzt die festen Gewichte durch gelernte
- **Text-Klassifikator** (quantisiert, 20–60 MB, WASM im Web Worker): nur für Grenzfälle
- **LLM-Erklärung** über einen lokalen Server: nur auf Knopfdruck
- **Externe Feeds** (Safe Browsing, OpenPhish): standardmäßig aus, mit eigenem API-Key, nur nicht-kommerziell

## Offen

- [ ] Eigenständig oder direkt als Modul in NextBird?
- [ ] Erstkontakt über Kontakt-Pilot/Such-Pilot oder eigene Absenderliste?
- [ ] Standardaktion bei „gefährlich“: nur Banner oder auch Junk?
- [ ] Liefert der eigene Mailserver verlässliche `Authentication-Results`?
