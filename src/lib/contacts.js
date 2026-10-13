// Kontaktdaten aus der Adressbuch-API: neuere Versionen liefern eine vCard,
// ältere ein properties-Objekt. Beides wird auf { names, emails } abgebildet.

/** Minimaler vCard-Parser (RFC 6350): FN, N, NICKNAME, EMAIL. */
export function parseVCard(text) {
  const names = [];
  const emails = [];
  const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const head = line.slice(0, idx).replace(/^[\w-]+\./, '');   // Gruppenpräfix "item1."
    const prop = head.split(';')[0].toUpperCase();
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    if (prop === 'FN' || prop === 'NICKNAME') names.push(value);
    else if (prop === 'N') {
      const [family = '', given = '', , prefix = '', suffix = ''] = value.split(';');
      names.push([given, family].filter(Boolean).join(' '));
      void prefix; void suffix;
    } else if (prop === 'EMAIL') emails.push(value.replace(/^mailto:/i, '').toLowerCase());
  }
  return { names: names.filter(Boolean), emails };
}

export function contactInfo(contact) {
  if (contact.vCard) return parseVCard(contact.vCard);
  const p = contact.properties || {};
  return {
    names: [p.DisplayName, [p.FirstName, p.LastName].filter(Boolean).join(' '), p.NickName].filter(Boolean),
    emails: [p.PrimaryEmail, p.SecondEmail].filter(Boolean).map((e) => e.toLowerCase()),
  };
}

// "Gesammelte Adressen": Thunderbird legt dort automatisch jede Adresse ab, an die man schreibt – auch die eines
// Betrügers, dem man einmal geantwortet hat. Deshalb zählt dieses Buch standardmäßig nicht als vertrauenswürdig.
// Die API liefert keinen festen Typ dafür; erkannt wird es am (übersetzten) Namen.
const COLLECTED = /^(gesammelte adressen|collected addresses|adresses collect[ée]es|direcciones recopiladas|indirizzi raccolti|verzamelde adressen|adresy zebrane|endereços coletados)$/i;
export const isCollectedBook = (book) => COLLECTED.test(String(book?.name ?? '').trim());

/** IDs der Adressbücher, die geprüft werden: gespeicherte Auswahl oder (Standard) alle außer "Gesammelte Adressen". */
export function trustedBookIds(books, contactBookIds) {
  if (Array.isArray(contactBookIds)) return books.filter((b) => contactBookIds.includes(b.id)).map((b) => b.id);
  return books.filter((b) => !isCollectedBook(b)).map((b) => b.id);
}
