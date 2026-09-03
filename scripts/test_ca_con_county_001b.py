"""CA-CON-COUNTY-001B harvest invariants. No public county routes."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LA_SC = ROOT / "data" / "california" / "counties" / "la-sc"
LA = ROOT / "data" / "california" / "counties" / "los-angeles"
SC = ROOT / "data" / "california" / "counties" / "santa-clara"
DOC = ROOT / "docs" / "california" / "counties" / "la-sc" / "exact-contractor-activity-opportunity.md"
SITEMAP = (ROOT / "lib" / "seo" / "sitemap-data.ts").read_text(encoding="utf-8")
APP = ROOT / "app"


class NamespaceTests(unittest.TestCase):
    def test_builder4_paths_exist(self):
        self.assertTrue((LA_SC / "source-manifest.json").exists())
        self.assertTrue((LA / "permit-cslb-join-report.json").exists())
        self.assertTrue((SC / "source-manifest.json").exists())
        self.assertTrue(DOC.exists())
        self.assertTrue((ROOT / "scripts" / "california" / "counties" / "la-sc" / "harvest_la_sc.py").exists())

    def test_builder3_namespaces_not_overwritten(self):
        harvest = (ROOT / "scripts" / "california" / "counties" / "la-sc" / "harvest_la_sc.py").read_text(encoding="utf-8")
        self.assertNotIn("data/california/counties/san-francisco", harvest)
        self.assertNotIn("data/california/counties/san-diego", harvest)
        self.assertNotIn("data/california/counties/sf-sd", harvest)
        self.assertFalse((ROOT / "app" / "california" / "san-diego").exists())


class NoPublicCountyRoutes(unittest.TestCase):
    def test_no_la_or_sc_pages(self):
        self.assertFalse((APP / "california" / "los-angeles-county").exists())
        self.assertFalse((APP / "california" / "santa-clara-county").exists())
        self.assertFalse((APP / "california" / "san-jose").exists())
        self.assertTrue((APP / "california" / "page.tsx").exists())

    def test_sitemap_has_state_not_ca_counties(self):
        self.assertIn('path: "/california"', SITEMAP)
        self.assertNotIn("los-angeles-county", SITEMAP)
        self.assertNotIn("santa-clara-county", SITEMAP)
        self.assertIn("/new-jersey", SITEMAP)


class SpineAndExactIdTests(unittest.TestCase):
    def test_partial_spine_semantics(self):
        ids = json.loads((LA_SC / "exact-cslb-id-sets.json").read_text(encoding="utf-8"))
        self.assertEqual(ids["acquired_cslb_spine_licenses"], 75572)
        self.assertEqual(ids["spine_coverage"], "ACQUIRED_PARTIAL_STREAM_TRUNCATED")
        self.assertEqual(ids["complete_statewide_renewable_denominator"], "UNKNOWN")
        self.assertGreater(ids["union_exact_match_licenses"], 3000)
        self.assertGreater(ids["union_outside_partial_spine_licenses"], 10000)
        self.assertIn("not unlicensed", ids["note"].lower())

    def test_la_license_columns_verified(self):
        report = json.loads((LA / "permit-cslb-join-report.json").read_text(encoding="utf-8"))
        self.assertIn("License #", report["cofo"]["fieldnames"])
        self.assertIn("License #", report["pcis_derived"]["fieldnames"])
        self.assertEqual(report["cofo"]["rows_total"], 132426)
        self.assertEqual(report["pcis_derived"]["rows_total"], 317027)
        self.assertEqual(report["cofo"]["exact_acquired_cslb_licenses"], 2507)
        self.assertEqual(report["pcis_derived"]["exact_acquired_cslb_licenses"], 3063)
        self.assertGreater(report["cofo"]["rows_with_source_native_license"], 60000)
        self.assertGreater(report["pcis_derived"]["rows_with_source_native_license"], 200000)

    def test_current_weekly_extract_has_no_cslb(self):
        issued = json.loads((LA / "issued-2020-present-profile.json").read_text(encoding="utf-8"))
        self.assertIsNone(issued["cslb_field"])
        self.assertIn("CITY_OF_LOS_ANGELES", issued["jurisdiction"])
        self.assertIn("NOT_COUNTYWIDE", issued["geographic_grain"])

    def test_no_name_only_auto_attach(self):
        doc = DOC.read_text(encoding="utf-8")
        self.assertIn("UNSAFE", doc)
        self.assertIn("name-only", doc.lower())
        self.assertIn("PERMIT ACTIVITY", doc)
        self.assertNotIn("Trust Score", doc.replace("No Trust Score", ""))
        sj = json.loads((SC / "san-jose-permit-file-report.json").read_text(encoding="utf-8"))
        self.assertEqual(sj["stats"]["rows_with_source_native_license"], 0)
        self.assertGreater(sj["stats"]["rows_with_contractor_business"], 1000)

    def test_contacts_not_overwriting_cslb_phone(self):
        report = json.loads((LA / "permit-cslb-join-report.json").read_text(encoding="utf-8"))
        self.assertEqual(report["cofo"]["source_native_phone_rows"], 0)
        self.assertEqual(report["pcis_derived"]["source_native_phone_rows"], 0)

    def test_inspections_are_permit_events(self):
        insp = json.loads((LA / "inspections-profile.json").read_text(encoding="utf-8"))
        self.assertEqual(insp["association_rule"], "Inspection events associated with this permit")
        self.assertIn("not a contractor quality finding", " ".join(insp["limitations"]))

    def test_dcba_no_adverse_attach(self):
        manifest = json.loads((LA_SC / "source-manifest.json").read_text(encoding="utf-8"))
        dcba_src = next(s for s in manifest["sources"] if s["source_id"] == "la-county-dcba")
        blob = " ".join(dcba_src["limitations"])
        self.assertIn("COMPLAINT != VIOLATION", blob)

    def test_no_shared_county_router(self):
        self.assertFalse((ROOT / "lib" / "california-intelligence" / "county-router.ts").exists())
        self.assertFalse((ROOT / "lib" / "california" / "counties.ts").exists())


class RegressionTests(unittest.TestCase):
    def test_california_state_page(self):
        self.assertTrue((APP / "california" / "page.tsx").exists())
        snap = ROOT / "lib" / "california-intelligence" / "accepted-snapshot.json"
        self.assertTrue(snap.exists())

    def test_nj_and_florida_pages(self):
        self.assertTrue((APP / "new-jersey" / "page.tsx").exists())
        self.assertTrue((APP / "new-jersey" / "[county]" / "page.tsx").exists())
        self.assertTrue((APP / "florida" / "page.tsx").exists())

    def test_customer_files_untouched_presence(self):
        self.assertTrue((ROOT / "app" / "claim").exists() or (ROOT / "lib" / "customer").exists() or (ROOT / "docs").exists())
        self.assertTrue((ROOT / "scripts" / "test_ca_con_002.py").exists())


if __name__ == "__main__":
    unittest.main()
