// Einrichtungsdialog beim ersten Start: Welche Adressbücher gelten als vertrauenswürdig?
import { t } from '../src/i18n.js';
import { isCollectedBook, trustedBookIds } from '../src/lib/contacts.js';

const $ = (id) => document.getElementById(id);
const lang = messenger.i18n.getUILanguage();
const tr = (key) => t(lang, key);

(async () => {
  for (const id of ['title', 'intro', 'scan', 'more', 'save']) $(id).textContent = tr('onb_' + id);
  document.title = tr('onb_title');

  const { config = {} } = await messenger.storage.local.get('config');
  const books = await messenger.addressBooks.list();
  const checked = new Set(trustedBookIds(books, config.contactBookIds));
  const defaults = trustedBookIds(books, null);
  if (!books.length) $('books').textContent = tr('onb_none');
  for (const book of books) {
    const label = document.createElement('label');
    const box = Object.assign(document.createElement('input'), { type: 'checkbox', value: book.id, checked: checked.has(book.id) });
    const text = document.createElement('span');
    text.textContent = book.name;
    if (isCollectedBook(book)) {
      const hint = Object.assign(document.createElement('span'), { className: 'hint', textContent: tr('onb_collected') });
      text.append(hint);
      $('hint').textContent = tr('onb_collected_hint');
    }
    label.append(box, text);
    $('books').append(label);
  }

  const close = async () => {
    const win = await messenger.windows.getCurrent();
    await messenger.windows.remove(win.id);
  };

  async function save() {
    const ids = [...$('books').querySelectorAll('input:checked')].map((b) => b.value).sort();
    const { config: stored = {} } = await messenger.storage.local.get('config');
    // wie der Standard -> null, damit später angelegte Adressbücher automatisch mitzählen
    stored.contactBookIds = JSON.stringify(ids) === JSON.stringify([...defaults].sort()) ? null : ids;
    await messenger.storage.local.set({ config: stored, onboardingDone: true });
  }
  $('save').addEventListener('click', async () => {
    await save();
    $('status').textContent = tr('onb_saved');
    setTimeout(close, 400);
  });
  $('more').addEventListener('click', async () => {
    await save();
    await messenger.runtime.openOptionsPage();
    await close();
  });
  $('save').focus();
})();
