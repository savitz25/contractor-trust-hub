"""NYC-CON-001A DCWP HIC intelligence invariants."""
from __future__ import annotations

import copy
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/new-york-city-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
ACQ = json.loads((ROOT / "data/new-york/nyc-con-001/acquire-report.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/new-york-city-intelligence/publication.ts").read_text(encoding="utf-8")
UI = (ROOT / "components/new-york/nyc-local-intel-page.tsx").read_text(encoding="utf-8")
PAGE = (ROOT / "app/new-york/new-york-city/page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
HEADER = (ROOT / "lib/nav/header-nav.ts").read_text(encoding="utf-8")
CLAIM = (ROOT / "lib/claim/eligibility.ts").read_text(encoding="utf-8")
JSONLD = (ROOT / "lib/new-york-city-intelligence/jsonld.ts").read_text(encoding="utf-8")
NY_SNAP = json.loads((ROOT / "lib/new-york-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
FINGERPRINT = "f2eeebd447fef501c4ebfd8dd74273a68be76e7d213ac18c6bf64e152a4a5bc2"


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


class NycConTests(unittest.TestCase):
    def test_official_hic_slice(self):
        self.assertEqual(ACQ["hic_business_category"], "Home Improvement Contractor")
        self.assertTrue(ACQ["did_not_use_community_filtered_view"])
        self.assertEqual(ACQ["licenses"]["dataset_id"], "w7w3-xahh")
        self.assertEqual(ACQ["licenses"]["http_status"], 200)
        self.assertEqual(ACQ["licenses"]["raw_sha256"], SNAP["licenses"]["raw_sha256"])
        self.assertEqual(SNAP["licenses"]["parsed_rows"], 18931)
        self.assertEqual(SNAP["licenses"]["distinct_license_ids"], 18931)
        self.assertEqual(SNAP["licenses"]["rows_without_license_nbr"], 0)
        self.assertEqual(SNAP["licenses"]["rows_without_business_unique_id"], 0)
        self.assertEqual(SNAP["licenses"]["active_distinct_license_ids"], 13385)
        self.assertTrue(SNAP["licenses"]["status_is_source_native"])
        self.assertTrue(SNAP["licenses"]["did_not_manufacture_active_from_dates"])
        self.assertEqual(SNAP["licenses"]["license_status_counts"]["Active"], 13385)

    def test_identity_and_safety(self):
        self.assertEqual(SNAP["identity"]["license_namespace"], "NYC-DCWP-LICENSE:{license_nbr}")
        self.assertEqual(SNAP["identity"]["business_namespace"], "NYC-DCWP-BUSINESS:{business_unique_id}")
        self.assertTrue(SNAP["identity"]["license_ne_business_unique_id"])
        self.assertEqual(SNAP["identity"]["name_only"], "UNSAFE")
        self.assertEqual(SNAP["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["NET_NEW_PUBLIC_CONTRACTOR_PROFILES"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["GRAPH_WRITES"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["EXACT_PROFILE_ATTACHMENTS"], 0)
        self.assertFalse(SNAP["claim_eligibility"]["broadened"])
        self.assertNotIn("NYC-DCWP", CLAIM)
        self.assertNotIn("business_unique_id", CLAIM)

    def test_evidence_semantics(self):
        self.assertEqual(SNAP["complaints"]["parsed_rows"], 3341)
        self.assertTrue(SNAP["complaints"]["complaint_ne_violation"])
        self.assertEqual(SNAP["inspections"]["parsed_rows"], 102)
        self.assertTrue(SNAP["inspections"]["inspection_ne_violation"])
        self.assertEqual(SNAP["charges"]["parsed_rows"], 558)
        self.assertTrue(SNAP["charges"]["charge_ne_conviction"])
        self.assertGreater(SNAP["linking"]["exact_buid_any_evidence"], 0)
        self.assertEqual(SNAP["wall_of_shame"]["name_only_attachment"], "UNSAFE")
        self.assertEqual(SNAP["archive"]["coverage"], "HISTORICAL_ARCHIVE_NOT_ACQUIRED")

    def test_clocks_independent(self):
        self.assertNotEqual(SNAP["clocks"]["licenses"]["sourceAsOf"], SNAP["clocks"]["complaints"]["sourceAsOf"])
        self.assertNotEqual(SNAP["clocks"]["licenses"]["retrievedAt"], SNAP["clocks"]["inspections"]["retrievedAt"])
        self.assertTrue(SNAP["clocks"]["do_not_use_one_master_date"])

    def test_no_borough_pages_and_not_statewide(self):
        self.assertTrue(SNAP["no_borough_pages"])
        self.assertTrue((ROOT / "app/new-york/new-york-city/page.tsx").exists())
        self.assertFalse((ROOT / "app/new-york/manhattan").exists())
        self.assertFalse((ROOT / "app/new-york/brooklyn").exists())
        self.assertIn("/new-york/new-york-city", SITEMAP)
        self.assertNotIn("/new-york/manhattan", SITEMAP)
        self.assertIn('href: "/new-york/new-york-city"', HEADER)
        self.assertTrue(SNAP["not_statewide_nysdol_public_work"])
        self.assertEqual(NY_SNAP["fingerprint"], "27f39aad84544a1ecfb4db74934ddbac55f94bd087b2a9cf3b5de20305685f14")
        self.assertEqual(NY_SNAP["registry"]["parsed_rows"], 14665)

    def test_ui_grains(self):
        self.assertIn("s.hero.universe_value", UI)
        self.assertIn("not a ranking", UI.lower())
        self.assertIn("Trust Score", UI)
        self.assertIn("NYC_INTELLIGENCE_GATE", PAGE)
        self.assertIn("WebPage", JSONLD)
        self.assertIn("BreadcrumbList", JSONLD)
        self.assertIn("Dataset", JSONLD)
        self.assertNotIn("AggregateRating", JSONLD)
        self.assertIn(FINGERPRINT, PUB)

    def test_fingerprint_twice_and_mutations(self):
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertEqual(fingerprint(SNAP), FINGERPRINT)
        self.assertEqual(fingerprint(SNAP), fingerprint(SNAP))
        mut = copy.deepcopy(SNAP)
        mut["licenses"]["active_distinct_license_ids"] = 1
        self.assertNotEqual(fingerprint(mut), FINGERPRINT)
        mut2 = copy.deepcopy(SNAP)
        mut2["complaints"]["parsed_rows"] = 1
        self.assertNotEqual(fingerprint(mut2), FINGERPRINT)
        mut3 = copy.deepcopy(SNAP)
        mut3["identity"]["business_namespace"] = "CHANGED"
        self.assertNotEqual(fingerprint(mut3), FINGERPRINT)
        mut4 = copy.deepcopy(SNAP)
        mut4["clocks"]["licenses"]["sourceAsOf"] = "1999-01-01"
        self.assertNotEqual(fingerprint(mut4), FINGERPRINT)
        mut5 = copy.deepcopy(SNAP)
        mut5["complaints"]["coverage_state"] = "CHANGED"
        self.assertNotEqual(fingerprint(mut5), FINGERPRINT)
        mut6 = copy.deepcopy(SNAP)
        mut6["linking"]["exact_buid_any_evidence"] = 1
        self.assertNotEqual(fingerprint(mut6), FINGERPRINT)
        mut7 = copy.deepcopy(SNAP)
        mut7["expansion_ledger"]["GRAPH_WRITES"] = 1
        self.assertNotEqual(fingerprint(mut7), FINGERPRINT)
        alt = copy.deepcopy(SNAP)
        alt["generated_at"] = "2099-01-01T00:00:00Z"
        alt["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(fingerprint(alt), FINGERPRINT)

    def test_independent_rebuild(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "nyc_build", ROOT / "scripts" / "new-york-city" / "build_nyc_con_001_snapshot.py"
        )
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        first = dict(SNAP)
        second = copy.deepcopy(SNAP)
        second["generated_at"] = "2099-01-01T00:00:00Z"
        second["clocks"] = dict(SNAP["clocks"])
        second["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(mod.fingerprint(first), FINGERPRINT)
        self.assertEqual(mod.fingerprint(second), FINGERPRINT)


if __name__ == "__main__":
    unittest.main()
