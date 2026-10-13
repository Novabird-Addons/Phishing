// Erzeugt die Screenshots für README/Release in docs/screenshots/ – mit erfundenen Demo-Mails (Domains *.example).
// Voraussetzung: frisch gestartetes Test-Thunderbird (tests/e2e/restart.sh) und gebaute Testkopie (tests/e2e/build-testext.sh).
// Aufruf: node tests/e2e/screenshots.mjs testext
import { Marionette } from './marionette.mjs';
import fs from 'node:fs';
import path from 'node:path';

const extDir = path.resolve(process.argv[2] ?? 'testext');
const outDir = path.resolve('docs/screenshots');
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toUTCString();

const m = new Marionette();
await m.connect();
await m.send('WebDriver:NewSession', { capabilities: { unhandledPromptBehavior: 'ignore' } });
await m.send('WebDriver:SetTimeouts', { script: 120000 });
await m.send('Marionette:SetContext', { value: 'chrome' });

// Köder-Bild "Dokument freigegeben" (wie bei einer echten Phishing-Mail, nachgestellt)
const baitB64 = await m.script(`
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  const c = new win.OffscreenCanvas(900, 320);
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, 900, 320);
  x.fillStyle = "#0364b8"; x.fillRect(0, 0, 900, 60);
  x.fillStyle = "#fff"; x.font = "bold 30px Arial, sans-serif"; x.fillText("OneDrive", 30, 42);
  x.fillStyle = "#222"; x.font = "bold 34px Arial, sans-serif";
  x.fillText("Muster GmbH hat ein Dokument freigegeben", 30, 130);
  x.font = "30px Arial, sans-serif"; x.fillText("DOKUMENT ANZEIGEN", 30, 210);
  x.fillText("Rechnung_2026.pdf   126 KB", 30, 270);
  const buf = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 4096) bin += String.fromCharCode(...buf.subarray(i, i + 4096));
  return win.btoa(bin);
`);
const wrap = (b64) => b64.match(/.{1,76}/g).join('\r\n');
// addMessage schreibt jedes Zeichen als ein Byte: Mails deshalb als UTF-8-Bytefolge übergeben (sonst kaputte Umlaute)
const bytes = (mail) => Buffer.from(mail, 'utf8').toString('latin1');
const qrB64 = fs.readFileSync(new URL('./qr-evil.png', import.meta.url)).toString('base64');

async function shot(name) {
  const { value } = await m.send('WebDriver:TakeScreenshot', { full: false, hash: false });
  fs.writeFileSync(path.join(outDir, name), Buffer.from(value, 'base64'));
  console.log('  ->', name);
}

const html = (from, id, subject, body, extra = '', date = daysAgo(0)) =>
  `From: ${from}\r\nTo: Max Beispiel <max@beispiel.example>\r\nSubject: ${subject}\r\nMessage-ID: <${id}>\r\nDate: ${date}\r\n${extra}` +
  `MIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body style="font-family:Arial,sans-serif">${body}</body></html>\r\n`;
const plain = (from, id, subject, body, extra = '', date = daysAgo(0)) =>
  `From: ${from}\r\nTo: Max Beispiel <max@beispiel.example>\r\nSubject: ${subject}\r\nMessage-ID: <${id}>\r\nDate: ${date}\r\n${extra}` +
  `Content-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`;
const related = (from, id, subject, bodyHtml, imgB64, imgName) =>
  `From: ${from}\r\nTo: Max Beispiel <max@beispiel.example>\r\nSubject: ${subject}\r\nMessage-ID: <${id}>\r\nDate: ${daysAgo(0)}\r\n` +
  `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="B1"\r\n\r\n--B1\r\nContent-Type: text/html; charset=utf-8\r\n\r\n` +
  `<html><body style="font-family:Arial,sans-serif">${bodyHtml}</body></html>\r\n--B1\r\nContent-Type: image/png; name="${imgName}"\r\n` +
  `Content-Transfer-Encoding: base64\r\nContent-ID: <${imgName}@01>\r\nContent-Disposition: inline; filename="${imgName}"\r\n\r\n${wrap(imgB64)}\r\n--B1--\r\n`;

const before = [
  // Verlauf: "Velomarkt" schreibt seit Wochen von velomarkt.example (wird gelernt)
  ...[50, 30, 10].map((d, i) => plain('"Velomarkt" <shop@velomarkt.example>', `velo${i}@demo`, 'Ihre Bestellung bei Velomarkt',
    'Vielen Dank für Ihre Bestellung. Wir melden uns, sobald das Paket unterwegs ist.', '', daysAgo(d))),
  plain('"Anna Schneider" <anna.schneider@beispiel-firma.example>', 'normal1@demo', 'Protokoll vom Dienstag',
    'Hallo Max,\r\n\r\nanbei wie besprochen das Protokoll.\r\n\r\nViele Grüße\r\nAnna', '', daysAgo(1)),
  html('"PayPal Service" <service@konto-hilfe24.example>', 'paypal@demo', 'Ihr Konto wurde vorübergehend eingeschränkt',
    '<h2>Ihr Konto wurde eingeschränkt</h2><p>Sehr geehrter Kunde,</p><p>wir haben ungewöhnliche Aktivitäten festgestellt. ' +
    'Bitte bestätigen Sie innerhalb von 24 Stunden Ihre Daten, sonst wird Ihr Konto gesperrt.</p>' +
    '<p><a href="https://paypal-sicherheit.konto-hilfe24.example/login">www.paypal.com</a></p>' +
    '<p style="font-size:12px"><a href="#">Impressum</a> · <a href="#">Datenschutz</a> · <a href="#">Hilfe</a></p>'),
  plain('"Chef Mustermann" <chef.mustermann@mail-privat.example>', 'chef@demo', 'Kurze Bitte',
    'Hallo Max,\r\n\r\nbist du gerade erreichbar? Ich brauche kurz deine Hilfe bei einer Zahlung, bitte antworte mir hier.\r\n\r\nGruß'),
  plain('"Support" <hilfe@sicherheit-team.example>', 'extortion@demo', 'LETZTE WARNUNG',
    'Ich habe Zugang zu Ihrem Computer und Ihrer Kamera. Ich habe Videos von Ihnen aufgenommen und werde sie an alle Ihre Kontakte ' +
    'und Ihre Familie verschicken, wenn Sie nicht zahlen. Überweisen Sie 1200 Euro in Bitcoin an diese Wallet: ' +
    'bc1q9h6tq79cgtcqcldqc2dw5k8t3u4zf8n0q7r2xy\r\nSie haben 48 Stunden. Antworten Sie nicht auf diese E-Mail und gehen Sie nicht zur Polizei.'),
  related('"Dokumentenfreigabe" <share@muster-gmbh.example>', 'bait@demo', 'Dokument freigegeben: Rechnung_2026.pdf',
    '<p>Guten Tag,</p><p>ein Dokument wurde für Sie freigegeben.</p><a href="https://saga.so/x7k2"><img src="cid:doc.png@01" width="600"></a>',
    baitB64, 'doc.png'),
  related('"Rechnungsservice" <rechnung@stromtarif.example>', 'qr@demo', 'Ihre Rechnung – jetzt per QR-Code bezahlen',
    '<p>Ihre Rechnung ist fällig. Scannen Sie den Code mit Ihrem Handy, um sie zu bezahlen.</p><img src="cid:qr.png@01" width="220">',
    qrB64, 'qr.png'),
];

console.log('Eingefügt:', await m.script(`
  const [mails] = arguments;
  const root = MailServices.accounts.localFoldersServer.rootFolder;
  let inbox = root.getChildNamed("Inbox");
  if (!inbox) inbox = root.QueryInterface(Ci.nsIMsgLocalMailFolder).createLocalSubfolder("Inbox");
  inbox.setFlag(Ci.nsMsgFolderFlags.Inbox);
  for (const mail of mails) inbox.QueryInterface(Ci.nsIMsgLocalMailFolder).addMessage(mail);
  const ab = MailServices.ab.directories.find((d) => d.URI == "jsaddrbook://abook.sqlite");
  const card = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance(Ci.nsIAbCard);
  card.displayName = "Chef Mustermann"; card.firstName = "Chef"; card.lastName = "Mustermann";
  card.primaryEmail = "chef@beispiel-firma.example";
  ab.addCard(card);
  return inbox.getTotalMessages(false);
`, [before.map(bytes)]));

await m.send('Addon:Install', { path: extDir, temporary: true });
await sleep(9000);   // Hintergrundskript startet, Absenderhistorie wird aufgebaut, Einrichtungsdialog erscheint
// Einrichtungsdialog (eigenes Fenster) fotografieren und schließen
{
  const handles = (await m.send('WebDriver:GetWindowHandles')).value ?? (await m.send('WebDriver:GetWindowHandles'));
  const main = (await m.send('WebDriver:GetWindowHandle')).value;
  for (const h of handles) {
    if (h === main) continue;
    await m.send('WebDriver:SwitchToWindow', { handle: h, focus: true });
    const isOnb = await m.script(`return [...document.querySelectorAll("browser")].some((b) => String(b.currentURI?.spec).includes("onboarding.html"))`);
    if (!isOnb) continue;
    await sleep(800);
    await shot('00-einrichtung.png');
    await m.script(`window.close(); return 1;`);
  }
  await m.send('WebDriver:SwitchToWindow', { handle: main, focus: true });
}
// nach dem Scan: "Velomarkt" von einer fremden Adresse
await m.script(`
  const [mail] = arguments;
  MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Inbox").QueryInterface(Ci.nsIMsgLocalMailFolder).addMessage(mail);
`, [bytes(plain('"Velomarkt" <service@paket-status.example>', 'velofake@demo', 'Ihre Bestellung bei Velomarkt: Zahlung fehlgeschlagen',
  'Ihre Zahlung konnte nicht verarbeitet werden. Bitte aktualisieren Sie Ihre Zahlungsdaten, damit wir das Paket versenden können.'))]);

await m.script(`
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  win.resizeTo(1280, 860);
  const about3 = win.tabmail.currentAbout3Pane;
  about3.displayFolder(MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Inbox").URI);
  await new Promise((r) => win.setTimeout(r, 2500));
  return 1;`);

/** Mail im Dreispalten-Fenster auswählen und warten, bis das Banner da ist (oder sicher keins kommt). */
const select = (id, opts = {}) => m.script(`
  const [id, expand, expectBanner] = arguments;
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  const about3 = win.tabmail.currentAbout3Pane;
  const view = about3.gDBView;
  let idx = -1;
  for (let i = 0; i < view.rowCount; i++) if (view.getMsgHdrAt(i).messageId === id) idx = i;
  about3.threadTree.selectedIndex = idx;
  await new Promise((r) => win.setTimeout(r, 1200));   // neue Mail laden lassen (sonst greift man das alte Banner)
  const banner = () => {
    try {
      const el = about3.messageBrowser.contentDocument.getElementById("messagepane").contentDocument.getElementById("phishing-pilot-banner");
      return el && !Cu.isDeadWrapper(el) ? el : null;
    } catch { return null; }
  };
  let el = null;
  for (let i = 0; i < 60 && !(el = banner()); i++) await new Promise((r) => win.setTimeout(r, 250));
  if (!expectBanner) await new Promise((r) => win.setTimeout(r, 1500));
  el = banner();
  if (el && expand) el.openOrClosedShadowRoot.querySelector("button").click();
  await new Promise((r) => win.setTimeout(r, 600));
  el = banner();
  return { idx, banner: el ? el.openOrClosedShadowRoot.querySelector("h1").textContent : null };
`, [id, !!opts.expand, opts.banner !== false]);


const plan = [
  ['01-uebersicht-gefaehrlich.png', 'paypal@demo', {}],
  ['02-warum-punkte.png', 'paypal@demo', { expand: true }],
  ['03-kontakt-imitation.png', 'chef@demo', { expand: true }],
  ['04-erpressung.png', 'extortion@demo', {}],
  ['05-bild-koeder-ocr.png', 'bait@demo', { expand: true }],
  ['06-qr-code.png', 'qr@demo', { expand: true }],
  ['07-gelernter-absender.png', 'velofake@demo', { expand: true }],
  ['08-normale-mail.png', 'normal1@demo', { banner: false }],
];
for (const [name, id, opts] of plan) {
  const r = await select(id, opts);
  console.log(name, JSON.stringify(r));
  await shot(name);
}

// Einstellungen
await m.script(`
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  const url = WebExtensionPolicy.getByID("phishing-addon@novabird").getURL("options/options.html");
  win.tabmail.openTab("contentTab", { url });
  await new Promise((r) => win.setTimeout(r, 2500));
  return 1;`);
await shot('09-einstellungen.png');

await m.send('Marionette:Quit', { flags: ['eForceQuit'] }).catch(() => {});
m.close();
process.exit(0);
