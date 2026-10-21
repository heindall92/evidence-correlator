import io
import json
import os
import subprocess
import sys
import tempfile
import unittest

from proyecto import NAME, __version__, cli
from proyecto.pipeline import run_files, verify_bundle, write_bundle, write_dashboard_js
from tests.helpers import ROOT


class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.bundle = run_files()

    def test_bundle_shape(self):
        b = self.bundle
        self.assertEqual(b["generator"], {"name": NAME, "version": __version__, "schema_version": "1.0.0"})
        self.assertTrue(b["forensic_custody_verification"]["valid"])
        self.assertEqual(len(b["custody_chain"]), 6)
        self.assertEqual(len(b["raw_events"]), 6)
        self.assertEqual(len(b["grc_summary"]["ens_rd_311_2022"]), 5)

    def test_grc_summary_links_incidents(self):
        ens = {c["control_id"]: c for c in self.bundle["grc_summary"]["ens_rd_311_2022"]}
        self.assertEqual(ens["op.acc.5"]["incidents"], ["INC-CORR-AD-001-01"])

    def test_verify_roundtrip_json(self):
        b = json.loads(json.dumps(self.bundle))
        self.assertTrue(verify_bundle(b)["valid"])

    def test_verify_detects_raw_tamper(self):
        b = json.loads(json.dumps(self.bundle))
        b["raw_events"][0]["source"]["ip"] = "1.2.3.4"
        rep = verify_bundle(b)
        self.assertEqual((rep["valid"], rep["broken_at_index"]), (False, 0))

    def test_verify_detects_incident_evidence_swap(self):
        b = json.loads(json.dumps(self.bundle))
        b["correlation_results"]["incidents"][0]["evidence_merkle_root_sha256"] = "0" * 64
        rep = verify_bundle(b)
        self.assertFalse(rep["valid"])
        self.assertEqual(rep["incidents_failed"], ["INC-CORR-AD-001-01"])

    def test_verify_detects_dropped_block(self):
        b = json.loads(json.dumps(self.bundle))
        b["custody_chain"].pop()
        b["raw_events"].pop()
        self.assertFalse(verify_bundle(b)["valid"])

    def test_verify_without_raw(self):
        b = run_files(embed_raw=False)
        self.assertNotIn("raw_events", b)
        self.assertTrue(verify_bundle(json.loads(json.dumps(b)))["valid"])

    def test_dashboard_js_is_script_safe(self):
        with tempfile.TemporaryDirectory() as d:
            self.bundle["raw_events"][0]["note"] = "</script><script>alert(1)</script>"
            p = os.path.join(d, "sub", "bundle.js")
            write_dashboard_js(self.bundle, p)
            with open(p, encoding="utf-8") as fh:
                text = fh.read()
            self.assertTrue(text.startswith("/*"))
            self.assertIn("window.EVIDENCE_BUNDLE = ", text)
            self.assertNotIn("</script>", text)
            payload = text.split("window.EVIDENCE_BUNDLE = ", 1)[1].rstrip().rstrip(";")
            self.assertEqual(json.loads(payload)["raw_events"][0]["note"], "</script><script>alert(1)</script>")


class CliTest(unittest.TestCase):
    def call(self, *argv):
        out = io.StringIO()
        code = cli.main(list(argv), out=out)
        return code, out.getvalue()

    def test_run_default_and_no_color(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "nested", "b.json")  # el directorio no existe: antes fallaba
            code, out = self.call("run", "--color", "never", "-o", p)
            self.assertEqual(code, 0)
            self.assertIn(NAME, out)
            self.assertIn("INC-CORR-WEB-003-01", out)
            self.assertNotIn("\033[", out)
            self.assertTrue(os.path.exists(p))

    def test_no_subcommand_means_run(self):
        with tempfile.TemporaryDirectory() as d:
            code, out = self.call("--color", "never", "run", "-o", os.path.join(d, "b.json"), "--json")
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(out)["incidents"], 3)

    def test_verify_ok_and_tampered(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "b.json")
            self.call("run", "-o", p, "--json")
            self.assertEqual(self.call("verify", p)[0], 0)
            with open(p, encoding="utf-8") as fh:
                b = json.load(fh)
            b["custody_chain"][3]["raw_log_sha256"] = "a" * 64
            write_bundle(b, p)
            code, out = self.call("verify", p, "--json")
            self.assertEqual(code, 2)
            self.assertEqual(json.loads(out)["broken_at_index"], 3)

    def test_rules_command(self):
        code, out = self.call("rules", "--color", "never")
        self.assertEqual(code, 0)
        self.assertIn("3 reglas válidas", out)

    def test_errors_return_1(self):
        old, sys.stderr = sys.stderr, io.StringIO()
        try:
            self.assertEqual(self.call("run", "--events", "/no/existe.json")[0], 1)
            self.assertEqual(self.call("verify", "/no/existe.json")[0], 1)
        finally:
            sys.stderr = old

    def test_force_color(self):
        with tempfile.TemporaryDirectory() as d:
            _, out = self.call("run", "--color", "always", "-o", os.path.join(d, "b.json"))
            self.assertIn("\033[", out)

    def test_module_entrypoint_smoke(self):
        with tempfile.TemporaryDirectory() as d:
            r = subprocess.run([sys.executable, "-W", "error", "-m", "proyecto", "--version"],
                               cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn(__version__, r.stdout)
            r = subprocess.run([sys.executable, "-W", "error", "-m", "proyecto", "run", "-o",
                                os.path.join(d, "b.json"), "--dashboard-js", os.path.join(d, "b.js")],
                               cwd=ROOT, capture_output=True, text=True, env=dict(os.environ, NO_COLOR="1"))
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertTrue(os.path.exists(os.path.join(d, "b.js")))


if __name__ == "__main__":
    unittest.main()
