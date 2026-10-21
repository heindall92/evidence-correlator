"""Comprobaciones estáticas del dashboard y del repositorio."""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

from proyecto import NAME
from proyecto.pipeline import run_files
from tests.helpers import ROOT

DOCS = os.path.join(ROOT, "docs")


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return fh.read()


def repo_text_files():
    skip = {".git", "__pycache__", "output", "node_modules"}
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in skip]
        for f in files:
            if f.endswith((".py", ".md", ".toml", ".yml", ".sh", ".html", ".css", ".json")) or f in ("app.js", "theme-boot.js", "sha256.js"):
                yield os.path.join(d, f)


class DashboardStaticTest(unittest.TestCase):
    def setUp(self):
        self.html = read("docs", "index.html")
        self.css = read("docs", "assets", "app.css")
        self.js = read("docs", "assets", "app.js")

    def test_no_remote_resources(self):
        for name, text in (("index.html", self.html), ("app.css", self.css), ("app.js", self.js)):
            urls = [u for u in re.findall(r"(?:src|href|url)\s*[=(]\s*[\"']?(https?:)?//", text) if u is not None]
            self.assertEqual([u for u in urls if u], [], name)
            self.assertNotRegex(text, r"(?:src|href)=\"https?://", name)
            self.assertNotIn("@import", text, name)

    def test_referenced_local_files_exist(self):
        for ref in re.findall(r'(?:src|href)="([^"#:]+)"', self.html):
            self.assertTrue(os.path.exists(os.path.join(DOCS, ref)), ref)
        for ref in re.findall(r'url\("([^"]+)"\)', self.css):
            self.assertTrue(os.path.exists(os.path.join(DOCS, "assets", ref)), ref)

    def test_strict_csp(self):
        m = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', self.html)
        self.assertIsNotNone(m)
        csp = m.group(1)
        self.assertIn("default-src 'none'", csp)
        self.assertNotIn("unsafe-inline", csp)
        self.assertNotIn("unsafe-eval", csp)
        self.assertNotRegex(self.html, r"<script>(?!</script>)", "no se permiten scripts en línea")
        self.assertNotIn("style=\"", self.html)

    def test_plain_surfaces_no_patterns(self):
        for banned in ("repeating-linear-gradient", "repeating-radial-gradient", "radial-gradient",
                       "background-image", "background-size", "conic-gradient"):
            self.assertNotIn(banned, self.css)

    def test_untrusted_data_never_via_innerhtml(self):
        uses = re.findall(r"\.innerHTML\s*=\s*([^;]+);", self.js)
        self.assertEqual(uses, ['ICONS[name] || ""'])  # solo iconos vendorizados
        self.assertNotIn("insertAdjacentHTML", self.js)
        self.assertNotIn("eval(", self.js)

    def test_icons_exist(self):
        icons_js = read("docs", "assets", "vendor", "lucide-icons.js")
        icons = json.loads(icons_js.split("window.LUCIDE_ICONS = ", 1)[1].rstrip().rstrip(";"))
        used = set(re.findall(r'data-icon="([a-z0-9-]+)"', self.html))
        used |= set(re.findall(r'icon\("([a-z0-9-]+)"', self.js))
        used |= set(x for pair in re.findall(r'icon\(on \? "([a-z-]+)" : "([a-z-]+)"\)', self.js) for x in pair)
        used |= set(x for pair in re.findall(r'icon\(theme === "dark" \? "([a-z-]+)" : "([a-z-]+)"\)', self.js) for x in pair)
        self.assertTrue(used)
        self.assertEqual(sorted(used - set(icons)), [])

    def test_light_and_dark_tokens(self):
        for theme in ("light", "dark"):
            block = re.search(r'\[data-theme="%s"\] \{(.*?)\}' % theme, self.css, re.S).group(1)
            for token in ("--bg", "--surface", "--text", "--muted", "--accent", "--crit"):
                self.assertIn(token + ":", block, theme)

    def test_name_placeholder_in_ui(self):
        self.assertIn("<title>%s" % NAME, self.html)
        self.assertIn('class="brand-name">%s<' % NAME, self.html)

    def test_sample_bundle_up_to_date(self):
        text = read("docs", "data", "bundle.js")
        committed = json.loads(text.split("window.EVIDENCE_BUNDLE = ", 1)[1].rstrip().rstrip(";"))
        fresh = run_files()

        def fingerprint(b):
            return [(i["incident_id"], i["evidence_merkle_root_sha256"], i["title"])
                    for i in b["correlation_results"]["incidents"]], \
                b["forensic_custody_verification"]["merkle_root_sha256"], b["generator"], b["rules"]
        self.assertEqual(fingerprint(committed), fingerprint(fresh),
                         "regenera con: python3 -m proyecto run --dashboard-js docs/data/bundle.js")


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
        py = [p for p in repo_text_files() if p.endswith(".py") and "/proyecto/" in p]
        literal = []
        for p in py:
            with open(p, encoding="utf-8") as fh:
                if '"PROYECTO"' in fh.read() and not p.endswith("branding.py"):
                    literal.append(os.path.relpath(p, ROOT))
        self.assertEqual(literal, [], "el nombre solo se define en proyecto/branding.py")


@unittest.skipIf(os.name == "nt" or shutil.which("bash") is None, "requiere bash")
class RenameScriptTest(unittest.TestCase):
    def test_rename_end_to_end(self):
        with tempfile.TemporaryDirectory() as d:
            dst = os.path.join(d, "repo")
            shutil.copytree(ROOT, dst, ignore=shutil.ignore_patterns(".git", "__pycache__", "output", "img"))
            r = subprocess.run(["bash", "scripts/rename.sh", "NUEVO-NOMBRE"], cwd=dst,
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertTrue(os.path.isdir(os.path.join(dst, "nuevo_nombre")))
            self.assertFalse(os.path.exists(os.path.join(dst, "proyecto")))
            left = []
            for dd, dirs, files in os.walk(dst):
                for f in files:
                    p = os.path.join(dd, f)
                    if p.endswith("rename.sh") or "/img/" in p or p.endswith((".woff2", ".png")):
                        continue
                    with open(p, encoding="utf-8", errors="ignore") as fh:
                        if re.search("proyecto", fh.read(), re.I):
                            left.append(os.path.relpath(p, dst))
            self.assertEqual(left, [])
            with open(os.path.join(dst, "docs", "index.html"), encoding="utf-8") as fh:
                self.assertIn("NUEVO-NOMBRE", fh.read())
            r = subprocess.run([sys.executable, "-m", "nuevo_nombre", "--color", "never", "rules"],
                               cwd=dst, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            r = subprocess.run([sys.executable, "-m", "nuevo_nombre", "--version"], cwd=dst,
                               capture_output=True, text=True)
            self.assertIn("NUEVO-NOMBRE", r.stdout)

    def test_rejects_invalid_slug(self):
        r = subprocess.run(["bash", os.path.join(ROOT, "scripts", "rename.sh"), "--dry-run", "X", "9bad"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 65)

    def test_dry_run_changes_nothing(self):
        before = read("proyecto", "branding.py")
        r = subprocess.run(["bash", os.path.join(ROOT, "scripts", "rename.sh"), "--dry-run", "ARGOS"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("simulación", r.stdout)
        self.assertEqual(read("proyecto", "branding.py"), before)


if __name__ == "__main__":
    unittest.main()
