// Läuft im Anzeigebereich der Mail (message_display_scripts). Zeigt das Banner, sperrt Links und meldet
// – nur wenn der Nutzer es eingeschaltet hat – nachgeladene Fremdbilder zur Prüfung.
(async () => {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  if (window !== window.top) return;
  if (document.getElementById('phishing-pilot-banner')) return;

  const state = { danger: false, trusted: false, host: null };

  // Andere Add-ons (z. B. NovaBird-Conversation) ersetzen den Inhalt des Nachrichtendokuments, auch nachträglich
  // (document.body.replaceChildren()). Dabei würde unser Banner gelöscht. Deshalb hängen wir ihn bei Bedarf wieder an:
  // in die Konversationsansicht als erstes Element (damit deren Layout stimmt), sonst in den <body>.
  function attach() {
    const host = state.host;
    if (!host || state.trusted || !document.body) return;
    const parent = document.getElementById('nbc-root') ?? document.body;
    if (host.parentNode !== parent) parent.prepend(host);
  }
  new MutationObserver(attach).observe(document.body, { childList: true });

  function render(payload) {
    if (state.trusted) return;
    state.host?.remove();
    const { level, score, reasons, ui } = payload;
    const danger = level === 'dangerous';
    state.danger = danger;

    // Banner im Shadow-DOM, damit Mail-CSS es nicht verändert
    const host = document.createElement('div');
    host.id = 'phishing-pilot-banner';
    host.dataset.ocrMs = String(payload.ocrMs ?? 0);
    host.dataset.ocr = (payload.ocrLanguages ?? []).join(',');   // welche OCR-Sprachen liefen (für Tests/Diagnose)
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; display: block; flex: none; }
      .box { font: 14px/1.4 system-ui, sans-serif; margin: 0 0 12px; padding: 10px 14px;
             border-radius: 6px; border: 2px solid ${danger ? '#C62828' : '#D9A400'};
             background: ${danger ? '#FDECEA' : '#FFF8E1'}; color: #222; }
      h1 { font-size: 15px; margin: 0 0 4px; }
      ul { margin: 6px 0; padding-left: 20px; }
      li.more { display: none; opacity: .8; }
      .open li.more { display: list-item; }
      button { font: inherit; margin: 4px 8px 0 0; padding: 3px 10px; cursor: pointer; }
      .small { font-size: 12px; opacity: .8; }`;
    const box = document.createElement('div');
    box.className = 'box';
    const h = document.createElement('h1');
    h.textContent = payload.kind === 'extortion' ? ui.banner_extortion : danger ? ui.banner_dangerous : ui.banner_suspicious;
    const ul = document.createElement('ul');
    reasons.forEach((r, i) => {
      const li = document.createElement('li');
      li.textContent = r.text;
      if (i >= 3) li.className = 'more';
      ul.append(li);
    });
    const small = document.createElement('div');
    small.className = 'small';
    small.textContent = ui.banner_score.replace('{0}', score) + (danger ? ' · ' + ui.banner_links : '');
    const why = document.createElement('button');
    why.textContent = ui.banner_why;
    why.addEventListener('click', () => box.classList.toggle('open'));
    const trust = document.createElement('button');
    trust.textContent = ui.banner_trust;
    trust.addEventListener('click', async () => {
      // Sicherheitsabfrage; bei "gefährlich" zweistufig und mit Punktzahl
      if (!confirm(danger ? ui.trust_confirm_dangerous.replace('{0}', score) : ui.trust_confirm)) return;
      if (danger && !confirm(ui.trust_confirm_final)) return;
      await api.runtime.sendMessage({ type: 'trustSender' });
      state.trusted = true;
      state.danger = false;
      state.host?.remove();
    });
    box.append(h, ul, small, why, trust);
    root.append(style, box);
    state.host = host;
    state.ui = ui;
    attach();
  }

  // Echte Zieldomain per Tooltip – beim Darüberfahren, damit auch später eingefügte Links (z. B. Konversationsansicht) sie bekommen
  document.addEventListener('mouseover', (ev) => {
    if (!state.host) return;
    const a = ev.target.closest?.('a[href]');
    if (!a || a.dataset.ppTitle) return;
    a.dataset.ppTitle = '1';
    try { a.title = '→ ' + new URL(a.href).hostname; } catch { /* mailto: usw. */ }
  }, true);

  // Bei "gefährlich" Klicks auf Web-Links abfangen (Links- und Mittelklick). Nach Bestätigung öffnet das
  // Hintergrundskript den Link im Standardbrowser – wie Thunderbird es bei einem normalen Klick auch tut.
  function guardLink(ev) {
    if (ev.type === 'auxclick' && ev.button !== 1) return;
    const a = ev.target.closest?.('a[href]');
    if (!state.danger || !a || !/^https?:/i.test(a.href)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    let target = a.href;
    try { target = new URL(a.href).hostname; } catch { /* unverändert */ }
    const ui = state.ui;
    if (confirm(`${ui.link_title}\n\n${ui.link_body}\n${target}`)) {
      api.runtime.sendMessage({ type: 'openLink', url: a.href }).catch(() => {});
    }
  }
  document.addEventListener('click', guardLink, true);
  document.addEventListener('auxclick', guardLink, true);

  // Vom Nutzer nachgeladene Fremdbilder (nur mit Einstellung + Berechtigung) zur Prüfung melden
  async function scanRemote() {
    const remoteImgs = () => [...document.images].filter((im) => /^https?:/i.test(im.src));
    for (let i = 0; i < 24; i++) {
      const imgs = remoteImgs();
      if (!imgs.length) return;
      if (imgs.every((im) => im.complete)) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const items = remoteImgs()
      .filter((im) => im.complete && im.naturalWidth >= 150)
      .slice(0, 6)
      .map((im) => ({ src: im.getAttribute('src'), url: im.src }));
    if (!items.length) return;
    const payload = await api.runtime.sendMessage({ type: 'remoteImages', items });
    if (payload) render(payload);
  }

  let res;
  try { res = await api.runtime.sendMessage({ type: 'getVerdict' }); } catch { return; }
  if (!res) return;
  if (res.verdict) render(res.verdict);
  if (res.remote) await scanRemote().catch(() => {});
})();
