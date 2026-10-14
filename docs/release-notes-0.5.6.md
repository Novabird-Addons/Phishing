<h2>Novabird-phishing 0.5.6</h2>
<p><strong>Bug-fix release.</strong></p>
<ul>
  <li><strong>“Trust this sender” works again.</strong> Clicking it did nothing because Thunderbird suppresses browser dialogs in the message pane. The confirmation now appears right inside the banner (two steps for red warnings). Afterwards the banner and the warning tag in the message list disappear.</li>
  <li><strong>Fewer false alarms:</strong> a reply address with the same company name under a different ending (e.g. sender <code>enjoy.eset.com</code>, replies to <code>eset.de</code>) is no longer reported as a foreign domain – if the sender is confirmed by DKIM or already known.</li>
</ul>
<p><strong>Installation:</strong> download <code>novabird-phishing-0.5.6.xpi</code> below → Thunderbird: Add-ons and Themes → gear icon → <em>Install Add-on From File</em>. If you still have a version older than 0.5.0 installed (old ID), please remove it.</p>
<p>🇩🇪 <strong>Kurz auf Deutsch:</strong> „Diesem Absender vertrauen“ funktioniert wieder (Rückfrage jetzt im Banner, danach verschwinden Banner und Tag). Weniger Fehlalarme bei Antwortadressen derselben Firma mit anderer Endung (eset.com → eset.de).</p>
