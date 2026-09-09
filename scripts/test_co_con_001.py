"""CO-CON-001 Colorado publication invariants."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/colorado-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
ACQ = json.loads((ROOT / "data/colorado/co-con-001/acquire-report.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/colorado-intelligence/publication.ts").read_text(encoding="utf-8")
UI = (ROOT / "components/colorado/co-state-intel-page.tsx").read_text(encoding="utf-8")
PAGE = (ROOT / "app/colorado/page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
HEADER = (ROOT / "lib/nav/header-nav.ts").read_text(encoding="utf-8")
CLAIM = (ROOT / "lib/claim/eligibility.ts").read_text(encoding="utf-8")
JSONLD = (ROOT / "lib/colorado-intelligence/jsonld.ts").read_text(encoding="utf-8")
LOOKUP = (ROOT / "lib/colorado-intelligence/lookup.ts").read_text(encoding="utf-8")
CONFIG = (ROOT / "lib/states/config.ts").read_text(encoding="utf-8")
FINGERPRINT = "d4895200fa822677843095ce1e4e216ecab7bf267a5d7945f7a1feabbc365b30"


class SourceTests(unittest.TestCase):
    def test_dora_acquired_deterministically(self):
        self.assertEqual(ACQ["dataset_id"], "7s5z-vewr")
        self.assertEqual(ACQ["types_dataset_id"], "349y-twqi")
        self.assertEqual(ACQ["master_rows"], SNAP["source"]["master_rows"])
        self.assertEqual(len(ACQ["raw_sha256"]), 64)
        self.assertGreater(ACQ["raw_bytes"], 1_000_000)
        self.assertTrue(ACQ["no_statewide_gc"])
        self.assertIn("data.colorado.gov", ACQ["source_url"])


class GrainTests(unittest.TestCase):
    def test_canonical_identity(self):
        ident = SNAP["identity"]
        self.assertEqual(ident["namespace"], "CO-DORA:{licensePrefix}:{licenseNumber}")
        self.assertTrue(ident["license_number_alone_not_globally_unique"])
        self.assertTrue(ident["license_row_ne_person"])
        self.assertTrue(ident["license_row_ne_business"])
        self.assertTrue(ident["ec_ne_me"])
        self.assertTrue(ident["pc_ne_mp"])
        self.assertTrue(ident["license_row_ne_unique_company"])

    def test_ec_pc_business_grain(self):
        self.assertEqual(SNAP["business_credentials"]["EC"]["business_or_individual"], "Business")
        self.assertEqual(SNAP["business_credentials"]["PC"]["business_or_individual"], "Business")
        self.assertEqual(SNAP["business_credentials"]["EC"]["active_exact"], 4789)
        self.assertEqual(SNAP["business_credentials"]["PC"]["active_exact"], 3147)
        self.assertTrue(SNAP["business_credentials"]["do_not_headline_ec_plus_pc_as_colorado_contractors"])
        self.assertIn("credential rows", SNAP["business_credentials"]["combined_active_exact_if_shown"]["label"])
        self.assertEqual(SNAP["business_credentials"]["combined_active_exact_if_shown"]["not"], "unique contractor companies")

    def test_person_trades_and_apprentices(self):
        for p in ("ME", "JW", "RW", "MP", "JP", "RP"):
            self.assertEqual(SNAP["individual_trades"]["prefixes"][p]["business_or_individual"], "Individual")
        self.assertTrue(SNAP["individual_trades"]["no_automatic_person_profiles"])
        self.assertEqual(SNAP["apprentices"]["publication"], "INTERNAL")
        self.assertTrue(SNAP["apprentices"]["omit_from_public_directory_metrics"])
        self.assertIn("internal", UI.lower())
        self.assertNotIn("apprentice home", UI.lower())

    def test_aels_not_gc(self):
        self.assertTrue(SNAP["aels"]["not_general_contractors"])
        self.assertTrue(SNAP["identity"]["pe_ne_general_contractor"])
        self.assertTrue(SNAP["identity"]["architect_ne_contractor_business"])
        self.assertTrue(SNAP["no_statewide_general_contractor_universe"])

    def test_discipline_exact_id(self):
        d = SNAP["discipline"]
        self.assertEqual(d["attach"], "EXACT_OFFICIAL_ID licensePrefix + licenseNumber")
        self.assertEqual(d["name_only"], "UNSAFE")
        self.assertTrue(d["row_ne_case"])
        self.assertGreater(d["contractor_relevant_rows"], d["contractor_distinct_cases"])
        self.assertNotEqual(d["contractor_relevant_rows"], d["all_prefix_flagged_rows"])
        self.assertTrue(SNAP["identity"]["active_ne_recommended"])
        self.assertTrue(SNAP["bond_insurance"]["missing_ne_zero"])
        self.assertEqual(SNAP["bond_insurance"]["coverage"], "UNKNOWN / NOT_ACQUIRED")


class PageTests(unittest.TestCase):
    def test_route_and_h1(self):
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertIn(FINGERPRINT, PUB)
        self.assertIn("ColoradoIntelPage", PAGE)
        self.assertEqual(UI.count("<h1"), 1)
        self.assertIn("Colorado Contractor License", UI)
        self.assertIn("No statewide general-contractor license", UI)
        self.assertNotIn("best contractor", UI.lower())
        self.assertNotIn("Trust Score ranking", UI)
        self.assertIn("/colorado", SITEMAP)
        self.assertNotIn("/colorado/denver", SITEMAP)
        self.assertIn('href: "/colorado"', HEADER)
        self.assertNotRegex(JSONLD, r"AggregateRating")
        self.assertFalse((ROOT / "app/colorado/denver").exists())
        self.assertFalse((ROOT / "app/colorado/colorado-springs").exists())
        self.assertIn("BUSINESS_PREFIXES", LOOKUP)
        self.assertIn('"EC"', LOOKUP)
        self.assertIn("co_dora", CONFIG)
        self.assertIn('"co"', CONFIG)

    def test_siblings_and_claim(self):
        self.assertTrue((ROOT / "app/arizona/page.tsx").exists())
        self.assertTrue((ROOT / "app/washington/page.tsx").exists())
        self.assertTrue((ROOT / "app/texas/page.tsx").exists())
        self.assertTrue((ROOT / "app/california/page.tsx").exists())
        self.assertTrue((ROOT / "app/new-jersey/page.tsx").exists())
        self.assertTrue((ROOT / "app/florida/page.tsx").exists())
        self.assertIn("fl_dbpr", CLAIM)
        self.assertNotRegex(CLAIM, r"co_dora|CO-DORA")
        self.assertFalse(SNAP["claim"]["individual_trades_claimable"])
        self.assertTrue(SNAP["claim"]["claimed_ne_verified"])
        self.assertEqual(SNAP["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"], 0)

    def test_metrics_do_not_use_master_as_contractors(self):
        self.assertTrue(SNAP["source"]["do_not_headline_master_as_contractors"])
        self.assertEqual(SNAP["source"]["master_rows"], 1606852)
        self.assertLess(SNAP["business_credentials"]["EC"]["all_rows"] + SNAP["business_credentials"]["PC"]["all_rows"], 30000)

    def test_homepage_graph_status_is_not_live_cohort(self):
        intel = json.loads((ROOT / "data/home/contractor-hub-intel-v2.json").read_text(encoding="utf-8"))
        overlay = (ROOT / "scripts/colorado/overlay_network_metrics.mjs").read_text(encoding="utf-8")
        self.assertIn("licensingStatus.graph", overlay)
        self.assertNotEqual(intel["licensingStatus"]["graph"]["active"], intel["licensingStatus"]["liveCohort"]["active"])
        self.assertEqual(sum(intel["licensingStatus"]["graph"].values()), intel["researchGraph"]["licenseRows"])
        self.assertEqual(intel["sourceFingerprint"], json.loads((ROOT / "data/home/contractor-network-metrics-v1.json").read_text(encoding="utf-8"))["sourceFingerprint"])


if __name__ == "__main__":
    unittest.main()
