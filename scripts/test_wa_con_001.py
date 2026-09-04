"""WA-CON-001 Washington publication invariants."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/washington-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
with (ROOT / "lib/washington-intelligence/identity-index.json").open("r", encoding="utf-8") as _fh:
    IDX_HEAD = _fh.read(800)
PUB = (ROOT / "lib/washington-intelligence/publication.ts").read_text(encoding="utf-8")
LOOKUP = (ROOT / "lib/washington-intelligence/lookup.ts").read_text(encoding="utf-8")
UI = (ROOT / "components/washington/wa-state-intel-page.tsx").read_text(encoding="utf-8")
LOOKUP_UI = (ROOT / "components/washington/wa-contractor-lookup.tsx").read_text(encoding="utf-8")
PAGE = (ROOT / "app/washington/page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
HEADER = (ROOT / "lib/nav/header-nav.ts").read_text(encoding="utf-8")
JSONLD = (ROOT / "lib/washington-intelligence/jsonld.ts").read_text(encoding="utf-8")
FINGERPRINT = "031f999a27459dee36ba4dd2ee8b766c3f1166629146f8e798edb04cbb910803"


class SnapshotTests(unittest.TestCase):
    def test_fingerprint_version_gate(self):
        self.assertEqual(SNAP["version"], "contractor-wa-state-intel-v1")
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertIn(SNAP["fingerprint"], PUB)
        self.assertIn(SNAP["fingerprint"], IDX_HEAD)
        self.assertTrue(SNAP["gate"]["passed"])
        self.assertTrue(SNAP["no_trust_score"])
        self.assertTrue(SNAP["no_ranking"])

    def test_general_counts(self):
        g = SNAP["general"]
        self.assertEqual(g["rows"], 160923)
        self.assertEqual(g["distinct_registration_ids"], 160923)
        self.assertEqual(g["dataset_id"], "m8qx-ubtq")
        self.assertEqual(g["identity_namespace"], "WA-LNI:{ContractorLicenseNumber}")
        self.assertEqual(g["rows_with_ubi"], 160923)
        self.assertGreater(g["distinct_ubi"], 140000)
        self.assertEqual(g["sha256"], "818c7f8df6ecb857aea6375c2b6ec884ae278cc6a89999c0bf8ad49f87285b20")

    def test_status_and_types(self):
        names = {row["name"]: row["rows"] for row in SNAP["general"]["status"]}
        self.assertEqual(names["ACTIVE"], 75823)
        self.assertEqual(names["EXPIRED"], 61083)
        self.assertEqual(names["SUSPENDED"], 9731)
        types = {row["name"]: row["rows"] for row in SNAP["general"]["types"]}
        self.assertEqual(types["CONSTRUCTION CONTRACTOR"], 148557)
        self.assertEqual(types["ELECTRICAL CONTRACTOR"], 9186)
        self.assertEqual(types["PLUMBING CONTRACTOR"], 3059)
        self.assertTrue(SNAP["status_model"]["source_native"])
        self.assertTrue(SNAP["status_model"]["registration_status_ne_quality"])

    def test_graph(self):
        g = SNAP["graph"]
        self.assertEqual(g["join_key"], "ContractorLicenseNumber exact")
        self.assertEqual(g["general_ids"], 160923)
        self.assertEqual(g["ids_with_bond_evidence"], 82635)
        self.assertEqual(g["ids_with_insurance_evidence"], 70953)
        self.assertEqual(g["ids_with_both"], 70622)
        self.assertEqual(g["ids_with_neither"], 77957)
        self.assertEqual(g["orphan_bond_ids"], 0)
        self.assertEqual(g["orphan_insurance_ids"], 0)
        self.assertTrue(g["name_match_not_used"])
        self.assertTrue(SNAP["bond"]["no_row_ne_unbonded"])
        self.assertTrue(SNAP["insurance"]["no_row_ne_uninsured"])

    def test_bond_insurance_rows(self):
        self.assertEqual(SNAP["bond"]["rows"], 176920)
        self.assertEqual(SNAP["bond"]["dataset_id"], "bzff-4fmt")
        self.assertEqual(SNAP["insurance"]["rows"], 77005)
        self.assertEqual(SNAP["insurance"]["dataset_id"], "ciwg-agsx")
        self.assertGreater(SNAP["bond"]["ids_with_current_filing"], 0)
        self.assertGreater(SNAP["insurance"]["ids_with_current_filing"], 0)


class SemanticsTests(unittest.TestCase):
    def test_guardrails(self):
        for rule in (
            "CONTRACTOR REGISTRATION != QUALITY",
            "BOND RECORD != ENDORSEMENT",
            "INSURANCE RECORD != SAFETY",
            "BOND + INSURANCE != TRUST SCORE",
            "NO BOND ROW != UNBONDED",
            "NO INSURANCE ROW != UNINSURED",
            "UBI != CONTRACTOR REGISTRATION",
            "NO TRUST SCORE",
        ):
            self.assertIn(rule, SNAP["semantics"])
        self.assertIn("not a ranking", UI.lower())
        self.assertIn("not unbonded", LOOKUP_UI.lower())
        self.assertIn("not uninsured", LOOKUP_UI.lower())
        self.assertIn("not a trusthub guarantee", LOOKUP_UI.lower())
        self.assertNotIn("Verified Contractors", UI)
        self.assertNotIn("Trust Score:", UI)

    def test_contacts_and_people(self):
        self.assertEqual(SNAP["contacts"]["provenance_phone"], "WA_LNI_CONTRACTOR_PHONE")
        self.assertEqual(SNAP["contacts"]["email_website"], "NOT_IN_SOURCE")
        self.assertTrue(SNAP["principals"]["no_person_profile_routes"])
        self.assertTrue(SNAP["additional_trades"]["person_certificate_ne_contractor_business"])
        self.assertTrue(SNAP["business_ubi_source"]["ubi_ne_contractor_registration"])
        self.assertEqual(SNAP["business_ubi_source"]["dor_business_lookup"]["access"], "OPEN_SEARCH_ONLY")

    def test_lookup_no_amount_sort(self):
        self.assertTrue(SNAP["lookup"]["never_sort_by_bond_or_insurance_amount"])
        self.assertIn("localeCompare", LOOKUP)
        self.assertNotIn("bondAmt", LOOKUP)
        self.assertIn(f'"rows":{SNAP["lookup"]["public_identities"]}', IDX_HEAD.replace(" ", ""))


class RouteTests(unittest.TestCase):
    def test_washington_route(self):
        self.assertTrue((ROOT / "app/washington/page.tsx").exists())
        self.assertIn("WashingtonIntelPage", PAGE)
        self.assertIn("noIndex: !WASHINGTON_INTELLIGENCE_GATE.robotsIndex", PAGE)
        self.assertIn('path: "/washington"', SITEMAP)
        self.assertIn('href: "/washington"', HEADER)
        self.assertIn("Washington Contractor Registration, Bond", UI)
        self.assertTrue(SNAP["no_washington_local_intel_routes"])

    def test_no_new_local_intel_routes(self):
        for p in (
            "app/washington/tacoma",
            "app/washington/pierce",
            "app/washington/spokane",
            "app/washington/snohomish",
            "app/washington/bellevue",
        ):
            self.assertFalse((ROOT / p).exists(), p)

    def test_regression(self):
        self.assertTrue((ROOT / "app/texas/page.tsx").exists())
        self.assertTrue((ROOT / "app/texas/austin/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/san-francisco/page.tsx").exists())
        self.assertTrue((ROOT / "app/new-jersey/page.tsx").exists())
        self.assertTrue((ROOT / "app/florida").exists())
        self.assertTrue((ROOT / "lib/claim").exists())
        self.assertIn('path: "/texas/austin"', SITEMAP)

    def test_seo_jsonld(self):
        self.assertEqual(SNAP["publication"]["robots"], "index,follow")
        self.assertEqual(SNAP["publication"]["canonical"], "https://www.contractortrusthub.com/washington")
        self.assertIn('"@type": "WebPage"', JSONLD)
        self.assertIn('"@type": "Dataset"', JSONLD)
        self.assertIn("waJsonLdHasForbiddenRatings", JSONLD)
        self.assertNotRegex(JSONLD, r"AggregateRating")


if __name__ == "__main__":
    unittest.main()
