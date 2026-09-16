"""OR-CON-001 fingerprint and frozen-grain tests."""
from __future__ import annotations

import copy
import gzip
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/oregon-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/oregon-intelligence/publication.ts").read_text(encoding="utf-8")
VOLATILE = {"fingerprint", "generated_at"}


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    out = {}
    for key, value in body.items():
        if key in VOLATILE:
            continue
        if key == "clocks" and isinstance(value, dict):
            out[key] = {ck: cv for ck, cv in value.items() if ck != "generatedAt"}
        else:
            out[key] = value
    return hashlib.sha256(dump(out).encode("utf-8")).hexdigest()


class OrConTests(unittest.TestCase):
    def test_frozen_counts(self):
        self.assertEqual(SNAP["ccb"]["SOURCE_ROWS"], 56172)
        self.assertEqual(SNAP["ccb"]["DISTINCT_NONEMPTY_LICENSE_IDS"], 45501)
        self.assertEqual(SNAP["hero"]["universe_value"], 45501)
        self.assertNotEqual(SNAP["hero"]["universe_value"], SNAP["ccb"]["SOURCE_ROWS"])
        self.assertEqual(SNAP["bcd"]["SOURCE_ROWS"], 47959)
        self.assertEqual(SNAP["bcd"]["ENTITY_GRAIN_DISTINCT_IDS"]["BUSINESS"], 5562)
        self.assertEqual(SNAP["bcd"]["ENTITY_GRAIN_DISTINCT_IDS"]["PERSON"], 33844)
        self.assertEqual(SNAP["expansion_ledger"]["GRAPH_WRITES"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"], 0)
        self.assertTrue(SNAP["bcd"]["not_added_to_ccb_denominator"])
        self.assertTrue(SNAP["no_portland_page"])
        self.assertEqual(SNAP["adverse"]["ccb_public_contract_ineligibility"]["PUBLICATION_STATUS"], "SOURCE_CURRENTLY_LISTS_NONE")

    def test_clocks(self):
        self.assertEqual(SNAP["clocks"]["ccb_sourceAsOf"], "2026-09-15")
        self.assertNotEqual(SNAP["clocks"]["ccb_retrievedAt"][:10], SNAP["clocks"]["ccb_sourceAsOf"])
        self.assertTrue(SNAP["clocks"]["retrievedAt_is_not_sourceAsOf"])

    def test_fingerprint(self):
        self.assertEqual(fingerprint(SNAP), SNAP["fingerprint"])
        self.assertIn(SNAP["fingerprint"], PUB)
        mutated = copy.deepcopy(SNAP)
        mutated["generated_at"] = "2099-01-01T00:00:00Z"
        mutated["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(fingerprint(mutated), SNAP["fingerprint"])
        mutated2 = copy.deepcopy(SNAP)
        mutated2["ccb"]["SOURCE_ROWS"] = 56173
        self.assertNotEqual(fingerprint(mutated2), SNAP["fingerprint"])

    def test_gzip_present(self):
        gz = ROOT / "data/oregon/or-con-001/ccb-active-licenses.csv.gz"
        self.assertTrue(gz.is_file())
        with gzip.open(gz, "rt", encoding="utf-8") as fh:
            header = fh.readline()
        self.assertIn("license_number", header)


if __name__ == "__main__":
    unittest.main()
