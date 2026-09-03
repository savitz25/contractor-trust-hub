"""CA-CON-COUNTY-002 local publication invariants."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/california-intelligence/local/accepted-snapshot.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/california-intelligence/local/publication.ts").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
SF_PAGE = (ROOT / "app/california/san-francisco/page.tsx").read_text(encoding="utf-8")
LA_PAGE = (ROOT / "app/california/los-angeles/page.tsx").read_text(encoding="utf-8")
SF_UI = (ROOT / "components/california/ca-sf-local-page.tsx").read_text(encoding="utf-8")
LA_UI = (ROOT / "components/california/ca-la-local-page.tsx").read_text(encoding="utf-8")
STATE_UI = (ROOT / "components/california/ca-local-evidence-section.tsx").read_text(encoding="utf-8")
LOOKUP = (ROOT / "lib/california-intelligence/local/lookup.ts").read_text(encoding="utf-8")


class SnapshotTests(unittest.TestCase):
    def test_fingerprint_and_version(self):
        self.assertEqual(SNAP["version"], "contractor-ca-local-intel-v1")
        self.assertEqual(SNAP["fingerprint"], "8bda38b1d8a365d832331b9a5168a1e7429eb7c764e0665c2a040493b8e54373")
        self.assertIn(SNAP["fingerprint"], PUB)

    def test_sf_counts(self):
        sf = SNAP["san_francisco"]
        self.assertEqual(sf["permits"]["rows"], 1294909)
        self.assertEqual(sf["permits"]["distinct_permit_numbers"], 1149123)
        self.assertEqual(sf["contacts"]["rows"], 1032543)
        self.assertEqual(sf["contacts"]["exact_acquired_cslb_licenses"], 2729)
        self.assertEqual(sf["contacts"]["outside_partial_spine_licenses"], 20450)
        self.assertEqual(sf["inspections"]["rows"], 702749)
        self.assertEqual(sf["business"]["rows"], 366307)
        self.assertTrue(sf["business"]["high_confidence_is_not_license_verification"])

    def test_la_counts(self):
        la = SNAP["los_angeles"]
        self.assertEqual(la["cofo"]["rows"], 132426)
        self.assertEqual(la["pcis"]["rows"], 317027)
        self.assertEqual(la["pcis"]["as_of"], "2023-05-22")
        self.assertEqual(la["current_permits_2020_present"]["rows"], 409619)
        self.assertIsNone(la["current_permits_2020_present"]["cslb_field"])
        self.assertEqual(la["union"]["exact_acquired_cslb_licenses"], 3708)
        self.assertEqual(la["union"]["outside_partial_spine_licenses"], 16704)
        self.assertTrue(la["not_los_angeles_county"])
        self.assertEqual(la["inspections"]["rows"], 11691152)

    def test_exact_keys_not_name_matches(self):
        self.assertTrue(SNAP["exact_activity_index"]["no_high_confidence_name_matches"])
        self.assertIn("CA-CSLB", SNAP["exact_activity_index"]["key"])
        self.assertNotIn("HIGH_CONFIDENCE", LOOKUP)
        self.assertTrue(SNAP["cslb_spine"]["outside_partial_is_not_unlicensed"])


class RouteTests(unittest.TestCase):
    def test_dedicated_routes(self):
        self.assertTrue((ROOT / "app/california/san-francisco/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/los-angeles/page.tsx").exists())
        self.assertIn("City and County of San Francisco Contractor", SF_UI)
        self.assertIn("City of Los Angeles Contractor", LA_UI)
        self.assertIn("not Los Angeles County", LA_UI)
        self.assertIn("noIndex: !CA_SF_GATE.robotsIndex", SF_PAGE)
        self.assertIn("noIndex: !CA_LA_GATE.robotsIndex", LA_PAGE)

    def test_no_unwanted_routes(self):
        self.assertFalse((ROOT / "app/california/san-diego").exists())
        self.assertFalse((ROOT / "app/california/san-jose").exists())
        self.assertFalse((ROOT / "app/california/san-diego-county").exists())
        self.assertFalse((ROOT / "app/california/santa-clara-county").exists())
        self.assertFalse((ROOT / "app/california/los-angeles-county").exists())
        self.assertNotIn("/california/san-diego", SITEMAP)
        self.assertNotIn("/california/san-jose", SITEMAP)
        self.assertIn('path: "/california/san-francisco"', SITEMAP)
        self.assertIn('path: "/california/los-angeles"', SITEMAP)

    def test_modules_on_state_page(self):
        self.assertIn("City of San Diego", STATE_UI)
        self.assertIn("City of San Jose", STATE_UI)
        self.assertIn("not San Diego County", STATE_UI)
        self.assertEqual(SNAP["san_diego"]["approvals_created_2024_2026"]["rows"], 172453)
        self.assertEqual(SNAP["san_jose"]["source_native_cslb"], 0)


class SemanticsTests(unittest.TestCase):
    def test_inspection_wording(self):
        self.assertIn("associated with permit", SF_UI.lower())
        self.assertIn("does not establish that a contractor passed", SF_UI.lower())
        self.assertIn("inspection events associated with that permit", LA_UI.lower())
        self.assertNotIn("contractor passed", SF_UI.lower().replace("does not establish that a contractor passed", ""))

    def test_no_ranking(self):
        self.assertFalse(SNAP["publication"]["rankings"])
        self.assertFalse(SNAP["publication"]["trustScore"])
        self.assertIn("PERMIT ACTIVITY != QUALITY", SNAP["semantics"])
        self.assertEqual(SNAP["profile_integration"], "DEFERRED")
        self.assertTrue(SNAP["california_local_closeout"])


class GeographyTests(unittest.TestCase):
    def test_types(self):
        self.assertEqual(SNAP["geographies"]["san-francisco"]["geography_type"], "CITY_COUNTY")
        self.assertEqual(SNAP["geographies"]["los-angeles"]["geography_type"], "CITY")
        self.assertEqual(SNAP["geographies"]["san-diego"]["geography_type"], "CITY")
        self.assertEqual(SNAP["geographies"]["san-jose"]["geography_type"], "CITY")


if __name__ == "__main__":
    unittest.main()
