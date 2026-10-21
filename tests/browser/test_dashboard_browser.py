"""Pruebas del dashboard en Chromium headless (axe-core + interacción).

Se omiten si Playwright no está instalado:
    pip install playwright && python3 -m playwright install chromium
"""
import pathlib
import unittest

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL = (ROOT / "docs" / "index.html").as_uri()
AXE = (pathlib.Path(__file__).parent / "axe.min.js").read_text(encoding="utf-8")
VIEWS = ["resumen", "incidentes", "cumplimiento", "custodia", "eventos", "grafo"]


@unittest.skipIf(sync_playwright is None, "Playwright no instalado")
class DashboardBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._pw = sync_playwright().start()
        cls.browser = cls._pw.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls._pw.stop()

    def open(self, theme="light", **ctx):
        context = self.browser.new_context(color_scheme=theme, **ctx)
        page = context.new_page()
        page.add_init_script("localStorage.setItem('prefs', JSON.stringify({theme: '%s'}))" % theme)
        errors, requests = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.on("request", lambda r: requests.append(r.url))
        self.addCleanup(context.close)
        return page, errors, requests

    def axe(self, page):
        page.evaluate(AXE)
        return page.evaluate("""async () => {
            const r = await axe.run(document, {resultTypes: ['violations'], preload: false});
            return r.violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(' | '));
        }""")

    def test_axe_zero_violations_all_views_both_themes(self):
        for theme in ("light", "dark"):
            page, errors, _ = self.open(theme, reduced_motion="reduce")
            for view in VIEWS:
                page.goto(URL + "#" + view)
                page.wait_for_timeout(80)
                if view == "custodia":
                    page.click("#btn-verify")
                with self.subTest(theme=theme, view=view):
                    self.assertEqual(self.axe(page), [])
            for dlg in ("dlg-help", "dlg-shortcuts", "dlg-settings", "dlg-privacy"):
                page.evaluate("document.getElementById('%s').showModal()" % dlg)
                with self.subTest(theme=theme, dialog=dlg):
                    self.assertEqual(self.axe(page), [])
                page.keyboard.press("Escape")
            self.assertEqual(errors, [])

    def test_axe_mobile_and_no_horizontal_overflow(self):
        page, _, _ = self.open("dark", reduced_motion="reduce",
                               viewport={"width": 390, "height": 844}, is_mobile=True)
        for view in VIEWS:
            page.goto(URL + "#" + view)
            page.wait_for_timeout(80)
            with self.subTest(view=view):
                self.assertEqual(self.axe(page), [])
                self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), 390)

    def test_only_local_requests(self):
        page, errors, requests = self.open()
        page.goto(URL)
        page.wait_for_timeout(200)
        self.assertTrue(requests)
        self.assertEqual([r for r in requests if not r.startswith(("file:", "data:"))], [])
        self.assertEqual(errors, [])

    def test_verify_and_tamper_simulation(self):
        page, _, _ = self.open()
        page.goto(URL + "#custodia")
        page.click("#btn-verify")
        self.assertIn("Cadena íntegra", page.inner_text("#verdict"))
        page.click("#btn-tamper")
        self.assertIn("Manipulación detectada en el bloque 1", page.inner_text("#verdict"))

    def test_keyboard_navigation_theme_and_search(self):
        page, _, _ = self.open()
        page.goto(URL)
        page.keyboard.press("2")
        self.assertTrue(page.is_visible("#view-incidentes"))
        page.keyboard.press("j")
        self.assertIn("LNX", page.inner_text("#inc-detail"))
        page.keyboard.press("t")
        self.assertEqual(page.get_attribute("html", "data-theme"), "dark")
        page.keyboard.press("/")
        page.keyboard.type("op.acc.5")
        page.wait_for_timeout(300)
        self.assertTrue(page.is_visible("#view-search"))
        self.assertIn("op.acc.5", page.inner_text("#results"))

    def test_loaded_bundle_is_not_rendered_as_html(self):
        page, _, _ = self.open()
        page.goto(URL)
        page.evaluate("""() => {
            const b = JSON.parse(JSON.stringify(window.EVIDENCE_BUNDLE));
            b.correlation_results.incidents[0].title = '<img src=x onerror="window.__xss=1">';
            const f = new File([JSON.stringify(b)], 'evil.json', {type: 'application/json'});
            const dt = new DataTransfer(); dt.items.add(f);
            const input = document.getElementById('file-input');
            input.files = dt.files; input.dispatchEvent(new Event('change'));
        }""")
        page.wait_for_timeout(300)
        page.keyboard.press("2")
        self.assertIn("<img src=x", page.inner_text("#inc-detail"))
        self.assertIsNone(page.evaluate("window.__xss"))


if __name__ == "__main__":
    unittest.main()
