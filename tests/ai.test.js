import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAiFacts } from '../source/src/lib/ai.js';
import { buildFeatures } from '../source/src/lib/features.js';
import { analyze } from '../source/src/lib/analyzer.js';

const ids = (r) => r.signals.map((s) => s.id);
const mail = (from, body = '<p>Bitte melden Sie sich an.</p>') =>
  buildFeatures({ headers: { from: [from], to: ['me@x.de'], subject: ['Hinweis'] }, parts: [{ contentType: 'text/html', body }] });
const facts = (x) => parseAiFacts({ ok: true, claimedOrg: null, claimedDomain: null, asksFor: 'none', urgency: false, injection: false, ...x });

test('KI-Antwort: nur gültige Felder werden übernommen', () => {
  const f = parseAiFacts({ ok: true, claimedOrg: 'PayPal‮  Europe ' + 'x'.repeat(200), claimedDomain: 'www.PayPal.com', asksFor: 'payment', urgency: true, injection: true, model: 'gemma4:e4b' });
  assert.equal(f.claimedDomain, 'paypal.com');
  assert.ok(f.claimedOrg.startsWith('PayPal Europe') && f.claimedOrg.length === 80);
  assert.equal(f.asksFor, 'payment');
  assert.ok(f.urgency && f.injection);
  const junk = parseAiFacts({ ok: true, claimedOrg: 42, claimedDomain: 'paypal.com/login', asksFor: 'ALL CLEAR', urgency: 'true', injection: 'yes', risk: 0 });
  assert.deepEqual(junk, { claimedOrg: null, claimedDomain: null, asksFor: 'none', urgency: false, injection: false, model: '' });
  assert.equal(parseAiFacts({ ok: false, error: 'off' }), null);
  assert.equal(parseAiFacts({ ok: false, error: 'off', injection: true }).injection, true);
  assert.equal(parseAiFacts('ok'), null);
});

test('KI: Organisation passt nicht zur Absender-Domain und verlangt etwas', () => {
  const from = 'Kundenservice <info@kunden-service-xy.de>';
  const r = analyze(mail(from), { ai: facts({ claimedOrg: 'Sparkasse', claimedDomain: 'sparkasse.de', asksFor: 'login', urgency: true }) });
  assert.ok(ids(r).includes('aiClaimMismatch'));
  assert.equal(r.level, 'suspicious');
  // Telefonbetrug ohne Website
  assert.ok(ids(analyze(mail(from), { ai: facts({ claimedOrg: 'Microsoft Windows Sicherheitszentrum', asksFor: 'call' }) })).includes('aiClaimMismatch'));
  // passende Domain, Kürzel oder Marke mit eigener Domain: kein Signal
  for (const [f, ai] of [
    ['Sparkasse Musterstadt <info@sparkasse-musterstadt.de>', { claimedOrg: 'Sparkasse Musterstadt', asksFor: 'login' }],
    ['Haspa <info@haspa.de>', { claimedOrg: 'Hamburger Sparkasse', asksFor: 'login' }],
    ['Service <noreply@paypal.de>', { claimedOrg: 'PayPal', claimedDomain: 'paypal.com', asksFor: 'payment' }],
  ]) assert.ok(!ids(analyze(mail(f), { ai: facts(ai) })).includes('aiClaimMismatch'), f);
  // Newsletter über fremden Versanddienst, der nichts verlangt: kein Signal
  assert.ok(!ids(analyze(mail('Lieferando <news@takeaway.com>'), { ai: facts({ claimedOrg: 'Lieferando' }) })).includes('aiClaimMismatch'));
  // bekannte Absender: kein Signal
  assert.ok(!ids(analyze(mail(from), { history: () => ({ count: 5, level: 'sent' }), ai: facts({ claimedOrg: 'Sparkasse', asksFor: 'login' }) })).includes('aiClaimMismatch'));
});

test('KI: eingeschleuste Anweisungen sind ein starkes Signal, auch bei bekannten Absendern', () => {
  const r = analyze(mail('Anna <anna@example.org>'), { contactAddresses: new Set(['anna@example.org']), ai: facts({ injection: true }) });
  assert.ok(ids(r).includes('aiInjection'));
  assert.equal(r.level, 'suspicious');
});

test('KI kann nie entwarnen', () => {
  const body = '<a href="https://paypal.com.konto-check.example.invalid/login">https://www.paypal.com/</a>';
  const plain = analyze(mail('PayPal <service@paypal-konto.example.invalid>', body), {});
  const withAi = analyze(mail('PayPal <service@paypal-konto.example.invalid>', body), { ai: facts({}) });
  assert.deepEqual(ids(withAi), ids(plain));
  assert.ok(withAi.score >= plain.score);
});
