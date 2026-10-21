#!/usr/bin/env bash
# Sustituye el nombre provisional (PROYECTO / proyecto) por el definitivo en
# todo el repositorio: nombres de ficheros y carpetas, código, README,
# dashboard, banner de la CLI y pyproject.
#
#   scripts/rename.sh NOMBRE [slug]      # aplica el cambio
#   scripts/rename.sh --dry-run NOMBRE   # solo muestra qué cambiaría
#
# NOMBRE  nombre visible (p. ej. "ARGOS"); sustituye a PROYECTO.
# slug    identificador de paquete Python y comando CLI; por defecto NOMBRE en
#         minúsculas con los caracteres no alfanuméricos cambiados por "_".
set -euo pipefail

DRY=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY=1; shift; fi
if [[ $# -lt 1 || -z "$1" ]]; then
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="$1"
SLUG="${2:-$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+|_+$//g')}"

if ! [[ "$SLUG" =~ ^[a-z][a-z0-9_]*$ ]]; then
  echo "error: slug no válido para un paquete Python: '$SLUG'" >&2
  exit 65
fi
if [[ "$NAME" == "PROYECTO" && "$SLUG" == "proyecto" ]]; then
  echo "nada que hacer: el nombre ya es PROYECTO" >&2
  exit 0
fi

DRY="$DRY" NAME="$NAME" SLUG="$SLUG" ROOT="$ROOT" python3 - <<'PY'
import os

root, name, slug, dry = os.environ["ROOT"], os.environ["NAME"], os.environ["SLUG"], os.environ["DRY"] == "1"
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", "node_modules", "output", ".venv", "venv"}
TEXT_EXT = {".py", ".md", ".toml", ".cfg", ".txt", ".json", ".js", ".css", ".html", ".yml",
            ".yaml", ".sh", ".svg", ".gitignore", ""}

def is_text(path):
    ext = os.path.splitext(path)[1].lower()
    if ext not in TEXT_EXT and os.path.basename(path) not in (".gitignore", "LICENSE"):
        return False
    with open(path, "rb") as fh:
        return b"\0" not in fh.read(4096)

changed, moved = [], []
for d, dirs, files in os.walk(root):
    dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
    for f in files:
        p = os.path.join(d, f)
        if os.path.relpath(p, root) == os.path.join("scripts", "rename.sh") or not is_text(p):
            continue
        with open(p, encoding="utf-8") as fh:
            src = fh.read()
        out = src.replace("PROYECTO", name).replace("proyecto", slug)
        if out != src:
            changed.append(os.path.relpath(p, root))
            if not dry:
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(out)

# Renombrar rutas (de las más profundas a las más superficiales).
for d, dirs, files in os.walk(root, topdown=False):
    if any(part in SKIP_DIRS for part in os.path.relpath(d, root).split(os.sep)):
        continue
    for entry in dirs + files:
        if "proyecto" in entry or "PROYECTO" in entry:
            new = entry.replace("PROYECTO", name).replace("proyecto", slug)
            moved.append((os.path.relpath(os.path.join(d, entry), root), new))
            if not dry:
                os.rename(os.path.join(d, entry), os.path.join(d, new))

print("%s%d ficheros con contenido modificado" % ("[simulación] " if dry else "", len(changed)))
for c in changed:
    print("  ~ " + c)
for old, new in moved:
    print("  > %s -> %s" % (old, new))
PY

if [[ "$DRY" == "0" ]]; then
  cat <<MSG

Hecho: PROYECTO -> $NAME, proyecto -> $SLUG.
Siguientes pasos:
  python3 -m $SLUG run --dashboard-js docs/data/bundle.js   # regenerar datos del dashboard
  python3 -m unittest discover -s tests -t .                # pruebas
  python3 scripts/screenshots.py                             # regenerar capturas
MSG
fi
