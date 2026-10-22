#!/usr/bin/env python3
"""Capturas de la consola de TRAMA (claro, oscuro y móvil, y una por lente) con Playwright.

Uso: python3 scripts/screenshots.py [--out docs/img]
Requiere: pip install playwright && python3 -m playwright install chromium
"""
import argparse
import os
import pathlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
VIEWS = ["inicio", "hilo", "incidentes", "cumplimiento", "custodia", "eventos", "entidades"]
LENSES = ["pentest", "red", "blue", "purple", "grc"]
MODES = {
    "light": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=1, theme="light"),
    "dark": dict(viewport={"width": 1440, "height": 900}, device_scale_factor=1, theme="dark"),
    "mobile": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, theme="dark",
                   is_mobile=True, has_touch=True),
}
INIT = """(() => { if (sessionStorage.getItem('__shot')) return; sessionStorage.setItem('__shot', '1');
  localStorage.setItem('trama-prefs', JSON.stringify({theme: '%s'}));
  localStorage.setItem('trama-perfil', JSON.stringify({rol: '%s', nombre: 'Ana García', org: 'Banco Ejemplo'})); })()"""


def settle(page):
    page.evaluate("""() => Promise.all(document.getAnimations()
        .filter(a => { const t = a.effect && a.effect.getComputedTiming(); return t && t.endTime !== Infinity; })
        .map(a => a.finished.catch(() => {})))""")
    page.evaluate("document.getElementById('toasts').replaceChildren()")
    page.wait_for_timeout(120)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "docs" / "img"))
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
            page.add_init_script(INIT % (theme, "blue"))
            for view in VIEWS:
                page.goto(url + "#" + view)
                page.wait_for_selector("#view-" + view)
                if view == "custodia":
                    page.click("#btn-verify")
                if view == "eventos":
                    page.locator("#ev-table tbody tr.hit .link-btn").first.click()
                settle(page)
                path = os.path.join(args.out, "%s-%s.png" % (view, mode))
                page.screenshot(path=path, full_page=(mode == "mobile"))
                written.append(path)
            ctx.close()
        ctx = browser.new_context(color_scheme="light", reduced_motion="reduce", viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.add_init_script(INIT % ("light", "blue"))
        for lens in LENSES:
            page.goto(url + "#inicio")
            page.click('.lens-opt[data-lens="%s"]' % lens)
            settle(page)
            path = os.path.join(args.out, "lente-%s.png" % lens)
            page.screenshot(path=path)
            written.append(path)
        ctx.close()
        browser.close()
    print("\n".join(written))


if __name__ == "__main__":
    main()
