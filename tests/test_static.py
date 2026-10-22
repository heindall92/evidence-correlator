"""Comprobaciones estáticas de la consola y del repositorio."""
import json
import os
import re
import sys
import unittest

from trama import NAME
from trama.pipeline import run_files
from tests.helpers import ROOT

DOCS = os.path.join(ROOT, "docs")


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return fh.read()


def load_i18n():
    text = read("docs", "assets", "i18n.js")
    body = text.split("window.TRAMA_I18N = ", 1)[1].rstrip().rstrip(";")
    return json.loads(body)


def load_icons():
    text = read("docs", "assets", "vendor", "lucide-icons.js")
    return json.loads(text.split("window.LUCIDE_ICONS = ", 1)[1].rstrip().rstrip(";"))


def repo_text_files():
    skip = {".git", "__pycache__", "output", "node_modules"}
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in skip]
        for f in files:
            if f.endswith((".py", ".md", ".toml", ".yml", ".sh", ".html", ".css", ".json")) or f in ("app.js", "theme-boot.js", "sha256.js", "i18n.js"):
                yield os.path.join(d, f)


class DashboardStaticTest(unittest.TestCase):
    FILES = ("index.html", "assets/app.css", "assets/app.js", "assets/i18n.js", "assets/theme-boot.js")

    def setUp(self):
        self.html = read("docs", "index.html")
        self.css = read("docs", "assets", "app.css")
        self.js = read("docs", "assets", "app.js")
        self.i18n = load_i18n()

    def test_no_remote_resources(self):
        for name in self.FILES:
            text = read("docs", *name.split("/"))
            self.assertNotRegex(text, r"(?:src|href)=\"https?://", name)
            self.assertNotRegex(text, r"url\(\s*[\"']?https?:", name)
            self.assertNotIn("@import", text, name)
            self.assertNotRegex(text, r"\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon", name)

    def test_referenced_local_files_exist(self):
        for ref in re.findall(r'(?:src|href)="([^"#:]+)"', self.html):
            self.assertTrue(os.path.exists(os.path.join(DOCS, ref.split("?")[0])), ref)

    def test_assets_carry_current_version(self):
        """Cada versión publicada invalida la caché del navegador: app.js?v=<versión>."""
        from trama import __version__
        refs = re.findall(r'(?:src|href)="((?:assets|data)/[^"]+\.(?:css|js)[^"]*)"', self.html)
        self.assertTrue(refs)
        for ref in refs:
            self.assertTrue(ref.endswith("?v=" + __version__), ref)
        for ref in re.findall(r'url\("([^"]+)"\)', self.css):
            self.assertTrue(os.path.exists(os.path.join(DOCS, "assets", ref)), ref)

    def test_strict_csp(self):
        m = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', self.html)
        self.assertIsNotNone(m)
        csp = m.group(1)
        for directive in ("default-src 'none'", "connect-src 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"):
            self.assertIn(directive, csp)
        self.assertNotIn("unsafe-inline", csp)
        self.assertNotIn("unsafe-eval", csp)
        self.assertNotRegex(self.html, r"<script>(?!</script>)", "no se permiten scripts en línea")
        self.assertNotIn('style="', self.html)

    def test_plain_surfaces_no_patterns_no_rings(self):
        for banned in ("repeating-linear-gradient", "repeating-radial-gradient", "radial-gradient",
                       "background-image", "background-size", "conic-gradient"):
            self.assertNotIn(banned, self.css)

    def test_untrusted_data_never_via_innerhtml(self):
        uses = re.findall(r"\.innerHTML\s*=\s*([^;]+);", self.js)
        self.assertEqual(uses, ['ICONS[name] || ""'])  # solo iconos vendorizados
        self.assertNotIn("insertAdjacentHTML", self.js)
        self.assertNotIn("outerHTML", self.js)
        self.assertNotRegex(self.js, r"\beval\(|new Function")

    def test_icons_exist(self):
        icons = load_icons()
        used = set(re.findall(r'data-icon="([a-z0-9-]+)"', self.html))
        used |= set(re.findall(r'\bicon\("([a-z0-9-]+)"', self.js))
        used |= set(re.findall(r'\bicon: "([a-z0-9-]+)"', self.js))
        for block in re.findall(r"(?:HELP_TABS|var groups) = (\[\[.*?\]\]);", self.js):  # pares [id, icono]
            used |= set(re.findall(r'\["[a-z]+", "([a-z0-9-]+)"\]', block))
        self.assertGreater(len(used), 40)
        self.assertEqual(sorted(used - set(icons)), [])

    def test_light_and_dark_tokens_and_seven_accents(self):
        for theme in ("light", "dark"):
            block = re.search(r'\[data-theme="%s"\] \{(.*?)\}' % theme, self.css, re.S).group(1)
            for token in ("--bg", "--surface", "--text", "--muted", "--accent", "--crit", "--ok"):
                self.assertIn(token + ":", block, theme)
            for accent in ("rosa", "solar", "glaciar", "orquidea", "verde", "rojo"):
                self.assertIn('[data-theme="%s"][data-accent="%s"]' % (theme, accent), self.css)
        self.assertIn("--accent: #1a4fe0", self.css)  # azul eléctrico por defecto en claro

    def test_reduced_motion_respected(self):
        self.assertIn("@media (prefers-reduced-motion: reduce)", self.css)
        self.assertIn('[data-motion="reduce"]', self.css)
        self.assertIn("scale(.97)", self.css)

    def test_name_in_ui(self):
        self.assertIn("<title>%s" % NAME, self.html)
        self.assertIn('class="brand-name">%s<' % NAME, self.html)
        self.assertIn('var NAME = "%s"' % NAME, self.js)

    def test_i18n_parity_and_coverage(self):
        es, en = self.i18n["es"], self.i18n["en"]
        self.assertEqual(sorted(es), sorted(en), "ES y EN deben tener las mismas claves")
        for k in es:
            self.assertTrue(es[k].strip() and en[k].strip(), k)
            self.assertEqual(sorted(re.findall(r"\{(\w+)\}", es[k])), sorted(re.findall(r"\{(\w+)\}", en[k])), k)
        literal = set(re.findall(r'\bt\("([a-zA-Z0-9_.]+)"\s*[,)]', self.js))
        self.assertGreater(len(literal), 150)
        self.assertEqual(sorted(k for k in literal if k not in es), [])

    def test_english_has_no_spanish_marks(self):
        for k, v in self.i18n["en"].items():
            self.assertNotRegex(v, r"[¿¡ñáéíóú]", k)

    def test_nis2_deadlines_follow_article_23(self):
        m = re.search(r"var NIS2 = \{ alertaH: (\d+), notificacionH: (\d+), finalMeses: (\d+) \}", self.js)
        self.assertEqual(m.groups(), ("24", "72", "1"))

    def test_sample_bundle_up_to_date(self):
        text = read("docs", "data", "bundle.js")
        committed = json.loads(text.split("window.EVIDENCE_BUNDLE = ", 1)[1].rstrip().rstrip(";"))
        fresh = run_files()

        def fingerprint(b):
            return [(i["incident_id"], i["evidence_merkle_root_sha256"], i["title"])
                    for i in b["correlation_results"]["incidents"]], \
                b["forensic_custody_verification"]["merkle_root_sha256"], b["generator"], b["rules"], b.get("dataset")
        self.assertEqual(fingerprint(committed), fingerprint(fresh),
                         "regenera con: python3 -m trama run --dashboard-js docs/data/bundle.js")
        self.assertEqual(committed.get("dataset"), "demo")


class ProfessionalCopyTest(unittest.TestCase):
    """Redacción de producto: reglas de linkedin-humanizer adaptadas al español (scripts/redaccion.py)."""

    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, os.path.join(ROOT, "scripts"))
        import redaccion
        cls.R = redaccion

    def test_platform_copy_has_no_ai_tells(self):
        fails, _ = self.R.audit()
        self.assertEqual(["%s · %s · %s" % f for f in fails], [])

    def test_detector_catches_known_tells(self):
        cases = [
            ("Hasta que te vieron", True, "es"), ("Qué viste y qué se te escapó", True, "es"),
            ("¿Mis hallazgos se explotaron en el mundo real?", True, "es"), ("Sigue el hilo", True, "es"),
            ("No se trata solo de cumplir, sino de demostrarlo.", False, "es"),
            ("El resultado: cero sorpresas.", False, "es"),
            ("Sin red, sin analítica y sin cookies.", False, "es"),
            ("Una solución integral que permite gestionar evidencias de forma sencilla y eficiente.", False, "es"),
            ("Además, garantiza la trazabilidad. Asimismo, facilita la auditoría.", False, "es"),
            ("Aprovechando la telemetría, el equipo optimiza la detección y potencia la respuesta.", False, "es"),
            ("Seamos sinceros: nadie lee los informes.", False, "es"),
            ("Preferencias y perfil. Nada más.", True, "es"),
            ("What you saw and what you missed", True, "en"), ("It's not just a tool, it's a workflow.", False, "en"),
            ("Here's the thing: custody matters.", False, "en"), ("Lanzamos la versión 🚀", False, "es"),
        ]
        for text, ui, lang in cases:
            with self.subTest(texto=text):
                self.assertTrue(self.R.audit_paragraph(text, ui=ui, lang=lang)[0], "no detectado")

    def test_detector_leaves_plain_technical_copy(self):
        for text in ("Cada evento crudo se sella con SHA-256 y se encadena al anterior.",
                     "Incidentes detectados con su tiempo de detección.",
                     "La CLI registró la cadena como íntegra. «Verificar ahora» recalcula cada sello en este navegador.",
                     "Fuera las frases del tipo «no es X, es Y»."):
            with self.subTest(texto=text):
                self.assertEqual(self.R.audit_paragraph(text, ui=True)[0], [])

    def test_own_logo_not_a_shared_icon(self):
        html = read(os.path.join(DOCS, "index.html"))
        self.assertNotIn("waypoints", html, "el icono waypoints es el logotipo de CTEM-Nexus")
        self.assertEqual(html.count('<svg class="mark"'), 2, "marca propia en el lateral y en la barra móvil")


class RepositoryHygieneTest(unittest.TestCase):
    def test_no_ai_attribution(self):
        pattern = re.compile(r"co-authored-by|generated (?:by|with) (?:ai|chatgpt|claude|copilot)|"
                             r"\b(?:claude|chatgpt|openai|anthropic|copilot)\b", re.I)
        offenders = []
        for p in repo_text_files():
            if p.endswith("test_static.py"):
                continue
            with open(p, encoding="utf-8", errors="ignore") as fh:
                if pattern.search(fh.read()):
                    offenders.append(os.path.relpath(p, ROOT))
        self.assertEqual(offenders, [])

    def test_no_rejected_name(self):
        offenders = []
        for p in repo_text_files():
            if p.endswith("test_static.py"):
                continue
            with open(p, encoding="utf-8", errors="ignore") as fh:
                if re.search(r"aegis", fh.read(), re.I):
                    offenders.append(os.path.relpath(p, ROOT))
        self.assertEqual(offenders, [])

    def test_name_centralized(self):
        py = [p for p in repo_text_files() if p.endswith(".py") and "/trama/" in p]
        literal = []
        for p in py:
            with open(p, encoding="utf-8") as fh:
                if '"TRAMA"' in fh.read() and not p.endswith("branding.py"):
                    literal.append(os.path.relpath(p, ROOT))
        self.assertEqual(literal, [], "el nombre solo se define en trama/branding.py")


if __name__ == "__main__":
    unittest.main()
