#!/usr/bin/env python3
"""Vendoriza los iconos Lucide usados por el dashboard en un único JS local.

Uso: python3 scripts/vendor_icons.py RUTA/node_modules/lucide-static
Genera docs/assets/vendor/lucide-icons.js (sin dependencias en tiempo de ejecución).
"""
import json
import os
import re
import sys

ICONS = """house waypoints siren scale link list network panel-left search sun moon circle-question-mark
settings user-round ellipsis palette folder-open wifi-off x check chevron-right chevron-down copy download
file-spreadsheet shield-check circle-check circle-x flask-conical fingerprint hash clock target triangle-alert
crosshair swords shield-half blend clipboard-check timer hourglass server user globe terminal key-round radar
bug list-checks external-link code mail info keyboard sliders-horizontal unlink link-2 play arrow-right
activity gauge eye eye-off file-json sparkles route layers boxes radio-tower log-out briefcase-business
building-2 lock calendar-clock bell-ring file-text git-commit-horizontal""".split()

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
