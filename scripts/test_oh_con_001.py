"""OH-CON-001 snapshot fingerprint and grain tests."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/ohio/build_oh_con_001_snapshot.py"


def load_builder():
    spec = importlib.util.spec_from_file_location("build_oh_con_001_snapshot", BUILDER)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


class TestOhCon001(unittest.TestCase):
    def test_fingerprint_stable_without_generated_at(self) -> None:
        builder = load_builder()
        snap = json.loads((ROOT / "lib/ohio-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
        self.assertEqual(snap["hero"]["universe_value"], 9528)
        self.assertEqual(snap["ocilb"]["OH_OCILB_ALL_TRADE_CREDENTIAL_ROWS"], 12461)
        self.assertNotEqual(snap["hero"]["universe_value"], snap["ocilb"]["OH_OCILB_ALL_TRADE_CREDENTIAL_ROWS"])
        self.assertEqual(builder.sha_body(snap), snap["fingerprint"])
        clocked = json.loads(json.dumps(snap))
        clocked["generatedAt"] = "2099-01-01T00:00:00Z"
        clocked["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(builder.sha_body(clocked), snap["fingerprint"])

    def test_identity_and_status_semantics(self) -> None:
        snap = json.loads((ROOT / "lib/ohio-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
        self.assertEqual(snap["regulatory_model"]["OH_GENERAL_CONTRACTOR_STATE_ROSTER_STATUS"], "UNSUPPORTED")
        self.assertTrue(snap["ocilb"]["do_not_sum_trade_rows_as_unique_contractors"])
        self.assertEqual(snap["status"]["OH_OCILB_ACTIVE_IN_RENEWAL_ROWS"], 975)
        self.assertTrue(snap["status"]["active_in_renewal_is_not_expired"])
        self.assertEqual(snap["discipline"]["OH_OCILB_DISCIPLINE_COVERAGE"], "OPEN_SEARCH_ONLY")
        self.assertIsNone(snap["unlicensed"]["OH_OCILB_UNLICENSED_ENFORCEMENT_ROWS"])
        self.assertIsNone(snap["fire_protection"]["OH_FIRE_DESIGNER_ROWS"])
        self.assertEqual(snap["expansion_ledger"]["GRAPH_WRITES"], 0)
        self.assertFalse(snap["expansion_ledger"]["CLAIM_ELIGIBILITY_BROADENED"])
        self.assertEqual(snap["permits"]["OH_BUILDING_PERMIT_CAPABILITY"], "LOCAL_OR_FRAGMENTED")


if __name__ == "__main__":
    unittest.main()
