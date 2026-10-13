// Prüft, ob eine Mail das Warn-Banner per CSS verdecken kann (position:fixed, z-index, negative Ränder, Transform …).
// Voraussetzung: frisches Test-Thunderbird (tests/e2e/restart.sh) und Testkopie (tests/e2e/build-testext.sh).
// Aufruf: node tests/e2e/overlay.mjs testext [ausgabeordner]   – Screenshots: <ausgabeordner>/pp-overlay-*.png (Standard: Temp-Ordner)
import { Marionette } from './marionette.mjs';
import fs from 'node:fs';
import path from 'node:path';

const extDir = path.resolve(process.argv[2] ?? 'testext');
const outDir = process.argv[3] ?? (await import('node:os')).tmpdir();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const m = new Marionette();
await m.connect();
await m.send('WebDriver:NewSession', { capabilities: {} });
await m.send('WebDriver:SetTimeouts', { script: 120000 });
await m.send('Marionette:SetContext', { value: 'chrome' });

// Jede Mail ist eindeutig Phishing (Marke im Namen, fremder Link) und versucht zusätzlich, das Banner zu verdecken.
const bait = '<p>Ihr Konto wurde eingeschränkt. Bitte bestätigen Sie Ihre Daten.</p><p><a href="https://paypal-login.konto-check.example/x">www.paypal.com</a></p>';
const cover = 'background:#fff;color:#222;font:16px Arial;padding:20px';
const tricks = {
  fixed: `<div style="position:fixed;top:0;left:0;right:0;height:260px;z-index:2147483647;${cover}">Alles in Ordnung – Ihre PayPal-Sicherheit</div>`,
  absolute: `<div style="position:absolute;top:0;left:0;width:100%;height:260px;z-index:2147483647;${cover}">Alles in Ordnung</div>`,
  negmargin: `<div style="margin-top:-400px;position:relative;z-index:2147483647;height:400px;${cover}">Alles in Ordnung</div>`,
  sticky: `<div style="position:sticky;top:0;z-index:2147483647;height:260px;${cover}">Alles in Ordnung</div>`,
  styletag: `<style>body::before{content:"Alles in Ordnung";position:fixed;inset:0 0 auto 0;height:260px;background:#fff;z-index:2147483647;display:block;${cover}} #phishing-pilot-banner{display:none!important;visibility:hidden!important;opacity:0!important}</style>`,
  transform: `<div style="transform:translateY(-300px);position:relative;z-index:2147483647;height:300px;${cover}">Alles in Ordnung</div>`,
};
const mails = Object.entries(tricks).map(([k, trick]) =>
  `From: "PayPal Service" <service@konto-check.example>\r\nTo: max@beispiel.example\r\nSubject: Overlay-Test ${k}\r\nMessage-ID: <overlay-${k}@demo>\r\n` +
  `MIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body>${trick}${bait}</body></html>\r\n`);

await m.script(`
  const [mails] = arguments;
  const root = MailServices.accounts.localFoldersServer.rootFolder;
  let inbox = root.getChildNamed("Inbox");
  if (!inbox) inbox = root.QueryInterface(Ci.nsIMsgLocalMailFolder).createLocalSubfolder("Inbox");
  inbox.setFlag(Ci.nsMsgFolderFlags.Inbox);
  for (const mail of mails) inbox.QueryInterface(Ci.nsIMsgLocalMailFolder).addMessage(mail);
  return 1;`, [mails]);
// Weitere Add-ons (z. B. NovaBird-Conversation): EXTRA_ADDONS="pfad1:pfad2"
for (const p of (process.env.EXTRA_ADDONS ?? '').split(':').filter(Boolean)) await m.send('Addon:Install', { path: path.resolve(p), temporary: true });
await m.send('Addon:Install', { path: extDir, temporary: true });
await sleep(9000);
// Einrichtungsdialog schließen, falls offen
await m.script(`for (const w of Services.wm.getEnumerator(null)) if ([...w.document.querySelectorAll("browser")].some((b) => String(b.currentURI?.spec).includes("onboarding.html"))) w.close(); return 1;`);
await m.script(`
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  win.resizeTo(1280, 860);
  win.tabmail.currentAbout3Pane.displayFolder(MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Inbox").URI);
  await new Promise((r) => win.setTimeout(r, 2000));
  return 1;`);

let failed = 0;
for (const k of Object.keys(tricks)) {
  const r = await m.script(`
    const [id] = arguments;
    const win = Services.wm.getMostRecentWindow("mail:3pane");
    const about3 = win.tabmail.currentAbout3Pane;
    const view = about3.gDBView;
    for (let i = 0; i < view.rowCount; i++) if (view.getMsgHdrAt(i).messageId === id) about3.threadTree.selectedIndex = i;
    await new Promise((r) => win.setTimeout(r, 1200));
    const doc = () => about3.messageBrowser.contentDocument.getElementById("messagepane").contentDocument;
    let el = null;
    for (let i = 0; i < 40; i++) {
      try { el = doc().getElementById("phishing-pilot-banner"); if (el && !Cu.isDeadWrapper(el)) break; } catch {}
      el = null;
      await new Promise((r) => win.setTimeout(r, 250));
    }
    if (!el) return { banner: false };
    await new Promise((r) => win.setTimeout(r, 3000));   // Schutzprüfung des Banners läuft bis 2,5 s nach dem Einblenden
    el = doc().getElementById("phishing-pilot-banner");
    const d = doc();
    const rect = el.getBoundingClientRect();
    const cs = d.defaultView.getComputedStyle(el);
    // Was liegt an mehreren Punkten des Banners wirklich oben?
    const pts = [[0.1, 0.3], [0.5, 0.5], [0.9, 0.7]].map(([fx, fy]) => {
      const x = rect.left + rect.width * fx, y = rect.top + rect.height * fy;
      const top = d.elementFromPoint(x, y);
      return top === el || el.contains(top);
    });
    return { banner: true, visibleOnTop: pts.every(Boolean), points: pts, rect: { top: Math.round(rect.top), h: Math.round(rect.height), w: Math.round(rect.width) },
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity, viewportH: d.defaultView.innerHeight };
  `, [`overlay-${k}@demo`]);
  const ok = r.banner && r.visibleOnTop && r.display !== 'none' && r.visibility === 'visible' && Number(r.opacity) > 0.9 && r.rect.top >= 0 && r.rect.h > 40;
  if (!ok) failed++;
  console.log(`${ok ? 'OK    ' : 'VERDECKT'} ${k.padEnd(10)} ${JSON.stringify(r)}`);
  const { value } = await m.send('WebDriver:TakeScreenshot', { full: false, hash: false });
  fs.writeFileSync(path.join(outDir, `pp-overlay-${k}.png`), Buffer.from(value, 'base64'));
}
console.log(failed ? `\n${failed} Trick(s) verdecken das Banner` : '\nBanner in allen Fällen sichtbar');
await m.send('Marionette:Quit', { flags: ['eForceQuit'] }).catch(() => {});
m.close();
process.exit(failed ? 1 : 0);
