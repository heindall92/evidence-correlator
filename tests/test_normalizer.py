import unittest

from trama.custody import CustodyChain
from trama.normalizer import EvidenceNormalizer
from tests.helpers import fixed_clock, normalize_all, sample_events, sample_findings


class NormalizerTest(unittest.TestCase):
    def setUp(self):
        self.chain, self.events = normalize_all()
        self.by_id = {e["event_id"]: e for e in self.events}

    def test_schema_shape(self):
        for ev in self.events:
            self.assertEqual(ev["schema_version"], "1.0.0")
            for key in ("forensic_chain", "event", "actor", "source", "target",
                        "process_or_artifact", "offensive_posture_context", "graph_keys"):
                self.assertIn(key, ev)

    def test_windows_fields(self):
        ev = self.by_id["evt-ad-1005"]
        self.assertEqual(ev["event"]["NativeEventID"], 4769)
        self.assertEqual(ev["process_or_artifact"]["EffectiveTicketEncryption"], "0x17")
        self.assertEqual(ev["graph_keys"]["target_node"], "SPN:svc_sql")

    def test_uid_strings(self):
        ev = self.by_id["evt-lnx-1004"]
        self.assertEqual((ev["actor"]["uid"], ev["actor"]["euid"]), ("33", "0"))
        self.assertIn("cap_setuid", ev["process_or_artifact"]["capabilities"])

    def test_offensive_context_spn_specific(self):
        ids = [x["finding_id"] for x in self.by_id["evt-ad-1005"]["offensive_posture_context"]["known_exposures"]]
        self.assertEqual(ids, ["AD-SPN-RC4-001"])
        self.assertEqual(self.by_id["evt-ad-1005"]["offensive_posture_context"]["asset_criticality"], "HIGH")

    def test_offensive_context_binary_specific(self):
        ids = {x["finding_id"] for x in self.by_id["evt-lnx-1004"]["offensive_posture_context"]["known_exposures"]}
        self.assertIn("LNX-CAP-SETUID-002", ids)
        ids_bash = {x["finding_id"] for x in self.by_id["evt-lnx-1002"]["offensive_posture_context"]["known_exposures"]}
        self.assertNotIn("LNX-CAP-SETUID-002", ids_bash)
        self.assertIn("WEB-SQLI-LOGIN-003", ids_bash)  # hallazgo genérico del host

    def test_host_match_case_insensitive(self):
        norm = EvidenceNormalizer(CustodyChain(clock=fixed_clock()), sample_findings())
        m = norm.match_offensive_context("web-prod-01")
        self.assertEqual([x["finding_id"] for x in m], ["WEB-SQLI-LOGIN-003"])
        self.assertEqual(norm.match_offensive_context(None), [])

    def test_short_name_ip_alias_and_domain_scope(self):
        findings = [
            {"finding_id": "N1", "hostname": "web-prod-01.corp.local", "ip": "10.10.10.80"},   # Nmap: nombre e IP
            {"finding_id": "U1", "hostname": "10.10.10.80", "ip": "10.10.10.80"},             # Nuclei: solo IP
            {"finding_id": "B1", "scope": "domain", "domain": "CORP.LOCAL", "target_spn": "svc_sql",
             "spns": ["MSSQLSvc/db01.corp.local:1433"]},                                     # BloodHound
        ]
        norm = EvidenceNormalizer(CustodyChain(clock=fixed_clock()), findings)
        ids = lambda m: sorted(x["finding_id"] for x in m)
        self.assertEqual(ids(norm.match_offensive_context("WEB-PROD-01")), ["N1", "U1"])
        self.assertEqual(ids(norm.match_offensive_context("DC01.CORP.LOCAL", "svc_sql")), ["B1"])
        self.assertEqual(ids(norm.match_offensive_context("DC01", "mssqlsvc/db01.corp.local:1433", domain="CORP")), ["B1"])
        self.assertEqual(ids(norm.match_offensive_context("DC01.CORP.LOCAL", "otra")), [])
        self.assertEqual(ids(norm.match_offensive_context("OTRO.EJEMPLO.LOCAL", "svc_sql")), [])

    def test_binary_finding_matches_parent_process(self):
        findings = [{"finding_id": "C1", "hostname": "WEB-PROD-01", "binary_path": "/usr/bin/python3",
                     "capabilities": ["cap_setuid"]}]
        norm = EvidenceNormalizer(CustodyChain(clock=fixed_clock()), findings)
        ev = norm.normalize({"timestamp_utc": "2026-10-21T08:00:00Z", "target": {"hostname": "WEB-PROD-01"},
                             "process_or_artifact": {"process_name": "/usr/bin/bash",
                                                     "parent_process_name": "/usr/bin/python3"}}, 0)
        self.assertEqual([x["finding_id"] for x in ev["offensive_posture_context"]["known_exposures"]], ["C1"])
        self.assertEqual(ev["process_or_artifact"]["capabilities"], ["cap_setuid"])

    def test_minimal_event_defaults(self):
        norm = EvidenceNormalizer(CustodyChain(clock=fixed_clock()))
        ev = norm.normalize({"timestamp_utc": "2026-10-21T08:00:00Z", "target": None}, 0)
        self.assertEqual(ev["event_id"], "evt-0001")
        self.assertEqual(ev["actor"]["user_name"], "anonymous")
        self.assertEqual(ev["target"]["hostname"], "UNKNOWN_HOST")
        self.assertEqual(ev["event"]["outcome"], "unknown")
        self.assertEqual(ev["offensive_posture_context"]["known_exposures"], [])

    def test_missing_or_bad_timestamp(self):
        norm = EvidenceNormalizer(CustodyChain(clock=fixed_clock()))
        for bad in ({}, {"timestamp_utc": "ayer"}):
            with self.assertRaises(ValueError):
                norm.normalize(bad, 0)
        with self.assertRaises(ValueError):
            norm.normalize(["no", "dict"], 0)
        self.assertEqual(norm.custody.chain, [])  # no se sella un evento rechazado

    def test_each_event_sealed_once(self):
        self.assertEqual(len(self.chain.chain), len(sample_events()))
        self.assertEqual([e["forensic_chain"] for e in self.events], self.chain.chain)


if __name__ == "__main__":
    unittest.main()
