"""CA-CON-COUNTY-001A SF/SD harvest invariants. No public county routes."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REP = json.loads((ROOT / "data/california/counties/sf-sd/harvest-report.json").read_text(encoding="utf-8"))
MAN = json.loads((ROOT / "data/california/counties/sf-sd/source-manifest.json").read_text(encoding="utf-8"))
SNAP = json.loads((ROOT / "lib/california-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")


class NoPublicationTests(unittest.TestCase):
    def test_no_county_routes(self):
        self.assertFalse((ROOT / "app/california/san-francisco").exists())
        self.assertFalse((ROOT / "app/california/san-francisco-county").exists())
        self.assertFalse((ROOT / "app/california/san-diego").exists())
        self.assertFalse((ROOT / "app/california/san-diego-county").exists())
        self.assertFalse((ROOT / "app/california/[county]").exists())
        self.assertNotIn("/california/san-francisco", SITEMAP)
        self.assertNotIn("/california/san-diego", SITEMAP)
        self.assertTrue((ROOT / "app/california/page.tsx").exists())

    def test_no_shared_county_loader(self):
        self.assertFalse((ROOT / "data/california/counties/index.ts").exists())
        self.assertFalse((ROOT / "lib/california-intelligence/counties").exists())
        self.assertTrue(REP["no_shared_county_loader"])
        self.assertTrue(REP["no_public_county_routes"])


class SpineTests(unittest.TestCase):
    def test_partial_cslb_semantics(self):
        self.assertEqual(REP["cslb_spine"]["rows"], 75572)
        self.assertEqual(SNAP["license_master"]["license_rows"], 75572)
        self.assertEqual(REP["cslb_spine"]["coverage"], "ACQUIRED_PARTIAL_STREAM_TRUNCATED")
        self.assertEqual(REP["cslb_spine"]["complete_denominator"], "UNKNOWN")
        self.assertTrue(REP["cslb_spine"]["non_match_is_not_unlicensed"])
        self.assertEqual(REP["totals"]["name_only_auto_attach"], 0)


class SanFranciscoTests(unittest.TestCase):
    def test_business_registry_grain(self):
        b = REP["sf_registered_business"]
        self.assertEqual(b["grain"], "registered business location")
        self.assertEqual(b["rows"], 366307)
        self.assertEqual(b["distinct_business_accounts"], 258032)
        self.assertGreater(b["construction_related_rows"], 1000)
        self.assertGreater(b["cslb_match"]["HIGH_CONFIDENCE"], 0)
        self.assertGreater(b["cslb_match"]["UNSAFE"], b["cslb_match"]["HIGH_CONFIDENCE"])
        self.assertEqual(b["contacts"]["phones"], 0)

    def test_permit_grain_and_no_license_on_permit_file(self):
        p = REP["sf_building_permits"]
        self.assertIn("permit at an address", p["grain"])
        self.assertEqual(p["rows"], 1294909)
        self.assertEqual(p["distinct_permit_numbers"], 1149123)
        self.assertEqual(p["rows_with_contractor_license_on_permit_file"], 0)
        self.assertEqual(p["rows_with_parcel_or_block_lot"], 1294909)
        self.assertIn("PERMIT APPLICATION != ISSUED PERMIT", p["semantics"])

    def test_exact_cslb_on_contacts(self):
        c = REP["sf_permit_contacts"]
        self.assertEqual(c["rows"], 1032543)
        self.assertEqual(c["rows_with_license1_or_license2"], 562059)
        self.assertEqual(c["distinct_exact_match_acquired_cslb"], 2729)
        self.assertEqual(c["distinct_exact_license_not_in_acquired_partial_spine"], 20450)
        self.assertTrue(c["no_name_only_auto_attach"])
        self.assertGreater(c["distinct_exact_license_not_in_acquired_partial_spine"], c["distinct_exact_match_acquired_cslb"])

    def test_inspections_not_contractor_passed(self):
        i = REP["sf_inspections"]
        self.assertEqual(i["rows"], 702749)
        self.assertEqual(i["attribution"], "PERMIT_OR_PROPERTY_GRAIN")
        self.assertTrue(i["do_not_translate_to_contractor_passed"])
        self.assertFalse(i["contractor_license_field"])


class SanDiegoTests(unittest.TestCase):
    def test_city_not_county_grain(self):
        a = REP["sd_city_approvals"]
        self.assertEqual(a["jurisdiction"], "CITY_OF_SAN_DIEGO")
        self.assertTrue(a["not_san_diego_county_permits"])
        self.assertIn("APPROVAL ROW != PROJECT COUNT", a["grain"])
        self.assertEqual(a["rows"], 172453)
        self.assertEqual(a["distinct_project_ids"], 39612)
        self.assertLess(a["distinct_project_ids"], a["rows"])

    def test_permit_holder_is_not_automatically_licensed(self):
        a = REP["sd_city_approvals"]
        self.assertIn("contact name", a["permit_holder_meaning"].lower())
        self.assertGreater(a["cslb_match"]["UNSAFE"], 100000)
        self.assertLess(a["cslb_match"].get("EXACT_MATCH_ACQUIRED_CSLB", 0), 50)

    def test_business_tax_not_trade_license(self):
        b = REP["sd_business_tax_active"]
        self.assertTrue(b["not_trade_license"])
        self.assertEqual(b["jurisdiction"], "CITY_OF_SAN_DIEGO")
        self.assertEqual(b["rows"], 59321)
        self.assertGreater(b["construction_related_rows"], 1000)

    def test_rental_no_owner_dossier(self):
        r = REP["sd_rental_unit_business_tax"]
        self.assertTrue(r["no_owner_dossiers"])
        self.assertEqual(r["rows"], 328337)
        self.assertIn("assessor_parcel_no", r["identity_fields"])


class NamespaceTests(unittest.TestCase):
    def test_builder3_paths_only(self):
        self.assertTrue((ROOT / "scripts/california/counties/sf-sd").is_dir())
        self.assertTrue((ROOT / "data/california/counties/san-francisco/fixtures").is_dir())
        self.assertTrue((ROOT / "data/california/counties/san-diego/fixtures").is_dir())
        self.assertFalse((ROOT / "data/california/counties/los-angeles").exists())
        self.assertFalse((ROOT / "data/california/counties/santa-clara").exists())
        self.assertEqual(MAN["ticket"], "CA-CON-COUNTY-001A")
        self.assertEqual(REP["publication_decision"]["san_francisco"], "PUBLISH_DEDICATED_COUNTY_PAGE")
        self.assertEqual(REP["publication_decision"]["city_of_san_diego"], "PUBLISH_LIGHT_MARKET_MODULE")
        self.assertEqual(REP["publication_decision"]["san_diego_county"], "PARK")


if __name__ == "__main__":
    unittest.main()
