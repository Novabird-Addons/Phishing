import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { uiStrings } from '../source/src/i18n.js';

// linkpolicy.js ist ein klassisches Skript (läuft vor banner.js im Anzeigebereich): in eigenem Kontext laden
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(fileURLToPath(new URL('../source/src/content/linkpolicy.js', import.meta.url)), 'utf8'), ctx);
const policy = (status, danger, href, raw = href) => ctx.ppLinkPolicy(status, danger, href, raw);

test('Link-Sperre: zu, bis die Bewertung da ist', () => {
  // Prüfung läuft: jeder Link wartet – auch bei einer Mail, die gleich "gefährlich" wird
  assert.equal(policy('pending', false, 'https://evil.example/login'), 'wait');
  assert.equal(policy('pending', false, 'file:///C:/x.exe'), 'wait');
  // Bewertung da: unauffällig/Vorsicht frei, gefährlich mit Rückfrage
  assert.equal(policy('done', false, 'https://shop.example/'), 'allow');
  assert.equal(policy('done', true, 'https://evil.example/login'), 'confirmDanger');
  assert.equal(policy('done', true, 'HTTP://EVIL.EXAMPLE/'), 'confirmDanger');
  // Prüffehler, Zeitlimit, mehrere Mails: Rückfrage statt offen
  assert.equal(policy('unchecked', false, 'https://evil.example/'), 'confirmUnchecked');
  assert.equal(policy('unchecked', false, 'smb://host/share'), 'confirmUnchecked');
  // Schattenmodus: nichts Sichtbares
  assert.equal(policy('off', false, 'file:///C:/x.exe'), 'allow');
});

test('Link-Sperre: alle Schemata außer mailto/tel und Sprungmarken', () => {
  for (const href of ['file:///C:/x.exe', 'smb://host/share', 'search-ms:query=x', 'ms-msdt:/id', 'ftp://x.example/', 'data:text/html,x']) {
    assert.equal(policy('done', true, href), 'blockScheme', href);   // gefährlich: nur Web-Links lassen sich öffnen
    assert.equal(policy('done', false, href), 'allow', href);
  }
  for (const href of ['mailto:a@b.example', 'MAILTO:a@b.example', 'tel:+49301234']) {
    assert.equal(policy('pending', true, href), 'allow', href);
    assert.equal(policy('done', true, href), 'allow', href);
  }
  // Sprungmarke in der Mail selbst (a.href ist dann absolut, das Attribut beginnt mit #)
  assert.equal(policy('done', true, 'imap://x/#oben', '#oben'), 'allow');
  assert.equal(policy('pending', false, 'imap://x/#oben', ' #oben'), 'allow');
});

test('Link-Sperre: Texte auf Deutsch und Englisch', () => {
  for (const lang of ['de', 'en']) {
    const ui = uiStrings(lang);
    for (const k of ['link_title', 'link_body', 'link_wait', 'link_unchecked', 'link_blocked', 'link_click_again']) assert.ok(ui[k], `${lang} ${k}`);
  }
});
