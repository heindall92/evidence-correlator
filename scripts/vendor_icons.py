#!/usr/bin/env python3
"""Vendoriza los iconos Lucide usados por el dashboard en un único JS local.

Uso: python3 scripts/vendor_icons.py RUTA/node_modules/lucide-static
Genera docs/assets/vendor/lucide-icons.js (sin dependencias en tiempo de ejecución).
"""
import json
import os
import re
import sys

ICONS = """shield-check shield-alert search sun moon monitor keyboard circle-help settings lock
wifi wifi-off layout-dashboard siren scale link list network folder-open download file-json
check x triangle-alert clock target fingerprint hash server user globe terminal copy
chevron-right filter flask-conical rotate-ccw file-spreadsheet key-round info radar
git-commit-horizontal circle-check circle-x eye-off""".split()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets", "vendor", "lucide-icons.js")


def main(src):
    pkg = json.load(open(os.path.join(src, "package.json"), encoding="utf-8"))
    icons = {}
    for name in ICONS:
        svg = open(os.path.join(src, "icons", name + ".svg"), encoding="utf-8").read()
        inner = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
        icons[name] = re.sub(r"\s+", " ", inner).replace(" />", "/>").strip()
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("/* Lucide v%s (ISC) - https://lucide.dev - subconjunto vendorizado. */\n" % pkg["version"])
        fh.write("window.LUCIDE_ICONS = %s;\n" % json.dumps(icons, indent=1, sort_keys=True))
    print("%d iconos -> %s" % (len(icons), OUT))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "node_modules/lucide-static")
