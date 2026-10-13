## Novabird-phishing 0.5.0

**Warnt in Thunderbird und Betterbird vor Phishing- und Betrugs-Mails – lokal, ohne Cloud.**

![Warnung bei einer gefälschten PayPal-Mail](https://raw.githubusercontent.com/Novabird-Addons/Phishing/v0.5.0/docs/screenshots/01-uebersicht-gefaehrlich.png)

**Was es macht**
- 🟥 **Rot:** sehr wahrscheinlich Phishing oder Erpressung – Links sind gesperrt, ein Klick fragt erst nach.
- 🟨 **Gelb:** verdächtig – genauer hinsehen.
- „Warum?“ zeigt jeden Grund, „Diesem Absender vertrauen“ schaltet Warnungen für einen Absender ab.

**Worauf es achtet:** Absendername passt nicht zur Adresse (z. B. „Deutsche Kreditbank AG“ von einer fremden Domain) · gefälschte und nachgemachte Links · bekannte Kontakte von neuen Adressen · „AW:“ ohne Vorgeschichte · Köder-Bilder und QR-Codes · Erpressungs-Mails und Krypto-Lockangebote.

**Besser als die eingebaute Prüfung:** Thunderbird prüft im Wesentlichen nur Links. Novabird-phishing prüft auch Absender, Kontakte, Verlauf, Bilder und Inhalt, erklärt jede Warnung und lernt die Absender aus deinem Postfach – ohne KI, ohne Cloud. Auffällige Mails werden nie gelernt.

**Datenschutz:** Keine Mail verlässt den Rechner. Gelesen werden für die Absenderhistorie nur Absender, Empfänger und Datum der letzten 12 Monate.

**Installation:** `novabird-phishing-0.5.0.xpi` herunterladen → Thunderbird: Add-ons und Themes → Zahnrad → *Add-on aus Datei installieren*. Beim ersten Start fragt ein kurzer Dialog, welche Adressbücher deine echten Kontakte enthalten („Gesammelte Adressen“ ist bewusst abgewählt). Danach ist der Schutz aktiv.

**Hinweise:** Getestet mit Thunderbird 157, Betterbird noch nicht getestet. Noch nicht signiert. Ersetzt nicht den Spamfilter des Mail-Anbieters.
