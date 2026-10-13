// Holt Banken in EU-Ländern aus Wikidata (CC0) und schreibt src/data/banks-wikidata.js.
// Nur zum Erzeugen der Datei beim Entwickeln – das Add-on selbst stellt keine Verbindung her.
// Aufruf: node tools/fetch-wikidata-banks.mjs [Länderkürzel ...]   (ohne Angabe: alle EU-Länder)
import fs from 'node:fs';
import { registrableDomain } from '../src/lib/domains.js';

// EU-Mitgliedstaaten: Kürzel -> Wikidata-ID und Sprachen für die Namen
const COUNTRIES = {
  de: ['Q183', 'de'], at: ['Q40', 'de'], be: ['Q31', 'nl,fr,de'], bg: ['Q219', 'bg'], hr: ['Q224', 'hr'], cy: ['Q229', 'el'],
  cz: ['Q213', 'cs'], dk: ['Q35', 'da'], ee: ['Q191', 'et'], fi: ['Q33', 'fi,sv'], fr: ['Q142', 'fr'], gr: ['Q41', 'el'],
  hu: ['Q28', 'hu'], ie: ['Q27', 'en'], it: ['Q38', 'it'], lv: ['Q211', 'lv'], lt: ['Q37', 'lt'], lu: ['Q32', 'fr,de,lb'],
  mt: ['Q233', 'mt'], nl: ['Q55', 'nl'], pl: ['Q36', 'pl'], pt: ['Q45', 'pt'], ro: ['Q218', 'ro'], sk: ['Q214', 'sk'],
  si: ['Q215', 'sl'], es: ['Q29', 'es'], se: ['Q34', 'sv'],
};
// Websites auf Plattformen sagen nichts über die Bank aus
const PLATFORM = /(^|\.)(facebook|instagram|linkedin|twitter|x|youtube|google|wixsite|wordpress|blogspot|jimdo|business\.site|github)\.(com|io|site)$/;

async function query(sparql) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql), {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'novabird-phishing/0.2 (brand list generator; offline add-on)' },
      signal: AbortSignal.timeout(90_000),
    }).catch((e) => ({ ok: false, status: e.message }));
    if (res.ok) return (await res.json()).results.bindings;
    console.warn(`  Versuch ${attempt}: ${res.status}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  throw new Error('Wikidata nicht erreichbar');
}

const bankQuery = (qid, langs) => `
SELECT ?b ?bLabel (GROUP_CONCAT(DISTINCT ?site; separator=" ") AS ?sites) (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE {
  ?b wdt:P31/wdt:P279* wd:Q22687 ; wdt:P17 wd:${qid} ; wdt:P856 ?site .
  FILTER NOT EXISTS { ?b wdt:P576 [] }
  OPTIONAL { ?b skos:altLabel ?alt FILTER(LANG(?alt) IN (${[...new Set([...langs.split(','), 'en'])].map((l) => `"${l}"`).join(',')})) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs},en". }
} GROUP BY ?b ?bLabel`;

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(COUNTRIES);
const out = [];
for (const cc of wanted) {
  const [qid, langs] = COUNTRIES[cc];
  const rows = await query(bankQuery(qid, langs));
  let kept = 0;
  for (const r of rows) {
    const name = r.bLabel.value;
    if (/^Q\d+$/.test(name)) continue;                    // ohne Namen in den gewünschten Sprachen
    const domains = [...new Set(r.sites.value.split(' ').map((u) => {
      try { return registrableDomain(new URL(u).hostname.replace(/^www\./, '')); } catch { return null; }
    }).filter((d) => d && !PLATFORM.test(d)))];
    if (!domains.length) continue;
    const aliases = [...new Set((r.alts?.value ?? '').split('|').filter((a) => a && a !== name && a.length <= 60))].slice(0, 4);
    out.push({ c: cc, n: name, a: aliases.length ? aliases : undefined, d: domains, q: r.b.value.split('/').pop() });
    kept++;
  }
  console.log(`${cc}: ${rows.length} Treffer, ${kept} übernommen`);
}
out.sort((x, y) => x.c.localeCompare(y.c) || x.n.localeCompare(y.n));
const file = new URL('../src/data/banks-wikidata.js', import.meta.url);
fs.writeFileSync(file, `// Banken in EU-Ländern aus Wikidata (CC0 1.0, https://www.wikidata.org), erzeugt mit tools/fetch-wikidata-banks.mjs
// am ${new Date().toISOString().slice(0, 10)}. Nicht von Hand bearbeiten. c = Land, n = Name, a = weitere Namen, d = Domains, q = Wikidata-ID.
export default ${JSON.stringify(out)};
`);
console.log(`${out.length} Banken -> ${file.pathname} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
