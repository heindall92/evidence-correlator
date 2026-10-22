"""Comprobaciones estáticas del dashboard y del repositorio."""
import json
import os
import re
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
            self.assertTrue(os.path.exists(os.path.join(DOCS, ref)), ref)
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
