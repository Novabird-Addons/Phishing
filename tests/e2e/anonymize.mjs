// E2E: Rechtsklick auf eine Mail -> "Anonymisiert als .eml speichern" -> Datei im Download-Ordner prüfen.
// Voraussetzung: tests/e2e/build-testext.sh und tests/e2e/restart.sh. Aufruf: node tests/e2e/anonymize.mjs
import { Marionette } from './marionette.mjs';
import fs from 'node:fs';
import path from 'node:path';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DL = path.resolve('testprofile/dl');   // Snap-Thunderbird sieht /tmp nicht
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
const m = new Marionette(); await m.connect();
await m.send('WebDriver:NewSession', { capabilities: {} });
await m.send('WebDriver:SetTimeouts', { script: 60000 });
await m.send('Marionette:SetContext', { value: 'chrome' });
const mail = `From: "PayPal Service" <service@konto-check.example>\r\nTo: "Jürgen Musterle" <j.musterle@familie-musterle.example>\r\nSubject: Ihr Konto, Herr Musterle\r\nMessage-ID: <anon1@demo>\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Sehr geehrter Herr Musterle,</p><a href="https://paypal-check.example/login?id=a8f7e6d5">www.paypal.com</a>\r\n`;
await m.script(`const [mail, dl] = arguments;
  Services.prefs.setIntPref("browser.download.folderList", 2);
  Services.prefs.setStringPref("browser.download.dir", dl);
  Services.prefs.setBoolPref("browser.download.useDownloadDir", true);
  const root = MailServices.accounts.localFoldersServer.rootFolder;
  let inbox = root.getChildNamed("Inbox"); if (!inbox) inbox = root.QueryInterface(Ci.nsIMsgLocalMailFolder).createLocalSubfolder("Inbox");
  inbox.setFlag(Ci.nsMsgFolderFlags.Inbox); inbox.QueryInterface(Ci.nsIMsgLocalMailFolder).addMessage(mail);
  // eigene Identität wie bei einem echten Konto: Name + Adresse des Empfängers
  const acc = MailServices.accounts.defaultAccount ?? MailServices.accounts.accounts[0];
  let id = acc.defaultIdentity; if (!id) { id = MailServices.accounts.createIdentity(); acc.addIdentity(id); }
  id.email = "j.musterle@familie-musterle.example"; id.fullName = "Jürgen Musterle";
  return 1;`, [Buffer.from(mail, 'utf8').toString('latin1'), DL]);
await m.send('Addon:Install', { path: path.resolve('testext'), temporary: true });
await sleep(8000);
await m.script(`for (const w of Services.wm.getEnumerator(null)) if ([...w.document.querySelectorAll("browser")].some((b) => String(b.currentURI?.spec).includes("onboarding.html"))) w.close(); return 1;`);
const r = await m.script(`
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  const about3 = win.tabmail.currentAbout3Pane;
  about3.displayFolder(MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Inbox").URI);
  await new Promise((r) => win.setTimeout(r, 1500));
  about3.threadTree.selectedIndex = 0;
  await new Promise((r) => win.setTimeout(r, 1500));
  const row = about3.threadTree.getRowAtIndex(0);
  const rect = row.getBoundingClientRect();
  row.dispatchEvent(new about3.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: rect.left + 20, clientY: rect.top + 5, button: 2 }));
  await new Promise((r) => win.setTimeout(r, 1000));
  const popup = about3.document.getElementById("mailContext");
  const items = [...popup.querySelectorAll("menuitem")].filter((i) => /anonym/i.test(i.label));
  if (!items.length) { popup.hidePopup?.(); return { menu: false, state: popup.state }; }
  items[0].click();
  popup.hidePopup?.();
  return { menu: true, label: items[0].label };
`);
console.log('Menü:', JSON.stringify(r));
await sleep(4000);
const files = fs.existsSync(DL + '/novabird-anonym') ? fs.readdirSync(DL + '/novabird-anonym') : [];
console.log('Dateien:', files);
if (files[0]) {
  const out = fs.readFileSync(DL + '/novabird-anonym/' + files[0], 'utf8');
  console.log('enthält noch Musterle/Jürgen/familie-musterle/a8f7e6d5:', ['Musterle', 'Jürgen', 'familie-musterle', 'a8f7e6d5'].filter((x) => out.includes(x)));
  console.log('Absender + Linkziel erhalten:', out.includes('service@konto-check.example'), out.includes('paypal-check.example/login'));
}
const report = await m.script(`for (const w of Services.wm.getEnumerator(null)) { const b = [...w.document.querySelectorAll("browser")].find((b) => String(b.currentURI?.spec).includes("report.html")); if (b) return { open: true, title: w.document.title }; } return { open: false };`);
console.log('Ergebnisfenster:', JSON.stringify(report));
const out = files[0] ? fs.readFileSync(DL + '/novabird-anonym/' + files[0], 'utf8') : '';
const ok = r.menu && files.length === 1 && report.open && !/Musterle|Jürgen|familie-musterle|a8f7e6d5/.test(out) &&
  out.includes('service@konto-check.example') && out.includes('paypal-check.example/login');
console.log(ok ? 'Anonymisieren ok' : 'FEHLER beim Anonymisieren');
await m.send('Marionette:Quit', { flags: ['eForceQuit'] }).catch(() => {}); process.exit(ok ? 0 : 1);
