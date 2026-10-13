# Änderungen

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
