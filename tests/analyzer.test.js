import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeatures } from '../source/src/lib/features.js';
import { analyze, headerSuspicion, nameMatchesDomain, orgKey } from '../source/src/lib/analyzer.js';
import { lookalike, registrableDomain, toUnicodeHost, hasMixedScript, looksRandomDomain } from '../source/src/lib/domains.js';
import { nameKey } from '../source/src/lib/text.js';
import { parseAddressList, parseAuthResults } from '../source/src/lib/headers.js';
import { contactInfo, parseVCard } from '../source/src/lib/contacts.js';
import { t, uiStrings } from '../source/src/i18n.js';
import { flagRecord, historyMonths, isEstablished, noteRecord, trustLevel } from '../source/src/lib/history.js';

const html = (body) => ({ contentType: 'text/html', body });
const mk = (headers, parts = [html('<p>Hallo</p>')], cfg) => buildFeatures({ headers, parts }, cfg);
const ids = (r) => r.signals.map((s) => s.id);

const ctx = (extra = {}) => ({
  contactsByName: new Map([[nameKey('Max Mustermann'), new Set(['max@firma-mustermann.de'])]]),
  contactAddresses: new Set(['max@firma-mustermann.de', 'anna@example.org']),
  contactDomains: new Set(['firma-mustermann.de', 'example.org']),
  historyByName: new Map(),
  history: (a) => (a === 'newsletter@shop.de' ? { count: 10 } : null),
  ...extra,
});

test('Domain-Helfer', () => {
  assert.equal(registrableDomain('mail.sub.example.co.uk'), 'example.co.uk');
  assert.equal(toUnicodeHost('xn--pypal-4ve.com'), 'pаypal.com'.replace('а', 'а'));
  assert.ok(hasMixedScript('xn--pypal-4ve.com'));
  assert.equal(lookalike('paypa1.com', ['paypal.com']).kind, 'homoglyph');
  assert.equal(lookalike('paypal.com', ['paypal.com']), null);
  assert.equal(lookalike('paypal.com.evil.tld', ['paypal.com']).kind, 'embedded');
  assert.equal(lookalike('secure-paypal.net', ['paypal.com']).kind, 'embedded');
  assert.equal(lookalike('example.org', ['paypal.com']), null);
});

test('Adressen und Auth-Results', () => {
  assert.deepEqual(parseAddressList('"Mustermann, Max" <Max@X.de>, a@b.de')
    .map((a) => [a.name, a.address]), [['Mustermann, Max', 'max@x.de'], ['', 'a@b.de']]);
  assert.equal(nameKey('Mustermann, Dr. Max'), nameKey('Max Mustermann'));
  const own = 'mx.me.de; dmarc=pass; spf=pass';
  const fake = 'evil.test; dmarc=pass';
  assert.equal(parseAuthResults([own, fake]).dmarc, 'pass');           // oberster zählt
  assert.equal(parseAuthResults([fake, 'mx.me.de; dmarc=fail'], ['mx.me.de']).dmarc, 'fail');
  assert.equal(parseAuthResults([fake], ['mx.me.de']).present, false); // fremder Header ignoriert
});

test('Display-Name eines Kontakts, neue Adresse -> verdächtig (allein)', () => {
  const f = mk({ from: ['Max Mustermann <max.mustermann@gmail.com>'], subject: ['Hi'] });
  const r = analyze(f, ctx());
  assert.ok(ids(r).includes('contactImpersonation'));
  assert.equal(r.level, 'suspicious');
});

test('Kontakt mit zweiter Adresse derselben Firma wird nicht geflaggt', () => {
  const f = mk({ from: ['Max Mustermann <m.mustermann@firma-mustermann.de>'], subject: ['Hi'] });
  assert.ok(!ids(analyze(f, ctx())).includes('contactImpersonation'));
});

test('Antwort ohne In-Reply-To/References -> verdächtig (allein)', () => {
  const f = mk({ from: ['Anna <anna@example.org>'], subject: ['AW: Rechnung'] });
  const r = analyze(f, ctx());
  assert.ok(ids(r).includes('replyNoThread'));
  assert.equal(r.level, 'suspicious');
});

test('Antwort mit unbekanntem Bezug -> verdächtig, mit lokalem Bezug nicht', () => {
  const h = { from: ['Anna <anna@example.org>'], subject: ['Re: Plan'], 'in-reply-to': ['<abc@x>'] };
  assert.ok(ids(analyze(mk(h), ctx({ threadFound: false }))).includes('replyThreadUnknown'));
  const ok = analyze(mk(h), ctx({ threadFound: true }));
  assert.equal(ok.level, 'normal');
  assert.deepEqual(ids(ok), []);
});

test('Klassisches Paket-Phishing -> gefährlich', () => {
  const f = mk(
    { from: ['DHL Paket <info@dhl-zustellung-service.com>'], subject: ['Ihr Paket'],
      'authentication-results': ['mx.me.de; spf=fail; dmarc=fail'] },
    [html('<p>Ihr Paket konnte nicht zugestellt werden, bestätigen Sie sofort:</p>' +
      '<a href="http://203.0.113.5/x">www.dhl.de/paket</a>')],
  );
  const r = analyze(f, ctx());
  assert.equal(r.level, 'dangerous');
  for (const id of ['dmarcFail', 'brandNameMismatch', 'lookalikeDomain', 'linkMismatch', 'ipLink', 'pressureWords']) {
    assert.ok(ids(r).includes(id), id);
  }
});

test('Newsletter bekannter Absender bleibt unauffällig', () => {
  const f = mk(
    { from: ['Shop <newsletter@shop.de>'], subject: ['Angebote'], 'list-unsubscribe': ['<mailto:u@shop.de>'] },
    [html('<a href="https://click.shop.de/r?u=1">Jetzt sparen</a>')],
  );
  const r = analyze(f, ctx());
  assert.equal(r.level, 'normal');
});

test('Nur schwache Signale lösen nie eine Warnung aus', () => {
  const f = mk(
    { from: ['Unbekannt <x@irgendwas-neu.de>'], subject: ['Wichtig'] },
    [html('<p>Dringend! Ihr Konto, sofort verifizieren, urgent</p>')],
  );
  const r = analyze(f, ctx());
  assert.equal(r.level, 'normal');
  assert.ok(r.score < 30);
});

test('Anhänge: HTML mit Passwortfeld, Doppel-Endung', () => {
  const f1 = mk({ from: ['a <a@neu.de>'], subject: ['Beleg'] }, [
    html('<p>siehe Anhang</p>'),
    { contentType: 'text/html', name: 'beleg.html', body: '<form><input type="password"></form>' },
  ]);
  const r1 = analyze(f1, ctx());
  assert.ok(ids(r1).includes('loginForm') && ids(r1).includes('riskyAttachment'));
  assert.equal(r1.level, 'dangerous');
  const f2 = mk({ from: ['a <a@neu.de>'], subject: ['x'] }, [
    html('<p>x</p>'), { contentType: 'application/octet-stream', name: 'rechnung.pdf.exe', body: '' },
  ]);
  assert.ok(ids(analyze(f2, ctx())).includes('riskyAttachment'));
});

test('Als vertrauenswürdig markierter Absender unterdrückt Signale, nicht DMARC-Fail', () => {
  const h = { from: ['Max Mustermann <max.mustermann@gmail.com>'], subject: ['Hi'] };
  const r = analyze(mk(h), ctx(), { trustedSenders: ['max.mustermann@gmail.com'] });
  assert.equal(r.level, 'normal');
  const h2 = { ...h, 'authentication-results': ['mx.me.de; dmarc=fail'] };
  assert.equal(analyze(mk(h2), ctx(), { trustedSenders: ['max.mustermann@gmail.com'] }).signals[0].id, 'dmarcFail');
});

test('vCard und alte properties werden gleich gelesen', () => {
  const v = 'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Chef Mustermann\r\nEMAIL;PREF=1:Chef@Firma-Mustermann.de\r\n' +
    'item1.EMAIL;TYPE=home:privat@gmx.de\r\nN:Mustermann;Chef;;;\r\nNOTE:lang\r\n zeile\r\nEND:VCARD\r\n';
  const a = parseVCard(v);
  assert.deepEqual(a.emails, ['chef@firma-mustermann.de', 'privat@gmx.de']);
  assert.equal(nameKey(a.names[0]), nameKey('Mustermann, Chef'));
  const b = contactInfo({ properties: { DisplayName: 'Chef Mustermann', PrimaryEmail: 'X@Y.de' } });
  assert.deepEqual(b, { names: ['Chef Mustermann'], emails: ['x@y.de'] });
});

test('Alle Signale haben deutsche und englische Texte', () => {
  const f = mk({ from: ['DHL <a@dhl-x.com>'], subject: ['Re: x'] }, [html('<a href="http://1.2.3.4">dhl.de</a>')]);
  for (const s of analyze(f, ctx()).signals) {
    const key = 'sig_' + s.id + (s.id === 'lookalikeDomain' ? '_' + s.params[2] : '');
    for (const lang of ['de', 'en']) assert.notEqual(t(lang, key, s.params), key, `${lang} ${key}`);
  }
});

test('Homoglyph im Anzeigenamen (großes I statt l) erkennt die Marke', () => {
  const f = mk({ from: ['KIarna <info@uni-irgendwo.ma>'], subject: ['Hinweis zu Ihrem Konto'] });
  assert.ok(ids(analyze(f, ctx())).includes('brandNameMismatch'));
});

test('Marke nur im Text (mit Leerzeichen getarnt) + Zahlungsbezug + Verkürzer', () => {
  const f = mk({ from: ['Konto-Service <x@gmail.com>'], subject: ['Zahlung ausstehend'] },
    [html('<p>My D isney Abonnement gekündigt. Ihre Zahlungsmethode wurde abgelehnt.</p><a href="https://clck.ru/abc">Jetzt aktualisieren</a>')]);
  const r = analyze(f, ctx());
  assert.deepEqual(ids(r).filter((x) => ['brandInContent', 'shortener'].includes(x)).sort(), ['brandInContent', 'shortener']);
  assert.notEqual(r.level, 'normal');
});

test('Marke im Text bei bekanntem Absender oder ohne Kontobezug: kein Treffer', () => {
  const known = mk({ from: ['Shop <newsletter@shop.de>'], subject: ['Zahlung per PayPal'] }, [html('<p>PayPal Zahlung erhalten</p>')]);
  assert.ok(!ids(analyze(known, ctx())).includes('brandInContent'));
  const harmless = mk({ from: ['Neu <x@neu-shop.de>'], subject: ['Wir lieben Amazon-Lieferungen'] }, [html('<p>Tolle Angebote</p>')]);
  assert.ok(!ids(analyze(harmless, ctx())).includes('brandInContent'));
});

test('Amazon-Infrastruktur ist keine Amazon-Nachahmung, offene Hosting-Dienste zählen aber', () => {
  const f = mk({ from: ['a <a@neu.de>'], subject: ['x'] },
    [html('<a href="https://bucket.s3.eu-west-1.amazonaws.com/login.html">Hier</a>')]);
  const r = ids(analyze(f, ctx()));
  assert.ok(!r.includes('lookalikeDomain'));
  assert.ok(r.includes('abusedHost'));
});

test('Gekaperter bekannter Absender: großes Bild als Link auf Fremddomain wird gewarnt', () => {
  const html1 = '<p>Anbei die Anfrage.</p><a href="https://saga.so/abc"><span><img width="566" height="225" src="cid:image001.png"></span></a>' +
    '<p><a href="https://www.firma-partner.de">www.firma-partner.de</a></p>';
  const f = mk({ from: ['"Langen, Christian" <c.langen@firma-partner.de>'], subject: ['Anfrage Transport'],
    'authentication-results': ['mx.me.de; dkim=pass; spf=pass; dmarc=pass'] }, [html(html1)]);
  const known = analyze(f, ctx({ history: (a) => (a === 'c.langen@firma-partner.de' ? { count: 8 } : null) }));
  assert.ok(ids(known).includes('imageLinkForeign'));
  assert.ok(known.score >= 30, 'Bonus für bekannte Absender darf nicht greifen: ' + known.score);
  assert.notEqual(known.level, 'normal');
});

test('Kleine Signatur-Icons, Social-Links und Newsletter lösen den Bild-Link-Alarm nicht aus', () => {
  const sig = mk({ from: ['a <a@firma-partner.de>'], subject: ['Hallo'] },
    [html('<a href="https://www.linkedin.com/in/x"><img width="24" height="24" src="cid:li"></a>' +
          '<a href="https://example-partner.com/x"><img width="32" src="cid:logo"></a>')]);
  assert.ok(!ids(analyze(sig, ctx())).includes('imageLinkForeign'));
  const social = mk({ from: ['a <a@firma-partner.de>'], subject: ['Hallo'] },
    [html('<a href="https://www.xing.com/profile/x"><img width="300" src="cid:banner"></a>')]);
  assert.ok(!ids(analyze(social, ctx())).includes('imageLinkForeign'));
  const nl = mk({ from: ['S <n@shop.de>'], subject: ['Angebote'], 'list-unsubscribe': ['<mailto:u@shop.de>'],
    'authentication-results': ['mx.me.de; dkim=pass header.i=@news.shop.de'] },
    [html('<a href="https://click.partner-tracking.net/x"><img width="600" src="https://img.shop.de/b.jpg"></a>')]);
  assert.ok(!ids(analyze(nl, ctx())).includes('imageLinkForeign'));
});

test('QR-Code mit Fremddomain wird wie ein Link geprüft und gemeldet', () => {
  const f = buildFeatures({
    headers: { from: ['Service <info@neu-firma.de>'], subject: ['Rechnung'] },
    parts: [html('<img src="cid:qr" width="250">')],
    qrUrls: ['https://secure-login.evil-example.test/pay?id=1'],
  });
  const r = analyze(f, ctx());
  assert.ok(ids(r).includes('qrForeignLink'));
  assert.equal(r.level, 'suspicious');
  const own = buildFeatures({
    headers: { from: ['Ticket <t@veranstalter.de>'], subject: ['Ihr Ticket'] },
    parts: [html('<img src="cid:qr">')], qrUrls: ['https://tickets.veranstalter.de/x/1'],
  });
  assert.ok(!ids(analyze(own, ctx())).includes('qrForeignLink'));
  const ip = buildFeatures({ headers: { from: ['a <a@x-firma.de>'] }, parts: [html('<img src="cid:qr">')], qrUrls: ['http://203.0.113.9/p'] });
  assert.ok(ids(analyze(ip, ctx())).includes('ipLink'));
});

test('OCR-Text im verlinkten Bild: Marke im Bild, Link führt woanders hin', () => {
  const body = '<p>Anbei.</p><a href="https://saga.so/abc"><img src="cid:image001.png@01DD" width="566"></a>';
  const f = buildFeatures({
    headers: { from: ['"Langen, Christian" <c.langen@firma-partner.de>'], subject: ['Anfrage Transport'] },
    parts: [html(body)],
    imageTexts: { 'image001.png': 'Muster GmbH hat ein Dokument zugesandt ABGESCHLOSSENES DOKUMENT ANZEIGEN OneDrive 126.9 KB' },
  });
  const r = analyze(f, ctx({ history: () => ({ count: 9 }) }));
  assert.ok(ids(r).includes('imageBrandMismatch'));
  assert.ok(ids(r).includes('imageCta'));
  assert.equal(r.level, 'dangerous');
});

test('OCR: Marke im Bild und Link zur Marke selbst ist unauffällig', () => {
  const f = buildFeatures({
    headers: { from: ['a <a@firma-partner.de>'], subject: ['Datei'] },
    parts: [html('<a href="https://onedrive.live.com/x"><img src="cid:img.png@01" width="400"></a>')],
    imageTexts: { 'img.png': 'OneDrive Dokument anzeigen' },
  });
  assert.ok(!ids(analyze(f, ctx())).includes('imageBrandMismatch'));
});

test('Fremdbild-Link ohne Größenangabe zählt, kleines Icon nicht', () => {
  const big = mk({ from: ['a <a@neu.de>'], subject: ['x'] }, [html('<a href="https://drop.example.test/x"><img src="http://cdn.example.test/p.png"></a>')]);
  assert.ok(ids(analyze(big, ctx())).includes('imageLinkForeign'));
  const icon = mk({ from: ['a <a@neu.de>'], subject: ['x'] }, [html('<a href="https://drop.example.test/x"><img src="http://cdn.example.test/p.png" width="32" height="32"></a>')]);
  assert.ok(!ids(analyze(icon, ctx())).includes('imageLinkForeign'));
});

test('Banner-Texte behalten den Platzhalter für die Punktzahl', () => {
  for (const lang of ['de', 'en']) assert.match(uiStrings(lang).banner_score, /\{0\}/);
});

test('Absender gelten nur als bekannt, wenn sie etabliert sind (nicht schon bei mehrfachem Vorkommen)', () => {
  const day = 86_400_000;
  const t0 = Date.UTC(2026, 0, 1);
  const idx = {};
  // Kampagne: 5 Mails am selben Tag -> nicht etabliert
  for (let i = 0; i < 5; i++) noteRecord(idx, { address: 'spam@evil.test' }, 'n', t0 + i * 3_600_000);
  assert.equal(isEstablished(idx['spam@evil.test']), false);
  // Newsletter: 4 Mails über 3 Monate -> etabliert
  for (let i = 0; i < 4; i++) noteRecord(idx, { address: 'news@shop.de' }, 'n', t0 + i * 30 * day);
  assert.equal(isEstablished(idx['news@shop.de']), true);
  // Wenig Mails, lange Zeit -> nicht etabliert (zu wenige)
  noteRecord(idx, { address: 'a@b.de' }, 'n', t0); noteRecord(idx, { address: 'a@b.de' }, 'n', t0 + 100 * day);
  assert.equal(isEstablished(idx['a@b.de']), false);
  // Man hat der Adresse selbst geschrieben -> etabliert
  noteRecord(idx, { address: 'partner@firma.de' }, 'sent', t0);
  assert.equal(isEstablished(idx['partner@firma.de']), true);
  // Alter Index ohne Zeitangaben -> nicht etabliert (wird neu aufgebaut)
  assert.equal(isEstablished({ n: 9, sent: 0, names: [] }), false);
});

test('Phishing von einem Absender, der mehrfach auftaucht, wird weiter gewarnt (Sammlung, Kampagne)', () => {
  // Nicht etablierter Absender: history liefert null, wie bei einem neuen Absender.
  const f = mk({ from: ['Disney Support <x@fremd-absender.test>'], subject: ['Zahlung ausstehend'] },
    [html('<p>Ihr Abonnement ... Zahlung abgelehnt</p><a href="https://clck.ru/x">Jetzt aktualisieren</a>')]);
  const r = analyze(f, ctx({ history: () => null }));
  assert.notEqual(r.level, 'normal');
  assert.ok(ids(r).includes('firstContact'));
});

test('Texte der Sicherheitsabfrage für "Absender vertrauen" gibt es in DE und EN, die Punktzahl bleibt Platzhalter', () => {
  for (const lang of ['de', 'en']) {
    const ui = uiStrings(lang);
    assert.ok(ui.trust_confirm.length > 20 && ui.trust_confirm_final.length > 20);
    assert.match(ui.trust_confirm_dangerous, /\{0\}/);
  }
});

const sextortionDe = 'Hallo! Leider habe ich schlechte Nachrichten für Sie. Vor einigen Monaten habe ich mir Zugang zu Ihren Computern verschafft. ' +
  'Ich habe einen Trojaner installiert und Zugriff auf Ihre Webcam. Ich habe mehrere Videos von Ihnen aufgenommen. ' +
  'Es ist nur ein paar Mausklicks entfernt, Ihre Videos mit Ihren Freunden, Verwandten und Kollegen zu teilen. ' +
  'Alles, was Sie brauchen, ist eine Überweisung von 1200€ in Bitcoin. Unten ist meine BTC-Wallet: bc1q3ukk25s5qwh8sshc0xy5p8qnylzgy0d9rhn78f ' +
  'Sie haben nicht mehr als 48 Stunden Zeit. Versuchen Sie nicht, auf diese E-Mail zu antworten.';
const sextortionEn = 'I hacked your device and installed spyware. I recorded you through your webcam. I will publish the videos and send them to all your contacts ' +
  'unless you pay 900 USD in Bitcoin within 48 hours. Do not reply and do not contact the police. Wallet: 1BoatSLRHtKNngkdXEeobR76b53LETtpyT';

test('Erpressungs-Mail (Sextortion) wird inhaltlich erkannt und zwingend "gefährlich", auch von bekanntem Absender', () => {
  for (const body of [sextortionDe, sextortionEn]) {
    const f = mk({ from: ['Kenzty <kenzty@my365.ws>'], subject: ['LETZTE WARNUNG'] }, [html(`<p>${body}</p>`)]);
    const r = analyze(f, ctx({ history: () => ({ count: 9 }) }));
    assert.ok(ids(r).includes('extortion'));
    assert.equal(r.level, 'dangerous');
  }
});

test('Füllwort zwischen den Wörtern wird erkannt, entfernt und gemeldet', () => {
  const filler = 'q𝑑ϳq';
  const words = sextortionDe.split(' ');
  const noisy = words.flatMap((w) => [w, filler]).join(' ') + ' ' + (filler + ' ').repeat(40);
  const f = mk({ from: ['x <x@neu-absender.test>'], subject: ['LETZTE WARNUNG'] }, [html(`<p>${noisy}</p>`)]);
  assert.equal(f.fillerToken, filler);
  assert.ok(!f.text.includes(filler));
  const r = analyze(f, ctx());
  assert.ok(ids(r).includes('fillerText'));
  assert.ok(ids(r).includes('extortion'), 'Wortgruppen müssen nach dem Entfernen wieder erkennbar sein');
});

test('Gegenbeispiele: Sicherheits-Newsletter, Krypto-Börse, Rechnung, normaler Text', () => {
  const newsletter = mk({ from: ['Heise <news@heise.test>'], subject: ['Sextortion-Welle'], 'list-unsubscribe': ['<mailto:u@x.test>'],
    'authentication-results': ['mx.me.de; dkim=pass header.d=heise.test'] },
    [html('<p>Aktuell kursieren Erpresser-Mails: Kriminelle behaupten, Ihre Webcam gehackt zu haben, und drohen, Videos zu veröffentlichen. ' +
      'Gefordert werden Bitcoin innerhalb von 48 Stunden. Bezahlen Sie nicht. Ein Trojaner ist laut Experten meist nicht installiert. Weitere Hinweise zum Schutz Ihrer Geräte finden Sie unten.</p>')]);
  assert.ok(!ids(analyze(newsletter, ctx())).includes('extortion'));
  const exchange = mk({ from: ['Börse <no-reply@boerse.test>'], subject: ['Ihre Einzahlungsadresse'] },
    [html('<p>Ihre Bitcoin Einzahlungsadresse (Wallet): bc1q3ukk25s5qwh8sshc0xy5p8qnylzgy0d9rhn78f. Bitte beachten Sie: Einzahlungen werden nach 2 Tagen gutgeschrieben, wenn sie bestätigt sind. Vielen Dank für Ihr Vertrauen.</p>')]);
  assert.ok(!ids(analyze(exchange, ctx())).includes('extortion'));
  const invoice = mk({ from: ['Firma <rechnung@firma.test>'], subject: ['Rechnung 4711'] },
    [html('<p>Bitte überweisen Sie den Betrag von 1200 € innerhalb von 14 Tagen auf unser Konto. Letzte Zahlungsfrist ist der 30. des Monats. Bei Fragen antworten Sie bitte auf diese E-Mail. Vielen Dank für Ihren Auftrag und freundliche Grüße aus dem Büro.</p>')]);
  assert.ok(!ids(analyze(invoice, ctx())).includes('extortion'));
  assert.equal(mk({ from: ['a <a@b.test>'], subject: ['x'] }, [html('<p>' + 'Der Hund und die Katze und der Vogel gingen in den Garten und spielten dort mit dem Ball. '.repeat(10) + '</p>')]).fillerToken, null);
});

test('Zufällig wirkende Domains: erkennen, ohne echte Marken zu treffen', () => {
  for (const d of ['zkwd.de', '5yngrqr7.com', 'mail.xk3j9q2z.net', 'kmpt.com']) assert.equal(looksRandomDomain(d), true, d);
  for (const d of ['schwarz.de', 'tchibo.de', 'n26.com', '1und1.de', 'strato.de', 'immobilienscout24.de', 'mediamarkt.de', 'sparkasse.de',
    'rwth-aachen.de', 'web.de', 'gmx.net', 'ard.de', 'zdf.de', 'bild.de', 'otto.de', 'check24.de', 'amazon.co.uk', 'kundenserver.de', 'telekom.de']) {
    assert.equal(looksRandomDomain(d), false, d);
  }
});

test('Anlage-/Krypto-Werbung von Unbekannten wird gemeldet, von Bekannten und ohne Köder nicht', () => {
  const ad = mk({ from: ['Wellenreiten <contact@5yngrqr7.com>'], subject: ['Timing ist alles: Mit Bedacht investieren, wenn der Kryptowert sinkt'], 'list-unsubscribe': ['<mailto:u@x.test>'] },
    [html('<p>Navigieren im Bitcoin-Abschwung: Warum jetzt Ihr idealer Einstiegspunkt sein könnte!!</p>')]);
  const r = analyze(ad, ctx());
  assert.ok(ids(r).includes('investmentPromo') && ids(r).includes('randomDomain'));
  assert.notEqual(r.level, 'normal');
  assert.ok(!ids(analyze(ad, ctx({ history: () => ({ count: 9 }) }))).includes('investmentPromo'), 'bekannter Absender');
  const bank = mk({ from: ['Sparkasse <news@neu-bank-info.test>'], subject: ['Ihre Zinsen im Überblick'] },
    [html('<p>Unsere Anlageberatung informiert Sie über aktuelle Tagesgeld-Zinsen und Wertpapiere. Der Zinssatz bleibt stabil.</p>')]);
  assert.ok(!ids(analyze(bank, ctx())).includes('investmentPromo'));
  const crypto1 = mk({ from: ['Blog <info@kryptoblog.test>'], subject: ['Wochenrückblick'] }, [html('<p>Der Bitcoin-Kurs schwankte diese Woche.</p>')]);
  assert.ok(!ids(analyze(crypto1, ctx())).includes('investmentPromo'), 'ein Begriff genügt nicht');
});

test('Unsichtbare Füllzeichen: sauber gezählt, aber nie allein ein Grund zu warnen (Newsletter-Preheader)', () => {
  const pad = '&zwnj;&nbsp;'.repeat(120);
  const f = mk({ from: ['Shop <news@neuer-shop.test>'], subject: ['Angebote'], 'list-unsubscribe': ['<mailto:u@x.test>'] },
    [html(`<div style="display:none">Vorschau${pad}</div><p>Unsere neuen Angebote für Sie, viel Spaß beim Stöbern in unserem Sortiment.</p>`)]);
  assert.ok(f.invisibleCount >= 100);
  assert.ok(!f.text.includes('\u200c'));
  const r = analyze(f, ctx());
  assert.ok(ids(r).includes('invisiblePadding'));
  assert.equal(r.level, 'normal');
});

test('Fehlalarme aus echten Newslettern/Shop-Mails: kein Treffer, Phishing-Varianten bleiben', () => {
  const H = (from, extra = {}) => ({ from, to: 'me@x.de', subject: 'Info', 'list-unsubscribe': '<mailto:u@x>', ...extra });
  const run = (headers, body) => analyze(mk(headers, [html(body)]), ctx());
  // Absender "drgmail.de" ist kein Gmail-Imitat; "gmail-login.de" schon
  assert.ok(!ids(run(H('DRG <drg@drgmail.de>'), '<p>Hi</p>')).includes('lookalikeDomain'));
  assert.ok(ids(run(H('X <a@gmail-login.de>'), '<p>Hi</p>')).includes('lookalikeDomain'));
  // Regionale Volksbank ja, "vr-secure-login" nein
  assert.ok(!ids(run(H('Volksbank Mittelhessen eG <info@vb-mittelhessen.de>'), '<p>Hi</p>')).includes('brandNameMismatch'));
  assert.ok(ids(run(H('Volksbank Service <info@vr-secure-login.de>'), '<p>Hi</p>')).includes('brandNameMismatch'));
  // Link über eigene Domain des Absenders (Tracking) ist kein Mismatch; fremde Domain bleibt einer
  assert.ok(!ids(run(H('Shop <info@service.shop-x.de>'), '<a href="https://link.service.shop-x.de/c?1">ec.europa.eu/odr</a>')).includes('linkMismatch'));
  assert.ok(ids(run(H('Shop <info@service.shop-x.de>'), '<a href="https://evil.example/c?1">paypal.com/login</a>')).includes('linkMismatch'));
  // Symbol-Leiste in der Fußzeile (30x30) ist kein Bild-Link-Signal
  const icons = '<a href="https://techrush.example/"><img src="cid:Techrush30x30.png"></a>';
  assert.ok(!ids(run(H('Shop <info@shop-x.de>', { 'list-unsubscribe': undefined }), icons)).includes('imageLinkForeign'));
  // Lieferdienst im Text einer Shop-Mail ist keine Markenvortäuschung
  assert.ok(!ids(run(H('Shop <info@shop-x.de>', { 'authentication-results': 'mx.me.de; dkim=pass header.d=shop-x.de' }),
    '<p>Ihr Konto: Die Sendung wird von Hermes zugestellt.</p>')).includes('brandInContent'));
  // "Termin bestätigt" ist kein Konto-Wort
  assert.ok(!ids(run(H('Salon <noreply@salon-x.de>', { 'list-unsubscribe': undefined }), '<p>Termin bestätigt, Google Maps Link folgt</p>')).includes('brandInContent'));
  // Zufalls-Domain: huk24-info ist keine
  assert.equal(looksRandomDomain('huk24-info.de'), false);
  assert.equal(looksRandomDomain('5yngrqr7.com'), true);
});

test('Review 0.2.8: Markenteile, Dateinamen im Linktext, gefälschte Listen-Header', () => {
  const run = (headers, body, c = ctx(), cfg = {}) => analyze(mk({ to: 'me@x.de', subject: 'Info', ...headers }, [html(body)]), c, cfg);
  // Markenname als Wortteil normaler Wörter ist kein Lookalike; mit Köder-Rest oder als ganzes Wort schon
  for (const d of ['teamsport-mueller.de', 'homeoffice-moebel.de', 'testdrive-autohaus.de', 'pineapple-cafe.de', 'bookingkit.net', 'telekommunikation-mayer.de']) {
    assert.ok(!ids(run({ from: `Info <info@${d}>` }, '<p>Hallo</p>')).includes('lookalikeDomain'), d);
  }
  for (const d of ['paypalsecure.com', 'appleid1.com', 'amazon-konto.de', 'secure-paypal.net', 'sparkasse-login.de']) {
    assert.ok(ids(run({ from: `Info <info@${d}>` }, '<p>Hallo</p>')).includes('lookalikeDomain'), d);
  }
  // Vom Nutzer vertrauter Absender: Lookalike der eigenen Domain verschwindet, Lookalike-Links nicht
  const trusted = { trustedSenders: ['info@paypalsecure.com'] };
  assert.equal(run({ from: 'Info <info@paypalsecure.com>' }, '<p>Hallo</p>', ctx(), trusted).level, 'normal');
  assert.ok(ids(run({ from: 'Info <info@shop-y.de>' }, '<a href="https://paypal-login.com/x">hier</a>', ctx(), { trustedSenders: ['info@shop-y.de'] })).includes('lookalikeDomain'));
  // Dateinamen und Technik-Namen im Linktext sind keine Domains, echte Adressen schon
  assert.ok(!ids(run({ from: 'Shop <info@shop.de>' }, '<a href="https://cdn.shopcloud.net/r/1">Rechnung_4711.pdf</a>')).includes('linkMismatch'));
  assert.ok(!ids(run({ from: 'Dev <news@dev.de>' }, '<a href="https://blog.other.io/x">Neues in Node.js</a>')).includes('linkMismatch'));
  assert.ok(ids(run({ from: 'Shop <info@shop.de>' }, '<a href="https://evil.example/x">https://www.shop.de.</a>')).includes('linkMismatch'));
  // Linktext nennt eine Marken-Domain, Link führt auf die Absenderdomain: bleibt ein Mismatch
  assert.ok(ids(run({ from: 'Service <a@evil-shop.com>' }, '<a href="https://evil-shop.com/login">www.paypal.com</a>')).includes('linkMismatch'));
  // List-Unsubscribe allein (fälschbar) lockert nichts; injizierte DKIM-Zeile einer fremden Domain auch nicht
  const img = '<p>Dokument freigegeben</p><a href="https://files-share.xyz/d"><img src="cid:doc.png" width="600"></a>';
  assert.ok(ids(run({ from: 'K <a@neu-firma.de>', 'list-unsubscribe': '<mailto:a@b.c>' }, img)).includes('imageLinkForeign'));
  const spoof = run({ from: 'PayPal <service@paypal.com>', 'list-unsubscribe': '<mailto:a@b.c>', 'authentication-results': 'mx.evil; dkim=pass header.d=evil.com' },
    '<p>Ihr Konto wurde eingeschränkt.</p><a href="https://login-check.xyz/a">www.paypal.com</a>');
  assert.equal(spoof.level, 'dangerous');
  // Drei Social-Icons heben den Bild-Link-Alarm nicht auf (ohne passende DKIM-Signatur)
  const icons = ['facebook.com', 'instagram.com', 'linkedin.com'].map((d) => `<a href="https://${d}/x"><img src="cid:${d}.png"></a>`).join('');
  assert.ok(ids(run({ from: 'K <a@neu-firma.de>' }, img + icons)).includes('imageLinkForeign'));
});

test('0.2.9: "oft empfangen" legitimiert keinen Spam, nur Angeschriebene/Kontakte sind voll bekannt', () => {
  const day = 86_400_000, t0 = Date.UTC(2026, 0, 1);
  const idx = {};
  for (let i = 0; i < 4; i++) noteRecord(idx, { address: 'news@shop.de' }, 'n', t0 + i * 30 * day);
  assert.equal(trustLevel(idx['news@shop.de']), 'recurring');
  flagRecord(idx, 'news@shop.de');
  assert.equal(trustLevel(idx['news@shop.de']), null, 'einmal aufgefallen -> nie mehr "oft empfangen"');
  noteRecord(idx, { address: 'news@shop.de' }, 'sent', t0);
  assert.equal(trustLevel(idx['news@shop.de']), 'sent', 'angeschrieben zählt trotz Markierung');

  // Krypto-Spam, der wochenlang durchkam: als "recurring" weiter erkannt (kein Bonus, Inhaltsprüfung läuft)
  const ad = mk({ from: ['Wellenreiten <contact@5yngrqr7.com>'], subject: ['Mit Bedacht investieren'] },
    [html('<p>Navigieren im Bitcoin-Abschwung: Warum jetzt Ihr idealer Einstiegspunkt sein könnte!!</p>')]);
  const recurring = analyze(ad, ctx({ history: () => ({ count: 6, level: 'recurring' }) }));
  assert.ok(ids(recurring).includes('investmentPromo') && ids(recurring).includes('randomDomain'));
  assert.ok(!ids(recurring).includes('firstContact'), 'nur der Erstkontakt-Hinweis entfällt');
  assert.equal(recurring.level, 'suspicious');
  const sent = analyze(ad, ctx({ history: () => ({ count: 6, level: 'sent' }) }));
  assert.ok(!ids(sent).includes('investmentPromo'));

  // Marke im Text: bei "recurring" weiter geprüft
  const brand = mk({ from: ['Info <info@kundeninfo-x.de>'], subject: ['Sparkasse: Ihr Konto'] }, [html('<p>Ihre Zahlung ist fehlgeschlagen.</p>')]);
  assert.ok(ids(analyze(brand, ctx({ history: () => ({ count: 6, level: 'recurring' }) }))).includes('brandInContent'));
});

test('0.2.9: Kopfzeilen-Prüfung für den Erstscan und Rückblick-Grenzen', () => {
  assert.deepEqual(headerSuspicion('Max Mustermann <max@firma-mustermann.de>'), []);
  assert.deepEqual(headerSuspicion('Newsletter <news@shop.de>'), []);
  assert.ok(headerSuspicion('PayPal Service <service@evil-shop.com>').includes('brandNameMismatch'));
  assert.ok(headerSuspicion('Info <info@paypal-secure.com>').includes('lookalikeDomain'));
  assert.ok(headerSuspicion('Hallo <contact@5yngrqr7.com>').includes('randomDomain'));
  assert.ok(headerSuspicion('"service@paypal.com" <x@evil.test>').includes('displayNameEmail'));
  assert.equal(historyMonths(undefined), 12);
  assert.equal(historyMonths(6), 6);
  assert.equal(historyMonths(60), 18);
  assert.equal(historyMonths(0), 12);
  assert.equal(historyMonths('abc'), 12);
});

test('DKB-Fall: ausgeschriebener Bankname, kurze Marken als eigenes Wort, Pflicht-Links ins Leere', () => {
  const run = (headers, body) => analyze(mk({ to: 'me@x.de', subject: 'Info', ...headers }, [html(body)]), ctx());
  const dead = '<a href="https://t.co/abc">Jetzt Einstellungen verwalten</a> <a href="#">Impressum</a> <a href="#">Datenschutz</a> <a href="#">Hilfe &amp; FAQ</a>';
  const r = run({ from: 'Deutsche Kreditbank-AG <campaign+x1@kindercomicfestival.de>', subject: 'Neue Funktionen in Ihrer DKB-App' }, '<p>Ihr Konto</p>' + dead);
  assert.ok(ids(r).includes('brandNameMismatch') && ids(r).includes('placeholderLinks'));
  assert.equal(r.level, 'dangerous');
  // echte DKB-Domain: kein Markenvorgeben
  assert.ok(!ids(run({ from: 'Deutsche Kreditbank AG <info@dkb.de>' }, '<p>Hallo</p>')).includes('brandNameMismatch'));
  // kurze Marke nur als großgeschriebenes eigenes Wort, nicht als Wortteil
  assert.ok(ids(run({ from: 'Info <a@neu-x.de>', subject: 'DKB: Ihr Konto wurde gesperrt' }, '<p>Hallo</p>')).includes('brandInContent'));
  assert.ok(!ids(run({ from: 'Info <a@neu-x.de>', subject: 'Ihr Konto: dkbx-Nummer' }, '<p>Hallo</p>')).includes('brandInContent'));
  // ein einzelner Anker-Link oder echte Pflicht-Links sind normal
  assert.ok(!ids(run({ from: 'Shop <a@shop.de>' }, '<a href="#top">Nach oben</a><a href="https://shop.de/impressum">Impressum</a><a href="https://shop.de/datenschutz">Datenschutz</a>')).includes('placeholderLinks'));
  assert.ok(!ids(run({ from: 'Shop <a@shop.de>' }, '<a href="https://shop.de/x">Angebot</a><a href="#">Impressum</a>')).includes('placeholderLinks'));
});

test('Anzeigename ohne Bezug zur Domain: Organisation stark, Personen/Dienste nur schwach', () => {
  const run = (from, c = ctx()) => analyze(mk({ from, to: 'me@x.de', subject: 'Info' }, [html('<p>Hallo</p>')]), c);
  const org = run('Deutsche Kreditbank-AG <campaign+x1@kindercomicfestival.de>');
  assert.ok(ids(org).includes('brandNameMismatch'), 'bekannte Bank: Markenliste greift zuerst');
  const unknownBank = run('Musterstädter Volkskasse AG <info@blumenversand-xy.de>');
  assert.ok(ids(unknownBank).includes('orgNameMismatch'), 'unbekannte Bank: allgemeine Regel');
  assert.equal(unknownBank.level, 'suspicious');
  assert.ok(ids(run('BKK Musterland Krankenkasse <a@pms.saokim.com.vn>')).includes('orgNameMismatch'));
  // Bezug zur Domain vorhanden oder nur Füllwörter: kein Signal
  for (const f of ['Galaxus Deutschland <noreply@galaxus.de>', 'Volksbank Mittelhessen eG <info@vb-mittelhessen.de>',
    'TrainingPeaks.com <messages-no-reply@trainingpeaks.com>', 'Service-Team <info@shop-x.de>', 'Info <a@b.de>']) {
    const r = ids(run(f));
    assert.ok(!r.includes('orgNameMismatch') && !r.includes('nameDomainMismatch'), f);
  }
  // Restaurant über Buchungsdienst, Person auf Firmendomain: schwach, bleibt unauffällig
  for (const f of ["Trattoria Beispiel <reservation@aleno.me>", 'Erika Musterfrau <praxis@radiologie-verbund.example>']) {
    const r = run(f);
    assert.ok(ids(r).includes('nameDomainMismatch'), f);
    assert.equal(r.level, 'normal', f);
  }
  // voll bekannte Absender (angeschrieben): keine Namensprüfung
  assert.ok(!ids(run('Musterstädter Volkskasse AG <info@blumenversand-xy.de>', ctx({ history: () => ({ count: 5, level: 'sent' }) }))).includes('orgNameMismatch'));
  // Kürzel-Domains echter Organisationen (auch außerhalb der Bankliste)
  for (const f of ['Musterhafener Stadtwerke AG <info@musta.de>', 'Stadtwerke Musterstadt GmbH <service@swm.de>', 'Kreiskasse Musterland <info@kkml.de>']) {
    assert.ok(!ids(run(f)).includes('orgNameMismatch'), f);
  }
  assert.ok(ids(run('Deutsche Kreditbank-AG <campaign+x1@kindercomicfestival.de>')).includes('brandNameMismatch'));
});

test('Schicht 1: aus dem Postfach gelernte Absendernamen', () => {
  // Schlüssel ohne Rechtsform/Füllwörter; zu kurze oder rein generische Namen ergeben keinen Schlüssel
  assert.equal(orgKey('Velomarkt Deutschland GmbH'), 'velomarkt');
  assert.equal(orgKey('OTTO'), 'otto');
  assert.equal(orgKey('Rechnung'), '');
  assert.equal(orgKey('Info'), '');
  // gelernt wird nur, wenn der Name zur Domain passt (nicht zum lokalen Teil, nicht bei fremder Domain)
  assert.ok(nameMatchesDomain('Velomarkt', 'velomarkt.de'));
  assert.ok(nameMatchesDomain('Volksbank Mittelhessen eG', 'vb-mittelhessen.de'));
  assert.ok(!nameMatchesDomain('Deutsche Kreditbank-AG', 'kindercomicfestival.de'), 'Phisher wird nie gelernt');
  assert.ok(!nameMatchesDomain('Decathlon', 'erply.io'));

  const learnedNames = new Map([['velomarkt', new Set(['velomarkt.de'])]]);
  const run = (from, extra = {}) => analyze(mk({ from, to: 'me@x.de', subject: 'Ihre Bestellung' }, [html('<p>Hallo</p>')]), ctx({ learnedNames, ...extra }));
  const fake = run('Velomarkt <info@kundenkonto-check.net>');
  assert.ok(ids(fake).includes('learnedNameMismatch'));
  assert.equal(fake.level, 'suspicious');
  // gleiche Domain, andere Adresse; gleiche Marke unter anderer Endung; bereits etablierte Adresse: kein Treffer
  assert.ok(!ids(run('Velomarkt <service@velomarkt.de>')).includes('learnedNameMismatch'));
  assert.ok(!ids(run('Velomarkt <news@velomarkt.ch>')).includes('learnedNameMismatch'));
  assert.ok(!ids(run('Velomarkt <news@erply.io>', { history: () => ({ count: 6, level: 'recurring' }) })).includes('learnedNameMismatch'));
});

test('Schicht 2: Banken aus Wikidata – keine Fehlalarme für echte Banken, Fälschungen höchstens verdächtig', async () => {
  const { default: BANKS } = await import('../source/src/data/banks-wikidata.js');
  assert.ok(BANKS.length > 1000, 'Liste vorhanden');
  // keine echte Bank löst von ihrer eigenen Domain ein Absender-Signal aus
  let fp = 0;
  for (const b of BANKS) for (const n of [b.n, ...(b.a ?? [])]) for (const d of b.d) if (headerSuspicion(`"${n.replace(/"/g, '')}" <info@${d}>`).length) fp++;
  assert.equal(fp, 0);
  const run = (from) => analyze(mk({ from, to: 'me@x.de', subject: 'Info' }, [html('<p>Hallo</p>')]), ctx());
  // regionale Banken außerhalb der Liste: Bankmuster gilt, kein Lookalike
  for (const f of ['Sparkasse Musterstadt <info@sparkasse-musterstadt.de>', 'Kreissparkasse Musterkreis <info@ksk-musterkreis.de>', 'Volksbank Musterland eG <info@vb-musterland.de>']) {
    assert.equal(run(f).level, 'normal', f);
  }
  // Fälschung einer Wikidata-Bank: verdächtig; Köder-Wörter in der Domain bleiben Lookalike
  const fake = run('Kreissparkasse Waiblingen <info@kundenservice-check.de>');
  assert.ok(ids(fake).includes('bankNameMismatch'));
  assert.equal(fake.level, 'suspicious');
  assert.ok(ids(run('Sparkasse <info@sparkasse-sicherheit.de>')).includes('lookalikeDomain'));
  // Vornamen und Gattungsbegriffe aus der Liste ("Alex", "Bank") sind keine Bankfälschung
  assert.ok(!ids(run('Alex <alex@meinefirma.de>')).includes('bankNameMismatch'));
  assert.ok(!ids(run('Bank <info@irgendwas.de>')).includes('bankNameMismatch'));
});

test('"Oft empfangen" nimmt nur den Erstkontakt-Hinweis weg; Erstscan markiert Organisations-/Banknamen ohne Bezug', () => {
  const recurring = ctx({ history: () => ({ count: 5, level: 'recurring' }) });
  const run = (from, c) => analyze(mk({ from, to: 'me@x.de', subject: 'Info' }, [html('<p>Hallo</p>')]), c);
  assert.ok(ids(run('Musterstädter Volkskasse AG <info@blumenversand-xy.de>', recurring)).includes('orgNameMismatch'));
  assert.ok(ids(run('Kreissparkasse Waiblingen <info@kundenservice-check.de>', recurring)).includes('bankNameMismatch'));
  assert.equal(run('Musterstädter Volkskasse AG <info@blumenversand-xy.de>', recurring).level, 'normal', 'allein keine Warnung');
  assert.ok(headerSuspicion('Deutsche Kreditbank-AG <campaign+x@kindercomicfestival.de>').length > 0);
  assert.ok(headerSuspicion('Kreissparkasse Waiblingen <info@kundenservice-check.de>').includes('bankNameMismatch'));
  assert.ok(headerSuspicion('Musterstädter Volkskasse AG <info@blumenversand-xy.de>').includes('orgNameMismatch'));
});

test('Adressbücher: "Gesammelte Adressen" zählt standardmäßig nicht, gespeicherte Auswahl gilt genau', async () => {
  const { isCollectedBook, trustedBookIds } = await import('../source/src/lib/contacts.js');
  const books = [{ id: 'a', name: 'Persönliches Adressbuch' }, { id: 'b', name: 'Gesammelte Adressen' }, { id: 'c', name: 'Firma (CardDAV)' }, { id: 'd', name: 'Collected Addresses' }];
  assert.ok(isCollectedBook(books[1]) && isCollectedBook(books[3]) && !isCollectedBook(books[0]));
  assert.deepEqual(trustedBookIds(books, null), ['a', 'c']);
  assert.deepEqual(trustedBookIds(books, ['b']), ['b']);
  assert.deepEqual(trustedBookIds(books, []), []);
});
