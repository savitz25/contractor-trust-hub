"""NC-CON-001 snapshot fingerprint and grain tests."""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/north-carolina/build_nc_con_001_snapshot.py"


def load_builder():
    spec = importlib.util.spec_from_file_location("build_nc_con_001_snapshot", BUILDER)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


class TestNcCon001(unittest.TestCase):
    def test_fingerprint_stable_without_generated_at(self) -> None:
        builder = load_builder()
        snap = json.loads((ROOT / "lib/north-carolina-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
        self.assertIsNone(snap["nclbgc"]["NC_NCLBGC_ROWS"])
        self.assertEqual(snap["doa_debarment"]["NC_DOA_DEBARRED_VENDOR_ROWS"], 236)
        self.assertEqual(builder.sha_body(snap), snap["fingerprint"])
        clocked = json.loads(json.dumps(snap))
        clocked["generatedAt"] = "2099-01-01T00:00:00Z"
        clocked["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(builder.sha_body(clocked), snap["fingerprint"])

    def test_no_synthetic_total(self) -> None:
        snap = json.loads((ROOT / "lib/north-carolina-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
        self.assertIsNone(snap["hero"]["universe_value"])
        self.assertTrue(snap["nclbgc"]["mixed_38523_is_not_active_census"])
        self.assertTrue(snap["nclbgc"]["licensee_ne_qualifier"])
        self.assertTrue(snap["nclbgc"]["roofing_not_only_s_roofing"])
        self.assertEqual(snap["expansion_ledger"]["GRAPH_WRITES"], 0)


if __name__ == "__main__":
    unittest.main()
