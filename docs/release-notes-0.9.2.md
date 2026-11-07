<h2>Novabird-phishing 0.9.2</h2>
<p><strong>The first release since 0.6.0: it includes all changes from 0.9.0 and 0.9.1, which were not published separately.</strong></p>

<h3>New in 0.9.2 – links locked from the moment an email opens</h3>
<ul>
  <li><strong>No gap while the check runs:</strong> until now, links in a dangerous email opened without a question during the first seconds, while the check was still running (longer with text recognition in images or the local AI). Now a click during the check waits up to five seconds for the result: harmless emails then open the link without a question, dangerous ones ask first.</li>
  <li><strong>Unchecked is not safe:</strong> if the check fails, times out or is not possible (several messages shown at once), you are asked “This message could not be checked. Open the link anyway?” instead of the link simply opening.</li>
  <li><strong>All link types:</strong> besides web links, <code>file:</code>, <code>smb:</code>, <code>ftp:</code> and Windows protocol links such as <code>search-ms:</code> are covered too. Only <code>mailto:</code>, <code>tel:</code> and jumps within the email stay free. For a dangerous email, only web links can be opened.</li>
  <li><strong>A dialog that always works:</strong> the question is now shown inside the email, with “Cancel” preselected. Thunderbird silently suppresses the usual browser dialog in the message area (for example in conversation views).</li>
</ul>

<h3>From 0.9.1 – trust you can review, harder to evade</h3>
<ul>
  <li><strong>Important notice on first start:</strong> the setup dialog explains that the filter works to the best of its knowledge but is not perfect – a missing warning is no guarantee, and every click, reply, attachment and payment remains your own decision. Setup continues after you tick “I have read and understood this”. Existing users see the dialog once after the update; the same text is always shown at the top of the settings.</li>
  <li><strong>Trusted senders you can review:</strong> the list in the settings shows for each address since when it is trusted, whether it was added from the banner or by hand, the rating at the time and the reasons of the warning. Every entry has a “Remove” button. Emails rated “dangerous” can no longer be trusted from the banner – only in the settings.</li>
  <li><strong>Trust has limits:</strong> for trusted senders, DKIM failures, disguised attachments (“Invoice.pdf.exe”) and extortion now stay visible – a hijacked account is not a trusted sender.</li>
  <li><strong>Errors are no all-clear:</strong> if an email cannot be checked, a grey “Check not possible” banner appears instead of nothing.</li>
  <li><strong>Harder to evade:</strong> very long emails are checked at the beginning and the end; forged <code>Authentication-Results</code> headers inserted by the sender are ignored (the add-on learns per account which header your own mail server writes); malicious HTML can no longer stall the check (all parsing now runs in linear time).</li>
</ul>

<h3>From 0.9.0 – fewer false alarms, optional local AI, tidier settings</h3>
<ul>
  <li><strong>Reference to earlier emails:</strong> if a new sender – say, a parcel service – quotes an order, tracking or invoice number that already appeared in an earlier trustworthy email (one you sent, one from a contact or regular sender, or a DKIM-signed one from another company that is at least 12 hours older), the “new sender” hints no longer count. Signs of forgery (DMARC failure, look-alike domain, deceptive links, disguised attachments) always stay.</li>
  <li><strong>Optional local AI via the NovaBird extension:</strong> if NovaBird 2.0 is installed and its <em>phishing check</em> is switched on, the add-on also asks its AI. The model only reports facts – who the email pretends to be and what it wants (sign-in, payment, download, a phone call). New warnings: an email that presents itself as an organisation that does not match the sender domain while asking for something, and hidden instructions to AI assistants inside an email. <strong>The AI can only strengthen warnings, never lift them</strong>, and is only used with a model on your own computer or network – never a cloud service. Without NovaBird nothing changes.</li>
  <li><strong>New detections:</strong> obfuscated script code in HTML attachments (fake login pages as “invoice.html”), links in calendar invitations (<code>.ics</code>, meeting services excepted), and extortion text inside images.</li>
  <li><strong>Fewer “Caution” banners on genuine emails:</strong> truncated reply-to addresses (PayPal), payment providers with the merchant’s helpdesk as reply-to, and investment talk in subscribed, DKIM-signed newsletters.</li>
  <li><strong>Settings page reorganised</strong> into sections, works in light and dark themes, with a coloured status dot for the local AI (green = connected). With NovaBird, the settings also appear under <em>Settings → NovaBird</em> as the “Phishing protection” tab. The add-on now has its own icon.</li>
</ul>

<p>Everything still runs locally – no part of a message leaves your computer or network.</p>
<p><strong>Installation:</strong> download <code>novabird-phishing-0.9.2.xpi</code> below → Thunderbird: Add-ons and Themes → gear icon → <em>Install Add-on From File</em>.</p>

<p>🇩🇪 <strong>Kurz auf Deutsch:</strong> Erste Veröffentlichung seit 0.6.0, mit allem aus 0.9.0, 0.9.1 und 0.9.2.
<strong>0.9.2:</strong> Links sind vom Öffnen der Mail an gesperrt. Wer klickt, während die Mail noch geprüft wird, wartet höchstens fünf Sekunden: Harmlose Mails öffnen den Link danach ohne Rückfrage, gefährliche fragen nach. Scheitert die Prüfung, fragt der Schutz „Diese Mail konnte nicht geprüft werden. Link trotzdem öffnen?“. Das gilt auch für <code>file:</code>-, <code>smb:</code>- und Windows-Protokoll-Links; frei bleiben nur <code>mailto:</code>, <code>tel:</code> und Sprünge innerhalb der Mail.
<strong>0.9.1:</strong> Beim ersten Start erklärt ein Hinweis, dass der Filter nach bestem Wissen arbeitet, aber nicht perfekt ist. Die Liste der vertrauten Absender zeigt Datum, Herkunft, Bewertung und Gründe und hat einen „Entfernen“-Knopf; „gefährliche“ Mails lassen sich nicht mehr im Banner freigeben. Prüffehler zeigen grau „Prüfung nicht möglich“, lange Mails werden am Anfang und Ende geprüft, gefälschte Authentication-Results zählen nicht mehr, und bösartiges HTML kann die Prüfung nicht mehr aufhalten.
<strong>0.9.0:</strong> Nennt ein neuer Absender (etwa ein Paketdienst) eine Bestell- oder Sendungsnummer aus einer früheren echten Mail, entfällt der Hinweis „neuer Absender“. Optional fragt der Schutz die lokale KI der NovaBird-Extension 2.0 mit – sie kann Warnungen nur verstärken, nie aufheben, und läuft nur im eigenen Rechner oder Netz. Dazu verschleierte HTML-Anhänge, Links in Kalender-Einladungen, Erpressung in Bildern, weniger Fehlalarme und eine neu gegliederte Einstellungsseite.</p>
