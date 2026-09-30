"""Integrity gates for read-only Contractor holder reconciliation."""

import csv
import hashlib
import json
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/TH-ENRICH-CON-2026-09-30-IDR1"
RAW = ROOT / "data/raw/th_enrich_b1"
MANIFEST = json.loads((ROOT / "docs/TH-ENRICH-2026-09-30-B1-source-manifest.json").read_text())


def rows(name):
    with (OUT / f"{name}-reconciliation.csv").open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


class HolderReconciliation(unittest.TestCase):
    def test_source_hashes(self):
        files = {"fl_dbpr_asbestos_59": "lic59asb.csv", "fl_dbpr_eclb_08": "lic08el.csv",
                 "nyc_dob_license_info": "t8hj-ruu2.csv", "ny_dol_mold": "ikqx-ispy.csv",
                 "ny_elevator": "jrac-r9vc.csv", "nj_dfs_fire_business": "nj_fire_permitted_business_2026.pdf"}
        expected = {s["id"]: s["sha256"] for s in MANIFEST["sources"]}
        for dataset, filename in files.items():
            self.assertEqual(hashlib.sha256((RAW / filename).read_bytes()).hexdigest(), expected[dataset])

    def test_asbestos_business_grain_and_active_qualification(self):
        all_rows = rows("fl_dbpr_asbestos_59")
        za = [r for r in all_rows if r["credential_class"] == "ZA"]
        self.assertEqual((len(all_rows), len(za)), (1157, 228))
        self.assertEqual(len({r["native_key"] for r in za}), 228)
        self.assertEqual(Counter(r["source_status"] for r in za), {"C|-": 172, "C|A": 56})
        self.assertTrue(all(r["classification"] == "NEW_BUSINESS_WITH_AUTHORITATIVE_ID" for r in za))
        self.assertTrue(all(not r["existing_business_id"] for r in all_rows))

    def test_nyc_gc_cannot_be_counted_as_businesses(self):
        all_rows = rows("nyc_dob_license_info")
        gc = [r for r in all_rows if r["credential_class"] == "GENERAL CONTRACTOR" and r["source_status"] == "ACTIVE"]
        self.assertEqual((len(all_rows), len(gc)), (103236, 9752))
        self.assertTrue(all(r["classification"] == "CREDENTIAL_ONLY" and r["holder_name_raw"] and r["associated_business_name_raw"] for r in gc))
        self.assertFalse(any(r["classification"] == "NEW_BUSINESS_WITH_AUTHORITATIVE_ID" for r in all_rows))
        self.assertFalse(any(r["credential_class"] == "FIRE SUPPRESSION CONTRACTOR" for r in gc))

    def test_status_holds_and_nj_count_exception(self):
        self.assertEqual(Counter(r["source_status"] for r in rows("ny_dol_mold")), {"Active": 1761, "Expired": 749})
        self.assertEqual(Counter(r["source_status"] for r in rows("ny_elevator")), {"Active": 212, "Expired": 90})
        elec = rows("fl_dbpr_eclb_08")
        self.assertEqual(sum(r["classification"] == "PERSON" and r["is_current_active"] == "YES" for r in elec), 16614)
        self.assertEqual(len(rows("nj_dfs_fire_business")), 542)
        self.assertEqual(json.loads((OUT / "classification-counts.json").read_text())["nj_evidence_baseline"], 542)
        self.assertTrue(all(r["classification"] == "HELD" for r in rows("nj_dfs_fire_business")))

    def test_person_hold_is_separate(self):
        with (OUT / "person-credential-hold.csv").open(newline="", encoding="utf-8") as stream:
            people = list(csv.DictReader(stream))
        self.assertEqual(len(people), 87874)
        self.assertEqual(Counter(r["source_dataset"] for r in people)["fl_dbpr_mold_07"], 6558)
        self.assertEqual(Counter(r["source_dataset"] for r in people)["fl_dbpr_home_04"], 8026)


if __name__ == "__main__":
    unittest.main()
