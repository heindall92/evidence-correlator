import json
import os
import tempfile
import unittest

from trama.rules import RULES_DIR, RuleError, load_rules, validate_rule
from tests.helpers import deep, sample_rules


class RulesTest(unittest.TestCase):
    def test_bundled_rules_valid(self):
        rules = load_rules()
        self.assertEqual([r["id"] for r in rules], ["CORR-AD-001", "CORR-LNX-002", "CORR-WEB-003"])

    def test_load_single_file_and_list(self):
        path = os.path.join(RULES_DIR, "corr_ad_001.json")
        self.assertEqual(len(load_rules(path)), 1)
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "bundle.json")
            with open(p, "w", encoding="utf-8") as fh:
                json.dump(sample_rules(), fh)
            self.assertEqual(len(load_rules(p)), 3)

    def test_duplicate_ids_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            r = sample_rules()[0]
            for n in ("a.json", "b.json"):
                with open(os.path.join(d, n), "w", encoding="utf-8") as fh:
                    json.dump(r, fh)
            with self.assertRaises(RuleError):
                load_rules(d)

    def test_empty_dir_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(RuleError):
                load_rules(d)

    def test_validation_errors(self):
        base = sample_rules()[0]
        cases = [
            lambda r: r.pop("mitre_attack"),
            lambda r: r.update(severity="URGENTE"),
            lambda r: r.update(confidence=1.5),
            lambda r: r["correlation"].update(window="45"),
            lambda r: r["correlation"].update(stages=[]),
            lambda r: r["correlation"]["stages"][1].update(stage_id=r["correlation"]["stages"][0]["stage_id"]),
            lambda r: r["correlation"]["stages"][0].setdefault("predicates", {}).update(regex_magic={}),
        ]
        for mutate in cases:
            r = deep(base)
            mutate(r)
            with self.assertRaises(RuleError):
                validate_rule(r)

    def test_rule_metadata(self):
        for r in sample_rules():
            self.assertEqual(r["author"], "Yoandy Ramírez Delgado")
            for m in r["mitre_attack"]:
                self.assertRegex(m["technique_id"], r"^T\d{4}(\.\d{3})?$")
            for fw in ("ens_rd_311_2022", "iso_27001_2022", "nis2_directive"):
                self.assertIn(fw, r["grc_compliance_mapping"])


if __name__ == "__main__":
    unittest.main()
