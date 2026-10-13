#!/usr/bin/env bash
# Erzeugt ein frisches Thunderbird-Testprofil mit lokalem Konto und Test-Mails.
# Aufruf: make-profile.sh <profil-verzeichnis>
set -euo pipefail
P="$(realpath -m "$1")"
rm -rf "$P"
mkdir -p "$P/Mail/Local Folders"
cat > "$P/user.js" <<JS
user_pref("marionette.enabled", true);
user_pref("marionette.port", 2828);
user_pref("xpinstall.signatures.required", false);
user_pref("extensions.autoDisableScopes", 0);
user_pref("extensions.experiments.enabled", true);
user_pref("mail.shell.checkDefaultClient", false);
user_pref("mail.provider.suppress_dialog_on_startup", true);
user_pref("mailnews.start_page.enabled", false);
user_pref("app.update.enabled", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("mail.rights.version", 1);
user_pref("mailnews.message_display.disable_remote_image", false);
user_pref("mail.accountmanager.accounts", "account1");
user_pref("mail.accountmanager.defaultaccount", "account1");
user_pref("mail.accountmanager.localfoldersserver", "server1");
user_pref("mail.account.account1.server", "server1");
user_pref("mail.server.server1.type", "none");
user_pref("mail.server.server1.hostname", "Local Folders");
user_pref("mail.server.server1.userName", "nobody");
user_pref("mail.server.server1.name", "Local Folders");
user_pref("mail.server.server1.directory", "$P/Mail/Local Folders");
user_pref("mail.server.server1.storeContractID", "@mozilla.org/msgstore/berkeleystore;1");
JS
echo "$P"
