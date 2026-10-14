// Läuft im Anzeigebereich der Mail (message_display_scripts). Zeigt das Banner, sperrt Links und meldet
// – nur wenn der Nutzer es eingeschaltet hat – nachgeladene Fremdbilder zur Prüfung.
(async () => {
  const api = typeof messenger !== 'undefined' ? messenger : browser;
  if (window !== window.top) return;
  if (document.getElementById('phishing-pilot-banner')) return;
  // Nur ein Banner pro Mail: Läuft das Skript doppelt (zweite Kopie des Add-ons, z. B. eine ältere Version mit anderer
  // ID, oder erneute Einbindung), übernimmt die erste Instanz – die übrigen halten sich heraus.
  if (document.documentElement.dataset.ppClaim) return;
  document.documentElement.dataset.ppClaim = api.runtime.id;

  const state = { danger: false, trusted: false, host: null, mode: 'inline', defanged: false };

  // Andere Add-ons (z. B. NovaBird-Conversation) ersetzen den Inhalt des Nachrichtendokuments, auch nachträglich
  // (document.body.replaceChildren()). Dabei würde unser Banner gelöscht. Deshalb hängen wir ihn bei Bedarf wieder an:
  // in die Konversationsansicht als erstes Element (damit deren Layout stimmt), sonst in den <body>.
  // Im Notfall-Modus ("fixed") hängt er als letztes Element am <html>, fest oben über allem.
  function attach() {
    const host = state.host;
    if (!host || state.trusted || !document.body) return;
    // Ältere Versionen kennen die Markierung oben nicht: Zeigt eine andere Kopie schon ein Banner, zieht sich dieses zurück
    if ([...document.querySelectorAll('#phishing-pilot-banner')].some((el) => el !== host)) {
      host.remove();
      state.host = null;
      state.trusted = true;   // nicht erneut einblenden
      return;
    }
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
    // Kompakt: eine Kopfzeile (Symbol, Überschrift, Punktzahl, Knöpfe), darunter die zwei wichtigsten Gründe.
    // "Warum?" klappt alle Gründe mit Punkten je Grund aus. Kräftiger Rand links wie bei den NovaBird-Overlays.
    const accent = danger ? '#C62828' : '#B07F00';
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; display: block; flex: none; }
      .box { font: 13px/1.35 system-ui, sans-serif; margin: 0 0 10px; padding: 7px 12px 7px 10px;
             border-radius: 8px; border: 1px solid ${danger ? '#E7A6A2' : '#E6C766'}; border-left: 6px solid ${accent};
             background: ${danger ? '#FDECEA' : '#FFF8E1'}; color: #222; box-shadow: 0 2px 8px rgba(20, 40, 80, .10); }
      .head { display: flex; align-items: baseline; gap: 2px 8px; flex-wrap: wrap; }
      .icon { color: ${accent}; font-size: 15px; }
      h1 { font-size: 14px; margin: 0; color: ${danger ? '#8E1B1B' : '#5C4300'}; }
      .small { font-size: 12px; color: #444; white-space: nowrap; }
      .foot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 3px; }
      .hint { font-size: 12px; color: #555; cursor: pointer; background: none; border: 0; padding: 0 0 0 16px; text-decoration: underline dotted; }
      .open .hint { display: none; }
      .actions { display: flex; gap: 6px; margin-left: auto; }
      button { font: 12px system-ui, sans-serif; margin: 0; padding: 2px 9px; cursor: pointer; border-radius: 5px;
               border: 1px solid ${danger ? '#E7A6A2' : '#E6C766'}; background: #fff; color: #222; }
      button:focus-visible { outline: 2px solid ${accent}; outline-offset: 1px; }
      ul { margin: 2px 0 0; padding-left: 30px; }
      li { margin: 1px 0; }
      li.more, .pts { display: none; }
      .open li.more { display: list-item; color: #333; }
      .ask { display: none; margin-top: 6px; padding: 6px 8px; border-radius: 6px; background: #fff; border: 1px solid ${danger ? '#E7A6A2' : '#E6C766'}; }
      .asking .ask { display: block; }
      .asking .actions { display: none; }
      .ask p { margin: 0 0 6px; white-space: pre-line; }
      .askbtns { display: flex; gap: 6px; justify-content: flex-end; }
      button.yes { background: ${accent}; border-color: ${accent}; color: #fff; }
      button:disabled { opacity: .6; cursor: default; }
      .open .pts { display: inline; margin-left: 6px; font-size: 11px; color: #666; font-variant-numeric: tabular-nums; }`;
    const box = document.createElement('div');
    box.className = 'box';
    const head = document.createElement('div');
    head.className = 'head';
    const icon = Object.assign(document.createElement('span'), { className: 'icon', textContent: '⚠' });
    icon.setAttribute('aria-hidden', 'true');
    const h = document.createElement('h1');
    h.textContent = payload.kind === 'extortion' ? ui.banner_extortion : danger ? ui.banner_dangerous : ui.banner_suspicious;
    const small = document.createElement('span');
    small.className = 'small';
    small.textContent = ui.banner_score.replace('{0}', score) + (danger ? ' · ' + (ui.banner_links_short ?? ui.banner_links) : '');
    if (danger) small.title = ui.banner_links;
    const ul = document.createElement('ul');
    const SHOWN = 2;
    reasons.forEach((r, i) => {
      const li = document.createElement('li');
      li.append(r.text);
      if (r.weight) li.append(Object.assign(document.createElement('span'), { className: 'pts', textContent: `+${r.weight}` }));
      if (i >= SHOWN) li.className = 'more';
      ul.append(li);
    });
    const why = document.createElement('button');
    why.textContent = ui.banner_why;
    const toggle = () => { box.classList.toggle('open'); why.textContent = box.classList.contains('open') ? (ui.banner_less ?? ui.banner_why) : ui.banner_why; };
    why.addEventListener('click', toggle);
    const foot = document.createElement('div');
    foot.className = 'foot';
    if (reasons.length > SHOWN) {
      const hint = Object.assign(document.createElement('button'), { className: 'hint', textContent: (ui.banner_more ?? '+ {0}').replace('{0}', reasons.length - SHOWN) });
      hint.addEventListener('click', toggle);
      foot.append(hint);
    }
    const trust = document.createElement('button');
    trust.textContent = ui.banner_trust;
    // Rückfrage direkt im Banner: window.confirm() wird im Nachrichtenbereich (z. B. in NovaBird-Conversation)
    // still unterdrückt und liefert sofort "Abbrechen" – dann passierte beim Klick scheinbar nichts.
    const ask = document.createElement('div');
    ask.className = 'ask';
    const askText = document.createElement('p');
    const yes = Object.assign(document.createElement('button'), { className: 'yes', textContent: ui.trust_yes });
    const no = Object.assign(document.createElement('button'), { textContent: ui.trust_cancel });
    const askBtns = document.createElement('div');
    askBtns.className = 'askbtns';
    askBtns.append(no, yes);
    ask.append(askText, askBtns);
    let step = 0;   // gefährlich: zwei Rückfragen, sonst eine
    const showAsk = () => {
      askText.textContent = step === 0 ? (danger ? ui.trust_confirm_dangerous.replace('{0}', score) : ui.trust_confirm) : ui.trust_confirm_final;
      box.classList.add('asking');
      yes.focus();
    };
    trust.addEventListener('click', () => { step = 0; showAsk(); });
    no.addEventListener('click', () => { box.classList.remove('asking'); trust.focus(); });
    yes.addEventListener('click', async () => {
      if (danger && step === 0) { step = 1; showAsk(); return; }
      yes.disabled = no.disabled = true;
      await api.runtime.sendMessage({ type: 'trustSender' }).catch(() => {});
      state.trusted = true;
      state.danger = false;
      state.host?.remove();
    });
    const actions = document.createElement('span');
    actions.className = 'actions';
    actions.append(why, trust);
    head.append(icon, h, small);
    foot.append(actions);
    box.append(head, ul, foot, ask);
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
