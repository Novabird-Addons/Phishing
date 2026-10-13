#!/usr/bin/env bash
# Baut eine Testkopie des Add-ons (aus source/) mit Fremdbild-Prüfung; Modus ist ohnehin "active".
set -euo pipefail
cd "$(dirname "$0")/../.."
rm -rf work/testext && mkdir -p work/testext
cp -r source/. work/testext/
sed -i "s/mode: 'shadow'/mode: 'active'/" work/testext/src/lib/config.js
# Fremdbild-Prüfung an (mit Host-Berechtigung), außer bei 'noremote'
if [ "${1:-}" != "noremote" ]; then
  sed -i "s/scanRemoteImages: false/scanRemoteImages: true/" work/testext/src/lib/config.js
  python3 - <<'PY'
import json
m = json.load(open('work/testext/manifest.json'))
m['host_permissions'] = ['<all_urls>']
json.dump(m, open('work/testext/manifest.json', 'w'), indent=2)
PY
fi

# Modus "langs": Französisch beim Start nachinstallieren (echter Download, mit Prüfsumme) und aktivieren
if [ "${1:-}" = "langs" ]; then
  sed -i "s/ocrLanguages: \['deu', 'eng'\]/ocrLanguages: ['deu', 'eng', 'fra']/" work/testext/src/lib/config.js
  cat >> work/testext/src/background.js <<'JS'
import('./ocr-models.js').then((m) => m.installLanguage('fra')).catch((e) => console.error('fra-Installation fehlgeschlagen', e?.message));
JS
fi

# Modus-Zusatz "seq": Sprachen nacheinander statt parallel (Vergleichsmessung)
if [ "${2:-}" = "seq" ]; then sed -i "s/ocrParallel: true/ocrParallel: false/" work/testext/src/lib/config.js; fi
