import { BUNDLED, MAX_LANGUAGES, installLanguage, installedLanguages, modelInfo, removeLanguage } from '../src/ocr-models.js';
import { OCR_MODELS } from '../src/data/ocr-languages.js';
import { HISTORY_MONTHS_DEFAULT, historyMonths, isSkippedFolder } from '../src/lib/history.js';
import { isCollectedBook, trustedBookIds } from '../src/lib/contacts.js';
import { t } from '../src/i18n.js';

const $ = (id) => document.getElementById(id);
const lines = (s) => s.split('\n').map((x) => x.trim().toLowerCase()).filter(Boolean);

let displayNames = null;
try { displayNames = new Intl.DisplayNames([navigator.language], { type: 'language' }); } catch { /* ältere Umgebung */ }
function langName(code) {
  try { return displayNames?.of(code) ?? code; } catch { return code; }   // Tesseract-Codes wie chi_sim sind keine Sprachcodes
}
const uiLang = messenger.i18n.getUILanguage();
const tr = (key, ...params) => t(uiLang, key, params);
const mb = (bytes) => (bytes / 1e6).toFixed(1).replace('.', uiLang.startsWith('de') ? ',' : '.') + ' MB';
// Texte der Seite: data-i18n = reiner Text, data-i18n-html = eigener Text mit <code>/<b> (nur aus i18n.js, nie aus Mails)
document.documentElement.lang = uiLang;
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tr(el.dataset.i18n);
for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = tr(el.dataset.i18nHtml);

(async () => {
  const { config = {} } = await messenger.storage.local.get('config');
  let selected = new Set(config.ocrLanguages ?? ['deu', 'eng']);

  async function renderLanguages() {
    const installed = await installedLanguages();
    const box = $('langs');
    box.replaceChildren();
    for (const code of [...BUNDLED, ...installed]) {
      const label = document.createElement('label');
      const cb = Object.assign(document.createElement('input'), { type: 'checkbox', value: code, checked: selected.has(code) });
      cb.addEventListener('change', () => {
        if (cb.checked && selected.size >= MAX_LANGUAGES) { cb.checked = false; $('langStatus').textContent = tr('opt_max_langs', MAX_LANGUAGES); return; }
        cb.checked ? selected.add(code) : selected.delete(code);
        $('langStatus').textContent = '';
      });
      label.append(cb, ` ${langName(code)} (${code})${BUNDLED.includes(code) ? ' – ' + tr('opt_bundled') : ''}`);
      if (!BUNDLED.includes(code)) {
        const rm = Object.assign(document.createElement('button'), { type: 'button', textContent: tr('opt_remove') });
        rm.addEventListener('click', async () => { await removeLanguage(code); selected.delete(code); await renderLanguages(); });
        label.append(rm);
      }
      box.append(label);
    }
    const sel = $('addLang');
    sel.replaceChildren();
    for (const m of OCR_MODELS.filter((x) => !installed.includes(x.code)).sort((a, b) => langName(a.code).localeCompare(langName(b.code)))) {
      sel.append(Object.assign(document.createElement('option'), { value: m.code, textContent: `${langName(m.code)} (${m.code}, ${mb(m.size)})` }));
    }
  }
  $('addLangBtn').addEventListener('click', async () => {
    const code = $('addLang').value;
    const info = modelInfo(code);
    if (!info) return;
    // Rückfrage: Das ist eine Verbindung ins Internet.
    const ok = confirm(tr('opt_download_confirm', langName(code), code, mb(info.size)));
    if (!ok) return;
    $('addLangBtn').disabled = true;
    $('langStatus').textContent = tr('opt_loading');
    try {
      await installLanguage(code);
      if (selected.size < MAX_LANGUAGES) selected.add(code);
      $('langStatus').textContent = tr('opt_done');
    } catch (e) {
      $('langStatus').textContent = tr('opt_error', e?.message ?? e);
    } finally {
      $('addLangBtn').disabled = false;
      await renderLanguages();
    }
  });
  await renderLanguages();

  // Ordner für die Ausnahmeliste der Absenderhistorie
  const excluded = new Set(config.historyExcludedFolders ?? []);
  let foldersLoaded = false;   // nur dann beim Speichern übernehmen, sonst ginge die gespeicherte Liste verloren
  async function listFolders(account) {
    const out = [];
    const walk = async (folder) => {
      out.push(folder);
      for (const sub of await messenger.folders.getSubFolders(folder.id, false)) await walk(sub);
    };
    for (const f of await messenger.folders.getSubFolders(account.rootFolder.id, false)) await walk(f);
    return out;
  }
  try {
    for (const account of await messenger.accounts.list()) {
      const head = Object.assign(document.createElement('div'), { textContent: account.name });
      head.style.cssText = 'font-weight:600;margin-top:6px';
      $('folders').append(head);
      for (const folder of await listFolders(account)) {
        if (isSkippedFolder(folder)) continue;
        const key = `${folder.accountId}:${folder.path}`;
        const label = document.createElement('label');
        const cb = Object.assign(document.createElement('input'), { type: 'checkbox', value: key, checked: excluded.has(key) });
        label.append(cb, ' ' + folder.path);
        $('folders').append(label);
      }
    }
    foldersLoaded = true;
  } catch (e) { $('folders').textContent = tr('opt_folders_error', e?.message ?? e); }

  $('mode').value = config.mode ?? 'active';
  $('ocr').checked = config.ocr ?? true;
  $('scanRemote').checked = !!config.scanRemoteImages && await messenger.permissions.contains({ origins: ['<all_urls>'] });
  const books = await messenger.addressBooks.list();
  const defaultBooks = trustedBookIds(books, null);
  const usedBooks = trustedBookIds(books, config.contactBookIds);
  for (const book of books) {
    const label = document.createElement('label');
    label.style.fontWeight = 'normal';
    const box = Object.assign(document.createElement('input'), {
      type: 'checkbox', value: book.id, checked: usedBooks.includes(book.id),
    });
    label.append(box, ' ' + book.name + (isCollectedBook(book) ? ` (${tr('opt_books_collected')})` : ''));
    $('books').append(label);
  }
  $('historyMonths').value = historyMonths(config.historyMonths ?? HISTORY_MONTHS_DEFAULT);
  $('authservIds').value = (config.trustedAuthservIds ?? []).join('\n');
  $('ownDomains').value = (config.ownDomains ?? []).join('\n');
  $('trusted').value = (config.trustedSenders ?? []).join('\n');

  $('scanRemote').addEventListener('change', async () => {
    // Berechtigung nur beim Einschalten abfragen (muss direkt aus dem Klick heraus geschehen)
    if ($('scanRemote').checked) {
      $('scanRemote').checked = await messenger.permissions.request({ origins: ['<all_urls>'] });
    } else {
      await messenger.permissions.remove({ origins: ['<all_urls>'] }).catch(() => {});
    }
  });

  $('save').addEventListener('click', async () => {
    const { config: old = {} } = await messenger.storage.local.get('config');
    const newExcluded = foldersLoaded
      ? [...$('folders').querySelectorAll('input:checked')].map((b) => b.value).sort()
      : [...(old.historyExcludedFolders ?? [])].sort();
    const foldersChanged = JSON.stringify(newExcluded) !== JSON.stringify([...(old.historyExcludedFolders ?? [])].sort());
    const months = historyMonths($('historyMonths').value);
    $('historyMonths').value = months;
    const monthsChanged = months !== historyMonths(old.historyMonths ?? HISTORY_MONTHS_DEFAULT);
    await messenger.storage.local.set({
      config: {
        ...old, mode: $('mode').value,
        ocr: $('ocr').checked,
        ocrLanguages: selected.size ? [...selected] : ['deu', 'eng'],
        scanRemoteImages: $('scanRemote').checked,
        // Auswahl wie der Standard (alle außer "Gesammelte Adressen") -> null, damit neue Bücher automatisch mitzählen
        contactBookIds: (() => {
          const ids = [...$('books').querySelectorAll('input')].filter((b) => b.checked).map((b) => b.value).sort();
          return JSON.stringify(ids) === JSON.stringify([...defaultBooks].sort()) ? null : ids;
        })(),
        trustedAuthservIds: lines($('authservIds').value),
        ownDomains: lines($('ownDomains').value),
        trustedSenders: lines($('trusted').value),
        historyExcludedFolders: newExcluded,
        historyMonths: months,
      },
    });
    if (foldersChanged || monthsChanged) messenger.runtime.sendMessage({ type: 'rescanHistory' }).catch(() => {});
    $('saveStatus').textContent = tr('opt_saved');
    setTimeout(() => { $('saveStatus').textContent = ''; }, 2500);
  });
  $('export').addEventListener('click', async () => {
    const { shadowLog = [] } = await messenger.storage.local.get('shadowLog');
    const url = URL.createObjectURL(new Blob([JSON.stringify(shadowLog, null, 1)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'novabird-phishing-shadow.json' });
    a.click();
    URL.revokeObjectURL(url);
  });
  $('rescan').addEventListener('click', async () => {
    await messenger.runtime.sendMessage({ type: 'rescanHistory' });
  });
})();
