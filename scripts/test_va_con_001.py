"""VA-CON-001A Virginia publication invariants."""
from __future__ import annotations

import copy
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/virginia-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
ACQ = json.loads((ROOT / "data/virginia/va-con-001/acquire-report.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/virginia-intelligence/publication.ts").read_text(encoding="utf-8")
UI = (ROOT / "components/virginia/va-state-intel-page.tsx").read_text(encoding="utf-8")
PAGE = (ROOT / "app/virginia/page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
HEADER = (ROOT / "lib/nav/header-nav.ts").read_text(encoding="utf-8")
CLAIM = (ROOT / "lib/claim/eligibility.ts").read_text(encoding="utf-8")
JSONLD = (ROOT / "lib/virginia-intelligence/jsonld.ts").read_text(encoding="utf-8")
CONFIG = (ROOT / "lib/states/config.ts").read_text(encoding="utf-8")
EXEC = (ROOT / "lib/specialist-execution/contractor-v2.ts").read_text(encoding="utf-8")
FINGERPRINT = "92560f784baab595177aa96daa437f105f4bf5f288967e7e9f68ed1bd8a73d26"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    skip = {"fingerprint", "generated_at"}
    return hashlib.sha256(dump({k: v for k, v in body.items() if k not in skip}).encode("utf-8")).hexdigest()


class SourceTests(unittest.TestCase):
    def test_official_bulk_acquired(self):
        self.assertTrue(ACQ["no_license_lookup_scrape"])
        self.assertEqual(ACQ["downloads"]["2705a_class_a"]["http_status"], 200)
        self.assertEqual(len(ACQ["downloads"]["2705a_class_a"]["sha256"]), 64)
        self.assertGreater(ACQ["downloads"]["2705a_class_a"]["bytes"], 1_000_000)
        self.assertEqual(SNAP["clocks"]["regulant_lists_sourceAsOf"], "2026-09-08")
        self.assertTrue(SNAP["clocks"]["retrievedAt_is_not_sourceAsOf"])
        self.assertNotEqual(SNAP["clocks"]["regulant_lists_sourceAsOf"], SNAP["clocks"]["regulant_lists_retrievedAt"][:10])
        self.assertNotEqual(SNAP["clocks"]["population_list_sourceAsOf"], SNAP["clocks"]["regulant_lists_sourceAsOf"])


class GrainTests(unittest.TestCase):
    def test_business_ne_tradesman(self):
        self.assertTrue(SNAP["identity"]["contractor_business_ne_tradesman_person"])
        self.assertEqual(SNAP["tradesmen"]["grain"], "person")
        self.assertTrue(SNAP["tradesmen"]["not_added_to_contractor_business_denominator"])
        self.assertNotEqual(SNAP["tradesmen"]["combined_license_rows"], SNAP["business_roster"]["distinct_class_abc_licenses"])
        self.assertEqual(SNAP["tradesmen"]["combined_license_rows"], 30120)
        self.assertIn("person grain", UI.lower())

    def test_class_not_quality(self):
        self.assertTrue(SNAP["license_class"]["class_a_ne_best"])
        self.assertTrue(SNAP["license_class"]["class_c_ne_worse"])
        self.assertIn("not a quality", UI.lower())
        self.assertTrue(SNAP["license_class"]["class_ne_classification"])
        self.assertEqual(SNAP["classifications"]["count"], 45)
        self.assertEqual(SNAP["identity"]["namespace"], "VA-DPOR:{licenseNumber}")
        self.assertTrue(SNAP["identity"]["license_number_is_source_identity"])

    def test_specialty_row_ne_unique_contractor(self):
        self.assertTrue(SNAP["business_roster"]["do_not_sum_specialty_tokens_as_contractors"])
        self.assertTrue(SNAP["business_roster"]["multiple_specialties_may_appear_on_one_license"])
        self.assertGreater(SNAP["business_roster"]["class_a_rows_with_multiple_specialties"], 0)
        self.assertEqual(SNAP["business_roster"]["duplicate_license_rows_2705a"], 0)

    def test_classes_disjoint_and_counts(self):
        r = SNAP["business_roster"]
        self.assertTrue(r["classes_are_disjoint"])
        self.assertEqual(r["class_a_distinct"], 34213)
        self.assertEqual(r["class_b_distinct"], 8374)
        self.assertEqual(r["class_c_distinct"], 11253)
        self.assertEqual(r["distinct_class_abc_licenses"], 53840)
        self.assertEqual(r["sum_if_classes_added"], r["distinct_class_abc_licenses"])
        self.assertTrue(r["temporary_not_added_to_abc"])
        self.assertNotEqual(r["class_a_distinct"], r["class_b_distinct"])  # source assertion, not grain proof

    def test_population_aggregate_ne_roster(self):
        self.assertTrue(SNAP["population_list"]["ne_row_level_roster"])
        self.assertEqual(SNAP["population_list"]["sourceAsOf"], "2025-06-01")
        self.assertNotEqual(SNAP["population_list"]["contractors_class_a"], SNAP["business_roster"]["class_a_distinct"])
        self.assertTrue(SNAP["population_list"]["do_not_create_profiles_from_this_count"])

    def test_discipline_semantics(self):
        d = SNAP["discipline"]
        self.assertEqual(d["attach"], "EXACT_CONTRACTOR_LICENSE")
        self.assertEqual(d["name_only"], "UNSAFE")
        self.assertEqual(d["name_plus_city"], "REVIEW_REQUIRED")
        self.assertTrue(d["row_ne_case"])
        self.assertTrue(d["case_ne_violation_count"])
        self.assertTrue(d["revocation_ne_criminal_conviction"])
        self.assertTrue(d["complaint_ne_discipline"])
        self.assertTrue(d["subset_of_all_discipline"])
        self.assertEqual(d["unsafe_name_only_rejected"], 0)
        self.assertEqual(d["observation_rows"], 83)
        self.assertEqual(d["distinct_cases"], 82)
        self.assertEqual(d["distinct_licenses"], 78)
        self.assertNotEqual(d["observation_rows"], d["distinct_cases"])
        self.assertNotEqual(d["observation_rows"], SNAP["business_roster"]["distinct_class_abc_licenses"])

    def test_recovery_and_bond(self):
        self.assertTrue(SNAP["recovery_fund"]["filing_ne_payment"])
        self.assertTrue(SNAP["recovery_fund"]["approved_ne_revocation"])
        self.assertTrue(SNAP["recovery_fund"]["fund_case_ne_board_discipline"])
        self.assertTrue(SNAP["recovery_fund"]["court_judgment_ne_criminal_conviction"])
        self.assertTrue(SNAP["recovery_fund"]["payment_ne_total_consumer_loss"])
        self.assertEqual(SNAP["recovery_fund"]["structured_bulk"], "SOURCE_NOT_ACQUIRED")
        self.assertTrue(SNAP["bond_insurance"]["no_boolean_bonded_from_license_status"])
        self.assertTrue(SNAP["bond_insurance"]["missing_ne_zero"])
        self.assertTrue(SNAP["lookup"]["search_only_ne_zero"])
        self.assertTrue(SNAP["identity"]["current_license_ne_clean_history"])

    def test_person_does_not_inflate_business(self):
        self.assertNotEqual(
            SNAP["tradesmen"]["combined_license_rows"] + SNAP["business_roster"]["distinct_class_abc_licenses"],
            SNAP["hero"]["universe_value"],
        )
        self.assertEqual(SNAP["hero"]["universe_value"], SNAP["business_roster"]["distinct_class_abc_licenses"])

    def test_no_local_routes_or_scores(self):
        self.assertTrue(SNAP["no_virginia_local_intel_routes_this_ticket"])
        self.assertTrue(SNAP["permits"]["local_routes"] is False)
        self.assertNotIn("/virginia/fairfax", SITEMAP)
        self.assertNotIn("/virginia/richmond", SITEMAP)
        self.assertIn('path: "/virginia"', SITEMAP)
        self.assertIn("/virginia", HEADER)
        self.assertTrue(SNAP["no_trust_score"])
        self.assertTrue(SNAP["no_ranking"])
        self.assertNotIn("Trust Score is", UI)
        self.assertIn("statewide contractor-business licensing", UI.lower())


class FingerprintTests(unittest.TestCase):
    def test_deterministic(self):
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertEqual(fingerprint(SNAP), FINGERPRINT)
        self.assertEqual(fingerprint(copy.deepcopy(SNAP)), FINGERPRINT)
        self.assertIn(FINGERPRINT, PUB)

    def test_nested_mutation_changes_fingerprint(self):
        mutated = copy.deepcopy(SNAP)
        mutated["business_roster"]["class_a_distinct"] += 1
        self.assertNotEqual(fingerprint(mutated), FINGERPRINT)
        mutated2 = copy.deepcopy(SNAP)
        mutated2["discipline"]["observation_rows"] += 1
        self.assertNotEqual(fingerprint(mutated2), FINGERPRINT)
        mutated3 = copy.deepcopy(SNAP)
        mutated3["business_roster"]["status"] = "SOURCE_NOT_ACQUIRED"
        self.assertNotEqual(fingerprint(mutated3), FINGERPRINT)
        mutated4 = copy.deepcopy(SNAP)
        mutated4["identity"]["namespace"] = "NAME-ONLY"
        self.assertNotEqual(fingerprint(mutated4), FINGERPRINT)


class PublicationTests(unittest.TestCase):
    def test_route_and_claim_and_search(self):
        self.assertTrue((ROOT / "app/virginia/page.tsx").exists())
        self.assertIn("VIRGINIA_INTELLIGENCE_GATE", PAGE)
        self.assertIn('sourceSystem === "fl_dbpr"', CLAIM)
        self.assertNotIn("va_dpor", CLAIM)
        self.assertEqual(SNAP["claim_safety"]["still_florida_dbpr_only"], True)
        self.assertEqual(SNAP["expansion_ledger"]["NET_NEW_PUBLIC_CONTRACTOR_PROFILES"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["NET_NEW_CANONICAL_ORGANIZATIONS"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["NEW_STATE_IDENTITIES"], 53840)
        self.assertIn('state !== "FL" && state !== "NJ"', EXEC)
        self.assertIn("FAIL_CLOSED", json.dumps(SNAP["search_v1"]))
        self.assertIn('live: false', CONFIG)
        self.assertIn("va_dpor", CONFIG)
        self.assertNotIn("AggregateRating", JSONLD)
        self.assertTrue(SNAP["gate"]["passed"])


if __name__ == "__main__":
    unittest.main()
