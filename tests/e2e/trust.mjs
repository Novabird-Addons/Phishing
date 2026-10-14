// Prüft "Diesem Absender vertrauen": Rückfrage im Banner, danach verschwinden Banner und Warn-Tag.
// Voraussetzung: frisches Test-Thunderbird (tests/e2e/restart.sh) und Testkopie (tests/e2e/build-testext.sh).
// Aufruf: node tests/e2e/trust.mjs [work/testext]   – mit Conversation: EXTRA_ADDONS=work/testconv
import { Marionette } from './marionette.mjs';
import path from 'node:path';

const extDir = path.resolve(process.argv[2] ?? 'work/testext');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const m = new Marionette();
await m.connect();
await m.send('WebDriver:NewSession', { capabilities: {} });
await m.send('WebDriver:SetTimeouts', { script: 120000 });
await m.send('Marionette:SetContext', { value: 'chrome' });

// verdächtig (nicht gefährlich): eine Rückfrage; gefährlich: zwei
const mails = {
  susp: `From: "Kranich Handels AG" <service@versandhaus-nord.example>\r\nTo: max@beispiel.example\r\nSubject: Ihr Auftrag\r\nMessage-ID: <trust-susp@demo>\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><p>Ihr Auftrag ist eingegangen.</p></body></html>\r\n`,
  dang: `From: "PayPal Service" <service@konto-check.example>\r\nTo: max@beispiel.example\r\nSubject: Konto eingeschraenkt\r\nMessage-ID: <trust-dang@demo>\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><p>Ihr Konto wurde eingeschränkt. Bitte bestätigen Sie Ihre Daten.</p><p><a href="https://paypal-login.konto-check.example/x">www.paypal.com</a></p></body></html>\r\n`,
};
await m.script(`
  const [mails] = arguments;
  const root = MailServices.accounts.localFoldersServer.rootFolder;
  let inbox = root.getChildNamed("Inbox");
  if (!inbox) inbox = root.QueryInterface(Ci.nsIMsgLocalMailFolder).createLocalSubfolder("Inbox");
  inbox.setFlag(Ci.nsMsgFolderFlags.Inbox);
  for (const mail of mails) inbox.QueryInterface(Ci.nsIMsgLocalMailFolder).addMessage(mail);
  return 1;`, [Object.values(mails)]);
for (const p of (process.env.EXTRA_ADDONS ?? '').split(':').filter(Boolean)) await m.send('Addon:Install', { path: path.resolve(p), temporary: true });
await m.send('Addon:Install', { path: extDir, temporary: true });
await sleep(9000);
await m.script(`for (const w of Services.wm.getEnumerator(null)) if ([...w.document.querySelectorAll("browser")].some((b) => String(b.currentURI?.spec).includes("onboarding.html"))) w.close(); return 1;`);
await m.script(`
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  win.tabmail.currentAbout3Pane.displayFolder(MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Inbox").URI);
  await new Promise((r) => win.setTimeout(r, 2000));
  return 1;`);

let failed = 0;
for (const k of Object.keys(mails)) {
  const r = await m.script(`
    const [id] = arguments;
    const win = Services.wm.getMostRecentWindow("mail:3pane");
    const about3 = win.tabmail.currentAbout3Pane;
    const view = about3.gDBView;
    let hdr = null;
    for (let i = 0; i < view.rowCount; i++) if (view.getMsgHdrAt(i).messageId === id) { about3.threadTree.selectedIndex = i; hdr = view.getMsgHdrAt(i); }
    const wait = (ms) => new Promise((r) => win.setTimeout(r, ms));
    // Banner suchen (normale Ansicht oder in Unter-Frames, z. B. Conversation)
    const findBanner = () => {
      const docs = [];
      const walk = (d) => { if (!d) return; docs.push(d); for (const f of d.querySelectorAll("iframe, browser")) { try { walk(f.contentDocument); } catch {} } };
      try { walk(about3.messageBrowser.contentDocument); } catch {}
      try { walk(win.tabmail.currentTabInfo.browser?.contentDocument); } catch {}
      for (const d of docs) { const el = d.getElementById("phishing-pilot-banner"); if (el && !Cu.isDeadWrapper(el)) return el; }
      return null;
    };
    let el = null;
    for (let i = 0; i < 60 && !el; i++) { await wait(250); el = findBanner(); }
    if (!el) return { banner: false };
    await wait(1500);
    const tagsBefore = hdr.getStringProperty("keywords");
    const root = el.openOrClosedShadowRoot;
    const btn = (txt) => [...root.querySelectorAll("button")].find((b) => b.textContent === txt);
    btn("Diesem Absender vertrauen")?.click() ?? btn("Trust this sender")?.click();
    await wait(300);
    const askVisible = root.querySelector(".box").classList.contains("asking");
    const clicks = [];
    for (let i = 0; i < 2 && el.isConnected; i++) {
      const yes = root.querySelector("button.yes");
      clicks.push(root.querySelector(".ask p").textContent.slice(0, 30));
      yes.click();
      await wait(1500);
    }
    return { banner: true, askVisible, clicks, removed: !el.isConnected, tagsBefore, tagsAfter: hdr.getStringProperty("keywords") };
  `, [`trust-${k}@demo`]);
  const ok = r.banner && r.askVisible && r.removed && !/phishpilot/.test(r.tagsAfter) && r.clicks.length === (k === 'dang' ? 2 : 1);
  if (!ok) failed++;
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${k} ${JSON.stringify(r)}`);
}
console.log(failed ? `\n${failed} Fall/Fälle fehlerhaft` : '\nVertrauen funktioniert');
await m.send('Marionette:Quit', { flags: ['eForceQuit'] }).catch(() => {});
m.close();
process.exit(failed ? 1 : 0);
