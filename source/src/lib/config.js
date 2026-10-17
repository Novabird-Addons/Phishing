export const DEFAULT_CONFIG = {
  // 'shadow': nur protokollieren (kein Tag, kein Banner); 'active': voll.
  mode: 'active',
  thresholds: { suspicious: 30, dangerous: 60 },
  weights: {
    dmarcFail: 45, spfFail: 25, dkimFail: 15,
    contactImpersonation: 40, replyNoThread: 30, replyThreadUnknown: 30,
    brandNameMismatch: 40, lookalikeDomain: 40, mixedScript: 30,
    displayNameEmail: 25, linkMismatch: 35, loginForm: 45,
    riskyAttachment: 35, passwordArchive: 20, disguisedFile: 60, archiveRisky: 35, badTld: 8,
    firstContact: 10, firstContactClaims: 15,
    replyToForeign: 20, ipLink: 20, shortener: 15, urlUserinfo: 30,
    brandInContent: 25, abusedHost: 15, imageLinkForeign: 30, qrForeignLink: 25, imageBrandMismatch: 45, imageCta: 10, extortion: 70, fillerText: 20, invisiblePadding: 8, randomDomain: 20, investmentPromo: 25, redirectParam: 10, placeholderLinks: 20, orgNameMismatch: 20, learnedNameMismatch: 30, bankNameMismatch: 25, nameDomainMismatch: 10, pressureWords: 8, imageOnly: 8, hiddenText: 6,
  },
  // Signale mit Mindeststufe: allein ausreichend für "verdächtig".
  force: {
    contactImpersonation: 'suspicious',
    replyNoThread: 'suspicious',
    replyThreadUnknown: 'suspicious',
    extortion: 'dangerous',   // Erpressung ist eindeutig, unabhängig vom Absender
    disguisedFile: 'dangerous',  // getarnter Anhang ("Rechnung.pdf" ist ein Programm): kein harmloser Grund denkbar
    archiveRisky: 'suspicious',  // Programm/Skript im ZIP: immer ansehen; rot erst zusammen mit weiteren Hinweisen
  },
  // Signalklassen; reine "weak"-Treffer können nie warnen.
  weak: ['firstContact', 'nameDomainMismatch', 'pressureWords', 'imageOnly', 'hiddenText', 'shortener', 'redirectParam', 'invisiblePadding', 'badTld'],
  knownSenderBonus: -15,
  trustedAuthservIds: [],
  ownDomains: [],
  tagMessages: true,
  // Text in eingebetteten Bildern lesen (OCR, lokal).
  ocr: true,
  // OCR-Sprachen (höchstens 3). Deutsch und Englisch sind mitgeliefert, weitere lassen sich herunterladen.
  ocrLanguages: ['deu', 'eng'],
  // Sprachen gleichzeitig prüfen (ein Worker je Sprache, schneller, aber mehr Speicher) statt nacheinander.
  ocrParallel: true,
  // Nachgeladene Fremdbilder prüfen: holt jedes Bild ein zweites Mal (nur mit Zustimmung + Host-Berechtigung).
  scanRemoteImages: false,
  trustedSenders: [],
  // Ordner, die nicht in die Absenderhistorie zählen (Schlüssel "<konto>:<pfad>", z. B. eine Spam-Sammlung).
  historyExcludedFolders: [],
  // Rückblick des Erstscans in Monaten (1–18). Ältere Mails sagen wenig darüber, wer heute schreibt.
  historyMonths: 12,
  // IDs der Adressbücher, gegen die geprüft wird; null = alle (auch künftige).
  contactBookIds: null,
};

export function mergeConfig(stored) {
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...stored?.thresholds },
    weights: { ...DEFAULT_CONFIG.weights, ...stored?.weights },
    force: { ...DEFAULT_CONFIG.force, ...stored?.force },
  };
}
