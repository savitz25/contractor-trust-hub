"""TX-CON-001 Texas publication invariants."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/texas-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
UI = (ROOT / "components/texas/tx-state-page.tsx").read_text(encoding="utf-8")
PAGE = ROOT / "app/texas/page.tsx"
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
FOOTER = (ROOT / "components/layout/SiteFooter.tsx").read_text(encoding="utf-8")
HEADER = (ROOT / "lib/nav/header-nav.ts").read_text(encoding="utf-8")
PUB = (ROOT / "lib/texas-intelligence/publication.ts").read_text(encoding="utf-8")
CLAIM = (ROOT / "lib/claim/eligibility.ts").read_text(encoding="utf-8")
JSONLD = (ROOT / "lib/texas-intelligence/jsonld.ts").read_text(encoding="utf-8")
UI_FLAT = re.sub(r"\s+", " ", UI.lower())
FINGERPRINT = "25d00ad3f4547ba212f4e2304177f788898c48d4750d1483944301eb1accadc6"


class PublicationTests(unittest.TestCase):
    def test_01_route_exists(self):
        self.assertTrue(PAGE.exists())

    def test_02_indexable(self):
        self.assertTrue(SNAP["publication"]["indexable"])
        self.assertEqual(SNAP["publication"]["robots"], "index,follow")

    def test_03_canonical(self):
        self.assertEqual(SNAP["publication"]["canonical"], "https://www.contractortrusthub.com/texas")
        self.assertEqual(SNAP["publication"]["h1"], "Texas Contractor & Trade Intelligence")

    def test_04_sitemap_nav(self):
        self.assertIn('path: "/texas"', SITEMAP)
        self.assertIn('href: "/texas"', HEADER)
        self.assertIn("/texas", FOOTER)

    def test_05_fingerprint(self):
        self.assertEqual(len(SNAP["fingerprint"]), 64)
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertIn(SNAP["fingerprint"], PUB)
        self.assertEqual(SNAP["version"], "contractor-tx-state-intel-v1")
        self.assertTrue(SNAP["gate"]["passed"])
        self.assertIsNone(SNAP["gate"]["blocker"])


class SemanticsTests(unittest.TestCase):
    def test_06_no_statewide_gc(self):
        self.assertFalse(SNAP["no_statewide_general_contractor_license"] is False)
        self.assertTrue(SNAP["no_statewide_general_contractor_license"])
        self.assertFalse(SNAP["regulatory_map"]["statewide_general_contractor_license"])
        self.assertIn("does not use one statewide general-contractor", UI_FLAT)
        self.assertNotRegex(UI, r"Texas has 38,915 contractors")
        self.assertNotRegex(UI, r"Texas has 983,494 contractors")

    def test_07_no_fake_all_texas_count(self):
        self.assertEqual(SNAP["tdlr"]["soda"]["row_count"], 983494)
        self.assertEqual(SNAP["tdlr"]["soda"]["grain_totals"]["BUSINESS_CONTRACTOR"], 37834)
        self.assertEqual(SNAP["tdlr"]["soda"]["grain_totals"]["PERSON_TRADE_CREDENTIAL"], 391308)
        self.assertGreater(SNAP["tdlr"]["soda"]["grain_totals"]["OTHER"], SNAP["tdlr"]["soda"]["grain_totals"]["BUSINESS_CONTRACTOR"])
        self.assertIn("not a contractor census", UI_FLAT)

    def test_08_business_vs_person(self):
        self.assertEqual(SNAP["tdlr"]["business_contractor"]["distinct_keys"], 38915)
        self.assertEqual(SNAP["tsbpe"]["responsible_master_plumber"]["distinct_keys"], 9360)
        self.assertEqual(SNAP["tsbpe"]["person_credentials"]["distinct_keys"], 34105)
        self.assertTrue(SNAP["tsbpe"]["rmp_may_contract_with_public"])
        self.assertTrue(SNAP["tsbpe"]["master_plumber_is_person"])
        self.assertFalse(SNAP["qualifier_relationships"]["publish_people_as_profiles"])
        self.assertIn("person trade license is not a contractor business", UI_FLAT)

    def test_09_status_reconciliation(self):
        listing = SNAP["tdlr"]["listing_status"]
        self.assertEqual(listing["CURRENT_BY_EXPIRATION"], 34563)
        self.assertEqual(listing["EXPIRED_BY_EXPIRATION"], 3515)
        self.assertTrue(listing["expired_is_not_disciplined"])
        self.assertTrue(listing["clear_is_not_verified"])
        rmp = SNAP["tsbpe"]["responsible_master_plumber"]["status_buckets"]
        self.assertEqual(rmp["Current"], 8570)
        self.assertEqual(rmp["Expired"], 790)
        self.assertNotEqual(rmp["Current"], rmp["Expired"])

    def test_10_contacts(self):
        self.assertEqual(SNAP["contacts"]["tdlr_business_phone_public_eligible"], 18485)
        self.assertEqual(SNAP["contacts"]["tsbpe_rmp_phone_public_eligible"], 4776)
        self.assertFalse(SNAP["contacts"]["person_phones_published"])
        self.assertTrue(SNAP["contacts"]["business_phone_is_not_personal"])
        self.assertTrue(SNAP["contacts"]["mail_address_is_not_service_area"])
        self.assertFalse(SNAP["contacts"]["inferred_email_or_website"])
        self.assertIn("PUBLIC_ELIGIBLE", UI)

    def test_11_vendor_semantics(self):
        self.assertEqual(SNAP["cmbl"]["web_name_rows"], 12000)
        self.assertEqual(SNAP["cmbl"]["construction_vendor_vids"], 3337)
        self.assertEqual(SNAP["cmbl"]["match"]["EXACT"], 0)
        self.assertEqual(SNAP["cmbl"]["match"]["HIGH_CONFIDENCE"], 43)
        self.assertEqual(SNAP["cmbl"]["match"]["NET_NEW_BUSINESS_CANDIDATES"], 2982)
        self.assertIn("EXACT official credential ID only", SNAP["cmbl"]["adverse_attach_rule"])
        self.assertIn("not unlicensed", UI_FLAT)
        self.assertIn("HIGH_CONFIDENCE is not attached as adverse", UI)

    def test_12_txdot_tceq(self):
        self.assertEqual(SNAP["txdot"]["row_count"], 8605)
        self.assertTrue(SNAP["txdot"]["construction_manager_is_txdot_staff"])
        self.assertIsNone(SNAP["txdot"]["awarded_contractor_field"])
        self.assertEqual(SNAP["tceq"]["coverage"], "PARKED_REGIONAL_FRAGMENT")
        self.assertIn("NOT_CONTRACTOR", SNAP["tceq"]["semantics"])

    def test_13_no_texas_local_routes(self):
        # TX-CON-001 snapshot flag is historical. TX-CON-LOCAL-002 publishes Austin only.
        self.assertTrue(SNAP["no_texas_local_routes"])
        self.assertTrue((ROOT / "app/texas/austin").exists())
        self.assertIn('path: "/texas/austin"', SITEMAP)
        self.assertFalse((ROOT / "app/texas/houston").exists())
        self.assertFalse((ROOT / "app/texas/dallas").exists())
        self.assertFalse((ROOT / "app/texas/san-antonio").exists())
        self.assertFalse((ROOT / "app/texas/fort-worth").exists())
        self.assertFalse((ROOT / "app/texas/harris").exists())
        self.assertNotIn("/texas/houston", SITEMAP)
        self.assertNotIn("/texas/dallas", SITEMAP)
        self.assertNotIn("/texas/fort-worth", SITEMAP)
        self.assertEqual(SNAP["statewide_permits"]["coverage"], "LOCAL_FRAGMENTED")

    def test_14_no_trust_score(self):
        self.assertTrue(SNAP["no_trust_score"])
        self.assertTrue(SNAP["no_ranking"])
        self.assertIn("not a ranking, recommendation, or Trust Score", UI)
        self.assertIn("No Trust Score", UI)
        builder, _, helper = JSONLD.partition("txJsonLdHasForbiddenRatings")
        self.assertFalse(re.search(r"aggregateRating|ratingValue", builder))
        self.assertIn("aggregateRating", helper)


class RegressionTests(unittest.TestCase):
    def test_15_california_closed_routes(self):
        self.assertTrue((ROOT / "app/california/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/san-francisco/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/los-angeles/page.tsx").exists())
        self.assertIn('path: "/california"', SITEMAP)
        self.assertIn('path: "/california/san-francisco"', SITEMAP)
        self.assertIn('path: "/california/los-angeles"', SITEMAP)

    def test_16_nj_and_florida(self):
        self.assertTrue((ROOT / "app/new-jersey/page.tsx").exists())
        self.assertTrue((ROOT / "app/new-jersey/monmouth-county").exists() or (ROOT / "app/new-jersey/[county]/page.tsx").exists())
        self.assertTrue((ROOT / "app/florida/page.tsx").exists())
        self.assertIn('path: "/new-jersey"', SITEMAP)
        self.assertIn('path: "/florida"', SITEMAP)

    def test_17_claim_remains_florida(self):
        self.assertIn('sourceSystem === "fl_dbpr"', CLAIM)
        self.assertNotIn("tx_tdlr", CLAIM)
        self.assertNotIn("tx_tsbpe", CLAIM)
        self.assertNotIn("/texas", CLAIM)


class GateTests(unittest.TestCase):
    def test_18_source_families_and_findings(self):
        self.assertGreaterEqual(SNAP["gate"]["source_families"], 3)
        self.assertGreaterEqual(len(SNAP["findings"]), 3)
        self.assertGreaterEqual(SNAP["gate"]["findings"], 3)
        self.assertEqual(len(SNAP["fingerprint"]), 64)


if __name__ == "__main__":
    unittest.main()
