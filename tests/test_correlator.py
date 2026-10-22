import unittest

from trama.correlator import EvidenceCorrelationEngine, get_nested
from trama.custody import merkle_root
from tests.helpers import deep, normalize_all, sample_events, sample_rules


def run(events=None, rules=None):
    _, normalized = normalize_all(events)
    return EvidenceCorrelationEngine(rules or sample_rules()).evaluate_events(normalized)


def rule(rid, rules=None):
    return [r for r in (rules or sample_rules()) if r["id"] == rid]


class GetNestedTest(unittest.TestCase):
    def test_paths(self):
        d = {"a": {"b": [{"c": {"d": 1}}, {"c": {"d": 2}}, {"x": 0}]}}
        self.assertEqual(get_nested(d, "a.b.c.d"), [1, 2])  # antes ignoraba el resto de la ruta
        self.assertIsNone(get_nested(d, "a.z.q"))
        self.assertIsNone(get_nested({"a": 3}, "a.b"))


class SampleCorrelationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.res = run()
        cls.by_rule = {i["rule_id"]: i for i in cls.res["incidents"]}

    def test_three_incidents(self):
        self.assertEqual(self.res["total_incidents_correlated"], 3)
        self.assertEqual(set(self.by_rule), {"CORR-AD-001", "CORR-LNX-002", "CORR-WEB-003"})
        self.assertEqual(self.res["total_events_analyzed"], 6)

    def test_ad_kerberoasting_chain(self):
        inc = self.by_rule["CORR-AD-001"]
        self.assertEqual([e["event_id"] for e in inc["correlated_events"]], ["evt-ad-1005", "evt-ad-1006"])
        self.assertEqual(inc["correlation_vars"]["attacker_ip"], "10.10.14.22")
        self.assertEqual(inc["correlation_vars"]["target_service_account"], "svc_sql")
        self.assertEqual(inc["attack_duration_seconds"], 712)
        self.assertEqual(inc["incident_id"], "INC-CORR-AD-001-01")

    def test_linux_privesc_chain(self):
        inc = self.by_rule["CORR-LNX-002"]
        self.assertEqual([e["event_id"] for e in inc["correlated_events"]], ["evt-lnx-1003", "evt-lnx-1004"])
        self.assertEqual([e["stage_id"] for e in inc["correlated_events"]],
                         ["stage_1_privesc_enum", "stage_2_suid_or_cap_exploitation"])

    def test_web_sqli_chain(self):
        inc = self.by_rule["CORR-WEB-003"]
        self.assertEqual([e["event_id"] for e in inc["correlated_events"]], ["evt-web-1001", "evt-lnx-1002"])

    def test_incident_merkle_matches_evidence(self):
        for inc in self.res["incidents"]:
            self.assertEqual(inc["evidence_merkle_root_sha256"],
                             merkle_root([e["raw_log_sha256"] for e in inc["correlated_events"]]))

    def test_grc_and_mitre_carried(self):
        inc = self.by_rule["CORR-AD-001"]
        self.assertEqual([m["technique_id"] for m in inc["mitre_attack"]], ["T1558.003", "T1021.006"])
        self.assertIn("op.acc.5", [c["control_id"] for c in inc["grc_compliance_mapping"]["ens_rd_311_2022"]])

    def test_entity_graph(self):
        g = self.res["entity_graph"]
        self.assertEqual(len(g["edges"]), 6)
        nodes = {n["id"]: n for n in g["nodes"]}
        self.assertTrue(nodes["SPN:svc_sql"]["has_offensive_exposure"])
        self.assertFalse(nodes["IP:10.10.14.22"]["has_offensive_exposure"])


class RuleSemanticsTest(unittest.TestCase):
    def test_outside_window_no_incident(self):
        ev = sample_events()
        ev[5]["timestamp_utc"] = "2026-10-21T09:40:00.000Z"  # 58 min > ventana de 45 min
        self.assertEqual(run(ev, rule("CORR-AD-001"))["total_incidents_correlated"], 0)

    def test_order_independent_of_input_order(self):
        self.assertEqual(run(list(reversed(sample_events())))["total_incidents_correlated"], 3)

    def test_mixed_timezone_offsets_sorted_chronologically(self):
        ev = sample_events()
        ev[4]["timestamp_utc"] = "2026-10-21T10:42:11.412+02:00"  # mismo instante, otra zona
        self.assertEqual(len(run(ev, rule("CORR-AD-001"))["incidents"]), 1)

    def test_stage_requires_order(self):
        ev = sample_events()
        ev[5]["timestamp_utc"] = "2026-10-21T08:40:00.000Z"  # el movimiento lateral antes del TGS
        self.assertEqual(run(ev, rule("CORR-AD-001"))["total_incidents_correlated"], 0)

    def test_equals_ref_mismatch(self):
        ev = sample_events()
        ev[5]["source"]["ip"] = "10.10.14.99"
        self.assertEqual(run(ev, rule("CORR-AD-001"))["total_incidents_correlated"], 0)

    def test_posture_condition_required(self):
        self.assertEqual(run(None, rule("CORR-AD-001"))["total_incidents_correlated"], 1)
        _, normalized = normalize_all(findings=[])
        res = EvidenceCorrelationEngine(rule("CORR-AD-001")).evaluate_events(normalized)
        self.assertEqual(res["total_incidents_correlated"], 0)

    def test_strong_cipher_not_kerberoasting(self):
        ev = sample_events()
        ev[4]["process_or_artifact"]["EffectiveTicketEncryption"] = "0x12"  # AES256
        self.assertEqual(run(ev, rule("CORR-AD-001"))["total_incidents_correlated"], 0)

    def test_port_string_matches_int_list(self):
        ev = sample_events()
        ev[5]["target"]["port"] = "5985"
        self.assertEqual(run(ev, rule("CORR-AD-001"))["total_incidents_correlated"], 1)

    def test_suid_or_capability_required(self):
        ev = sample_events()
        ev[3]["process_or_artifact"]["capabilities"] = []
        self.assertEqual(run(ev, rule("CORR-LNX-002"))["total_incidents_correlated"], 0)
        ev[3]["process_or_artifact"]["suid_bit"] = True
        self.assertEqual(run(ev, rule("CORR-LNX-002"))["total_incidents_correlated"], 1)

    def test_capability_with_flags_suffix(self):
        ev = sample_events()
        ev[3]["process_or_artifact"]["capabilities"] = ["cap_setuid+ep"]
        self.assertEqual(run(ev, rule("CORR-LNX-002"))["total_incidents_correlated"], 1)

    def test_not_equals_root_enumeration_ignored(self):
        ev = sample_events()
        ev[2]["actor"]["uid"] = "0"
        self.assertEqual(run(ev, rule("CORR-LNX-002"))["total_incidents_correlated"], 0)

    def test_contains_any_case_insensitive(self):
        ev = sample_events()
        ev[0]["process_or_artifact"]["command_line"] = "POST /api/v1/login username=x' union select 1--"
        self.assertEqual(run(ev, rule("CORR-WEB-003"))["total_incidents_correlated"], 1)

    def test_no_duplicate_incidents_for_repeated_stage0(self):
        ev = sample_events()
        dup = deep(ev[4])
        dup["event_id"] = "evt-ad-1005b"
        dup["record_number"] = 148921
        dup["timestamp_utc"] = "2026-10-21T08:43:00.000Z"
        ev.insert(5, dup)
        self.assertEqual(run(ev, rule("CORR-AD-001"))["total_incidents_correlated"], 1)

    def test_two_independent_groups_two_incidents(self):
        ev = sample_events()
        extra = [deep(ev[4]), deep(ev[5])]
        for i, e in enumerate(extra):
            e["event_id"] += "-b"
            e["record_number"] += 1000
            e["target"]["target_user_or_spn"] = "svc_web"
            if i == 1:
                e["actor"]["user_name"] = "svc_web"
        findings = [{"finding_id": "AD-SPN-RC4-001", "hostname": "DC01.CORP.LOCAL", "target_spn": "svc_web"}]
        from tests.helpers import sample_findings
        _, normalized = normalize_all(ev + extra, sample_findings() + findings)
        res = EvidenceCorrelationEngine(rule("CORR-AD-001")).evaluate_events(normalized)
        self.assertEqual(res["total_incidents_correlated"], 2)
        self.assertEqual([i["incident_id"] for i in res["incidents"]],
                         ["INC-CORR-AD-001-01", "INC-CORR-AD-001-02"])

    def test_single_stage_rule(self):
        r = deep(rule("CORR-WEB-003")[0])
        r["id"] = "ONE"
        r["correlation"]["stages"] = r["correlation"]["stages"][:1]
        self.assertEqual(run(None, [r])["total_incidents_correlated"], 1)

    def test_no_events(self):
        res = EvidenceCorrelationEngine(sample_rules()).evaluate_events([])
        self.assertEqual((res["total_incidents_correlated"], res["entity_graph"]["nodes"]), (0, []))


if __name__ == "__main__":
    unittest.main()
