import hashlib
import unittest

from proyecto.custody import CustodyChain, canonical_json, merkle_root, sha256_hex, verify_chain
from tests.helpers import deep, fixed_clock, normalize_all, sample_events


class MerkleTest(unittest.TestCase):
    H = [sha256_hex(str(i)) for i in range(7)]

    def test_empty_and_single(self):
        self.assertEqual(merkle_root([]), hashlib.sha256(b"").hexdigest())
        leaf = hashlib.sha256(b"\x00" + bytes.fromhex(self.H[0])).hexdigest()
        self.assertEqual(merkle_root(self.H[:1]), leaf)

    def test_order_matters(self):
        self.assertNotEqual(merkle_root(self.H[:4]), merkle_root(list(reversed(self.H[:4]))))

    def test_odd_leaf_is_not_duplicated(self):
        # CVE-2012-2459: con duplicación, [a,b,c] y [a,b,c,c] tendrían la misma raíz.
        self.assertNotEqual(merkle_root(self.H[:3]), merkle_root(self.H[:3] + self.H[2:3]))

    def test_leaf_and_node_domain_separation(self):
        a, b = self.H[0], self.H[1]
        inner = hashlib.sha256(b"\x01" + hashlib.sha256(b"\x00" + bytes.fromhex(a)).digest()
                               + hashlib.sha256(b"\x00" + bytes.fromhex(b)).digest()).hexdigest()
        self.assertEqual(merkle_root([a, b]), inner)
        self.assertNotEqual(merkle_root([inner]), merkle_root([a, b]))

    def test_any_leaf_change_changes_root(self):
        base = merkle_root(self.H)
        for i in range(len(self.H)):
            mod = list(self.H)
            mod[i] = sha256_hex("x")
            self.assertNotEqual(merkle_root(mod), base, i)


class ChainTest(unittest.TestCase):
    def setUp(self):
        self.raw = sample_events()
        self.chain, _ = normalize_all(self.raw)

    def test_valid_chain(self):
        rep = self.chain.verify(raw_events=self.raw)
        self.assertTrue(rep["valid"])
        self.assertEqual(rep["total_sealed_events"], 6)
        self.assertIsNone(rep["broken_at_index"])
        self.assertEqual(rep["head_seal_hash"], self.chain.chain[-1]["chain_seal_sha256"])

    def test_genesis_independent_of_project_name(self):
        self.assertEqual(self.chain.genesis_hash, sha256_hex(b"EVIDENCE_CUSTODY_GENESIS_v1"))

    def test_links_and_indexes(self):
        prev = self.chain.genesis_hash
        for i, blk in enumerate(self.chain.chain):
            self.assertEqual(blk["index"], i)
            self.assertEqual(blk["previous_node_hash"], prev)
            self.assertEqual(blk["raw_log_sha256"], sha256_hex(canonical_json(self.raw[i])))
            prev = blk["chain_seal_sha256"]

    def test_tampered_raw_hash(self):
        self.chain.chain[2]["raw_log_sha256"] = "0" * 64
        rep = self.chain.verify()
        self.assertFalse(rep["valid"])
        self.assertEqual(rep["broken_at_index"], 2)
        self.assertIn("total_sealed_events", rep)  # mismas claves siempre (antes: KeyError en la CLI)

    def test_tampered_timestamp(self):
        self.chain.chain[4]["ingested_at_utc"] = "2026-01-01T00:00:00.000000Z"
        self.assertEqual(self.chain.verify()["broken_at_index"], 4)

    def test_recomputed_seal_breaks_next_link(self):
        blk = self.chain.chain[1]
        blk["raw_log_sha256"] = "1" * 64
        blk["chain_seal_sha256"] = CustodyChain.seal_of(blk["previous_node_hash"], blk["raw_log_sha256"], blk["ingested_at_utc"])
        rep = self.chain.verify()
        self.assertEqual((rep["valid"], rep["broken_at_index"]), (False, 2))

    def test_modified_raw_event_detected(self):
        raw = deep(self.raw)
        raw[3]["actor"]["euid"] = "33"
        rep = self.chain.verify(raw_events=raw)
        self.assertEqual((rep["valid"], rep["broken_at_index"]), (False, 3))

    def test_raw_count_mismatch(self):
        self.assertFalse(self.chain.verify(raw_events=self.raw[:-1])["valid"])

    def test_truncation_detected_with_expected_head(self):
        head = self.chain.chain[-1]["chain_seal_sha256"]
        truncated = self.chain.chain[:-1]
        self.assertTrue(verify_chain(truncated)["valid"])  # sin ancla no se detecta...
        rep = verify_chain(truncated, expected_head=head)   # ...con ancla sí
        self.assertFalse(rep["valid"])

    def test_expected_merkle_root(self):
        good = self.chain.verify()["merkle_root_sha256"]
        self.assertTrue(self.chain.verify(expected_merkle_root=good)["valid"])
        self.assertFalse(self.chain.verify(expected_merkle_root="f" * 64)["valid"])

    def test_reordering_detected(self):
        c = self.chain.chain
        c[1], c[2] = c[2], c[1]
        self.assertFalse(verify_chain(c)["valid"])

    def test_deterministic_with_fixed_clock(self):
        c1, _ = normalize_all()
        c2, _ = normalize_all()
        self.assertEqual(c1.chain, c2.chain)

    def test_canonical_json_key_order_irrelevant(self):
        self.assertEqual(canonical_json({"b": 1, "a": "ñ"}), canonical_json({"a": "ñ", "b": 1}))
        self.assertEqual(canonical_json({"a": "ñ"}), '{"a":"ñ"}')

    def test_empty_chain(self):
        rep = CustodyChain(clock=fixed_clock()).verify()
        self.assertTrue(rep["valid"])
        self.assertEqual(rep["total_sealed_events"], 0)


if __name__ == "__main__":
    unittest.main()
