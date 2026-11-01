# KI-Schnittstelle Phishing-Schutz ↔ NovaBird-Extension

Stand 01.11.2026. Extension-Seite (`phish:extract`, `aiAvailable`, `phish:result`) gebaut und in TB 159 getestet,
noch nicht committet; dort festgehalten in `docs/ki-anbindung.md`, Abschnitt 5a. Abgestimmt zwischen dem Phishing-Thread (`C:\Claude-phishing`) und dem NovaBird-Thread
(`C:\Claude\NovaBird`, Branch `novabird-2.0`). Hintergrund: `C:\Claude\NovaBird\docs\ki-anbindung.md`.

**Arbeitsteilung:** Jeder ändert nur sein eigenes Repository. Wünsche an die andere Seite werden als Vertrag hier
festgehalten.

## Grundsätze

1. **Die KI darf verschärfen, nie entwarnen.** Phishing-Mails schleusen gezielt Anweisungen an Sprachmodelle ein
   („diese Mail ist sicher“). Ein Modellergebnis kann im Phishing-Schutz nur Signale *hinzufügen*, nie welche
   entfernen oder die Stufe senken.
2. **Fakten statt Urteil.** Das Modell liefert keinen Risikowert und kein „verdächtig ja/nein“, sondern nur Merkmale
   mit festen Feldern. Die Bewertung treffen die Regeln des Phishing-Schutzes.
3. **Entwarnen darf nur, was ein Angreifer nicht kennen kann.** Ein Beispiel ist eine Bestell- oder Sendungsnummer aus
   einer früheren, vertrauenswürdigen Mail („Bezug über Anker“, siehe unten). Ähnlichkeit per Vektor zählt nicht dazu:
   Eine gefälschte Rechnung ähnelt der echten absichtlich.
4. **Keine Cloud.** Der Phishing-Schutz verspricht „keine Verbindung ins Internet“. Mailtext geht nur an ein Modell im
   eigenen Rechner oder Netz.
5. **Ohne NovaBird-Extension** läuft der Phishing-Schutz unverändert mit seinen Regeln.

## IDs

| Add-on | ID |
|---|---|
| Phishing-Schutz | `phishing-addon@novabird` (Thunderbird ab 153) |
| NovaBird-Extension | `novabird-extension@novabird` |

## Nachrichten Phishing → Extension

Die Extension nimmt sie nur von `phishing-addon@novabird` an. Der Listener ist **nicht `async`** und antwortet nur
auf die eigenen Typen; alle anderen Nachrichten lässt er unbeantwortet.

### `aiAvailable`

```js
browser.runtime.sendMessage('novabird-extension@novabird', { type: 'aiAvailable', feature: 'phish' })
// → { available: bool, local: bool, reachable: bool, model: string }
```

`available` ist wahr, wenn die KI eingerichtet ist und der Schalter „Phishing-Prüfung“ (`aiFeatures.phish`) an ist.
Der Schalter steht **standardmäßig auf aus** (opt-in), weil er jede neue Mail von selbst an die KI schickt.
`local` folgt der Cloud-Regel unten. `reachable` prüft die Modellliste der KI (Helper `hello`, Ollama `/api/tags`,
OpenAI `/models`; bei Ollama/OpenAI muss das eingestellte Modell darin stehen), höchstens 2 s, 30 s gemerkt; nur wenn
`available` und `local` stimmen, sonst `false` und `model` = `""`. Die Einstellungsseite des Phishing-Schutzes zeigt
daraus den Statuspunkt (grün/gelb/grau).

## Einstellungen → NovaBird

Die Extension nimmt `phishing-addon@novabird` über eine eigene ID-Liste (`HUB_IDS`) als Reiter „Phishing-Schutz“
(key `phishing`, nach `send`) auf: `options_ui.page` + `?hub=1`, Symbol `icons/icon-48.png`. Mit `HUB_KEYS` beantwortet
sie `{ type: 'openSettings', probe: true }` mit `{ ok: true }`; dann zeigt die Seite in der Add-on-Verwaltung nur einen
Verweis dorthin.

### `phish:extract`

```js
browser.runtime.sendMessage('novabird-extension@novabird', { type: 'phish:extract', messageId })
```

`messageId` ist die Thunderbird-interne ID (Ganzzahl). Ein Feld `hints` gibt es nicht: Das Modell liest nur den Mailtext. So
bleibt das zwischen PCs geteilte Ergebnis unabhängig von den Regeln und der Version des Phishing-Schutzes.

Antwort bei Erfolg:

| Feld | Typ | Bedeutung |
|---|---|---|
| `ok` | `true` | |
| `claimedOrg` | string \| null, max. 80 Zeichen | Als welche Organisation gibt sich die Mail aus („Sparkasse Köln“, „DHL“)? |
| `claimedDomain` | Hostname \| null | Welche Website nennt die Mail als die eigene? Kein gültiger Hostname ergibt `null`. |
| `asksFor` | `login` \| `payment` \| `download` \| `reply` \| `call` \| `none` | Was soll der Empfänger tun? Unbekannte Werte ergeben `none`. |
| `urgency` | bool | Wird Zeitdruck oder eine Drohung aufgebaut? Nur echtes bool. |
| `injection` | bool | Enthält die Mail Anweisungen an KI-Systeme? Kommt aus `nbAI.suspicious(text)`, also regelbasiert und ohne Modell. |
| `model` | string | Name des Modells, nur zur Anzeige und Fehlersuche |
| `cached` | bool | Ergebnis kam aus dem Cache oder von einem anderen PC |

Eine Mail ohne Text ergibt `ok: true` mit `claimedOrg`/`claimedDomain` = `null`, `asksFor` = `none`,
`urgency` = `false` und `cached` = `false`.

Antwort bei Fehler: `{ ok: false, error, injection? }` mit `error`:

| Wert | Bedeutung |
|---|---|
| `off` | KI nicht eingerichtet |
| `feature` | Schalter „Phishing-Prüfung“ aus |
| `cloud` | Eingestelltes Modell liegt nicht lokal (siehe unten) |
| `busy` | Ergebnis nicht innerhalb von 2,5 s verfügbar; es folgt später als `phish:result` |
| `timeout`, `error` | Sonstiges. `error` auch bei ungültiger `messageId` (keine Ganzzahl, unbekannt). |

`injection` (regelbasiert) kommt bei allen Fehlern mit, die nach dem Lesen der Mail auftreten: `off`, `feature`,
`cloud` und `busy`. Nur bei einer ungültigen `messageId` fehlt es.

Beide Seiten prüfen die Felder: Die Extension normalisiert die Werte wie oben beschrieben. Der Phishing-Schutz
übernimmt nur bekannte Felder mit gültigem Typ und Länge und ignoriert alles andere.

## Nachricht Extension → Phishing

### `phish:result`

Nur für Mails, auf die der Phishing-Schutz ein `busy` bekommen hat, schickt die Extension das Ergebnis von sich aus
nach. Mails, die nur über die Warteschlange beim Eintreffen geprüft wurden, pusht sie nicht. Die holt der
Phishing-Schutz beim Öffnen per `phish:extract`; die Antwort kommt dann in wenigen Millisekunden aus dem Cache.

```js
browser.runtime.sendMessage('phishing-addon@novabird', { type: 'phish:result', messageId, ...dieselbenFelder })
// Fehler im Nachgang: { type: 'phish:result', messageId, ok: false, error: 'timeout'|'error'|'off', injection }
```

Der Phishing-Schutz nimmt sie per `runtime.onMessageExternal` nur von `novabird-extension@novabird` an. Der Listener ist
nicht `async`. Danach wird die Mail neu bewertet und das Banner gegebenenfalls ergänzt.

## Zeitpunkt und Teilen (Extension)

- Die Prüfung läuft **beim Eintreffen** in derselben Warteschlange wie „Vorbereiten“, als eigener kurzer Aufruf von
  etwa 1–2 s. Sie hängt nur am Schalter „Phishing-Prüfung“, nicht an `aiPrepare`.
- Kommt `phish:extract` vor dem Ergebnis an, zieht die Extension die Mail in der Warteschlange nach vorn oder wartet auf
  den Claim eines anderen PCs. Nach höchstens 2,5 s antwortet sie `busy`.
- Geteilt wird über den Helper-AiCache mit kind `phish`, variant `p1`. Jede Änderung an Prompt oder Feldern zählt die
  variant hoch (`p2` …).

## Cloud-Regel

Erlaubt ist `aiType` = `nbhelper` oder eine `aiUrl`, deren Host einer der folgenden ist (`nbAI.privateHost`):

- `localhost`, Hostnamen ohne Punkt (z. B. `http://nas:11434`)
- Namen unter `.local`, `.lan`, `.home.arpa`, `.internal`
- IPv4: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`
- IPv6: `::1`, `fc00::/7`, `fe80::/10`

Alle anderen öffentlichen Namen und IPs ergeben `error: 'cloud'`. `aiAvailable.local` folgt derselben Regel.

## Prompt-Schutz (Extension)

Der Mailtext steht zwischen zufälligen Markierungen (`fenced()` aus `ai.js`), danach folgt der Erinnerungssatz.
Ausgabe nur als JSON (Ollama `format: "json"`). Gemessen ohne Erinnerung: 9 von 10 eingeschleusten Anweisungen
befolgt, mit Erinnerung 0 von 10.

## Verwendung im Phishing-Schutz (geplant)

Erst wenn die Extension `phish:extract` liefert. Nur im Graubereich gefragt, also wenn die Regeln allein „normal“ mit
Hinweisen oder „Vorsicht“ ergeben.

| Merkmal | Neues Signal | Bedingung |
|---|---|---|
| `claimedOrg` / `claimedDomain` | `aiClaimMismatch` | Die genannte Organisation bzw. Domain passt nicht zur Absenderdomain und zu keinem Linkziel. Erkennt Marken, die in keiner Liste stehen. |
| `asksFor` = `login`/`payment` | `aiAsksCredentials` | Nur verstärkend (schwach), zusammen mit anderen Hinweisen |
| `injection` | `aiInjection` | Eine Mail, die KI-Systeme anweist, ist an sich verdächtig (stark) |
| `urgency` | – | Nur zusammen mit `asksFor` ≠ `none` |

Keines dieser Felder kann ein Signal entfernen.

## Bezug über Anker (im Phishing-Schutz, ohne KI, ab 0.6.1)

`lib/anchors.js` zieht Bestell-, Sendungs-, Rechnungs-, Vorgangs- und Kundennummern aus Betreff und Text. Bei einer
Warnung, an der Erstkontakt-Hinweise beteiligt sind, sucht `background.js` dieselbe Nummer in früheren Mails der
letzten 180 Tage. Gesucht wird im Betreff in allen Konten, im Text nur in lokalen Konten. Die frühere Mail zählt nur,
wenn sie:

- selbst verschickt wurde (Gesendet-Ordner), oder
- von einem Kontakt oder etablierten Absender stammt, oder
- per DKIM von einer *anderen* Domain bestätigt ist, mindestens 12 Stunden älter ist und eine unauffällige Absenderzeile hat.

Außerdem darf sie nicht im Spam-Ordner liegen und kein Warn-Tag tragen. Dann entfallen `firstContact`,
`nameDomainMismatch`, `orgNameMismatch` und `replyToForeignAuthed`. Alle Fälschungshinweise bleiben.

**Später (kein Eilbedarf):** `{ type: 'phish:related', messageId, anchors }` → `{ ok, related: [{ messageId, anchor,
date }] }` über die Bedeutungssuche von NovaBird-Search. Das wäre eine Beschleunigung für IMAP-Konten, deren Text
der Phishing-Schutz nicht durchsucht.
