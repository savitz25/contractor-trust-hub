"""VA-CON-001A Virginia publication invariants."""
from __future__ import annotations

import copy
import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "virginia"))
from dpor_tsv import parse_row  # noqa: E402
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
FINGERPRINT = "f758a837d397d7480eb80ff57889a9dd845a016b86edc95a0b4d8f457022eaa3"
OLD_FINGERPRINT = "92560f784baab595177aa96daa437f105f4bf5f288967e7e9f68ed1bd8a73d26"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    skip = {"fingerprint", "generated_at"}
    return hashlib.sha256(dump({k: v for k, v in body.items() if k not in skip}).encode("utf-8")).hexdigest()


class ParserTests(unittest.TestCase):
    def test_extra_tab_in_business_name_realigns_rank_and_specialty(self):
        parts = [
            "27", "05", "041747", "", "AMENTUM", "SPECIAL MISSIONS SERVICES INC",
            "6564 LOISDALE COURT", "SUITE 500", "", "SPRINGFIELD", "VA", "22150",
            "0000", "", "", "", "11/30/2027", "11/21/1997", "A", "RBC CBC PLB ELE FSP SPR HVA ",
            "ops@example.com",
        ]
        rec = parse_row(parts, expected_rank="A")
        assert rec is not None
        self.assertEqual(rec["parse_status"], "STRUCTURALLY_REPAIRED")
        self.assertEqual(rec["LICENSE RANK"], "A")
        self.assertEqual(rec["STATE"], "VA")
        self.assertEqual(rec["CITY"], "SPRINGFIELD")
        self.assertEqual(rec["BUSINESS NAME"], "AMENTUM SPECIAL MISSIONS SERVICES INC")
        self.assertIn("RBC", rec["LICENSE SPECIALTY"])
        self.assertEqual(rec["EXPIRATION DATE"], "11/30/2027")

    def test_canonical_row_stays_valid(self):
        parts = ["27", "05", "035405", "", "MARK FIVE CONSTRUCTION INC", "1008 COVINGTON WAY", "", "", "", "", "21401", "0000", "", "", "", "12/31/2026", "12/13/1996", "A", "CBC RBC ", ""]
        rec = parse_row(parts, expected_rank="A")
        assert rec is not None
        self.assertEqual(rec["parse_status"], "VALID")
        self.assertEqual(rec["LICENSE RANK"], "A")
        self.assertIn("CBC", rec["LICENSE SPECIALTY"])


class SourceTests(unittest.TestCase):
    def test_official_bulk_acquired(self):
        self.assertTrue(ACQ["no_license_lookup_scrape"])
        self.assertEqual(ACQ["downloads"]["2705a_class_a"]["http_status"], 200)
        self.assertEqual(len(ACQ["downloads"]["2705a_class_a"]["sha256"]), 64)
        self.assertGreater(ACQ["downloads"]["2705a_class_a"]["bytes"], 1_000_000)
        self.assertEqual(ACQ["regulant_lists_source_as_of_iso"], SNAP["clocks"]["regulant_lists_sourceAsOf"])
        self.assertEqual(ACQ["regulant_lists_source_as_of_label"], SNAP["clocks"]["regulant_lists_sourceAsOf_text"])
        self.assertIn("Updated", SNAP["clocks"]["regulant_lists_sourceAsOf_label"])
        self.assertTrue(SNAP["clocks"]["retrievedAt_is_not_sourceAsOf"])
        self.assertIn("retrievedAt", SNAP["clocks"]["clock_derivation"])
        self.assertIn("fileLastModified", SNAP["clocks"]["clock_derivation"])
        self.assertEqual(SNAP["clocks"]["regulant_lists_file_last_modified"], ACQ["regulant_lists_file_last_modified"])
        self.assertEqual(SNAP["population_list"]["grain"], "monthly_regulant_population_aggregate")
        self.assertEqual(SNAP["business_roster"]["grain"], "contractor_business_license_number")


class GrainTests(unittest.TestCase):
    def test_business_ne_tradesman(self):
        self.assertTrue(SNAP["identity"]["contractor_business_ne_tradesman_person"])
        self.assertEqual(SNAP["tradesmen"]["grain"], "person")
        self.assertTrue(SNAP["tradesmen"]["not_added_to_contractor_business_denominator"])
        self.assertEqual(SNAP["tradesmen"]["entity_type"], "tradesman_person")
        self.assertEqual(SNAP["business_roster"]["entity_type"], "contractor_business")
        self.assertNotEqual(SNAP["tradesmen"]["grain"], SNAP["business_roster"]["grain"])
        self.assertEqual(SNAP["tradesmen"]["license_type"], "2710_combined_tradesman")
        self.assertEqual(SNAP["tradesmen"]["combined_license_rows"], 30120)
        self.assertIn("person grain", UI.lower())

    def test_class_not_quality(self):
        self.assertTrue(SNAP["license_class"]["class_a_ne_best"])
        self.assertTrue(SNAP["license_class"]["class_c_ne_worse"])
        self.assertIn("not a quality", UI.lower())
        self.assertTrue(SNAP["license_class"]["class_ne_classification"])
        self.assertTrue(SNAP["classifications"]["do_not_assume_examples_exhaustive"])
        self.assertTrue(SNAP["classifications"]["official_acquired_dictionary_complete"])
        self.assertEqual(SNAP["classifications"]["count"], 45)
        self.assertEqual(len(SNAP["classifications"]["items"]), 45)
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
        self.assertEqual(r["file_2705a_distinct"], 30476)
        self.assertEqual(r["file_2701_distinct"], 3737)
        self.assertEqual(r["file_2705a_intersect_2701"], 0)
        self.assertEqual(r["class_a_distinct"], 34213)
        self.assertEqual(r["class_a_distinct"], r["file_2705a_distinct"] + r["file_2701_distinct"] - r["file_2705a_intersect_2701"])
        self.assertIn("set union", r["class_a_union_method"])
        self.assertEqual(r["class_b_distinct"], 8374)
        self.assertEqual(r["class_c_distinct"], 11253)
        self.assertEqual(r["overlap_ab"], 0)
        self.assertEqual(r["overlap_ac"], 0)
        self.assertEqual(r["overlap_bc"], 0)
        self.assertEqual(r["distinct_class_abc_licenses"], 53840)
        self.assertEqual(r["sum_if_classes_added"], r["distinct_class_abc_licenses"])
        self.assertTrue(r["temporary_not_added_to_abc"])
        self.assertEqual(r["parse_audit"]["2705a"]["structurally_repaired_rows"], 15)
        self.assertEqual(r["parse_audit"]["2705a"]["unresolved_malformed_rows"], 0)
        self.assertEqual(r["parse_audit"]["2705b"]["structurally_repaired_rows"], 1)
        self.assertEqual(r["parse_audit"]["2705c"]["structurally_repaired_rows"], 6)

    def test_population_aggregate_ne_roster(self):
        self.assertTrue(SNAP["population_list"]["ne_row_level_roster"])
        self.assertEqual(SNAP["population_list"]["grain"], "monthly_regulant_population_aggregate")
        self.assertEqual(SNAP["business_roster"]["grain"], "contractor_business_license_number")
        self.assertNotEqual(SNAP["population_list"]["grain"], SNAP["business_roster"]["grain"])
        self.assertEqual(SNAP["population_list"]["sourceAsOf"], "2025-06-01")
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
        self.assertEqual(d["grain"], "revocation_release_observation")
        self.assertEqual(d["entity_type"], "disciplinary_observation")
        self.assertNotEqual(d["grain"], SNAP["business_roster"]["grain"])
        self.assertEqual(d["unsafe_name_only_rejected"], 0)
        self.assertEqual(d["observation_rows"], 120)
        self.assertEqual(d["distinct_cases"], 119)
        self.assertEqual(d["distinct_licenses"], 100)
        self.assertEqual(d["exact_license_linked_evidence_rows"], 120)
        self.assertEqual(d["exact_duplicate_rows_removed"], 1)
        self.assertIn("2705154724", d["license_ids_appearing_in_multiple_observations"])
        labels = d["license_ids_with_multiple_respondent_labels"]
        self.assertEqual(len(labels), 1)
        self.assertEqual(labels[0]["license_number"], "2705154724")
        self.assertEqual(d["roster_crosswalk"]["REVOCATION_DISTINCT_LICENSES"], 100)
        self.assertEqual(d["roster_crosswalk"]["CURRENT_ROSTER_EXACT_MATCHES"], 3)
        self.assertEqual(d["roster_crosswalk"]["NOT_IN_CURRENT_ROSTER"], 97)
        self.assertTrue(d["roster_crosswalk"]["absence_from_current_roster_ne_bad_identity"])

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
        self.assertTrue(SNAP["tradesmen"]["not_added_to_contractor_business_denominator"])
        self.assertTrue(SNAP["adjacent_credentials"]["not_added_to_class_abc_denominator"])
        self.assertEqual(SNAP["hero"]["universe_value"], SNAP["business_roster"]["distinct_class_abc_licenses"])
        self.assertEqual(SNAP["expansion_ledger"]["EXACT_PROFILE_ATTACHMENTS"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["EXACT_LICENSE_LINKED_EVIDENCE_ROWS"], 120)

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
        self.assertNotEqual(FINGERPRINT, OLD_FINGERPRINT)

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
        self.assertNotIn("2026-09-08", (ROOT / "scripts/virginia/build_va_con_001_snapshot.py").read_text(encoding="utf-8"))
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
