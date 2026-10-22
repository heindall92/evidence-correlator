"""Importadores de formatos nativos: detección, traducción, seguridad y flujo completo."""
import io
import json
import os
import tempfile
import unittest

from trama.cli import main
from trama.importers import FORMATS, detect, guess_asset, import_files, parse_file
from trama.importers.common import ImportError_, iso, url_decode
from trama.pipeline import run_files, verify_bundle
from tests.helpers import ROOT

FIX = os.path.join(ROOT, "tests", "fixtures", "nativo")


def text(name):
    with open(os.path.join(FIX, name), encoding="utf-8") as fh:
        return fh.read()


def parse(name, asset=None):
    return parse_file(text(name), name, asset)


class DetectionTest(unittest.TestCase):
    EXPECTED = {
        "windows_evtx_dump.jsonl": "windows", "windows_evtx_dump.json": "windows",
        "windows_winlogbeat.ndjson": "windows", "windows_wevtutil.xml": "windows",
        "audit.log": "auditd", "access_srv01.log": "access_log", "eve.json": "suricata",
        "nmap.xml": "nmap", "scan.nessus": "nessus", "nuclei.jsonl": "nuclei", "burp.xml": "burp",
        "bloodhound_users.json": "bloodhound", "linpeas_srv01.txt": "linpeas",
    }

    def test_every_fixture_is_detected_by_content(self):
        for name, fmt in self.EXPECTED.items():
            with self.subTest(fichero=name):
                self.assertEqual(detect(text(name), name), fmt)
                # El nombre del fichero no decide el formato (salvo LinPEAS sin cabecera).
                if fmt != "linpeas":
                    self.assertEqual(detect(text(name), "datos.bin"), fmt)

    def test_trama_formats_and_unknown(self):
        sample = os.path.join(ROOT, "trama", "sample_data")
        with open(os.path.join(sample, "raw_telemetry_events.json"), encoding="utf-8") as fh:
            self.assertEqual(detect(fh.read()), "trama_events")
        with open(os.path.join(sample, "offensive_findings.json"), encoding="utf-8") as fh:
            self.assertEqual(detect(fh.read()), "trama_findings")
        self.assertEqual(detect('{"generator": {}, "custody_chain": []}'), "trama_bundle")
        self.assertIsNone(detect("hola, esto es un texto cualquiera"))
        self.assertIsNone(detect("<html><body></body></html>"))
        with self.assertRaises(ImportError_):
            parse_file("texto sin formato", "x.txt")

    def test_bom_and_every_format_has_a_label(self):
        self.assertEqual(detect("\ufeff" + text("nmap.xml")), "nmap")
        for fmt, (label, kind, _, _) in FORMATS.items():
            self.assertTrue(label and kind in ("events", "findings", "bundle"), fmt)


class WindowsTest(unittest.TestCase):
    def test_evtx_dump_jsonl(self):
        fmt, kind, ev, skipped = parse("windows_evtx_dump.jsonl")
        self.assertEqual((fmt, kind, len(ev), skipped), ("windows", "events", 3, 0))
        logon, tgs, sysmon = ev
        self.assertEqual(logon["timestamp_utc"], "2026-10-20T07:58:12.123Z")  # 7 decimales -> 3
        self.assertEqual((logon["event"]["action"], logon["event"]["LogonType"]), ("interactive_logon", 2))
        self.assertNotIn("ip", logon["source"])  # «-» no es una IP
        self.assertEqual(tgs["actor"]["user_name"], "a.lopez")  # sin @dominio
        self.assertEqual(tgs["source"], {"ip": "10.0.0.21", "port": 50211})  # sin ::ffff:
        self.assertEqual(tgs["process_or_artifact"]["EffectiveTicketEncryption"], "0x12")
        self.assertEqual(tgs["target"]["target_user_or_spn"], "http_web")
        self.assertEqual(sysmon["event_id"], "sysmon-WS01-7")
        self.assertEqual(sysmon["process_or_artifact"]["file_sha256"], "ab" * 32)
        self.assertEqual(sysmon["process_or_artifact"]["parent_process_name"], "C:\\Windows\\explorer.exe")

    def test_original_record_is_kept_verbatim(self):
        first_line = text("windows_evtx_dump.jsonl").split("\n")[0]
        self.assertEqual(parse("windows_evtx_dump.jsonl")[2][0]["native"],
                         {"format": "evtx_dump", "record": first_line})

    def test_record_blocks_winlogbeat_and_xml(self):
        self.assertEqual([e["event_id"] for e in parse("windows_evtx_dump.json")[2]], ["win-SRV01-5001", "win-SRV01-5002"])
        (beat,) = parse("windows_winlogbeat.ndjson")[2]
        self.assertEqual((beat["event"]["action"], beat["source"]["ip"], beat["native"]["format"]),
                         ("network_logon", "10.0.0.30", "winlogbeat"))
        (xml,) = parse("windows_wevtutil.xml")[2]
        self.assertEqual((xml["event"]["action"], xml["process_or_artifact"]["command_line"]),
                         ("process_creation", "ipconfig /all"))
        self.assertTrue(xml["native"]["record"].startswith("<Event ") and xml["native"]["record"].endswith("</Event>"))


class LinuxWebTest(unittest.TestCase):
    def test_auditd_groups_records_and_reads_enriched_names(self):
        ev = parse("audit.log")[2]
        self.assertEqual([e["process_or_artifact"]["command_line"] for e in ev],
                         ["ls -la /tmp", "echo hola mundo", "sudo apt update", "apt update"])  # argumento en hexadecimal
        self.assertEqual({e["actor"]["user_name"] for e in ev}, {"a.lopez"})
        self.assertEqual(ev[0]["target"]["hostname"], "srv01")  # node=
        self.assertEqual(ev[0]["timestamp_utc"], "2026-10-20T08:00:00.100Z")
        self.assertEqual(len(ev[0]["native"]["record"].split("\n")), 3)  # SYSCALL + EXECVE + PROCTITLE

    def test_auditd_sudo_is_not_an_escalation(self):
        apt = parse("audit.log")[2][3]
        self.assertEqual(apt["event"]["action"], "privileged_execution")
        self.assertEqual(apt["process_or_artifact"]["parent_process_name"], "/usr/bin/sudo")

    def test_auditd_setuid_by_child_of_unprivileged_process(self):
        lines = [
            'node=h type=SYSCALL msg=audit(1792483200.000:1): syscall=59 success=yes ppid=1 pid=10 auid=4294967295 '
            'uid=33 euid=33 exe="/usr/bin/python3" key="x"\x1dUID="www-data"',
            'node=h type=EXECVE msg=audit(1792483200.000:1): argc=1 a0="python3"',
            'node=h type=SYSCALL msg=audit(1792483201.000:2): syscall=59 success=yes ppid=10 pid=11 auid=4294967295 '
            'uid=0 euid=0 exe="/usr/bin/bash" key="x"\x1dUID="root"',
            'node=h type=EXECVE msg=audit(1792483201.000:2): argc=1 a0="bash"',
        ]
        ev = parse_file("\n".join(lines), "audit.log")[2]
        self.assertEqual(ev[1]["event"]["action"], "setuid_root_transition")
        self.assertEqual(ev[1]["actor"]["user_name"], "www-data")  # atribuido a la cuenta del padre
        self.assertEqual(ev[1]["process_or_artifact"]["parent_process_name"], "/usr/bin/python3")

    def test_access_log(self):
        fmt, kind, ev, skipped = parse("access_srv01.log", asset="SRV01")
        self.assertEqual((len(ev), skipped), (3, 1))
        self.assertEqual(ev[2]["timestamp_utc"], "2026-10-20T08:15:02.000Z")  # +0200 a UTC
        self.assertEqual(ev[2]["actor"]["user_name"], "b.ruiz")
        self.assertEqual(ev[2]["target"], {"hostname": "SRV01", "resource_path": "/login"})
        self.assertIn("/login?next=/panel principal", ev[2]["process_or_artifact"]["command_line"])
        self.assertEqual(ev[1]["event"]["outcome"], "failure")

    def test_suricata(self):
        fmt, kind, ev, skipped = parse("eve.json")
        self.assertEqual((len(ev), skipped), (2, 2))  # stats y la línea rota se omiten
        http, alert = ev
        self.assertEqual((http["source_type"], http["target"]["hostname"], http["timestamp_utc"]),
                         ("web_access_log", "srv01.lab.local", "2026-10-20T08:20:00.123Z"))
        self.assertEqual((alert["source_type"], alert["event_id"]), ("network_ids", "ids-93.184.216.34-2"))


class OffensiveTest(unittest.TestCase):
    def test_nmap(self):
        f = parse("nmap.xml")[2]
        self.assertEqual([x["port"] for x in f], [22, 443])  # cerrados y hosts caídos fuera
        self.assertEqual((f[0]["hostname"], f[0]["ip"], f[0]["finding_class"]), ("srv01.lab.local", "10.0.0.10", "exposed_service"))
        self.assertIn("OpenSSH 9.6", f[0]["title"])

    def test_nessus_burp_nuclei_skip_informational(self):
        for name, title in (("scan.nessus", "SSL Certificate Cannot Be Trusted"),
                            ("burp.xml", "Cookie without HttpOnly flag set"),
                            ("nuclei.jsonl", "Weak Cipher Suites")):
            with self.subTest(fichero=name):
                _, _, items, skipped = parse(name)
                self.assertEqual(([x["title"] for x in items], skipped), ([title], 1))
                self.assertEqual(items[0]["ip"], "10.0.0.10")
        self.assertEqual(parse("nuclei.jsonl")[2][0]["port"], 443)

    def test_classification(self):
        from trama.importers.common import classify
        self.assertEqual(classify("SQL Injection (time-based)"), "sqli")
        self.assertEqual(classify("Kerberoastable account"), "kerberoastable_spn")
        self.assertEqual(classify("Default credentials on admin panel"), "weak_credentials")
        self.assertEqual(classify("SSL Certificate Cannot Be Trusted"), "vulnerability")

    def test_bloodhound_only_enabled_accounts_with_spn(self):
        _, _, f, skipped = parse("bloodhound_users.json")
        self.assertEqual(skipped, 2)
        (only,) = f
        self.assertEqual((only["finding_class"], only["scope"], only["domain"], only["target_spn"]),
                         ("kerberoastable_spn", "domain", "LAB.LOCAL", "svc_backup"))
        self.assertEqual(only["spns"], ["MSSQLSvc/sql01.lab.local:1433"])

    def test_linpeas_dangerous_caps_and_gtfobins_only(self):
        f = parse("linpeas_srv01.txt")[2]
        self.assertEqual([(x["finding_class"], x["binary_path"]) for x in f],
                         [("dangerous_capability", "/usr/bin/python3.11"), ("suid_gtfobin", "/usr/bin/find")])
        self.assertEqual(f[0]["hostname"], "srv01")
        self.assertEqual(f[0]["capabilities"], ["cap_setuid"])
        # python3.11 es el GTFOBin «python» con versión: con cap_setuid es crítico.
        self.assertEqual(f[0]["severity"], "CRITICAL")


class SecurityTest(unittest.TestCase):
    def test_xml_with_dtd_is_rejected(self):
        evil = '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><nmaprun>&a;</nmaprun>'
        with self.assertRaises(ImportError_):
            parse_file(evil, "nmap.xml")

    def test_size_limit(self):
        from trama.importers import common
        old = common.MAX_BYTES
        try:
            import trama.importers as imp
            imp.MAX_BYTES = 10
            with self.assertRaises(ImportError_):
                parse_file(text("nmap.xml"), "nmap.xml")
        finally:
            imp.MAX_BYTES = old

    def test_impossible_dates_skip_only_that_record(self):
        for bad in ("2026-13-01T00:00:00Z", "2026-02-31T00:00:00Z", "2026-10-21T24:00:00Z", "1601-01-01T00:00:00Z"):
            with self.subTest(fecha=bad), self.assertRaises(ImportError_):
                iso(bad)
        self.assertEqual(iso("2024-02-29T23:59:59Z"), "2024-02-29T23:59:59.000Z")
        xml = ('<Events><Event><System><EventID>4688</EventID><TimeCreated SystemTime="2026-10-21T08:00:00Z"/>'
               '<Computer>ws01</Computer></System></Event><Event><System><EventID>4688</EventID>'
               '<TimeCreated SystemTime="2026-13-40T00:00:00Z"/><Computer>ws01</Computer></System></Event></Events>')
        _, _, events, skipped = parse_file(xml, "ws01.xml", fmt="windows")
        self.assertEqual((len(events), skipped), (1, 1))
        log = ('10.0.0.5 - - [21/Oct/2026:08:00:00 +0200] "GET / HTTP/1.1" 200 1 "-" "-"\n'
               '10.0.0.5 - - [31/Feb/2026:08:00:00 +0200] "GET / HTTP/1.1" 200 1 "-" "-"\n')
        _, _, events, skipped = parse_file(log, "web.log", "web01")
        self.assertEqual((len(events), skipped), (1, 1))

    def test_helpers(self):
        self.assertEqual(iso("2026-10-21T10:42:11.5+02:00"), "2026-10-21T08:42:11.500Z")
        self.assertEqual(url_decode("a%27+b%zz%E2%82%AC"), "a' b%zz€")


class ImportFilesTest(unittest.TestCase):
    def test_mixed_import_orders_dedupes_and_guesses_asset(self):
        names = ["access_srv01.log", "nmap.xml", "windows_evtx_dump.jsonl", "windows_evtx_dump.json", "audit.log"]
        events, findings, report = import_files([(n, text(n)) for n in names])
        stamps = [e["timestamp_utc"] for e in events]
        self.assertEqual(stamps, sorted(stamps))
        ids = [e["event_id"] for e in events]
        self.assertEqual(len(ids), len(set(ids)))  # los dos ficheros de Windows repiten registros: sufijo -2
        self.assertIn("win-SRV01-5001-2", ids)
        access = [r for r in report if r["file"] == "access_srv01.log"][0]
        self.assertEqual(access["asset"].lower(), "srv01")  # deducido del nombre: Nmap y Windows conocen SRV01
        self.assertEqual([r["file"] for r in report], names)

    def test_guess_asset(self):
        hosts = {"srv01.lab.local", "10.0.0.10", "web-prod-01"}
        self.assertEqual(guess_asset("access_srv01.log", hosts), "srv01")
        self.assertEqual(guess_asset("nginx-web-prod-01.log", hosts), "web-prod-01")
        self.assertIsNone(guess_asset("access.log", hosts))
        self.assertIsNone(guess_asset("srv012.log", hosts))  # no casa con un prefijo

    def test_errors_are_reported_per_file(self):
        events, findings, report = import_files([("raro.txt", "nada que ver"), ("nmap.xml", text("nmap.xml"))])
        self.assertEqual(report[0]["error"], "formato no reconocido")
        self.assertEqual(len(findings), 2)


class EndToEndTest(unittest.TestCase):
    def test_run_files_verifies_and_keeps_provenance(self):
        files = [os.path.join(FIX, n) for n in ("windows_evtx_dump.jsonl", "audit.log", "nmap.xml", "bloodhound_users.json")]
        bundle = run_files(files=files)
        self.assertEqual(bundle["dataset"], "real")
        self.assertEqual(len(bundle["imports"]), 4)
        self.assertEqual(len(bundle["raw_events"]), 7)
        self.assertTrue(verify_bundle(json.loads(json.dumps(bundle)))["valid"])

    def test_cli_run_and_import(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = io.StringIO()
            code = main(["run", "--color", "never", "-o", os.path.join(tmp, "b.json"),
                         os.path.join(FIX, "access_srv01.log"), os.path.join(FIX, "eve.json"),
                         "--asset", "access_srv01.log=SRV01"], out=out)
            self.assertEqual(code, 0, out.getvalue())
            self.assertIn("access_srv01.log · Log de acceso web (nginx, Apache) · eventos: 3 · omitidos: 1 · activo SRV01",
                          out.getvalue())
            with open(os.path.join(tmp, "b.json"), encoding="utf-8") as fh:
                self.assertEqual(len(json.load(fh)["normalized_events"]), 5)
        out = io.StringIO()
        self.assertEqual(main(["import", "--json", os.path.join(FIX, "nmap.xml")], out=out), 0)
        self.assertEqual(json.loads(out.getvalue())[0]["format"], "nmap")
        self.assertEqual(main(["run", "--asset", "sin-igual"], out=io.StringIO()), 1)


if __name__ == "__main__":
    unittest.main()
