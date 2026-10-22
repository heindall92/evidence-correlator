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
