// Ergebnis des anonymisierten Speicherns anzeigen (was ersetzt wurde, Hinweis vor dem Weitergeben).
import { t } from '../src/i18n.js';

const $ = (id) => document.getElementById(id);
const lang = messenger.i18n.getUILanguage();
const q = new URLSearchParams(location.search);
const r = (() => { try { return JSON.parse(q.get('r') || '{}'); } catch { return {}; } })();

document.title = t(lang, 'anon_title');
$('title').textContent = t(lang, 'anon_title');
$('saved').textContent = t(lang, 'anon_saved', [q.get('n') ?? '0']);
$('replaced').textContent = t(lang, 'anon_replaced', [r.addresses ?? 0, r.names ?? 0, r.domains ?? 0, r.postal ?? 0, r.links ?? 0, r.attachments ?? 0]);
$('hint').textContent = t(lang, 'anon_hint');
if (q.get('e')) $('status').textContent = t(lang, 'anon_error', [q.get('e')]);
$('folder').textContent = t(lang, 'anon_folder');
$('close').textContent = t(lang, 'anon_close');
$('folder').addEventListener('click', () => messenger.runtime.sendMessage({ type: 'showDownloads' }).catch(() => {}));
$('close').addEventListener('click', async () => messenger.windows.remove((await messenger.windows.getCurrent()).id));
$('close').focus();
