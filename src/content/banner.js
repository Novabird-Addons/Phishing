// Läuft im Anzeigebereich der Mail (message_display_scripts). Zeigt das Banner, sperrt Links und meldet
// – nur wenn der Nutzer es eingeschaltet hat – nachgeladene Fremdbilder zur Prüfung.
(async () => {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  if (window !== window.top) return;
  if (document.getElementById('phishing-pilot-banner')) return;

  const state = { danger: false, trusted: false, host: null, mode: 'inline', defanged: false };

  // Andere Add-ons (z. B. NovaBird-Conversation) ersetzen den Inhalt des Nachrichtendokuments, auch nachträglich
  // (document.body.replaceChildren()). Dabei würde unser Banner gelöscht. Deshalb hängen wir ihn bei Bedarf wieder an:
  // in die Konversationsansicht als erstes Element (damit deren Layout stimmt), sonst in den <body>.
  // Im Notfall-Modus ("fixed") hängt er als letztes Element am <html>, fest oben über allem.
  function attach() {
    const host = state.host;
    if (!host || state.trusted || !document.body) return;
    if (state.mode === 'fixed') {
      if (document.documentElement.lastElementChild !== host) document.documentElement.append(host);
      return;
    }
    const parent = document.getElementById('nbc-root') ?? document.body;
    if (host.parentNode !== parent) parent.prepend(host);
  }
  new MutationObserver(attach).observe(document.body, { childList: true });
  new MutationObserver(attach).observe(document.documentElement, { childList: true });

  // ---- Schutz gegen Verdecken: Eine Phishing-Mail kann per CSS eine Fläche über das Banner legen oder es ausblenden. ----
  // 1) Sichtbarkeit und Ebene als Inline-Stil mit !important (schlägt jede Regel aus der Mail).
  const FORCE = { display: 'block', visibility: 'visible', opacity: '1', position: 'relative', 'z-index': '2147483647',
    transform: 'none', filter: 'none', 'clip-path': 'none', 'pointer-events': 'auto', 'max-height': 'none', overflow: 'visible' };
  function harden(host) {
    for (const [k, v] of Object.entries(FORCE)) host.style.setProperty(k, v, 'important');
    if (state.mode === 'fixed') {
      for (const [k, v] of Object.entries({ position: 'fixed', top: '0', left: '0', right: '0', margin: '8px' })) host.style.setProperty(k, v, 'important');
    }
  }
  // 2) Liegt das Banner wirklich oben und ist es sichtbar (auch keine unsichtbaren Vorfahren)?
  function onTop(host) {
    const r = host.getBoundingClientRect();
    if (r.width < 100 || r.height < 30) { state.why = `klein ${Math.round(r.width)}x${Math.round(r.height)}`; return false; }
    for (let e = host.parentElement; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (Number(cs.opacity) < 0.9 || cs.visibility === 'hidden' || cs.filter !== 'none' || cs.clipPath !== 'none') {
        state.why = `vorfahr ${e.tagName}#${e.id}.${e.className} op=${cs.opacity} vis=${cs.visibility} f=${cs.filter} cp=${cs.clipPath}`; return false;
      }
    }
    return [[0.1, 0.3], [0.5, 0.5], [0.9, 0.7]].every(([fx, fy]) => {
      const y = Math.min(r.top + r.height * fy, innerHeight - 1);
      const t = y < 0 ? host : document.elementFromPoint(r.left + r.width * fx, y);
      if (t !== host) state.why = `punkt ${fx},${fy} y=${Math.round(y)} top=${Math.round(r.top)} -> ${t?.tagName}#${t?.id}.${String(t?.className).slice(0, 40)}`;
      return t === host;
    });
  }
  // 3) Verdeckt? Dann die Stile dieser Mail abschalten (ihre <style>-Blöcke und Inline-Stile); hilft das nicht, Banner fest anheften.
  function defang() {
    for (const el of document.querySelectorAll('style, link[rel~="stylesheet"]')) {
      if (/^(chrome|moz-extension|resource):/i.test(el.href || '')) continue;
      if (el.sheet) el.sheet.disabled = true;
    }
    for (const el of document.querySelectorAll('[style]')) if (el !== state.host) el.removeAttribute('style');
    state.defanged = true;
    if (state.host) state.host.dataset.ppGuard = 'defanged';   // für Tests/Diagnose: Mail-Stile wurden abgeschaltet
  }
  // Eingreifen erst, wenn das Banner zweimal im Abstand von 800 ms verdeckt ist: Andere Add-ons (NovaBird-Conversation)
  // blenden ihre Ansicht beim Öffnen kurz mit Deckkraft 0 ein – das ist keine Überdeckung.
  let misses = 0, recheck = null;
  function guard() {
    const host = state.host;
    if (!host || state.trusted || !host.isConnected || (scrollY > 20 && state.mode !== 'fixed')) return;
    harden(host);
    if (onTop(host)) { misses = 0; return; }
    if (++misses < 2) { clearTimeout(recheck); recheck = setTimeout(guard, 800); return; }
    host.dataset.ppWhy = state.why ?? '';
    if (!state.defanged) { defang(); if (onTop(host)) return; }
    if (state.mode !== 'fixed') {
      state.mode = 'fixed';
      host.dataset.ppGuard = 'fixed';
      harden(host);
      attach();
      document.body?.style.setProperty('padding-top', `${host.offsetHeight + 16}px`, 'important');
    }
  }

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
    harden(host);
    attach();
    // prüfen, sobald gezeichnet, und noch einmal, wenn Bilder und Schriften geladen sind
    requestAnimationFrame(guard);
    for (const ms of [300, 1000, 2500]) setTimeout(guard, ms);
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
