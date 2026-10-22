"""Pruebas de la consola de TRAMA en Chromium headless (axe-core + interacción).

Se omiten si Playwright no está instalado:
    pip install playwright && python3 -m playwright install chromium
"""
import json
import pathlib
import unittest

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None

from trama.pipeline import SAMPLE_EVENTS, SAMPLE_FINDINGS, load_json_list, run_pipeline
from trama.rules import load_rules

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / "docs" / "index.html").as_uri()
AXE = (pathlib.Path(__file__).parent / "axe.min.js").read_text(encoding="utf-8")
VIEWS = ["inicio", "hilo", "incidentes", "cumplimiento", "custodia", "eventos", "entidades"]
LENSES = ["pentest", "red", "blue", "purple", "grc"]
I18N = json.loads((ROOT / "docs" / "assets" / "i18n.js").read_text(encoding="utf-8")
                  .split("window.TRAMA_I18N = ", 1)[1].rstrip().rstrip(";"))


@unittest.skipIf(sync_playwright is None, "Playwright no instalado")
class ConsoleBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._pw = sync_playwright().start()
        cls.browser = cls._pw.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls._pw.stop()

    def open(self, theme="light", lens="blue", lang="es", reduced=True, **ctx):
        context = self.browser.new_context(color_scheme=theme, reduced_motion="reduce" if reduced else "no-preference", **ctx)
        page = context.new_page()
        page.add_init_script("""(() => { if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
            localStorage.setItem('trama-prefs', JSON.stringify({theme: '%s', lang: '%s'}));
            localStorage.setItem('trama-perfil', JSON.stringify({rol: '%s'})); })()""" % (theme, lang, lens))
        page.errors, page.requests = [], []
        page.on("pageerror", lambda e: page.errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and page.errors.append(m.text))
        page.on("request", lambda r: page.requests.append(r.url))
        self.addCleanup(context.close)
        return page

    def go(self, page, view):
        page.goto(URL + "#" + view)
        page.wait_for_selector("#view-" + view)
        self.settle(page)

    @staticmethod
    def settle(page):
        page.evaluate("""() => Promise.all(document.getAnimations()
            .filter(a => { const t = a.effect && a.effect.getComputedTiming(); return t && t.endTime !== Infinity; })
            .map(a => a.finished.catch(() => {})))""")
        page.wait_for_timeout(40)

    def axe(self, page):
        if not page.evaluate("typeof window.axe !== 'undefined'"):
            page.evaluate(AXE)
        self.settle(page)
        return page.evaluate("""async () => {
            const r = await axe.run(document, {resultTypes: ['violations'], preload: false,
              runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']}});
            return r.violations.map(v => v.id + ': ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | '));
        }""")

    def overflowing(self, page):
        """Elementos que se salen de su tarjeta (sin contar las zonas con desplazamiento propio)."""
        return page.evaluate("""() => [...document.querySelectorAll('main .card *')].filter(e => {
            if (!e.offsetParent || e.closest('.hilo-wrap, .table-wrap, .lenses')) return false;
            const c = e.closest('.card').getBoundingClientRect(), r = e.getBoundingClientRect();
            return r.width && (r.right > c.right + 1 || r.left < c.left - 1); }).map(e => e.tagName + '.' + e.className).slice(0, 3)""")

    def empty_icons(self, page):
        return page.evaluate("[...document.querySelectorAll('svg.ico')].filter(s => !s.firstElementChild).length")

    # ------------------------------------------------------------ accesibilidad
    def test_axe_all_views_lenses_and_dialogs_both_themes(self):
        for theme in ("light", "dark"):
            page = self.open(theme)
            for view in VIEWS:
                self.go(page, view)
                if view == "custodia":
                    page.click("#btn-verify")
                with self.subTest(theme=theme, view=view):
                    self.assertEqual(self.axe(page), [])
                    self.assertEqual(self.empty_icons(page), 0, "iconos vacíos")
                    self.assertEqual(self.overflowing(page), [])
            for lens in LENSES:
                self.go(page, "inicio")
                page.click('.lens-opt[data-lens="%s"]' % lens)
                with self.subTest(theme=theme, lens=lens):
                    self.assertEqual(self.axe(page), [])
                    self.assertEqual(self.overflowing(page), [])
            for opener, dlg in (("#search-btn", "#dlg-search"), ("#help-btn", "#dlg-help"),
                                ("#settings-btn", "#dlg-settings"), ("#account-btn", "#dlg-profile")):
                page.click(opener)
                page.wait_for_selector(dlg + "[open]")
                with self.subTest(theme=theme, dialog=dlg):
                    self.assertEqual(self.axe(page), [])
                if dlg == "#dlg-help":
                    for tab in ("metodo", "datos", "atajos", "glosario", "acerca"):
                        page.click("#ht-" + tab)
                        with self.subTest(theme=theme, help=tab):
                            self.assertEqual(self.axe(page), [])
                page.keyboard.press("Escape")
            self.assertEqual(page.errors, [])

    def test_mobile_axe_no_overflow_and_more_menu(self):
        page = self.open("dark", viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        for view in VIEWS:
            self.go(page, view)
            with self.subTest(view=view):
                self.assertEqual(self.axe(page), [])
                self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), 390)
                cut = page.evaluate("""() => [...document.querySelectorAll('main *')].filter(e => {
                    const r = e.getBoundingClientRect(); if (!r.width || !e.offsetParent) return false;
                    if (e.closest('.hilo-wrap, .table-wrap, .lenses')) return false;
                    return r.right > innerWidth + 1; }).map(e => e.tagName + '.' + e.className).slice(0, 3)""")
                self.assertEqual(cut, [])
                self.assertEqual(self.overflowing(page), [])
        self.assertTrue(page.is_visible("#bnav"))
        self.assertFalse(page.is_visible("#side"))
        page.click("#more-btn")
        page.wait_for_selector("#dlg-more[open]")
        self.assertEqual(page.locator("#dlg-more .swatch").count(), 7, "los 7 acentos en «Más»")
        self.assertEqual(self.axe(page), [])
        page.click('#dlg-more .sw-verde')
        self.assertEqual(page.get_attribute("html", "data-accent"), "verde")
        page.click('#dlg-more [lang="en"]')
        self.assertEqual(page.get_attribute("html", "lang"), "en")

    def test_more_sheet_is_organised_at_every_width(self):
        """«Más» en móvil: rejilla de vistas, lista agrupada y preferencias, sin textos cortados."""
        for width in (320, 390):
            page = self.open("light", viewport={"width": width, "height": 800}, is_mobile=True, has_touch=True)
            self.go(page, "inicio")
            page.click("#more-btn")
            page.wait_for_selector("#dlg-more[open]")
            with self.subTest(ancho=width):
                self.assertEqual(page.locator("#dlg-more .tile").count(), 3)
                self.assertEqual(page.locator("#dlg-more .group .grow-row").count(), 4)
                self.assertEqual(page.locator("#dlg-more .more-k").count(), 3)
                cut = page.evaluate("""() => [...document.querySelectorAll('#dlg-more .tile span, #dlg-more .gt b')]
                    .filter(e => e.getBoundingClientRect().right > e.closest('.tile, .grow-row, .pref').getBoundingClientRect().right + 0.5)
                    .map(e => e.textContent)""")
                self.assertEqual(cut, [])
                # Los siete acentos ocupan el ancho de la tarjeta: primero y último pegados a sus bordes.
                spread = page.evaluate("""() => { const s = [...document.querySelectorAll('#dlg-more .swatch')];
                    const box = s[0].parentElement.getBoundingClientRect();
                    return [s[0].getBoundingClientRect().left - box.left, box.right - s[6].getBoundingClientRect().right]; }""")
                self.assertLess(max(spread), 8)
                self.assertEqual(self.axe(page), [])
            page.locator("#dlg-more .tile").first.click()
            page.wait_for_selector("#view-cumplimiento")
            self.assertFalse(page.evaluate("document.getElementById('dlg-more').open"))
            page.context.close()

    # ------------------------------------------------------------ seguridad y red
    def test_only_local_requests_and_no_errors(self):
        page = self.open()
        for view in VIEWS:
            self.go(page, view)
        self.assertTrue(page.requests)
        self.assertEqual([r for r in page.requests if not r.startswith(("file:", "data:", "blob:"))], [])
        self.assertEqual(page.errors, [])

    def test_loaded_bundle_is_not_rendered_as_html(self):
        page = self.open()
        self.go(page, "incidentes")
        page.evaluate("""() => {
            const b = JSON.parse(JSON.stringify(window.EVIDENCE_BUNDLE));
            b.correlation_results.incidents[0].title = '<img src=x onerror="window.__xss=1">';
            b.offensive_findings[0].description = '<svg onload="window.__xss=2">';
            const f = new File([JSON.stringify(b)], 'evil.json', {type: 'application/json'});
            const dt = new DataTransfer(); dt.items.add(f);
            const input = document.getElementById('file-input');
            input.files = dt.files; input.dispatchEvent(new Event('change'));
        }""")
        # Localizador en lugar de wait_for_function con cadena: la CSP de la consola bloquea eval.
        page.locator(".inc-btn .title", has_text="<img").first.wait_for()
        self.assertIn("<img src=x", page.inner_text("#main"))
        self.go(page, "inicio")
        page.click('.lens-opt[data-lens="pentest"]')
        self.assertIn("<svg onload", page.inner_text("#main"))
        self.assertIsNone(page.evaluate("window.__xss"))

    def test_invalid_file_and_ecosystem_envelope_are_rejected(self):
        page = self.open()
        self.go(page, "inicio")
        for content, msg in (('{"hola": 1}', "No es un paquete"), ('{"format": "yrd-ecosistema", "version": 1}', "yrd-ecosistema")):
            page.evaluate("""(c) => { const f = new File([c], 'x.json', {type: 'application/json'});
                const dt = new DataTransfer(); dt.items.add(f); const i = document.getElementById('file-input');
                i.files = dt.files; i.dispatchEvent(new Event('change')); }""", content)
            page.locator("#toasts", has_text=msg).wait_for()
        self.assertIn("Paquete de ejemplo", page.inner_text("#pkg-btn"))

    # ------------------------------------------------------------ custodia
    def test_verify_and_tamper_simulation(self):
        page = self.open()
        self.go(page, "custodia")
        self.assertEqual(page.locator(".link-blk").count(), 6)
        page.click("#btn-verify")
        self.assertIn("Cadena íntegra: 6 sellos", page.inner_text("#verdict"))
        self.assertEqual(page.locator(".link-blk.ok").count(), 6)
        page.click("#btn-tamper")
        self.assertIn("Manipulación detectada en el bloque 1", page.inner_text("#verdict"))
        self.assertEqual(page.locator(".link-blk.bad").count(), 1)
        self.assertEqual(page.locator(".link-blk.skip").count(), 4)
        page.click("#btn-tamper")
        self.assertIn("Cadena íntegra", page.inner_text("#verdict"))

    def test_browser_verifies_raw_event_with_decimals(self):
        """Antes, un evento con «1.0» daba un falso positivo en el navegador (Python escribía 1.0 y JS 1)."""
        raw = load_json_list(SAMPLE_EVENTS, "eventos")
        raw[0]["risk_score"] = 1.0
        raw[1]["ratio"] = 1e-7
        raw[2]["big"] = 1e21
        bundle = run_pipeline(raw, load_json_list(SAMPLE_FINDINGS, "hallazgos"), load_rules())
        page = self.open()
        self.go(page, "custodia")
        page.evaluate("""(c) => { const f = new File([c], 'decimales.json', {type: 'application/json'});
            const dt = new DataTransfer(); dt.items.add(f); const i = document.getElementById('file-input');
            i.files = dt.files; i.dispatchEvent(new Event('change')); }""", json.dumps(bundle))
        page.locator("#pkg-btn", has_text="decimales.json").wait_for()
        page.click("#btn-verify")
        self.assertIn("Cadena íntegra", page.inner_text("#verdict"))

    # ------------------------------------------------------------ lentes
    def test_each_lens_answers_its_question(self):
        expect = {"pentest": ("Hallazgos frente a telemetría", "Copiar bloque"),
                  "red": ("Tiempo de permanencia", "Detectado:"),
                  "blue": ("Exposiciones sin detección", "Copiar IOC"),
                  "purple": ("Cobertura ejercitada", "Ejercicio recomendado"),
                  "grc": ("Plazos de notificación NIS2", "Alerta temprana")}
        page = self.open()
        self.go(page, "inicio")
        for lens, (a, b) in expect.items():
            page.click('.lens-opt[data-lens="%s"]' % lens)
            text = page.inner_text("#main")
            with self.subTest(lens=lens):
                self.assertIn(I18N["es"]["lens.%s.h1" % lens], text)
                self.assertIn(a, text)
                self.assertIn(b, text)
        self.assertEqual(json.loads(page.evaluate("localStorage.getItem('trama-perfil')"))["rol"], "grc")
        page.keyboard.press("l")
        self.assertIn(I18N["es"]["lens.pentest.h1"], page.inner_text("h1"))

    def test_grc_demo_clock_and_deadlines(self):
        page = self.open(lens="grc")
        self.go(page, "inicio")
        text = page.inner_text("#main")
        self.assertIn("el reloj se fija 5 h después", text)
        # Primer incidente (WEB, 08:17:45) y reloj de demo = última detección (08:54:03) + 5 h:
        # a la alerta temprana le quedan 24 h − 5 h 36 min = 18 h 23 min.
        self.assertIn("Quedan 18 h 23 min", text)
        self.assertEqual(page.locator(".deadline").count(), 3)

    def test_pentest_copies_sealed_evidence(self):
        page = self.open(lens="pentest")
        page.context.grant_permissions(["clipboard-read", "clipboard-write"])
        self.go(page, "inicio")
        self.assertIn("Explotado", page.inner_text("#main"))
        page.locator("text=Copiar bloque").first.click()
        clip = page.evaluate("navigator.clipboard.readText()")
        self.assertIn("SHA-256:", clip)
        self.assertIn("Raíz de Merkle del incidente", clip)

    # ------------------------------------------------------------ El Hilo
    def test_thread_highlights_selected_incident(self):
        page = self.open()
        self.go(page, "hilo")
        self.assertEqual(page.locator(".inc-pick button").count(), 3)
        on = page.locator("svg.hilo .thread.on").count()
        self.assertGreater(on, 3)
        self.assertGreater(page.locator("svg.hilo .thread").count(), on)
        page.locator(".inc-pick button").nth(2).click()
        self.assertIn("Recorrido de INC-CORR-WEB-003-01", page.inner_text("#main"))
        self.assertIn("WEB-SQLI-LOGIN-003", page.inner_text(".steps"))
        self.assertEqual(page.get_attribute(".inc-pick button >> nth=2", "aria-pressed"), "true")
        self.assertTrue(page.get_attribute("svg.hilo", "aria-label"))

    # ------------------------------------------------------------ teclado, búsqueda, idioma, perfil
    def test_keyboard_navigation_theme_and_search(self):
        page = self.open()
        self.go(page, "inicio")
        page.keyboard.press("3")
        page.wait_for_selector("#view-incidentes")
        first = page.inner_text("#inc-title")
        page.keyboard.press("j")
        self.assertNotEqual(page.inner_text("#inc-title"), first)
        page.keyboard.press("t")
        self.assertEqual(page.get_attribute("html", "data-theme"), "dark")
        page.keyboard.press("Control+k")
        page.wait_for_selector("#dlg-search[open]")
        self.assertEqual(page.evaluate("document.activeElement.id"), "s-input")
        page.keyboard.type("op.acc.5")
        self.assertIn("op.acc.5", page.inner_text("#s-list"))
        page.keyboard.press("Enter")
        page.wait_for_selector("#view-cumplimiento")
        page.keyboard.press("?")
        page.wait_for_selector("#dlg-help[open]")
        page.keyboard.press("ArrowRight")
        self.assertEqual(page.get_attribute("#ht-metodo", "aria-selected"), "true")
        page.keyboard.press("Escape")
        self.assertFalse(page.evaluate("!!document.querySelector('dialog[open]')"))

    def test_english_ui_has_no_spanish_chrome(self):
        page = self.open(lang="en")
        for view in VIEWS:
            self.go(page, view)
            with self.subTest(view=view):
                self.assertEqual(page.inner_text("h1"), page.evaluate("document.querySelector('h1').textContent"))
                self.assertTrue(page.title().startswith(I18N["en"]["view." + view]))
                chrome = page.inner_text("#nav") + page.inner_text("#top") + page.inner_text("#foot") + page.inner_text(".vhead")
                for word in ("Inicio", "Incidentes", "Custodia", "Cumplimiento", "Buscar", "Correlación de evidencias", "Perspectiva"):
                    self.assertNotIn(word, chrome)

    def test_profile_sets_name_and_lens(self):
        page = self.open()
        self.go(page, "inicio")
        page.click("#account-btn")
        page.wait_for_selector("#dlg-profile[open]")
        page.fill("#pf-nombre", "Ana García")
        page.fill("#pf-org", "Banco Ejemplo")
        page.click('#dlg-profile .lens-opt[data-lens="purple"]')
        page.click("#pf-save")
        self.assertIn("AG", page.inner_text("#account-btn"))
        self.assertIn(I18N["es"]["lens.purple.h1"], page.inner_text("h1"))
        page.reload()
        page.wait_for_selector("#view-inicio")
        self.assertIn("Ana García", page.inner_text("#account-btn"))

    def test_settings_density_motion_and_reset(self):
        page = self.open()
        self.go(page, "inicio")
        page.click("#settings-btn")
        page.wait_for_selector("#dlg-settings[open]")
        page.click('#dlg-settings input[value="compact"]')
        page.click('#dlg-settings input[value="reduce"]')
        self.assertEqual(page.get_attribute("html", "data-density"), "compact")
        self.assertEqual(page.get_attribute("html", "data-motion"), "reduce")
        reset = page.locator("#dlg-settings .btn", has_text="Borrar")
        reset.click()
        page.locator("#dlg-settings .btn", has_text="confirmar").click()
        self.assertEqual(page.evaluate("localStorage.getItem('trama-prefs')"), None)

    # ------------------------------------------------------------ movimiento
    def test_theme_switch_is_one_coordinated_fade(self):
        """Todos los colores cambian a la vez, con la misma duración: sin cajas a medio color."""
        page = self.open(reduced=False)
        self.go(page, "inicio")
        page.hover("#theme-btn")
        page.wait_for_timeout(400)
        page.click("#theme-btn")
        info = page.evaluate("""() => { const t = document.getAnimations().filter(a => a.transitionProperty);
            const col = t.filter(a => /color|background|border|shadow|fill|stroke/.test(a.transitionProperty) && !a.effect.target.classList.contains('knob'));
            return { n: col.length, dur: [...new Set(col.map(a => a.effect.getTiming().duration))], start: new Set(col.map(a => a.startTime)).size,
                     knob: t.some(a => a.transitionProperty === 'transform' && a.effect.target.classList.contains('knob')) }; }""")
        self.assertGreater(info["n"], 50)
        self.assertEqual(info["dur"], [320])
        self.assertEqual(info["start"], 1)
        self.assertTrue(info["knob"])

    def test_reduced_motion_stops_animations(self):
        page = self.open(reduced=True)
        self.go(page, "hilo")
        page.wait_for_timeout(100)
        running = page.evaluate("document.getAnimations().filter(a => a.playState === 'running' && a.effect.getComputedTiming().duration > 1).length")
        self.assertEqual(running, 0)


if __name__ == "__main__":
    unittest.main()
