"""TX-CON-LOCAL-001A harvest invariants. No public local routes."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REP = json.loads((ROOT / "data/texas/local/tx-local-001a/harvest-report.json").read_text(encoding="utf-8"))
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
MAN = json.loads((ROOT / "data/texas/local/tx-local-001a/source-manifest.json").read_text(encoding="utf-8"))


class IsolationTests(unittest.TestCase):
    def test_no_local_routes(self):
        self.assertTrue((ROOT / "app/texas/page.tsx").exists())
        # TX-CON-LOCAL-002 publishes City of Austin only.
        self.assertTrue((ROOT / "app/texas/austin").exists())
        self.assertIn('path: "/texas/austin"', SITEMAP)
        for p in (
            "app/texas/travis",
            "app/texas/fort-worth",
            "app/texas/tarrant",
            "app/texas/[city]",
            "app/texas/[county]",
        ):
            self.assertFalse((ROOT / p).exists(), p)
        self.assertIn('path: "/texas"', SITEMAP)
        self.assertNotIn("/texas/fort-worth", SITEMAP)
        self.assertNotIn("/texas/tarrant", SITEMAP)
        self.assertNotIn("/texas/travis", SITEMAP)

    def test_namespaces(self):
        self.assertEqual(REP["namespaces"], ["austin-travis", "fort-worth-tarrant", "tx-local-001a"])
        self.assertEqual(REP["builder_4_namespaces_untouched"], ["san-antonio-bexar", "houston-harris"])
        self.assertTrue(REP["no_public_local_routes"])
        self.assertTrue(REP["no_shared_texas_local_loader"])
        self.assertTrue((ROOT / "lib/texas-intelligence/local").exists())
        self.assertFalse((ROOT / "data/texas/local/index.ts").exists())
        self.assertFalse((ROOT / "app/texas/san-antonio").exists())
        self.assertFalse((ROOT / "app/texas/houston").exists())

    def test_regression_surfaces(self):
        self.assertTrue((ROOT / "app/california/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/san-francisco/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/los-angeles/page.tsx").exists())
        self.assertTrue((ROOT / "app/new-jersey/page.tsx").exists())
        self.assertTrue((ROOT / "app/florida").exists())
        self.assertTrue((ROOT / "lib/claim").exists())


class AustinPermitTests(unittest.TestCase):
    def test_grain_and_row_count(self):
        a = REP["austin"]
        self.assertEqual(a["rows"], 2373854)
        self.assertEqual(a["dataset_id"], "3syk-w9eu")
        self.assertIn("one row = one issued permit", a["grain"])
        self.assertEqual(a["sha256"], "3ff78f727b98c7d8c7f6a17867e46afa133776c7fbb2b306b8b03cd9b7e53aa8")
        self.assertEqual(a["bytes"], 1512298131)

    def test_no_source_native_state_id(self):
        a = REP["austin"]
        self.assertFalse(a["source_native_tdlr_or_tsbpe_id"])
        self.assertFalse(a["source_native_city_contractor_number"])
        self.assertEqual(a["license_like_columns"], [])

    def test_identity_coverage(self):
        a = REP["austin"]
        self.assertEqual(a["rows_with_contractor_company"], 1186388)
        self.assertEqual(a["rows_with_contractor_phone"], 1333297)
        self.assertEqual(a["rows_with_tcad_id"], 2310765)
        self.assertEqual(a["distinct_tcad_ids"], 254703)
        self.assertGreater(a["distinct_contractor_company_values"], 30000)

    def test_match_classes(self):
        m = REP["austin"]["match_class"]
        self.assertEqual(m.get("HIGH_CONFIDENCE_BUSINESS_MATCH"), 174673)
        self.assertEqual(m.get("REVIEW_REQUIRED"), 117480)
        self.assertEqual(m.get("UNSAFE"), 167231)
        self.assertEqual(m.get("LOCAL_ONLY_CONTRACTOR_IDENTITY"), 965876)
        self.assertNotIn("EXACT_STATE_CREDENTIAL", m)
        self.assertTrue(REP["state_spine"]["non_match_is_not_unlicensed"])

    def test_local_gc_not_unlicensed(self):
        loc = REP["austin"]["local_only_trade_breakout"]
        self.assertGreater(loc.get("general", 0), 300000)
        self.assertIn("GENERAL CONTRACTOR WITHOUT TDLR != UNLICENSED", REP["austin"]["semantics"])

    def test_contacts_provenance(self):
        c = REP["austin"]["contacts"]
        self.assertEqual(c["provenance_phone"], "AUSTIN_PERMIT_CONTRACTOR_PHONE")
        self.assertEqual(c["provenance_address"], "AUSTIN_PERMIT_CONTRACTOR_ADDRESS")
        self.assertEqual(c["email_website"], "NOT_IN_SOURCE")
        self.assertEqual(c["emails"], 0)


class FortWorthTests(unittest.TestCase):
    def test_no_contractor_on_official_table(self):
        f = REP["fort_worth"]
        self.assertEqual(f["item_id"], "d2740f4d746b4bfaa03e25de0376238b")
        self.assertEqual(f.get("service_count"), 1611676)
        self.assertEqual(f.get("rows"), 1611699)
        self.assertTrue(f.get("owner_full_name_is_not_contractor", True))
        self.assertFalse(f.get("contractor_company_field", False))
        self.assertFalse(f.get("source_native_tdlr_or_tsbpe_id", True))
        self.assertEqual(f.get("permit_to_tad_exact_join"), "NOT_AVAILABLE_NO_ACCOUNT_OR_SITUS_ON_PERMIT_TABLE")

    def test_travis_cad_join(self):
        j = REP["travis_cad"]["join"]
        self.assertEqual(j["permit_rows_with_tcad_id_distinct"], 254703)
        self.assertEqual(j["exact_geo_id_joins"], 233085)
        self.assertEqual(j["unmatched_permit_tcad_ids"], 21618)
        self.assertTrue(j["owner_fields_not_exported"])
        self.assertTrue(REP["tarrant_cad"]["acquired"])
        self.assertEqual(REP["tarrant_cad"]["rows"], 2286442)
        self.assertTrue(REP["tarrant_cad"]["owner_dossiers"] is False)


class GuardrailTests(unittest.TestCase):
    def test_guardrails(self):
        g = REP["guardrails"]
        self.assertTrue(g["local_permit_contractor_ne_state_licensee"])
        self.assertTrue(g["gc_without_tdlr_ne_unlicensed"])
        self.assertTrue(g["permit_ne_quality"])
        self.assertTrue(g["missing_ne_zero"])
        self.assertTrue(g["no_trust_score"])
        self.assertTrue(g["no_ranking"])
        self.assertTrue(g["no_name_only_adverse_attach"])

    def test_manifest_access_classes(self):
        ids = {s["id"] for s in MAN["sources"]}
        self.assertIn("austin_issued_construction_permits", ids)
        self.assertIn("fort_worth_development_permits", ids)
        self.assertIn("travis_cad_2026_certified_appraisal_export", ids)


if __name__ == "__main__":
    unittest.main()
