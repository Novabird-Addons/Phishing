// Antworten der NovaBird-Extension auf "phish:extract" (Vertrag: docs/ki-schnittstelle.md).
// Das Sprachmodell liest fremden Mailtext – eine Phishing-Mail kann versuchen, seine Antwort zu steuern. Deshalb werden
// nur bekannte Felder mit gültigem Typ übernommen, und die Felder können im Analyzer nur Signale hinzufügen.

export const NOVABIRD_ID = 'novabird-extension@novabird';
const ASKS = ['login', 'payment', 'download', 'reply', 'call', 'none'];
const HOST = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Geprüfte Fakten aus einer Antwort (auch aus einer Fehlerantwort, die nur `injection` trägt), sonst null.
 * @returns {{claimedOrg:string|null, claimedDomain:string|null, asksFor:string, urgency:boolean, injection:boolean, model:string}|null}
 */
export function parseAiFacts(r) {
  if (!r || typeof r !== 'object') return null;
  const injection = r.injection === true;
  if (r.ok !== true) return typeof r.injection === 'boolean' ? { claimedOrg: null, claimedDomain: null, asksFor: 'none', urgency: false, injection, model: '' } : null;
  const org = typeof r.claimedOrg === 'string' ? r.claimedOrg.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  const dom = typeof r.claimedDomain === 'string' ? r.claimedDomain.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '') : '';
  return {
    claimedOrg: org.length >= 2 ? org : null,
    claimedDomain: HOST.test(dom) ? dom : null,
    asksFor: ASKS.includes(r.asksFor) ? r.asksFor : 'none',
    urgency: r.urgency === true,
    injection,
    model: typeof r.model === 'string' ? r.model.slice(0, 60) : '',
  };
}
