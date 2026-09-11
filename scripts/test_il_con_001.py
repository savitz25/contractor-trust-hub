"""IL-CON-001 Illinois roofing invariants."""
from __future__ import annotations

import copy
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/illinois-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
ACQ = json.loads((ROOT / "data/illinois/il-con-001/acquire-report.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/illinois-intelligence/publication.ts").read_text(encoding="utf-8")
UI = (ROOT / "components/illinois/il-state-intel-page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
CLAIM = (ROOT / "lib/claim/eligibility.ts").read_text(encoding="utf-8")
FINGERPRINT = "a9f63e7625d25fd64e4fe95b15f558a49fc719376154be481fdd062042dd0235"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    out = {}
    for key, value in body.items():
        if key in {"fingerprint", "generated_at"}:
            continue
        if key == "clocks" and isinstance(value, dict):
            out[key] = {ck: cv for ck, cv in value.items() if ck != "generatedAt"}
        else:
            out[key] = value
    return hashlib.sha256(dump(out).encode("utf-8")).hexdigest()


class GrainTests(unittest.TestCase):
    def test_rows_ne_distinct_and_headline(self):
        self.assertEqual(SNAP["roofing"]["source_rows"], 33891)
        self.assertEqual(SNAP["roofing"]["distinct_license_ids"], 33290)
        self.assertNotEqual(SNAP["roofing"]["source_rows"], SNAP["roofing"]["distinct_license_ids"])
        self.assertEqual(SNAP["business_licenses"]["active_business_y_rows"], 4891)
        self.assertEqual(SNAP["business_licenses"]["active_business_y_distinct_license_ids"], 4675)
        self.assertEqual(SNAP["hero"]["universe_value"], 4675)
        self.assertNotEqual(SNAP["hero"]["universe_value"], 4891)
        self.assertEqual(SNAP["business_licenses"]["status_conflict_ids"], 0)
        self.assertTrue(SNAP["not_statewide_gc_or_hic_license"])
        self.assertTrue(SNAP["qualifying_parties"]["person_grain"])
        self.assertTrue(SNAP["qualifying_parties"]["not_added_to_business_denominator"])
        self.assertNotEqual(SNAP["hero"]["universe_value"], SNAP["qualifying_parties"]["active_distinct_license_ids"])
        compact = " ".join(UI.lower().split())
        self.assertIn("statewide general-contractor", compact)
        self.assertIn("person credential", compact)

    def test_discipline_and_geography(self):
        self.assertNotEqual(SNAP["discipline"]["flag_rows"], SNAP["discipline"]["distinct_case_ids"])
        self.assertTrue(SNAP["discipline"]["flag_ne_case"])
        self.assertTrue(SNAP["discipline"]["observation_ne_conviction"])
        self.assertTrue(SNAP["discipline"]["not_master_dataset_discipline_counts"])
        self.assertLess(SNAP["discipline"]["flag_rows"], 20000)
        self.assertTrue(SNAP["geography"]["registration_jurisdiction_ne_mailing_address"])
        self.assertGreater(SNAP["geography"]["out_of_state_mailing_rows"], 0)
        self.assertTrue(SNAP["identity"]["blank_id_mints_no_identity"])
        self.assertEqual(SNAP["roofing"]["rows_without_license_id"], 48)
        self.assertEqual(SNAP["discipline"]["flag_rows"], 1393)
        self.assertEqual(SNAP["discipline"]["flag_distinct_license_ids"], 836)
        rows = json.loads((ROOT / "data/illinois/il-con-001/roofing-rows.json").read_text(encoding="utf-8"))
        def nid(r):
            return (r.get("license_number") or "").strip()
        flagged = [r for r in rows if (r.get("ever_disciplined") or "").upper() == "Y"]
        flagged_with_blank = {nid(r) for r in flagged}
        flagged_nonempty = {i for i in flagged_with_blank if i}
        self.assertIn("", flagged_with_blank)
        self.assertEqual(len(flagged_nonempty), 836)
        self.assertEqual(len(flagged_with_blank), 837)
        biz = {nid(r) for r in rows if (r.get("description") or "").strip().upper() == "LICENSED ROOFING CONTRACTOR" and nid(r)}
        qp = {nid(r) for r in rows if (r.get("description") or "").strip().upper() == "QUALIFYING PARTY ROOFING CONTRACTOR" and nid(r)}
        self.assertEqual(len(biz & qp), 0)
        inspect = (ROOT / "scripts/illinois/inspect_il_roofing.py").read_text(encoding="utf-8")
        self.assertIn("if not i:", inspect)
        self.assertIn("distinct nonempty ids", inspect)

    def test_no_local_claim_live(self):
        self.assertTrue(SNAP["no_local_illinois_routes"])
        self.assertFalse((ROOT / "app/illinois/chicago").exists())
        self.assertFalse((ROOT / "app/illinois/cook").exists())
        self.assertIn("/illinois", SITEMAP)
        self.assertNotIn("/illinois/chicago", SITEMAP)
        self.assertNotIn("il_idfpr", CLAIM)
        self.assertFalse(SNAP["claim_eligibility"]["broadened"])
        self.assertEqual(SNAP["expansion_ledger"]["GRAPH_WRITES"], 0)
        self.assertEqual(ACQ["full_professional_dataset_acquisition"], "NOT_PERFORMED")
        self.assertTrue(ACQ["count_consistent"])

    def test_fingerprint(self):
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertEqual(fingerprint(SNAP), FINGERPRINT)
        self.assertIn(FINGERPRINT, PUB)
        mut = copy.deepcopy(SNAP)
        mut["business_licenses"]["active_business_y_distinct_license_ids"] = 1
        self.assertNotEqual(fingerprint(mut), FINGERPRINT)
        mut2 = copy.deepcopy(SNAP)
        mut2["clocks"]["sourceUpdatedAt"] = "1999-01-01T00:00:00Z"
        self.assertNotEqual(fingerprint(mut2), FINGERPRINT)
        mut3 = copy.deepcopy(SNAP)
        mut3["identity"]["namespace"] = "OTHER"
        self.assertNotEqual(fingerprint(mut3), FINGERPRINT)
        second = copy.deepcopy(SNAP)
        second["generated_at"] = "2099-01-01T00:00:00Z"
        second["clocks"] = dict(SNAP["clocks"])
        second["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(fingerprint(second), FINGERPRINT)


if __name__ == "__main__":
    unittest.main()
