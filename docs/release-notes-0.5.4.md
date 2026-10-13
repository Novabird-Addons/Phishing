## Novabird-phishing 0.5.4

**Warns you about phishing and scam emails in Thunderbird and Betterbird – locally, without any cloud service.**

![Warning on a fake PayPal message](https://raw.githubusercontent.com/Novabird-Addons/Phishing/v0.5.4/docs/screenshots/01-overview-dangerous.png)

**What it does**
- 🟥 **Red:** very likely phishing or extortion – links are blocked, a click asks first.
- 🟨 **Yellow:** suspicious – take a closer look.
- The banner shows the two main reasons; **“Why?”** lists all reasons with their points; **“Trust this sender”** turns warnings off for one sender.

**What it looks for:** sender name doesn’t match the address (e.g. “Deutsche Kreditbank AG” from a foreign domain) · fake and look-alike links · known contacts writing from new addresses · “Re:” without any previous mail · bait images and QR codes · extortion and crypto scams.

**Better than the built-in check:** Thunderbird mainly checks links. Novabird-phishing also checks sender, contacts, history, images and content, explains every warning, knows about 1,250 EU banks, and learns the senders in your own mailbox – no AI, no cloud. Suspicious mail is never learned.

**New in 0.5.4:** right-click a message → **“Save anonymized as .eml”** to share phishing samples without revealing who you are. Help improve detection!

**Privacy:** no message ever leaves your computer. For the sender history, only sender, recipients and date of the last 12 months are read.

**Installation:** download `novabird-phishing-0.5.4.xpi` below → Thunderbird: Add-ons and Themes → gear icon → *Install Add-on From File*. A short dialog asks which address books contain your real contacts; then protection is on. English and German user interface.

**Notes:** tested with Thunderbird 157; Betterbird not yet tested. Not signed yet. Complements – doesn’t replace – your provider’s spam filter.

---

🇩🇪 **Kurz auf Deutsch:** Lokaler Phishing-Schutz für Thunderbird/Betterbird, ohne Cloud. Rot = sehr wahrscheinlich Phishing (Links gesperrt), Gelb = verdächtig, „Warum?“ zeigt alle Gründe mit Punkten. Neu in 0.5.4: Rechtsklick → „Anonymisiert als .eml speichern“, um Phishing-Beispiele zu teilen. Installation: XPI unten herunterladen → Add-ons und Themes → Zahnrad → *Add-on aus Datei installieren*. Ausführlich: [README.de.md](https://github.com/Novabird-Addons/Phishing/blob/main/README.de.md)
