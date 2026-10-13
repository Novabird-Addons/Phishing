#!/usr/bin/env bash
# Baut dist/novabird-phishing-<version>.xpi (ungesigniert). Tests, Testdaten und Doku bleiben draußen.
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/novabird-phishing-$VERSION.xpi"
rm -f "$OUT"
python3 - "$OUT" <<'PY'
import sys, zipfile, os
out = sys.argv[1]
items = ['manifest.json', 'LICENSE', 'THIRD_PARTY.md', 'README.md', '_locales', 'src', 'options', 'onboarding', 'anon']
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for item in items:
        if os.path.isdir(item):
            for root, _, files in os.walk(item):
                for f in sorted(files):
                    p = os.path.join(root, f)
                    z.write(p, p)
        else:
            z.write(item, item)
PY
echo "$OUT"
unzip -l "$OUT" | tail -n +4 | awk '{print $1, $4}' | head -40
sha256sum "$OUT"
# Neueste Version plus die 3 vorherigen behalten, ältere löschen
ls -1 dist/*.xpi | sed -E 's/.*-([0-9.]+)\.xpi$/\1 &/' | sort -V | awk '{print $2}' | head -n -4 | xargs -r rm -v
