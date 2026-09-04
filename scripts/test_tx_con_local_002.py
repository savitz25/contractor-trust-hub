"""TX-CON-LOCAL-002 City of Austin publication invariants."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/texas-intelligence/local/accepted-snapshot.json").read_text(encoding="utf-8"))
IDX = json.loads((ROOT / "lib/texas-intelligence/local/identity-index.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/texas-intelligence/local/publication.ts").read_text(encoding="utf-8")
LOOKUP = (ROOT / "lib/texas-intelligence/local/lookup.ts").read_text(encoding="utf-8")
PAGE = (ROOT / "app/texas/austin/page.tsx").read_text(encoding="utf-8")
UI = (ROOT / "components/texas/tx-austin-local-page.tsx").read_text(encoding="utf-8")
LOOKUP_UI = (ROOT / "components/texas/tx-austin-lookup.tsx").read_text(encoding="utf-8")
STATE_UI = (ROOT / "components/texas/tx-local-evidence-section.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
HEADER = (ROOT / "lib/nav/header-nav.ts").read_text(encoding="utf-8")
FOOTER = (ROOT / "components/layout/SiteFooter.tsx").read_text(encoding="utf-8")
JSONLD = (ROOT / "lib/texas-intelligence/local/jsonld.ts").read_text(encoding="utf-8")
UI_FLAT = re.sub(r"\s+", " ", UI.lower())
LOOKUP_FLAT = re.sub(r"\s+", " ", LOOKUP_UI.lower())


class SnapshotTests(unittest.TestCase):
    def test_fingerprint_and_version(self):
        self.assertEqual(SNAP["version"], "contractor-tx-austin-local-intel-v1")
        self.assertEqual(len(SNAP["fingerprint"]), 64)
        self.assertIn(SNAP["fingerprint"], PUB)
        self.assertEqual(IDX["fingerprint"], SNAP["fingerprint"])
        self.assertEqual(SNAP["ticket"], "TX-CON-LOCAL-002")
        self.assertFalse(SNAP["source_clock"]["runtime_csv_import"])
        self.assertEqual(SNAP["source_clock"]["csv_sha256"], "3ff78f727b98c7d8c7f6a17867e46afa133776c7fbb2b306b8b03cd9b7e53aa8")
        self.assertEqual(SNAP["source_clock"]["csv_rows"], 2373854)

    def test_austin_counts(self):
        a = SNAP["austin"]
        self.assertEqual(a["rows"], 2373854)
        self.assertEqual(a["dataset_id"], "3syk-w9eu")
        self.assertEqual(a["distinct_normalized_company_plus_phone"], 31908)
        self.assertEqual(SNAP["lookup"]["harvest_distinct_normalized_company_plus_phone"], 31908)
        self.assertEqual(SNAP["lookup"]["public_identities"], 31876)
        self.assertEqual(a["rows_with_contractor_company"], 1186388)
        self.assertEqual(a["rows_with_contractor_phone"], 1333297)
        self.assertEqual(a["contacts"]["phones"], 1333297)
        self.assertEqual(a["contacts"]["emails"], 0)
        self.assertEqual(a["contacts"]["provenance_phone"], "AUSTIN_PERMIT_CONTRACTOR_PHONE")
        self.assertEqual(a["contacts"]["provenance_address"], "AUSTIN_PERMIT_CONTRACTOR_ADDRESS")
        self.assertTrue(a["not_travis_county"])
        self.assertTrue(a["not_austin_metro"])
        self.assertEqual(IDX["rows"], SNAP["lookup"]["public_identities"])
        self.assertIn("OWNER", SNAP["lookup"]["placeholder_company_names_excluded"])

    def test_exact_id_zero_and_hc_internal(self):
        a = SNAP["austin"]
        self.assertEqual(a["exact_state_credential"], 0)
        self.assertFalse(a["source_native_tdlr_or_tsbpe_id"])
        self.assertFalse(a["source_native_city_contractor_number"])
        self.assertEqual(a["license_like_columns"], [])
        self.assertEqual(a["match_class"]["EXACT_STATE_CREDENTIAL"], 0)
        self.assertEqual(a["match_class"]["HIGH_CONFIDENCE_BUSINESS_MATCH"], 174673)
        self.assertTrue(a["high_confidence_is_not_license_verification"])
        self.assertTrue(a["high_confidence_is_internal_only"])
        self.assertTrue(SNAP["state_credential"]["high_confidence_is_not_license_verification"])
        self.assertNotIn("HIGH_CONFIDENCE", LOOKUP)
        self.assertTrue(IDX["match_class_not_on_public_identity"])
        sample = IDX["i"][0]
        self.assertNotIn("match_class", sample)
        self.assertNotIn("class", sample)
        self.assertNotIn("state_keys", sample)

    def test_local_only_not_unlicensed(self):
        loc = SNAP["local_only"]
        self.assertEqual(loc["rows"], 965876)
        self.assertEqual(loc["general"], 351005)
        self.assertTrue(loc["local_only_ne_unlicensed"])
        self.assertTrue(loc["no_statewide_general_contractor_license"])
        self.assertIn("LOCAL_ONLY != UNLICENSED", SNAP["semantics"])
        self.assertIn("HIGH_CONFIDENCE_BUSINESS_MATCH != LICENSE VERIFICATION", SNAP["semantics"])
        self.assertIn("local-only is not unlicensed", UI_FLAT)

    def test_tcad_join(self):
        t = SNAP["tcad"]
        self.assertEqual(t["exact_geo_id_joins"], 233085)
        self.assertEqual(t["distinct_permit_tcad_ids"], 254703)
        self.assertEqual(t["unmatched_permit_tcad_ids"], 21618)
        self.assertFalse(t["owner_dossiers"])
        self.assertTrue(t["appraisal_value_is_not_sale_price"])
        self.assertIn("tcad_id", t["join_key"])
        self.assertIn("geo_id", t["join_key"])


class RouteTests(unittest.TestCase):
    def test_austin_is_only_texas_local_page(self):
        self.assertTrue((ROOT / "app/texas/austin/page.tsx").exists())
        self.assertIn("City of Austin Contractor", UI)
        self.assertIn("not Travis County", UI)
        self.assertIn("noIndex: !TX_AUSTIN_GATE.robotsIndex", PAGE)
        self.assertIn('path: "/texas/austin"', SITEMAP)
        self.assertIn('href: "/texas/austin"', HEADER)
        self.assertIn("/texas/austin", FOOTER)
        for p in (
            "app/texas/travis",
            "app/texas/fort-worth",
            "app/texas/tarrant",
            "app/texas/san-antonio",
            "app/texas/bexar",
            "app/texas/houston",
            "app/texas/harris",
            "app/texas/dallas",
            "app/texas/[city]",
            "app/texas/[county]",
        ):
            self.assertFalse((ROOT / p).exists(), p)
        for path in (
            "/texas/fort-worth",
            "/texas/tarrant",
            "/texas/travis",
            "/texas/san-antonio",
            "/texas/houston",
            "/texas/harris",
            "/texas/dallas",
        ):
            self.assertNotIn(path, SITEMAP)
            self.assertNotIn(f'href: "{path}"', HEADER)

    def test_data_only_copy_has_no_fake_links(self):
        self.assertIn("Fort Worth — data only", STATE_UI)
        self.assertIn("San Antonio — data only", STATE_UI)
        self.assertIn("Houston / Harris — data only", STATE_UI)
        self.assertIn("No Fort Worth page", STATE_UI)
        self.assertIn("No San Antonio page", STATE_UI)
        self.assertIn("No Houston page", STATE_UI)
        self.assertNotIn('href="/texas/fort-worth"', STATE_UI)
        self.assertNotIn('href="/texas/san-antonio"', STATE_UI)
        self.assertNotIn('href="/texas/houston"', STATE_UI)
        self.assertEqual(SNAP["parked"]["fort_worth"]["route"], None)
        self.assertEqual(SNAP["parked"]["houston"]["building_permit_bulk"], "SOURCE_NOT_ACQUIRED / SEARCH_ONLY")
        self.assertEqual(SNAP["parked"]["harris"]["hcad_real_acct_rows"], 1628241)
        self.assertEqual(SNAP["parked"]["san_antonio"]["permits_issued_rows"], 139124)

    def test_regression_surfaces(self):
        self.assertTrue((ROOT / "app/california/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/san-francisco/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/los-angeles/page.tsx").exists())
        self.assertTrue((ROOT / "app/new-jersey/page.tsx").exists())
        self.assertTrue((ROOT / "app/florida").exists())
        self.assertTrue((ROOT / "app/texas/page.tsx").exists())
        self.assertIn('path: "/california/san-francisco"', SITEMAP)
        self.assertIn('path: "/california/los-angeles"', SITEMAP)
        self.assertIn('path: "/new-jersey"', SITEMAP)


class SemanticsTests(unittest.TestCase):
    def test_no_ranking_or_trust_score(self):
        self.assertFalse(SNAP["publication"]["rankings"])
        self.assertFalse(SNAP["publication"]["trustScore"])
        self.assertTrue(SNAP["lookup"]["never_sort_by_permit_count"])
        self.assertTrue(SNAP["lookup"]["never_sort_by_valuation"])
        self.assertIn("alphabetical_or_query_relevance", SNAP["lookup"]["sort"])
        self.assertIn("not a ranking", UI_FLAT)
        self.assertIn("never by permit count", LOOKUP_FLAT)
        self.assertEqual(SNAP["profile_integration"], "DEFERRED")

    def test_activity_semantics_locked(self):
        for rule in (
            "PERMIT != QUALITY",
            "PERMIT COUNT != QUALITY",
            "VALUATION != REVENUE",
            "FINAL != INSPECTIONS PASSED",
            "EXPIRED != DISCIPLINE",
            "VOID != MISCONDUCT",
            "LOCAL PERMIT CONTRACTOR != STATE LICENSEE",
            "NO TRUST SCORE",
            "NO RANKING",
        ):
            self.assertIn(rule, SNAP["semantics"])
        self.assertIn("final is a permit status", UI_FLAT)
        self.assertIn("expired is not discipline", UI_FLAT)
        self.assertIn("void is not misconduct", UI_FLAT)

    def test_identity_and_contacts(self):
        self.assertEqual(SNAP["austin"]["identity_key"], "AUSTIN_PERMIT_CONTRACTOR_IDENTITY")
        self.assertEqual(SNAP["austin"]["person_name_only"], "REVIEW_REQUIRED_NOT_PUBLIC")
        self.assertTrue(SNAP["lookup"]["person_name_only_not_public"])
        self.assertTrue(SNAP["lookup"]["not_a_complete_permit_directory"])
        self.assertIn("AUSTIN_PERMIT_CONTRACTOR_IDENTITY", LOOKUP_UI)
        self.assertIn("AUSTIN_PERMIT_CONTRACTOR_PHONE", LOOKUP_UI)
        self.assertIn("person-name-only", LOOKUP_FLAT)
        self.assertEqual(LOOKUP.count("localeCompare"), 2)

    def test_seo_and_jsonld(self):
        self.assertTrue(SNAP["publication"]["indexable"])
        self.assertEqual(SNAP["publication"]["robots"], "index,follow")
        self.assertEqual(SNAP["publication"]["canonical"], "https://www.contractortrusthub.com/texas/austin")
        self.assertEqual(SNAP["publication"]["h1"], "City of Austin Contractor & Permit Intelligence")
        self.assertIn('"@type": "WebPage"', JSONLD)
        self.assertIn('"@type": "BreadcrumbList"', JSONLD)
        self.assertIn('"@type": "Dataset"', JSONLD)
        self.assertIn('"@type": "ItemList"', JSONLD)
        self.assertIn("txAustinJsonLdHasForbiddenRatings", JSONLD)
        self.assertNotRegex(JSONLD, r"AggregateRating")
        self.assertIn("not a ranking, recommendation, or Trust Score", UI)
        self.assertNotIn("Trust Score:", UI)

    def test_closeout(self):
        self.assertTrue(SNAP["texas_local_harvest_closed"])
        self.assertTrue(SNAP["texas_fully_closed"])
        self.assertEqual(SNAP["next_state"], "WASHINGTON")
        self.assertEqual(SNAP["publication"]["dedicated"], ["/texas/austin"])


if __name__ == "__main__":
    unittest.main()
