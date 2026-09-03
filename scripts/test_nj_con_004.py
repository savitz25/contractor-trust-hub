"""NJ-CON-004 publication invariants."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/new-jersey-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
A001 = json.loads((ROOT / "artifacts/nj-con-001-summary.json").read_text(encoding="utf-8"))
A003 = json.loads((ROOT / "artifacts/nj-con-003-audit-summary.json").read_text(encoding="utf-8"))
UI = (ROOT / "components/new-jersey/nj-state-page.tsx").read_text(encoding="utf-8")
UI_FLAT = re.sub(r"\s+", " ", UI.lower())
PAGE = ROOT / "app/new-jersey/page.tsx"
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
FOOTER = (ROOT / "components/layout/SiteFooter.tsx").read_text(encoding="utf-8")
PUB = (ROOT / "lib/new-jersey-intelligence/publication.ts").read_text(encoding="utf-8")


class PublicationTests(unittest.TestCase):
    def test_01_route_exists(self):
        self.assertTrue(PAGE.exists())

    def test_02_indexable(self):
        self.assertTrue(SNAP["publication"]["indexable"])
        self.assertEqual(SNAP["publication"]["robots"], "index,follow")

    def test_03_canonical(self):
        self.assertEqual(SNAP["publication"]["canonical"], "https://www.contractortrusthub.com/new-jersey")

    def test_04_sitemap(self):
        self.assertIn('path: "/new-jersey"', SITEMAP)

    def test_05_fingerprint(self):
        self.assertEqual(len(SNAP["fingerprint"]), 64)
        self.assertIn(SNAP["fingerprint"], PUB)


class ConstructionGrainTests(unittest.TestCase):
    def test_06_total_source_records_not_permits(self):
        self.assertEqual(SNAP["construction"]["total_source_records"], A003["totals"]["source_records"])
        self.assertTrue(SNAP["construction"]["total_is_not_permits"])
        self.assertNotIn("2.68 million permits", UI.lower())
        self.assertNotIn("2,678,341 permits", UI.lower())

    def test_07_p_separate(self):
        self.assertEqual(SNAP["construction"]["permit_issued_records"], 1366478)

    def test_08_c_separate(self):
        self.assertEqual(SNAP["construction"]["certificate_issued_records"], 1311863)
        self.assertNotEqual(SNAP["construction"]["permit_issued_records"], SNAP["construction"]["certificate_issued_records"])

    def test_09_p_plus_c_cost_not_summed(self):
        self.assertIsNone(SNAP["cost"]["combined_p_plus_c"])
        self.assertFalse(SNAP["cost"]["combined_published"])
        self.assertNotIn("126101062607", UI)

    def test_10_candidate_not_project(self):
        self.assertFalse(SNAP["linkage"]["sufficient_for_project"])
        self.assertIsNone(SNAP["linkage"]["headline_projects"])
        self.assertIn("not a canonical project identity", UI_FLAT)

    def test_11_state_not_additive(self):
        self.assertTrue(SNAP["construction"]["state_not_additive_municipality"])
        self.assertEqual(SNAP["municipalities"]["state_rows"], 60)

    def test_12_extreme_excluded(self):
        self.assertEqual(SNAP["cost"]["extreme_unresolved_rows"], 7)
        self.assertFalse(SNAP["cost"]["p_stage_published"])

    def test_13_negative_units(self):
        self.assertTrue(SNAP["units"]["negative_is_net_loss"])
        self.assertLess(SNAP["units"]["p_sale_neg"], 0)

    def test_14_invalid_future_dates(self):
        self.assertEqual(SNAP["quality"]["invalid_years"], 92)
        self.assertEqual(SNAP["quality"]["future_date_review"], 1)
        self.assertIn("not treated as current", UI_FLAT)


class MunicipalityTests(unittest.TestCase):
    def test_15_canonical_564(self):
        self.assertEqual(SNAP["municipalities"]["canonical_current"], 564)

    def test_16_observed_556(self):
        self.assertEqual(SNAP["municipalities"]["current_reporting"], 556)

    def test_17_non_reporters(self):
        self.assertEqual(SNAP["municipalities"]["current_non_reporting"], 8)
        self.assertEqual(len(SNAP["municipalities"]["non_reporters"]), 8)

    def test_18_historical_separate(self):
        self.assertEqual(SNAP["municipalities"]["historical_or_inactive_codes"], ["0429", "1109", "1110"])

    def test_19_state_category_separate(self):
        state = [c for c in SNAP["counties"] if c["is_state_category"]]
        self.assertEqual(len(state), 1)
        self.assertEqual(state[0]["observed_municipality_codes"], 0)


class DebarmentTests(unittest.TestCase):
    def test_20_wall_separate(self):
        self.assertEqual(SNAP["regulatory"]["wall"]["rows"], A001["family_results"]["NJ_WALL"]["rows"])

    def test_21_watchlist_separate(self):
        self.assertEqual(SNAP["regulatory"]["wage_watchlist"]["rows"], 1116)
        self.assertEqual(SNAP["regulatory"]["wage_watchlist"]["distinct"], 1088)

    def test_22_treasury_construction(self):
        self.assertEqual(SNAP["regulatory"]["treasury_construction"]["rows"], 323)

    def test_23_treasury_vendor(self):
        self.assertEqual(SNAP["regulatory"]["treasury_vendor"]["rows"], 65)

    def test_24_absence_not_clean(self):
        self.assertTrue(SNAP["regulatory"]["absence_is_not_clean"])
        self.assertIn("not a clean record", UI_FLAT)


class SpecialtyTests(unittest.TestCase):
    def test_25_lead_eval_ne_abatement(self):
        self.assertNotEqual(SNAP["specialty"]["lead_evaluation"]["count"], SNAP["specialty"]["lead_abatement"]["count"])

    def test_26_asbestos_separate(self):
        self.assertEqual(SNAP["specialty"]["asbestos_ascm"]["count"], 37)

    def test_27_fire_c1_c6(self):
        self.assertEqual(SNAP["specialty"]["fire_protection"]["classes_preserved"], ["C1", "C2", "C3", "C4", "C5", "C6"])
        self.assertEqual(SNAP["specialty"]["fire_protection"]["count"], 529)

    def test_28_not_general_license(self):
        self.assertTrue(SNAP["specialty"]["lead_evaluation"]["not_general_license"])
        self.assertIn("not a general contractor license", UI_FLAT)


class EnforcementTests(unittest.TestCase):
    def test_29_nov_not_final(self):
        self.assertTrue(SNAP["safe_house"]["nov_is_not_final_order"])
        self.assertIn("not a final order", UI_FLAT)

    def test_30_proposed_not_paid(self):
        self.assertTrue(SNAP["safe_house"]["proposed_is_not_paid"])
        self.assertEqual(SNAP["safe_house"]["novs"], 18)
        self.assertEqual(SNAP["safe_house"]["failure_to_renew"], 15)
        self.assertEqual(SNAP["safe_house"]["failure_to_register"], 3)

    def test_31_unresolved_not_attached(self):
        self.assertEqual(SNAP["safe_house"]["profile_links"], 0)
        self.assertEqual(SNAP["profile_modules"]["public_profile_links_rendered"], 0)


class IdentityTests(unittest.TestCase):
    def test_32_name_only_rejected(self):
        self.assertTrue(SNAP["profile_modules"]["name_only_rejected"])
        self.assertFalse(SNAP["local_dca_identity"]["name_only_attach"])

    def test_34_exact_may_attach(self):
        self.assertTrue(SNAP["profile_modules"]["exact_may_attach"])

    def test_35_market_only(self):
        self.assertTrue(SNAP["construction"]["market_only"])
        self.assertIsNone(SNAP["construction"]["contractor_attribution"])
        self.assertIsNone(SNAP["profile_modules"]["permit_attribution"])


class RegressionTests(unittest.TestCase):
    def test_36_florida_page(self):
        self.assertTrue((ROOT / "app/florida/page.tsx").exists())

    def test_37_county_enhancement(self):
        self.assertTrue((ROOT / "lib/intelligence/enhanced-county-identity.ts").exists())

    def test_38_contractor_profiles(self):
        self.assertTrue((ROOT / "app/contractors/[slug]/page.tsx").exists())

    def test_39_customer_claim(self):
        self.assertTrue((ROOT / "app/api/claim/handoff/[profileId]/route.ts").exists())

    def test_40_no_ranking(self):
        self.assertFalse(SNAP["publication"]["rankings"])
        self.assertNotRegex(UI, re.compile(r"best contractor|worst municipality", re.I))

    def test_41_no_trust_score(self):
        self.assertFalse(SNAP["publication"]["trust_scores"])
        self.assertIn("not a ranking, recommendation, or trust score", UI_FLAT)

    def test_no_county_routes(self):
        # NJ-CON-004 frozen snapshot did not publish county routes.
        # NJ-CON-COUNTY-001 adds exactly four county paths; no municipality routes.
        self.assertFalse(SNAP["publication"]["county_routes"])
        self.assertIn('path: "/new-jersey"', SITEMAP)
        self.assertIn('path: "/new-jersey/monmouth-county"', SITEMAP)
        self.assertIn('path: "/new-jersey/middlesex-county"', SITEMAP)
        self.assertIn('path: "/new-jersey/somerset-county"', SITEMAP)
        self.assertIn('path: "/new-jersey/union-county"', SITEMAP)
        self.assertNotIn("/new-jersey/freehold", SITEMAP)
        self.assertIn("/new-jersey", FOOTER)

    def test_five_noun_hero(self):
        for noun in ("Universe", "Current", "Observations", "Geography", "As-of"):
            self.assertIn(noun, UI)

    def test_source_record_count_label(self):
        self.assertIn("SOURCE RECORD COUNT", UI)


if __name__ == "__main__":
    unittest.main()
