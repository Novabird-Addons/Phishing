<h2>Novabird-phishing 0.6.0</h2>
<p><strong>Closer look at attachments</strong> – thanks to user feedback.</p>
<ul>
  <li><strong>Disguised attachments get a red warning:</strong> a document ending in front of a dangerous one (<code>invoice.pdf.exe</code>), hidden characters that reverse the writing direction, and files whose content doesn't match their name. The add-on reads the first bytes of every attachment, so an “invoice.pdf” that is really a Windows program, or a “scan.jpg” that is really a web page, is caught. Names like <code>Invoice.2024.pdf</code> or <code>backup.tar.gz</code> are fine.</li>
  <li><strong>Looks inside ZIP files</strong> without unpacking them. A program, script or web page inside gives at least “Caution”, even from known senders; red together with other signs.</li>
  <li><strong>Domain endings popular with spammers</strong> (<code>.xyz</code>, <code>.top</code>, <code>.tk</code>, <code>.zip</code> …) in the sender or in links count as a weak hint – never a reason to warn on their own.</li>
  <li>More dangerous file types recognised (<code>.com</code>, <code>.pif</code>, <code>.cpl</code>, <code>.reg</code>, <code>.vhd(x)</code>, <code>.appx</code>, <code>.msix</code>, <code>.url</code>).</li>
</ul>
<p>Everything still runs locally – no attachment and no part of a message leaves your computer.</p>
<p><strong>Installation:</strong> download <code>novabird-phishing-0.6.0.xpi</code> below → Thunderbird: Add-ons and Themes → gear icon → <em>Install Add-on From File</em>. If you still have a version older than 0.5.0 installed (old ID), please remove it.</p>
<p>🇩🇪 <strong>Kurz auf Deutsch:</strong> Getarnte Anhänge (<code>Rechnung.pdf.exe</code>, eine „PDF“, die in Wahrheit ein Programm ist) werden rot gemeldet. Das Add-on schaut in ZIP-Dateien und warnt bei Programmen darin. Bei Spammern beliebte Domain-Endungen (<code>.xyz</code>, <code>.top</code> …) zählen als schwacher Zusatzhinweis. Alles weiterhin lokal.</p>
