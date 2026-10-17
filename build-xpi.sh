#!/usr/bin/env bash
# Baut dist/novabird-phishing-<version>.xpi (ungesigniert) aus source/ plus LICENSE, THIRD_PARTY.md und README.md.
# Tests, Testdaten und Doku bleiben draußen.
set -euo pipefail
cd "$(dirname "$0")"
# Unter Windows ist "python3" oft nur der Store-Platzhalter (existiert, läuft aber nicht) – deshalb ausprobieren statt nur suchen
PYTHON=python3
"$PYTHON" -c '' 2>/dev/null || PYTHON=python
VERSION=$("$PYTHON" -c "import json;print(json.load(open('source/manifest.json'))['version'])")
OUT="dist/novabird-phishing-$VERSION.xpi"
mkdir -p dist
rm -f "$OUT"
"$PYTHON" - "$OUT" <<'PY'
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
