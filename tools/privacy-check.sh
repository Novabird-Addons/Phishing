#!/usr/bin/env bash
# Sucht persönliche Daten, bevor etwas das Haus verlässt: in den Dateien des Repositorys, in Commit-Texten, die noch
# nicht gepusht sind, und in übergebenen XPIs. Die Suchbegriffe stehen nur lokal in testdata/privacy-patterns.txt
# (gitignored, ein erweiterter regulärer Ausdruck pro Zeile, # für Kommentare) – eine Liste im Repository würde genau
# die Daten veröffentlichen, die sie schützen soll. Ausgegeben werden nur Fundorte, nie die gefundenen Daten.
# Aufruf: tools/privacy-check.sh [--history] [datei.xpi ...]
#   --history  zusätzlich alle Änderungen und Texte der ganzen Historie (vor einem Push oder Force-Push)
# Ausgang 1 bei Treffern; ohne Liste 0 mit Warnung (andere Rechner haben sie nicht).
set -euo pipefail
cd "$(dirname "$0")/.."
LIST=testdata/privacy-patterns.txt
if [ ! -f "$LIST" ]; then echo "Datenschutz-Prüfung übersprungen: $LIST fehlt" >&2; exit 0; fi
PAT=$(mktemp); trap 'rm -f "$PAT"' EXIT
grep -v -E '^[[:space:]]*(#|$)' "$LIST" | tr -d '\r' > "$PAT" || true
if [ ! -s "$PAT" ]; then echo "Datenschutz-Prüfung übersprungen: $LIST ist leer" >&2; exit 0; fi

history=0
if [ "${1:-}" = "--history" ]; then history=1; shift; fi
found=0
hit() { echo "TREFFER: $1" >&2; found=1; }
matches() { grep -a -q -i -E -f "$PAT"; }

# Dateien im Repository (versioniert und neue, nicht ignorierte); testdata/ bleibt als ignoriert draußen
while IFS= read -r f; do hit "Datei $f"; done < <(git grep -l -I -i -E --untracked -f "$PAT" -- . || true)
# Commit-Texte: noch nicht gepushte, mit --history alle
range=HEAD
if [ $history = 0 ] && git rev-parse -q --verify '@{u}' >/dev/null; then range='@{u}..HEAD'; fi
for c in $(git rev-list "$range"); do
  git log -1 --format='%an %ae%n%B' "$c" | matches && hit "Commit-Text $(git rev-parse --short "$c")"
done
# Änderungen der ganzen Historie (nur mit --history: kostet bei großen Bankdateien einige Sekunden)
if [ $history = 1 ]; then
  for c in $(git rev-list --all); do
    git show --format= "$c" | grep -a '^[+-]' | matches && hit "Änderung in Commit $(git rev-parse --short "$c")"
  done
fi
# XPIs: jede enthaltene Datei einzeln, damit der Fundort klar ist
for x in "$@"; do
  while IFS= read -r e; do
    unzip -p "$x" "$e" | matches && hit "$(basename "$x") → $e"
  done < <(unzip -Z1 "$x" | grep -v '/$')
done

if [ $found = 1 ]; then echo "Datenschutz-Prüfung: Treffer – nichts veröffentlichen, erst bereinigen." >&2; exit 1; fi
echo "Datenschutz-Prüfung: keine Treffer ($(wc -l < "$PAT" | tr -d ' ') Muster)"
