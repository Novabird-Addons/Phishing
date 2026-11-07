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

  // status für die Link-Sperre (linkpolicy.js): 'pending' bis die Bewertung da ist, dann 'done' oder 'unchecked'
  const state = { danger: false, trusted: false, host: null, mode: 'inline', defanged: false, status: 'pending' };
  let settle;
  const settled = new Promise((r) => { settle = r; });
  function setStatus(s) {
    if (state.status !== 'off') state.status = s;
    settle();
  }

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

  // Prüfung gescheitert: neutraler Hinweis statt stillem "keine Warnung" – ein Fehler darf nicht wie Entwarnung aussehen
  function renderError(ui) {
    state.host?.remove();
    state.danger = false;
    setStatus('unchecked');
    const host = document.createElement('div');
    host.id = 'phishing-pilot-banner';
    host.dataset.level = 'error';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; display: block; flex: none; }
      .box { font: 13px/1.35 system-ui, sans-serif; margin: 0 0 10px; padding: 6px 12px 6px 10px; border-radius: 8px;
             border: 1px solid #CFCFCF; border-left: 6px solid #8A8A8A; background: #F4F4F4; color: #222; }`;
    const box = document.createElement('div');
    box.className = 'box';
    box.append(Object.assign(document.createElement('b'), { textContent: ui.banner_error_title }), ' ', ui.banner_error_text);
    root.append(style, box);
    state.host = host;
    state.ui = ui;
    harden(host);
    attach();
  }

  function render(payload) {
    if (state.trusted) return;
    if (payload.level === 'error') return renderError(payload.ui);
    state.host?.remove();
    const { level, score, reasons, ui } = payload;
    const danger = level === 'dangerous';
    state.danger = danger;
    setStatus('done');

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
    const actions = document.createElement('span');
    actions.className = 'actions';
    actions.append(why);
    const ask = document.createElement('div');
    ask.className = 'ask';
    if (danger) {
      // Bei "gefährlich" gibt es keinen Vertrauen-Knopf: Ein Klick darf eine so auffällige Mail nicht entwarnen.
      // Wer die Adresse trotzdem freigeben will, trägt sie bewusst in den Einstellungen ein.
      actions.append(Object.assign(document.createElement('span'), { className: 'small', textContent: ui.trust_blocked, title: ui.trust_blocked_hint }));
    } else {
      const trust = document.createElement('button');
      trust.textContent = ui.banner_trust;
      // Rückfrage direkt im Banner: window.confirm() wird im Nachrichtenbereich (z. B. in NovaBird-Conversation)
      // still unterdrückt und liefert sofort "Abbrechen" – dann passierte beim Klick scheinbar nichts.
      const askText = Object.assign(document.createElement('p'), { textContent: ui.trust_confirm });
      const yes = Object.assign(document.createElement('button'), { className: 'yes', textContent: ui.trust_yes });
      const no = Object.assign(document.createElement('button'), { textContent: ui.trust_cancel });
      const askBtns = document.createElement('div');
      askBtns.className = 'askbtns';
      askBtns.append(no, yes);
      ask.append(askText, askBtns);
      trust.addEventListener('click', () => { box.classList.add('asking'); yes.focus(); });
      no.addEventListener('click', () => { box.classList.remove('asking'); trust.focus(); });
      yes.addEventListener('click', async () => {
        yes.disabled = no.disabled = true;
        const ok = await api.runtime.sendMessage({ type: 'trustSender' }).catch(() => false);
        // Hintergrund lehnt ab (inzwischen "gefährlich" bewertet, Fehler): Banner bleibt
        if (ok !== true) { yes.disabled = no.disabled = false; box.classList.remove('asking'); return; }
        state.trusted = true;
        state.danger = false;
        state.host?.remove();
      });
      actions.append(trust);
    }
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

  // Klicks auf Links abfangen (Links- und Mittelklick), Regeln in linkpolicy.js. Gesperrt ist von Anfang an: Solange
  // die Prüfung läuft, wartet ein Klick bis zu WAIT_MS auf die Bewertung; ist die Mail unauffällig, öffnet der Link
  // danach ohne Rückfrage. Nach Fehlern oder ohne Bewertung fragt der Schutz nach – mit eigenem Dialog in der Mail:
  // confirm()/alert() werden im Nachrichtenbereich (z. B. NovaBird-Conversation) still unterdrückt (siehe Vertrauen).
  // Web-Links öffnet danach das Hintergrundskript im Standardbrowser – ein nachgestellter Klick aus dem Skript wäre
  // "untrusted" und wird von Thunderbird nicht zuverlässig als Link-Klick behandelt. Andere Schemata (file:, smb: …)
  // kann nur ein echter Klick öffnen: nach "Öffnen" darf der nächste Klick auf denselben Link durch.
  const WAIT_MS = 5000;
  const de = /^de\b/i.test(navigator.language);
  // bis die Texte vom Hintergrundskript da sind (die ersten Millisekunden)
  const FALLBACK = de
    ? { link_title: 'Link öffnen?', link_body: 'Dieser Link führt zu:', link_open: 'Trotzdem öffnen', link_cancel: 'Abbrechen',
        link_wait: 'Die Mail wird noch geprüft …', link_unchecked: 'Diese Mail konnte nicht geprüft werden. Link trotzdem öffnen?',
        link_blocked: 'Bei einer gefährlichen Mail öffnet der Schutz nur Web-Links.', link_click_again: 'Geprüft – bitte noch einmal klicken.' }
    : { link_title: 'Open link?', link_body: 'This link leads to:', link_open: 'Open anyway', link_cancel: 'Cancel',
        link_wait: 'The message is still being checked …', link_unchecked: 'This message could not be checked. Open the link anyway?',
        link_blocked: 'For a dangerous message, only web links can be opened.', link_click_again: 'Checked – please click again.' };
  const text = (k) => state.ui?.[k] ?? FALLBACK[k];
  const isWeb = (href) => /^https?:/i.test(href);
  const targetOf = (href) => { try { return new URL(href).hostname || href; } catch { return href; } };
  const openWeb = (href) => { api.runtime.sendMessage({ type: 'openLink', url: href }).catch(() => {}); };

  // Eigenes Shadow-DOM für Hinweis und Dialog, damit Mail-CSS sie nicht verändert (Inhalte nur über textContent)
  function overlay(id, html) {
    const el = document.createElement('div');
    el.id = id;
    const root = el.attachShadow({ mode: 'closed' });
    root.innerHTML = '<style>:host{all:initial}*{font:13px/1.35 system-ui,sans-serif;box-sizing:border-box}' +
      '.note{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;padding:6px 12px;border-radius:8px;background:#333;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25)}' +
      '.bg{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}' +
      '.box{max-width:min(440px,90vw);padding:14px 16px;border-radius:10px;background:#fff;color:#222;box-shadow:0 6px 24px rgba(0,0,0,.3)}' +
      'b{display:block;font-weight:600;margin-bottom:6px}code{display:block;font-family:monospace;margin:6px 0 12px;word-break:break-all}' +
      '.btns{display:flex;gap:8px;justify-content:flex-end}button{padding:4px 12px;border-radius:6px;border:1px solid #bbb;background:#f4f4f4;color:#222;cursor:pointer}' +
      '</style>' + html;
    (document.body ?? document.documentElement).append(el);
    return { el, root };
  }
  function note(msg, ms) {
    const { el, root } = overlay('phishing-pilot-note', '<div class="note"></div>');
    root.querySelector('.note').textContent = msg;
    if (ms) setTimeout(() => el.remove(), ms);
    return el;
  }
  // Rückfrage; true = öffnen. Abbrechen ist vorausgewählt, Escape und Klick daneben brechen ab.
  function askInPage(key, href) {
    return new Promise((resolve) => {
      const { el, root } = overlay('phishing-pilot-ask',
        '<div class="bg"><div class="box" role="dialog" aria-modal="true"><b></b><span></span><code></code>' +
        '<div class="btns"><button class="no"></button><button class="yes"></button></div></div></div>');
      root.querySelector('b').textContent = text(key);
      root.querySelector('span').textContent = text('link_body');
      root.querySelector('code').textContent = targetOf(href);
      root.querySelector('.no').textContent = text('link_cancel');
      root.querySelector('.yes').textContent = text('link_open');
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(false); } };
      const done = (v) => { el.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      root.querySelector('.yes').addEventListener('click', () => done(true));
      root.querySelector('.no').addEventListener('click', () => done(false));
      root.querySelector('.bg').addEventListener('click', (e) => { if (e.target === e.currentTarget) done(false); });
      document.addEventListener('keydown', onKey, true);
      root.querySelector('.no').focus();
    });
  }

  async function waitForVerdict(foreign) {
    if (foreign || state.status !== 'pending') return;
    document.documentElement.style.cursor = 'progress';
    const hint = note(text('link_wait'));
    await Promise.race([settled, new Promise((r) => setTimeout(r, WAIT_MS))]);
    hint.remove();
    document.documentElement.style.cursor = '';
  }
  let allowOnce = '';   // Nicht-Web-Link, dessen Öffnen bestätigt wurde: der nächste echte Klick darf durch
  async function decide(href, foreign) {
    // Zeitlimit abgelaufen: für diesen Klick "ungeprüft"; die Bewertung darf trotzdem später noch kommen
    const status = foreign || state.status === 'pending' ? 'unchecked' : state.status;
    const decision = ppLinkPolicy(status, state.danger, href, href);
    if (decision === 'blockScheme') { note(text('link_blocked'), 4000); return; }
    if (decision !== 'allow' && !await askInPage(decision === 'confirmDanger' ? 'link_title' : 'link_unchecked', href)) return;
    if (isWeb(href)) openWeb(href);
    else { allowOnce = href; note(text('link_click_again'), 4000); }
  }

  let busy = false;
  function guardLink(ev) {
    if (ev.type === 'auxclick' && ev.button !== 1) return;
    const a = ev.target.closest?.('a[href]');
    if (!a) return;
    const href = a.href;
    if (allowOnce && href === allowOnce) { allowOnce = ''; return; }
    // Link in einer anderen Karte der Konversationsansicht: die Bewertung gilt nicht für ihn (siehe linkpolicy.js)
    const status = ppCardStatus(state.status, !!a.closest('#nbc-root'), !!a.closest('.nbc-card.selected'));
    const foreign = status === 'unchecked' && state.status !== 'unchecked';
    if (ppLinkPolicy(status, state.danger, href, a.getAttribute('href')) === 'allow') return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (busy) return;   // Dialog oder Warten läuft schon
    busy = true;
    waitForVerdict(foreign).then(() => decide(href, foreign)).finally(() => { busy = false; });
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

  // Nachgereichte Bewertung (z. B. Ergebnis der lokalen KI kam später): Banner ersetzen
  api.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'verdictUpdate' && msg.verdict) render(msg.verdict);
  });

  // Texte für die Link-Sperre gleich holen (die Bewertung kann dauern), ohne auf sie zu warten; im Schattenmodus
  // bleibt alles unverändert
  api.runtime.sendMessage({ type: 'linkInfo' }).then((info) => {
    if (info?.ui) state.ui ??= info.ui;
    if (info?.off) { state.status = 'off'; settle(); }
  }).catch(() => { /* dann mit FALLBACK */ });
  // Kommt gar keine Antwort (Hintergrundskript hängt oder läuft nicht), soll das in der Fehlerkonsole stehen
  const noAnswer = setTimeout(() => console.warn('Novabird-phishing: nach 10 s keine Bewertung vom Hintergrundskript – Links fragen nach'), 10_000);
  let res;
  try { res = await api.runtime.sendMessage({ type: 'getVerdict' }); } catch { setStatus('unchecked'); return; } finally { clearTimeout(noAnswer); }
  // null: keine Bewertung möglich (z. B. mehrere Mails angezeigt) – Links fragen dann nach
  if (!res) { setStatus('unchecked'); return; }
  if (res.verdict) render(res.verdict);
  else setStatus('done');
  if (res.remote) await scanRemote().catch(() => {});
})();
