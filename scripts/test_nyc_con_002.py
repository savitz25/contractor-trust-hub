"""NYC-CON-002A DOB/PLUTO property intelligence invariants."""
from __future__ import annotations

import copy
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/new-york-city-dob-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
DCWP = json.loads((ROOT / "lib/new-york-city-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
NY = json.loads((ROOT / "lib/new-york-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
ACQ = json.loads((ROOT / "data/new-york/nyc-con-002/acquire-report.json").read_text(encoding="utf-8"))
PAGE = (ROOT / "app/new-york/new-york-city/page.tsx").read_text(encoding="utf-8")
UI = (ROOT / "components/new-york/nyc-local-intel-page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
FINGERPRINT = "d45b0d0492634786b9669a07988d228037f7b162e7a837ba605d4666c4f2a80f"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    out = {}
    for key, value in body.items():
        if key in {"fingerprint", "generated_at"}:
            continue
        if key == "clocks" and isinstance(value, dict):
            clocks = {}
            for ck, cv in value.items():
                if ck == "generatedAt":
                    continue
                if isinstance(cv, dict):
                    clocks[ck] = {ik: iv for ik, iv in cv.items() if ik != "generatedAt"}
                else:
                    clocks[ck] = cv
            out[key] = clocks
        else:
            out[key] = value
    return hashlib.sha256(dump(out).encode("utf-8")).hexdigest()


class NycCon002Tests(unittest.TestCase):
    def test_official_sources_and_window(self):
        self.assertEqual(SNAP["dob_now"]["dataset_id"], "rbx6-tga4")
        self.assertEqual(SNAP["legacy"]["dataset_id"], "ipu4-2q9a")
        self.assertEqual(SNAP["pluto"]["dataset_id"], "64uk-42ks")
        self.assertEqual(SNAP["dob_now"]["parsed_rows"], 337613)
        self.assertEqual(SNAP["dob_now"]["distinct_permit_ids"], 228515)
        self.assertEqual(SNAP["window"]["start"], "2024-09-12")
        self.assertTrue(SNAP["window"]["missing_older_history_ne_no_older_permit"])
        self.assertEqual(ACQ["dob_now"]["sha256"], SNAP["dob_now"]["raw_sha256"])

    def test_pluto_and_condo(self):
        self.assertEqual(SNAP["pluto"]["release"], "26v2")
        self.assertTrue(SNAP["pluto"]["no_bin_column"])
        self.assertEqual(SNAP["pluto"]["matched_rows"], 66525)
        self.assertGreater(SNAP["pluto"]["condo_lots"], 0)
        self.assertGreater(SNAP["pluto"]["addresses_with_multiple_bbls"], 0)
        self.assertTrue(SNAP["pluto"]["not_ownership_proof"])
        self.assertTrue(SNAP["pluto"]["not_acris"])

    def test_identity_firewall(self):
        self.assertEqual(SNAP["identity"]["bbl_namespace"], "NYC-BBL:{bbl}")
        self.assertEqual(SNAP["identity"]["name_only"], "UNSAFE")
        self.assertTrue(SNAP["linking"]["applicant_ne_contractor"])
        self.assertEqual(SNAP["expansion_ledger"]["EXACT_PROFILE_ATTACHMENTS"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["GRAPH_WRITES"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"], 0)
        self.assertTrue(SNAP["legacy"]["do_not_sum_with_dobnow"])

    def test_dcwp_and_statewide_frozen(self):
        self.assertEqual(DCWP["fingerprint"], "f2eeebd447fef501c4ebfd8dd74273a68be76e7d213ac18c6bf64e152a4a5bc2")
        self.assertEqual(DCWP["licenses"]["parsed_rows"], 18931)
        self.assertEqual(DCWP["licenses"]["active_distinct_license_ids"], 13385)
        self.assertEqual(NY["fingerprint"], "27f39aad84544a1ecfb4db74934ddbac55f94bd087b2a9cf3b5de20305685f14")
        self.assertTrue(SNAP["not_a_second_nyc_page"])
        self.assertEqual(SNAP["publication"]["route"], "/new-york/new-york-city")
        self.assertEqual(SITEMAP.count("/new-york/new-york-city"), 1)
        self.assertFalse((ROOT / "app/new-york/manhattan").exists())

    def test_page_module(self):
        self.assertIn("loadNycDobPlutoView", PAGE)
        self.assertIn("property-permit", UI)
        self.assertIn("Applicant is not contractor", UI)
        self.assertIn("Applicant is not contractor", UI)
        self.assertNotIn("AggregateRating", UI)

    def test_fingerprint_mutations(self):
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertEqual(fingerprint(SNAP), FINGERPRINT)
        mut = copy.deepcopy(SNAP)
        mut["dob_now"]["parsed_rows"] = 1
        self.assertNotEqual(fingerprint(mut), FINGERPRINT)
        mut2 = copy.deepcopy(SNAP)
        mut2["pluto"]["matched_rows"] = 1
        self.assertNotEqual(fingerprint(mut2), FINGERPRINT)
        mut3 = copy.deepcopy(SNAP)
        mut3["clocks"]["dob_now"]["sourceAsOf"] = "1999-01-01"
        self.assertNotEqual(fingerprint(mut3), FINGERPRINT)
        mut4 = copy.deepcopy(SNAP)
        mut4["linking"]["exact_dob_pluto_bbl"] = 1
        self.assertNotEqual(fingerprint(mut4), FINGERPRINT)
        mut5 = copy.deepcopy(SNAP)
        mut5["expansion_ledger"]["GRAPH_WRITES"] = 1
        self.assertNotEqual(fingerprint(mut5), FINGERPRINT)
        alt = copy.deepcopy(SNAP)
        alt["generated_at"] = "2099-01-01T00:00:00Z"
        alt["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(fingerprint(alt), FINGERPRINT)


if __name__ == "__main__":
    unittest.main()
