// Was darf ein Klick auf einen Link in der angezeigten Mail? Läuft vor banner.js im selben Skript-Bereich
// (message_display_scripts) und wird in tests/linkpolicy.test.js geprüft.
// status: 'pending'   – Prüfung läuft noch: Klick anhalten und kurz warten
//         'done'      – Bewertung liegt vor (danger = "gefährlich")
//         'unchecked' – Prüffehler, Zeitlimit oder keine Bewertung (mehrere Mails angezeigt)
//         'off'       – Schattenmodus: nichts sichtbar ändern
// Ergebnis: 'allow' | 'wait' | 'confirmDanger' | 'confirmUnchecked' | 'blockScheme'
// Frei bleiben nur mailto:, tel: und Sprungmarken in der Mail selbst; alle anderen Schemata (file:, smb:, ms-…)
// zählen wie Web-Links – bei "gefährlich" öffnet der Schutz aber nur http(s).
var ppLinkPolicy = function (status, danger, href, rawHref) {
  if (status === 'off') return 'allow';
  if (String(rawHref ?? '').trim().startsWith('#')) return 'allow';
  const scheme = (String(href).match(/^([a-z][a-z0-9+.-]*):/i)?.[1] ?? '').toLowerCase();
  if (scheme === 'mailto' || scheme === 'tel') return 'allow';
  if (status === 'pending') return 'wait';
  if (status === 'done') return !danger ? 'allow' : scheme === 'http' || scheme === 'https' ? 'confirmDanger' : 'blockScheme';
  return 'confirmUnchecked';
};
