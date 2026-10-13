// E2E-Test: Thunderbird headless (Marionette), Erweiterung temporär installieren,
// Test-Mails öffnen und prüfen, ob das Banner wie erwartet erscheint.
// Aufruf: node tests/e2e/run.mjs <extension-dir> [active|shadow|noremote|langs]
//   langs    = wie active, dazu ist Französisch nachinstalliert (echter, geprüfter Download) und aktiv
//   noremote = wie active, aber Fremdbild-Prüfung aus (es darf nur 1 Anfrage an den Bild-Server gehen)
import { Marionette } from './marionette.mjs';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { execSync } from 'node:child_process';
const rssMB = () => { try { return Math.round(Number(execSync("MAIN=$(ps -eo pid,args | awk '/\\/thunderbird/ && /--profile/ && /testprofile/ && !/awk/ && !/bash -c/ {print $1; exit}'); ps -o rss= --ppid $MAIN | awk '{s+=$1} END {print s+0}'", { shell: '/bin/bash' }).toString()) / 1024); } catch { return -1; } };

const extDir = path.resolve(process.argv[2] ?? '.');
const mode = process.argv[3] ?? 'active';
const activeLike = mode !== 'shadow';
const remoteOn = mode === 'active' || mode === 'langs';
const IMG_PORT = 8767;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const m = new Marionette();
await m.connect();
await m.send('WebDriver:NewSession', { capabilities: {} });
await m.send('Marionette:SetContext', { value: 'chrome' });

// Köder-Bild ("OneDrive – Dokument anzeigen") im Thunderbird-Fenster rendern.
const pngB64 = await m.script(`
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  const c = new win.OffscreenCanvas(900, 320);
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, 900, 320);
  x.fillStyle = "#222"; x.font = "bold 38px Arial, sans-serif";
  x.fillText("Muster GmbH hat ein Dokument zugesandt", 30, 90);
  x.font = "34px Arial, sans-serif";
  x.fillText("ABGESCHLOSSENES DOKUMENT ANZEIGEN", 30, 170);
  x.fillText("OneDrive    126.9 KB", 30, 250);
  const buf = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 4096) bin += String.fromCharCode(...buf.subarray(i, i + 4096));
  return win.btoa(bin);
`);
const png = Buffer.from(pngB64, 'base64');
console.log('Köder-Bild:', png.length, 'Bytes');
let imgRequests = 0;
const imgServer = http.createServer((req, res) => { imgRequests++; res.setHeader('Content-Type', 'image/png'); res.end(png); }).listen(IMG_PORT, '127.0.0.1');

// Test-Mails aus der Fixture direkt in den Posteingang legen.
const raw = fs.readFileSync(new URL('./fixtures.mbox', import.meta.url), 'utf8');
const mails = raw.split(/^(?=From - )/m).filter((x) => x.startsWith('From - ')).map((x) => x.replace(/^From - .*\n/, '').trim().replace(/\n/g, '\r\n') + '\r\n');
// Optional: eine echte .eml unverändert einschleusen (Umgebungsvariable REAL_EML); es wird nur das Banner ausgegeben.
if (process.env.REAL_EML) mails.push(fs.readFileSync(process.env.REAL_EML, 'latin1').replace(/\r?\n/g, '\r\n'));
// Regression: derselbe Phishing-Absender mehrfach im Postfach (Spam-Sammlung/Kampagne) darf nicht "bekannt" werden.
const phish1 = mails.find((x) => x.includes('<phish1@evil.test>'));
for (let n = 1; n <= 4; n++) mails.push(phish1.replace('<phish1@evil.test>', `<phish1-kopie${n}@evil.test>`));
const wrap = (b64) => b64.match(/.{1,76}/g).join('\r\n');
mails.push(
  // A: Köder-Bild eingebettet (cid), verlinkt auf Fremddomain – Absender wie ein bekannter Geschäftspartner
  `From: "Langen, Christian" <c.langen@partner-firma.test>\r\nTo: me@example.net\r\nSubject: Anfrage Transport\r\nMessage-ID: <ocr-embedded@partner-firma.test>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="B2"\r\n\r\n--B2\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><p>Anbei die Anfrage.</p><a href="https://saga.so/abc"><img src="cid:doc.png@01" width="566"></a></body></html>\r\n--B2\r\nContent-Type: image/png; name="doc.png"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <doc.png@01>\r\nContent-Disposition: inline; filename="doc.png"\r\n\r\n${wrap(pngB64)}\r\n--B2--\r\n`,
  // B: dasselbe Bild als Fremdbild (http), ohne Größenangaben
  `From: "Dokumentenfreigabe" <share@partner2-firma.test>\r\nTo: me@example.net\r\nSubject: Dokument freigegeben\r\nMessage-ID: <ocr-remote@partner2-firma.test>\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><a href="https://saga.so/xyz"><img src="http://127.0.0.1:${IMG_PORT}/doc.png"></a></body></html>\r\n`,
);
// Absenderhistorie über den Gesendet-Ordner: gleiche Mail (Reply-To fremd, 20 Punkte + 10 Erstkontakt = verdächtig)
// von einem Fremden, von jemandem, dem ich vor dem Erstscan geschrieben habe, und von jemandem, dem ich erst danach schrieb.
const histMail = (addr, id) => `From: "Kontakt" <${addr}>\r\nTo: me@example.net\r\nSubject: Unterlagen\r\nMessage-ID: <${id}>\r\n` +
  `Reply-To: <buero@andere-domain.test>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHallo, anbei wie besprochen die Unterlagen.\r\n`;
mails.push(histMail('stranger@neu-domain.test', 'sent-none@test'), histMail('friend@bekannt.test', 'sent-scan@test'));
// Stufe "oft empfangen" (0.2.9): je 3 frühere Mails über mehrere Wochen, die zu prüfende Mail kommt erst nach dem Scan.
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toUTCString();
const plainMail = (from, id, date, subject, body, extra = '') => `From: ${from}\r\nTo: me@example.net\r\nSubject: ${subject}\r\n` +
  `Message-ID: <${id}>\r\nDate: ${date}\r\n${extra}Content-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`;
const CRYPTO = ['Mit Bedacht investieren', 'Navigieren im Bitcoin-Abschwung: Warum jetzt Ihr idealer Einstiegspunkt sein könnte!!'];
for (const [i, d] of [60, 40, 20].entries()) {
  mails.push(plainMail('"Verein" <info@verein-x.test>', `verein-old${i}@test`, daysAgo(d), 'Vereinsnachrichten', 'Liebe Mitglieder, das nächste Treffen ist am Freitag.'));
  mails.push(plainMail('"Krypto News" <news@krypto-x.test>', `krypto-old${i}@test`, daysAgo(d), ...CRYPTO));
  mails.push(plainMail('"Alter Bekannter" <old@alt-x.test>', `alt-old${i}@test`, daysAgo(800 - d), 'Hallo', 'Hallo, wie geht es dir?'));
}
// Schicht 1: "Velomarkt" schreibt seit Wochen von velomarkt.test -> der Name ist gelernt
for (const [i, d] of [50, 30, 10].entries()) {
  mails.push(plainMail('"Velomarkt" <news@velomarkt.test>', `velomarkt-old${i}@test`, daysAgo(d), 'Ihre Bestellung', 'Vielen Dank für Ihre Bestellung.'));
}
const afterScan = [
  plainMail('"Velomarkt" <info@kundenkonto-check.test>', 'learned-fake@test', daysAgo(1), 'Ihre Bestellung', 'Bitte prüfen Sie Ihre Bestellung.'),
  plainMail('"Velomarkt" <service@velomarkt.test>', 'learned-ok@test', daysAgo(1), 'Ihre Bestellung', 'Ihre Bestellung wurde versandt.'),
  // Reply-To fremd (20) – ohne Erstkontakt-Hinweis bleibt es unauffällig, mit (+10) wird es verdächtig
  plainMail('"Verein" <info@verein-x.test>', 'recurring-ok@test', daysAgo(1), 'Unterlagen', 'Anbei die Unterlagen.', 'Reply-To: <buero@andere-domain.test>\r\n'),
  plainMail('"Krypto News" <news@krypto-x.test>', 'recurring-spam@test', daysAgo(1), ...CRYPTO),
  plainMail('"Alter Bekannter" <old@alt-x.test>', 'recurring-old@test', daysAgo(1), 'Unterlagen', 'Anbei die Unterlagen.', 'Reply-To: <buero@andere-domain.test>\r\n'),
];
const sentMail = (to, id) => `From: me@example.net\r\nTo: <${to}>\r\nSubject: Frage\r\nMessage-ID: <${id}>\r\nDate: Mon, 05 Oct 2026 10:00:00 +0200\r\n` +
  `Content-Type: text/plain; charset=utf-8\r\n\r\nHallo\r\n`;
const addSent = (mail) => m.script(`
  const [mail] = arguments;
  const root = MailServices.accounts.localFoldersServer.rootFolder;
  let sent = root.getChildNamed("Sent");
  if (!sent) sent = root.QueryInterface(Ci.nsIMsgLocalMailFolder).createLocalSubfolder("Sent");
  sent.setFlag(Ci.nsMsgFolderFlags.SentMail);
  sent.QueryInterface(Ci.nsIMsgLocalMailFolder).addMessage(mail);
  return sent.getTotalMessages(false);
`, [mail]);
console.log('Gesendet (vor Scan):', await addSent(sentMail('friend@bekannt.test', 'out1@example.net')));

console.log('Eingefügt:', await m.script(`
  const [mails] = arguments;
  const root = MailServices.accounts.localFoldersServer.rootFolder;
  let inbox = root.getChildNamed("Inbox");
  if (!inbox) inbox = root.QueryInterface(Ci.nsIMsgLocalMailFolder).createLocalSubfolder("Inbox");
  inbox.setFlag(Ci.nsMsgFolderFlags.Inbox);
  const local = inbox.QueryInterface(Ci.nsIMsgLocalMailFolder);
  for (const mail of mails) local.addMessage(mail);
  return inbox.getTotalMessages(false);
`, [mails]));

const rssBefore = rssMB();
const install = await m.send('Addon:Install', { path: extDir, temporary: true });
console.log('Addon installiert:', JSON.stringify(install));

// Kontakt anlegen: "Chef Mustermann" mit anderer Adresse als der Absender der Fake-Antwort.
console.log('Kontakt:', await m.script(`
  const ab = MailServices.ab.directories.find((d) => d.dirType == 101 || d.URI == "jsaddrbook://abook.sqlite");
  const card = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance(Ci.nsIAbCard);
  card.displayName = "Chef Mustermann"; card.firstName = "Chef"; card.lastName = "Mustermann";
  card.primaryEmail = "chef@firma-mustermann.de";
  ab.addCard(card);
  return ab.URI;
`));

await sleep(8000); // Hintergrund-Skript startet, Historie wird aufgebaut
// Einrichtungsdialog muss nach der Installation offen sein (Adressbücher wählen); danach schließen
const onboarding = await m.script(`
  for (const w of Services.wm.getEnumerator(null)) {
    const hit = [...w.document.querySelectorAll("browser")].find((b) => String(b.currentURI?.spec).includes("onboarding.html"));
    if (!hit) continue;
    const size = { w: w.outerWidth, h: w.outerHeight };   // Inhalt läuft im Erweiterungsprozess (nicht lesbar), Fenster genügt
    w.close();
    return { open: true, size };
  }
  return null;
`);
console.log('Einrichtungsdialog:', JSON.stringify(onboarding));
// Erst die eigene Mail, dann die Antwort darauf (wie im Alltag; sonst könnte die Antwort schon vorher bewertet sein)
console.log('Gesendet (nach Scan):', await addSent(sentMail('later@bekannt2.test', 'out2@example.net')));
await m.script(`
  const [list] = arguments;
  const inbox = MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Inbox").QueryInterface(Ci.nsIMsgLocalMailFolder);
  for (const mail of list) inbox.addMessage(mail);
`, [[histMail('later@bekannt2.test', 'sent-later@test'), ...afterScan]]);

const listing = await m.script(`
  const root = MailServices.accounts.localFoldersServer.rootFolder;
  const inbox = root.getChildNamed("Inbox");
  const out = [];
  for (const hdr of inbox.messages) out.push({ key: hdr.messageKey, id: hdr.messageId, subject: hdr.mime2DecodedSubject });
  return out;
`);
console.log('Mails im Posteingang:', listing.length);

const results = {};
// Auf B wird gewartet, bis die Fremdbild-Prüfung das Banner ergänzt hat (nur wenn eingeschaltet).
const NEEDLE = remoteOn ? { 'ocr-remote@partner2-firma.test': 'Ein Bild nennt' } : {};
for (const msg of listing) {
  results[msg.id] = await m.script(`
    const [msgKey, needle] = arguments;
    const inbox = MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Inbox");
    const hdr = inbox.GetMessageHeader(msgKey);
    const win = Services.wm.getMostRecentWindow("mail:3pane");
    const tabmail = win.document.getElementById("tabmail");
    const uri = inbox.getUriForMsg(hdr);
    const tab = tabmail.openTab("mailMessageTab", { messageURI: uri, background: false });
    const findBanner = (doc, depth = 0) => {
      if (!doc || depth > 6) return null;
      const el = doc.getElementById("phishing-pilot-banner");
      if (el) return el;
      for (const f of doc.querySelectorAll("browser, iframe")) {
        let d = null;
        try { d = f.contentDocument; } catch (e) {}
        const r = findBanner(d, depth + 1);
        if (r) return r;
      }
      return null;
    };
    let found = null;
    const reasonsOf = (el) => [...el.openOrClosedShadowRoot.querySelectorAll("li")].map((l) => l.textContent);
    for (let i = 0; i < (needle ? 100 : 40); i++) {
      await new Promise((r) => win.setTimeout(r, 250));
      found = findBanner(tab.chromeBrowser?.contentDocument ?? win.document);
      if (found && (!needle || reasonsOf(found).some((t) => t.includes(needle)))) break;
    }
    let info = null;
    if (found) {
      const sr = found.openOrClosedShadowRoot;
      info = { score: sr.querySelector(".small").textContent, ocr: found.dataset.ocr, ocrMs: found.dataset.ocrMs, debug: (function dbg(doc, d) { if (!doc || d > 6) return null; if (doc.documentElement?.dataset?.ppDebug) return doc.documentElement.dataset.ppDebug; for (const f of doc.querySelectorAll("browser, iframe")) { let x = null; try { x = f.contentDocument; } catch (e) {} const r = dbg(x, d + 1); if (r) return r; } return null; })(tab.chromeBrowser?.contentDocument ?? win.document, 0), title: sr.querySelector("h1").textContent, reasons: [...sr.querySelectorAll("li")].map((l) => l.textContent) };
    }
    tabmail.closeTab(tab);
    return info;
  `, [msg.key, NEEDLE[msg.id] ?? '']);
  console.log(`\n# ${msg.subject}  <${msg.id}>`);
  console.log(results[msg.id] ? JSON.stringify(results[msg.id], null, 1) : '(kein Banner)');
}

const expectBanner = {
  'phish1@evil.test': 'Warnung',
  'fakereply@gmail.com': 'Warnung',
  'hist1@example.org': null,
  'real-reply@example.org': null,
  'qr1@neu-firma.test': 'Warnung',   // seit 0.2.10: „Rechnungsservice“ ohne Bezug zur Domain (orgNameMismatch)
  'ocr-embedded@partner-firma.test': 'Warnung',
  'ocr-remote@partner2-firma.test': remoteOn ? 'Warnung' : 'Vorsicht',
  'sent-none@test': 'Vorsicht',
  'sent-scan@test': null,     // Gesendet-Ordner beim Erstscan (specialUse 'sent')
  'sent-later@test': null,    // Gesendet-Mail erst nach dem Scan (gezielte Suche)
  'recurring-ok@test': null,          // oft empfangen, unauffällig -> kein Erstkontakt-Hinweis
  'recurring-spam@test': 'Vorsicht',  // oft empfangen, aber Vollprüfung im Scan auffällig -> nicht legitimiert
  'recurring-old@test': 'Vorsicht',   // frühere Mails älter als der Rückblick -> zählen nicht
  'learned-fake@test': 'Vorsicht',    // gelernter Name "Velomarkt" von neuer Domain
  'learned-ok@test': null,            // gelernter Name, gewohnte Domain (andere Adresse)
};
let failed = 0;
for (const [id, expected] of Object.entries(expectBanner)) {
  const got = results[id]?.title ?? null;
  const ok = mode === 'shadow' ? got === null : expected === null ? got === null : got?.startsWith(expected);
  if (!ok) { failed++; console.log(`FEHLER ${id}: erwartet ${expected}, erhalten ${got}`); }
}
if (activeLike) {
  const r = results['fakereply@gmail.com']?.reasons ?? [];
  if (!r.some((x) => x.includes('deiner Kontakte'))) { failed++; console.log('FEHLER: Kontakt-Imitation nicht erkannt'); }
  if (!r.some((x) => x.includes('keine frühere Mail'))) { failed++; console.log('FEHLER: Antwort ohne Bezug nicht erkannt'); }
  const qr = results['qr1@neu-firma.test']?.reasons ?? [];
  if (!qr.some((x) => x.includes('QR-Code'))) { failed++; console.log('FEHLER: QR-Code nicht erkannt'); }
  const ph = results['phish1@evil.test']?.reasons ?? [];
  if (!ph.some((x) => x.includes('Neuer Absender'))) { failed++; console.log('FEHLER: Absender der geöffneten Mail zählt sich selbst als bekannt (Neuer-Absender-Hinweis fehlt)'); }
  if (!/\d/.test(results['phish1@evil.test']?.score ?? '')) { failed++; console.log('FEHLER: Punktzahl fehlt im Banner'); }
  const emb = results['ocr-embedded@partner-firma.test']?.reasons ?? [];
  if (!emb.some((x) => x.includes('Ein Bild nennt'))) { failed++; console.log('FEHLER: OCR (eingebettet) hat die Marke im Bild nicht erkannt'); }
  const rem = results['ocr-remote@partner2-firma.test']?.reasons ?? [];
  const remBrand = rem.some((x) => x.includes('Ein Bild nennt'));
  if (remoteOn && !remBrand) { failed++; console.log('FEHLER: Fremdbild-Prüfung hat die Marke im Bild nicht erkannt'); }
  if (mode === 'noremote' && remBrand) { failed++; console.log('FEHLER: Fremdbild wurde geprüft, obwohl aus'); }
  console.log(`OCR-Zeit: eingebettet ${results['ocr-embedded@partner-firma.test']?.ocrMs} ms (kalt), Fremdbild ${results['ocr-remote@partner2-firma.test']?.ocrMs} ms (warm); Kindprozesse des Test-Thunderbirds RSS ${rssBefore} -> ${rssMB()} MB`);
  const wantLangs = mode === 'langs' ? 'deu,eng,fra' : 'deu,eng';
  const gotLangs = results['ocr-embedded@partner-firma.test']?.ocr;
  console.log('OCR-Sprachen (eingebettete Mail):', gotLangs);
  if (gotLangs !== wantLangs) { failed++; console.log(`FEHLER: OCR-Sprachen erwartet ${wantLangs}, erhalten ${gotLangs}`); }
  console.log('Anfragen an den Bild-Server:', imgRequests);
  if (mode === 'noremote' && imgRequests !== 1) { failed++; console.log('FEHLER: erwartet genau 1 Anfrage (nur Anzeigen), erhalten ' + imgRequests); }
  if (remoteOn && imgRequests < 2) { failed++; console.log('FEHLER: Fremdbild-Prüfung hat kein zweites Mal geladen'); }
  const rr = results['real-reply@example.org'];
  if (rr) { failed++; console.log('FEHLER: echte Antwort wurde geflaggt'); }
}
if (!onboarding) { failed++; console.log('FEHLER: Einrichtungsdialog nicht erschienen'); }
console.log(failed ? `\n${failed} Abweichung(en)` : '\nE2E ok');
imgServer.close();
await m.send('Marionette:Quit', { flags: ['eForceQuit'] }).catch(() => {});
m.close();
process.exit(failed ? 1 : 0);
