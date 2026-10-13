// Durchklick-Test: .eml-Ordner in den Posteingang legen und die Mails im Dreispalten-Fenster nacheinander
// auswählen (wie ein Nutzer). Meldet pro Mail, ob und welches Banner erschien.
// Aufruf: node tests/e2e/clickthrough.mjs <extension-dir> <eml-ordner> <wartezeit-ms> [wiederholungen]
import { Marionette } from './marionette.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [extDir, emlDir, waitMs = '2500', rounds = '1'] = process.argv.slice(2);
const DUP = Number(process.env.DUP ?? 1);
const mails0 = fs.readdirSync(emlDir).filter((f) => f.endsWith('.eml')).sort()
  .map((f) => fs.readFileSync(path.join(emlDir, f), 'latin1').replace(/\r?\n/g, '\r\n'));
const mails = Array.from({ length: DUP }, () => mails0).flat();   // DUP>1: dieselben Absender mehrfach im Postfach

const m = new Marionette();
await m.connect();
await m.send('WebDriver:NewSession', { capabilities: {} });
await m.send('WebDriver:SetTimeouts', { script: 600000 });
await m.send('Marionette:SetContext', { value: 'chrome' });

await m.script(`
  const [mails] = arguments;
  const root = MailServices.accounts.localFoldersServer.rootFolder;
  let inbox = root.getChildNamed("Inbox");
  if (!inbox) inbox = root.QueryInterface(Ci.nsIMsgLocalMailFolder).createLocalSubfolder("Inbox");
  inbox.setFlag(Ci.nsMsgFolderFlags.Inbox);
  for (const mail of mails) inbox.QueryInterface(Ci.nsIMsgLocalMailFolder).addMessage(mail);
  return 1;`, [mails]);
// Weitere Add-ons (z. B. Conversation): EXTRA_ADDONS="pfad1:pfad2"; ADDON_ORDER=last installiert sie nach unserem Add-on.
const extras = (process.env.EXTRA_ADDONS ?? '').split(':').filter(Boolean).map((p) => path.resolve(p));
const install = (p) => m.send('Addon:Install', { path: p, temporary: true });
if (process.env.ADDON_ORDER !== 'last') for (const p of extras) await install(p);
await install(path.resolve(extDir));
if (process.env.ADDON_ORDER === 'last') for (const p of extras) await install(p);
await new Promise((r) => setTimeout(r, 9000));

const rows = await m.script(`
  const [waitMs, rounds] = arguments;
  const win = Services.wm.getMostRecentWindow("mail:3pane");
  const about3 = win.tabmail.currentAbout3Pane;
  const inbox = MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Inbox");
  about3.displayFolder(inbox.URI);
  await new Promise((r) => win.setTimeout(r, 3000));
  const tree = about3.threadTree;
  const n = tree.view.rowCount;
  const out = [];
  const bannerOf = () => {
    try {
      const doc = about3.messageBrowser.contentDocument;
      const cd = doc.getElementById("messagepane").contentDocument;
      const el = cd.getElementById("phishing-pilot-banner");
      if (!el) return { missing: true, conv: !!cd.getElementById("nbc-root") };
      const sr = el.openOrClosedShadowRoot;
      const root = cd.getElementById("nbc-root");
      const geo = root ? { overflow: root.scrollHeight - root.clientHeight, bannerH: Math.round(el.getBoundingClientRect().height), listH: Math.round((cd.querySelector(".nbc-list, .nbc-history") ?? root).getBoundingClientRect().height), rootH: root.clientHeight } : null;
      return { guard: (el.dataset.ppGuard ?? '-') + ' ' + (el.dataset.ppWhy ?? ''), geo, where: el.parentNode === root ? "in-root" : el.parentNode === cd.body ? "body" : "andere", conv: !!root, title: sr.querySelector("h1").textContent.slice(0, 12), reasons: sr.querySelectorAll("li").length, score: sr.querySelector(".small").textContent.slice(0, 22) };
    } catch (e) { return { err: String(e) }; }
  };
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n; i++) {
      tree.selectedIndex = i;
      await new Promise((r) => win.setTimeout(r, waitMs));
      const hdr = about3.gDBView.getMsgHdrAt(i);
      out.push({ round, i, subject: hdr.mime2DecodedSubject.slice(0, 34), banner: bannerOf() });
    }
  }
  return out;`, [Number(waitMs), Number(rounds)]);

let missing = 0;
for (const r of rows) {
  const none = !r.banner || r.banner.missing;
  if (none) missing++;
  console.log(`r${r.round} #${String(r.i).padStart(2)} ${none ? `--- KEIN BANNER --- (Konversation aktiv: ${r.banner?.conv})` : (r.banner.err ?? `${r.banner.title} ${r.banner.score} [Schutz:${r.banner.guard} ${r.banner.where}${r.banner.geo ? `, root ${r.banner.geo.rootH}px: Banner ${r.banner.geo.bannerH}px + Liste ${r.banner.geo.listH}px, Überlauf ${r.banner.geo.overflow}px` : ''}]`)}  | ${r.subject}`);
}
console.log(`\n${rows.length - missing} von ${rows.length} mit Banner (Wartezeit ${waitMs} ms)`);
await m.send('Marionette:Quit', { flags: ['eForceQuit'] }).catch(() => {});
m.close();
