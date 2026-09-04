"""AZ-CON-001 Arizona publication invariants."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/arizona-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/arizona-intelligence/publication.ts").read_text(encoding="utf-8")
UI = (ROOT / "components/arizona/az-state-intel-page.tsx").read_text(encoding="utf-8")
PAGE = (ROOT / "app/arizona/page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
HEADER = (ROOT / "lib/nav/header-nav.ts").read_text(encoding="utf-8")
CLAIM = (ROOT / "lib/claim/eligibility.ts").read_text(encoding="utf-8")
JSONLD = (ROOT / "lib/arizona-intelligence/jsonld.ts").read_text(encoding="utf-8")
FINGERPRINT = "ac2bfa07ef7e65f7cfa1527cd4564161f989d27371166636e0cc012091db2cd1"


class SnapshotTests(unittest.TestCase):
    def test_fingerprint_version_gate(self):
        self.assertEqual(SNAP["version"], "contractor-az-state-intel-v1")
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertIn(SNAP["fingerprint"], PUB)
        self.assertTrue(SNAP["gate"]["passed"])
        self.assertTrue(SNAP["no_trust_score"])
        self.assertTrue(SNAP["no_ranking"])

    def test_current_header_and_overlap(self):
        c = SNAP["current_posting"]
        self.assertEqual(c["all_current"], 57886)
        self.assertEqual(c["commercial_file"], 46913)
        self.assertEqual(c["residential_file"], 47258)
        self.assertEqual(c["dual_file"], 36285)
        self.assertTrue(c["files_are_not_additive"])
        self.assertEqual(c["additive_sum_if_mistaken"], 46913 + 47258 + 36285)
        self.assertGreater(c["additive_sum_if_mistaken"], c["all_current"])

    def test_license_grain(self):
        ident = SNAP["identity"]
        self.assertEqual(ident["namespace"], "AZ-ROC:{License No}")
        self.assertEqual(ident["distinct_license_numbers"], 58131)
        self.assertEqual(ident["duplicate_license_rows"], 0)
        self.assertTrue(ident["license_row_ne_unique_company"])
        self.assertLess(ident["distinct_normalized_business_names"], ident["distinct_license_numbers"])
        self.assertGreater(ident["business_names_with_multiple_licenses"], 0)

    def test_extract_partitions(self):
        cats = SNAP["last_full_extract"]["category_counts"]
        self.assertEqual(cats["Dual"] + cats["Residential"] + cats["Commercial"] + cats.get("UNKNOWN", 0), 58131)
        self.assertTrue(SNAP["last_full_extract"]["category_sum_equals_rows"])

    def test_expansion_ledger(self):
        led = SNAP["expansion_ledger"]
        self.assertEqual(led["NET_NEW_CANONICAL_ORGANIZATIONS"], 0)
        self.assertEqual(led["NET_NEW_STATE_IDENTITIES"], 0)
        self.assertEqual(SNAP["pre_ingest_baseline"]["az_roc_licenses_in_network_metrics"], 58408)

    def test_discipline_and_unlicensed_safety(self):
        self.assertEqual(SNAP["discipline"]["attach"], "EXACT License No / AZ-ROC only")
        self.assertEqual(SNAP["discipline"]["name_only"], "UNSAFE")
        self.assertEqual(SNAP["unlicensed"]["name_only"], "UNSAFE_FOR_PROFILE_ATTACH")
        self.assertTrue(SNAP["unlicensed"]["historical_ne_currently_unlicensed"])
        self.assertTrue(SNAP["qualifying_party"]["person_ne_contractor_business"])


class PageTests(unittest.TestCase):
    def test_route_and_h1(self):
        self.assertIn("ArizonaIntelPage", PAGE)
        self.assertIn("ARIZONA_INTELLIGENCE_GATE", PAGE)
        self.assertEqual(UI.count("<h1"), 1)
        self.assertIn("Arizona Contractor License", UI)
        self.assertNotIn("best contractor", UI.lower())
        self.assertNotIn("Trust Score ranking", UI)
        self.assertIn("SOURCE_NOT_ACQUIRED", UI)
        self.assertIn("/arizona", SITEMAP)
        self.assertIn('href: "/arizona"', HEADER)
        self.assertNotRegex(JSONLD, r"AggregateRating")
        self.assertNotIn("app/arizona/phoenix/page.tsx", PAGE)
        self.assertFalse((ROOT / "app/arizona/phoenix").exists())
        self.assertFalse((ROOT / "app/arizona/maricopa").exists())
        self.assertFalse((ROOT / "app/arizona/mesa").exists())
        self.assertFalse((ROOT / "app/arizona/tucson").exists())
        self.assertFalse((ROOT / "app/arizona/scottsdale").exists())
        self.assertFalse((ROOT / "app/arizona/tempe").exists())
        self.assertFalse((ROOT / "app/arizona/chandler").exists())
        self.assertFalse((ROOT / "app/arizona/pima").exists())

    def test_siblings_and_claim(self):
        self.assertTrue((ROOT / "app/washington/page.tsx").exists())
        self.assertTrue((ROOT / "app/texas/page.tsx").exists())
        self.assertTrue((ROOT / "app/texas/austin/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/page.tsx").exists())
        self.assertTrue((ROOT / "app/new-jersey/page.tsx").exists())
        self.assertTrue((ROOT / "app/florida/page.tsx").exists())
        self.assertIn("fl_dbpr", CLAIM)
        self.assertNotRegex(CLAIM, r"az_roc|AZ-ROC")


if __name__ == "__main__":
    unittest.main()
