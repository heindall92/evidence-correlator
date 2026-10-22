"""Paridad CLI ↔ consola: los importadores y el motor de JavaScript dan exactamente lo mismo que Python.

La consola importa y correlaciona en el navegador con ``docs/assets/importers.js``
y ``docs/assets/engine.js``. Con el mismo reloj de custodia, el paquete que sale
de la consola tiene que ser idéntico al de ``trama run``: mismos eventos, mismos
sellos, misma raíz de Merkle y mismos incidentes. Estas pruebas ejecutan el código
de la consola con Node (``tests/parity/run_import.js``) y comparan campo a campo.
Si Node no está instalado se omiten.
"""
import itertools
import json
import os
import shutil
import subprocess
import unittest

from tests.helpers import ROOT
from trama import __version__
from trama.importers import import_files
from trama.pipeline import SAMPLE_EVENTS, SAMPLE_FINDINGS, read_text, run_pipeline, verify_bundle
from trama.rules import load_rules, rules_js

NODE = shutil.which("node")
HARNESS = os.path.join(ROOT, "tests", "parity", "run_import.js")
NATIVE = os.path.join(ROOT, "tests", "fixtures", "nativo")


def _clock():
    counter = itertools.count()
    return lambda: "2026-10-22T10:00:00.%06dZ" % next(counter)


def _node(payload):
    out = subprocess.run([NODE, HARNESS], input=json.dumps(payload), capture_output=True, text=True,
                         encoding="utf-8", timeout=120)
    if out.returncode:
        raise AssertionError("la consola falló:\n" + out.stderr)
    return json.loads(out.stdout)


def _plain(value):
    return json.loads(json.dumps(value))


def _native_files():
    return [[n, read_text(os.path.join(NATIVE, n))] for n in sorted(os.listdir(NATIVE))]


def _python_files_bundle(files, assets=None):
    events, findings, report = import_files([tuple(f) for f in files], assets)
    bundle = run_pipeline(events, findings, load_rules(), clock=_clock())
    bundle["dataset"] = "real"
    bundle["imports"] = report
    return bundle


# Entradas límite, todas benignas: finales de línea, BOM, espacios Unicode, entidades XML,
# fechas imposibles y registros a medias. Cada una se compara entre Python y JavaScript.
EDGE_CASES = [
    ("crlf_access.log",
     '10.0.0.5 - - [21/Oct/2026:08:00:00 +0200] "GET /index.html?q=a%20b+c HTTP/1.1" 200 512 "-" "curl/8.5"\r\n'
     '10.0.0.5 - ana [21/Oct/2026:08:00:01 +0200] "GET /%E2%82%AC%zz HTTP/1.1" 404 0 "-" "-"\r\n'
     '10.0.0.5 - - [31/Feb/2026:08:00:02 +0200] "GET / HTTP/1.1" 200 1 "-" "-"\r\n'
     'línea que no es un log\r\n'),
    ("bom_eve.json",
     "﻿" + json.dumps({"timestamp": "2026-10-21T08:00:00.123456+0000", "event_type": "http", "src_ip": "::ffff:10.0.0.9",
                            "dest_ip": "10.0.0.1", "dest_port": 443,
                            "http": {"hostname": "Portal.Example.Local", "url": "/a?b=%41", "http_method": "GET",
                                     "status": 200, "http_user_agent": "x y"}}) + "\n"
     + json.dumps({"timestamp": "no es fecha", "event_type": "alert"}) + "\n"
     + json.dumps({"timestamp": "2026-10-21T08:00:01Z", "event_type": "alert", "dest_ip": "10.0.0.1",
                   "alert": {"signature": "  firma\x1cde\tprueba  ", "signature_id": "2001", "severity": 2}}) + "\n"
     + "[1, 2]\n{roto\n"),
    ("entidades_wevtutil.xml",
     '<?xml version="1.0"?><Events><!-- comentario --><Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">'
     '<System><Provider Name="Microsoft-Windows-Security-Auditing"/><EventID>4624</EventID>'
     '<TimeCreated SystemTime="2026-10-21T08:00:00.1234567Z"/><EventRecordID>77</EventRecordID>'
     '<Channel>Security</Channel><Computer>ws01.example.local</Computer></System>'
     '<EventData><Data Name="TargetUserName">ana&amp;co&#x20AC;&#169;</Data><Data Name="TargetDomainName">EXAMPLE</Data>'
     '<Data Name="LogonType">3</Data><Data Name="IpAddress">10.0.0.7</Data><Data Name="IpPort">-</Data>'
     '<Data Name="WorkstationName"><![CDATA[WS<02>]]></Data></EventData></Event>'
     '<Event><System><EventID>4688</EventID><TimeCreated SystemTime="2026-13-40T00:00:00Z"/></System></Event></Events>'),
    ("ws01_audit.log",
     'type=SYSCALL msg=audit(1792569600.120:500): arch=c000003e syscall=59 success=yes exit=0 ppid=1 pid=900 auid=1000 uid=1000 '
     'gid=1000 euid=1000 comm="ls" exe="/usr/bin/ls"\x1dAUID="ana" UID="ana"\n'
     'type=EXECVE msg=audit(1792569600.120:500): argc=2 a0="ls" a1=2D6C61\n'
     'type=PROCTITLE msg=audit(1792569601.5:501): proctitle=6C73\n'),
    ("hosts.nmap.xml",
     '<?xml version="1.0"?><nmaprun><host><status state="up"/><address addr="10.0.0.1" addrtype="ipv4"/>'
     '<hostnames><hostname name="portal.example.local"/></hostnames><ports>'
     '<port protocol="tcp" portid="443"><state state="open"/><service name="https" product="nginx" version="1.24"/></port>'
     '<port protocol="tcp" portid="22"><state state="filtered"/></port></ports></host>'
     '<host><status state="down"/><address addr="10.0.0.2" addrtype="ipv4"/></host></nmaprun>'),
    ("nuclei_lista.json",
     json.dumps([{"template-id": "tls-version", "info": {"name": "TLS antiguo", "severity": "low", "tags": "ssl,tls"},
                  "matched-at": "portal.example.local:8443", "ip": "10.0.0.1"},
                 {"template-id": "tech-detect", "info": {"name": "Tecnología", "severity": "info"},
                  "matched-at": "https://portal.example.local/"}])),
    ("vacio.txt", "   \n\t\n"),
    ("dtd.xml", '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><nmaprun/>'),
]


@unittest.skipUnless(NODE, "Node no está instalado: se omite la paridad con la consola")
class ParityTest(unittest.TestCase):
    maxDiff = None

    def assertSame(self, py, js, where):
        self.assertEqual(_plain(py), js, "la consola y la CLI difieren en %s" % where)

    def test_each_native_file_imports_identically(self):
        for name, text in _native_files():
            with self.subTest(fichero=name):
                events, findings, report = import_files([(name, text)])
                js = _node({"mode": "import", "files": [[name, text]]})
                self.assertSame({"events": events, "findings": findings, "report": report}, js, name)

    def test_all_native_files_together(self):
        files = _native_files()
        events, findings, report = import_files([tuple(f) for f in files])
        self.assertGreater(len(events), 10)
        self.assertGreater(len(findings), 5)
        js = _node({"mode": "import", "files": files})
        self.assertSame({"events": events, "findings": findings, "report": report}, js, "la importación conjunta")

    def test_edge_cases_import_identically(self):
        for name, text in EDGE_CASES:
            with self.subTest(fichero=name):
                events, findings, report = import_files([(name, text)])
                js = _node({"mode": "import", "files": [[name, text]]})
                self.assertSame({"events": events, "findings": findings, "report": report}, js, name)
        # Juntas: ws01_audit.log y crlf_access.log toman el activo del nombre de host conocido por otros ficheros.
        files = [list(c) for c in EDGE_CASES]
        events, findings, report = import_files([tuple(f) for f in files])
        js = _node({"mode": "import", "files": files})
        self.assertSame({"events": events, "findings": findings, "report": report}, js, "los casos límite juntos")

    def test_demo_pipeline_is_byte_identical(self):
        raw, findings = json.loads(read_text(SAMPLE_EVENTS)), json.loads(read_text(SAMPLE_FINDINGS))
        py = _plain(run_pipeline(raw, findings, load_rules(), clock=_clock()))
        js = _node({"mode": "pipeline", "events": raw, "findings": findings})
        self.assertEqual(py["correlation_results"]["total_incidents_correlated"], 3)
        self.assertEqual(js.pop("generated_at_utc")[:2], "20")
        py.pop("generated_at_utc")
        self.assertSame(py, js, "el paquete de la demo")

    def test_files_pipeline_matches_and_cli_verifies_console_bundle(self):
        files = _native_files() + [["eventos.json", read_text(SAMPLE_EVENTS)], ["hallazgos.json", read_text(SAMPLE_FINDINGS)]]
        py = _plain(_python_files_bundle(files))
        js = _node({"mode": "files", "files": files})
        self.assertEqual(js["dataset"], "real")
        self.assertEqual(js["correlation_results"]["total_incidents_correlated"], 3)
        # El paquete generado en el navegador lo acepta `trama verify` tal cual.
        report = verify_bundle(js)
        self.assertTrue(report["valid"], report)
        self.assertEqual(report["merkle_root_sha256"], py["forensic_custody_verification"]["merkle_root_sha256"])
        js.pop("generated_at_utc")
        py.pop("generated_at_utc")
        self.assertSame(py, js, "el paquete con ficheros nativos")

    def test_console_rejects_like_the_cli_when_nothing_imports(self):
        out = subprocess.run([NODE, HARNESS], input=json.dumps({"mode": "files", "files": [["x.txt", "nada"]]}),
                             capture_output=True, text=True, encoding="utf-8", timeout=60)
        self.assertNotEqual(out.returncode, 0)
        self.assertIn("ningún fichero se pudo importar", out.stderr)


class ConsoleAssetsInSyncTest(unittest.TestCase):
    def test_rules_js_matches_rule_files(self):
        with open(os.path.join(ROOT, "docs", "assets", "rules.js"), encoding="utf-8") as fh:
            self.assertEqual(fh.read(), rules_js(), "regenera con: python -m trama rules-js")

    def test_engine_version_matches_package(self):
        with open(os.path.join(ROOT, "docs", "assets", "engine.js"), encoding="utf-8") as fh:
            self.assertIn('var VERSION = "%s"' % __version__, fh.read())


if __name__ == "__main__":
    unittest.main()
