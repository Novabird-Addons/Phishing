#!/usr/bin/env bash
# Baut dist/novabird-phishing-<version>.xpi (ungesigniert) aus source/ plus LICENSE, THIRD_PARTY.md und README.md.
# Tests, Testdaten und Doku bleiben draußen.
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(python3 -c "import json;print(json.load(open('source/manifest.json'))['version'])")
OUT="dist/novabird-phishing-$VERSION.xpi"
rm -f "$OUT"
python3 - "$OUT" <<'PY'
import sys, zipfile, os
out = sys.argv[1]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    # Inhalt von source/ liegt im XPI auf oberster Ebene (manifest.json, src/, options/ …)
    for root, _, files in sorted(os.walk('source')):
        for f in sorted(files):
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, 'source'))
    for item in ['LICENSE', 'THIRD_PARTY.md', 'README.md']:
        z.write(item, item)
PY
echo "$OUT"
unzip -l "$OUT" | tail -n +4 | awk '{print $1, $4}' | head -40
sha256sum "$OUT"
# Neueste Version plus die 3 vorherigen behalten, ältere löschen
ls -1 dist/*.xpi | sed -E 's/.*-([0-9.]+)\.xpi$/\1 &/' | sort -V | awk '{print $2}' | head -n -4 | xargs -r rm -v
