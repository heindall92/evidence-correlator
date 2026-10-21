#!/usr/bin/env python3
"""Capturas del dashboard (claro, oscuro y móvil) con Playwright en modo headless.

Uso: python3 scripts/screenshots.py [--out docs/img] [--copy-to DIR]
Requiere: pip install playwright && python3 -m playwright install chromium
"""
import argparse
import os
import pathlib
import shutil

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
VIEWS = ["resumen", "incidentes", "cumplimiento", "custodia", "eventos", "grafo"]
MODES = {
    "light": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=1, theme="light"),
    "dark": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=1, theme="dark"),
    "mobile": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, theme="light",
                   is_mobile=True, has_touch=True),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "docs" / "img"))
    ap.add_argument("--copy-to", help="copia adicional con prefijo (p. ej. /workspace/shots)")
    ap.add_argument("--prefix", default="correlator-")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    url = (ROOT / "docs" / "index.html").as_uri()
    written = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for mode, cfg in MODES.items():
            cfg = dict(cfg)
            theme = cfg.pop("theme")
            ctx = browser.new_context(color_scheme=theme, reduced_motion="reduce", **cfg)
            page = ctx.new_page()
            page.add_init_script("localStorage.setItem('prefs', JSON.stringify({theme: '%s'}))" % theme)
            for view in VIEWS:
                page.goto(url + "#" + view)
                page.wait_for_timeout(150)
                if view == "custodia":
                    page.click("#btn-verify")
                    page.wait_for_timeout(100)
                if view == "eventos":
                    page.locator("#ev-table tbody tr.hit .link-btn").first.click()
                page.evaluate("document.getElementById('toast').classList.remove('show')")
                page.wait_for_timeout(200)
                path = os.path.join(args.out, "%s-%s.png" % (view, mode))
                page.screenshot(path=path, full_page=(mode == "mobile"))
                written.append(path)
            ctx.close()
        browser.close()
    if args.copy_to:
        os.makedirs(args.copy_to, exist_ok=True)
        for path in written:
            shutil.copy(path, os.path.join(args.copy_to, args.prefix + os.path.basename(path)))
    print("\n".join(written))


if __name__ == "__main__":
    main()
