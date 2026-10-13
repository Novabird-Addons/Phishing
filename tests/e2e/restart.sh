#!/usr/bin/env bash
# Beendet ein laufendes Test-Thunderbird (per Marionette; Snap-Prozesse lassen sich nicht killen)
# und startet es mit frischem Profil neu.
cd "$(dirname "$0")/../.."
node -e '
import("./tests/e2e/marionette.mjs").then(async ({Marionette})=>{
  const m=new Marionette(); try { await m.connect(); await m.send("WebDriver:NewSession",{capabilities:{}});
  await m.send("Marionette:Quit",{flags:["eForceQuit"]}).catch(()=>{}); } catch {} m.close?.(); });' 2>/dev/null
sleep 4
./tests/e2e/make-profile.sh testprofile >/dev/null
(setsid /snap/bin/thunderbird --headless --marionette --remote-allow-system-access --no-remote \
  --profile "$PWD/testprofile" > /tmp/tb-e2e.log 2>&1 &)
for i in $(seq 1 40); do ss -ltn | grep -q 2828 && break; sleep 0.5; done
sleep 3
