#!/usr/bin/env python3
"""NJ-CON-001 unit tests. No database required."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

from ingest.adapters.nj_public_works import (
    FORBIDDEN_PUBLIC_LABELS,
    PUBLIC_LABELS,
    SOURCE_FAMILIES,
    load_source,
    observation_key,
    parse_date,
    parse_pwcr_rows,
    parse_treasury_text,
    parse_wall_rows,
    parse_watchlist_rows,
)
from ingest.nj_identity_match import (
    LicenseCandidate,
    apply_matches,
    build_license_index,
    load_license_csv,
    match_observation,
)
from ingest.xlsx_stdlib import read_xlsx_dicts

SAMPLES = ROOT / "data" / "samples" / "nj_public_works"
HIC = ROOT / "data" / "samples" / "nj_dca_hic_sample.csv"


class SourceFamilyTests(unittest.TestCase):
    def test_six_families_are_distinct(self):
        self.assertEqual(len(SOURCE_FAMILIES), 6)
        self.assertEqual(len(set(SOURCE_FAMILIES)), 6)
        self.assertNotIn("NJ_DEBARMENT", SOURCE_FAMILIES)

    def test_public_labels_are_not_endorsements(self):
        blob = " ".join(PUBLIC_LABELS.values())
        for banned in FORBIDDEN_PUBLIC_LABELS:
            self.assertNotIn(banned, blob)
        self.assertEqual(PUBLIC_LABELS["NJ_PWCR_REGISTRATION"], "New Jersey Public Works Contractor Registration")


class ParserTests(unittest.TestCase):
    def test_pwcr_certificate_normalization(self):
        parsed, rejected = load_source(SAMPLES / "pwcr_sample.csv", "NJ_PWCR_REGISTRATION")
        self.assertEqual(rejected, [])
        self.assertEqual(parsed[0]["certificate_or_vendor_id"], "PWCR-100001")
        self.assertEqual(parsed[0]["source_family"], "NJ_PWCR_REGISTRATION")
        self.assertEqual(parsed[0]["effective_date"], "2025-01-01")
        self.assertEqual(parsed[0]["expiration_date"], "2026-12-31")

    def test_treasury_tab_and_percent_delimiters(self):
        tab = (SAMPLES / "treasury_construction_sample.txt").read_text(encoding="utf-8")
        pct = (SAMPLES / "treasury_construction_pct_sample.txt").read_text(encoding="utf-8")
        a, ra = parse_treasury_text(tab, delimiter="\t", source_family="NJ_TREASURY_CONSTRUCTION_DEBARMENT")
        b, rb = parse_treasury_text(pct, delimiter="%", source_family="NJ_TREASURY_CONSTRUCTION_DEBARMENT")
        self.assertEqual(ra, [])
        self.assertEqual(rb, [])
        self.assertEqual(a[0]["official_business_name"], b[0]["official_business_name"])
        self.assertEqual(a[0]["reason_code"], "F")
        self.assertEqual(a[0]["reason_text"], "Wage & Hour Violation")
        self.assertEqual(a[0]["action"], "DEBARMENT")
        self.assertEqual(a[0]["source_family"], "NJ_TREASURY_CONSTRUCTION_DEBARMENT")

    def test_treasury_reason_and_permanent_flag(self):
        parsed, _ = load_source(SAMPLES / "treasury_construction_sample.txt", "NJ_TREASURY_CONSTRUCTION_DEBARMENT")
        by_name = {p["official_business_name"]: p for p in parsed}
        self.assertEqual(by_name["PERMANENT EXAMPLE LLC"]["permanent_flag"], "Y")
        self.assertEqual(by_name["PERMANENT EXAMPLE LLC"]["reason_text"], "Criminal Offense")
        self.assertEqual(parsed[2]["individual_name"], "PERSON ONLY")
        self.assertEqual(parsed[2]["action"], "DISQUALIFICATION")

    def test_medical_category_rejected_from_vendor_file(self):
        parsed, rejected = load_source(SAMPLES / "treasury_vendor_sample.txt", "NJ_TREASURY_VENDOR_DEBARMENT")
        self.assertTrue(any(r.get("reason") == "excluded_category" for r in rejected))
        self.assertTrue(all(p["source_family"] == "NJ_TREASURY_VENDOR_DEBARMENT" for p in parsed))
        self.assertFalse(any((p.get("raw_payload") or {}).get("category") == "MEDICAL" for p in parsed))

    def test_wall_not_merged_with_prevailing_wage(self):
        wall, _ = load_source(SAMPLES / "wall_sample.csv", "NJ_WALL")
        pw, _ = load_source(SAMPLES / "pw_debarment_sample.csv", "NJ_PREVAILING_WAGE_DEBARMENT")
        self.assertEqual(wall[0]["source_family"], "NJ_WALL")
        self.assertEqual(wall[0]["action"], "WALL_LISTING")
        self.assertEqual(pw[0]["source_family"], "NJ_PREVAILING_WAGE_DEBARMENT")
        self.assertEqual(pw[0]["action"], "PREVAILING_WAGE_DEBARMENT")
        self.assertNotEqual(wall[0]["source_family"], pw[0]["source_family"])

    def test_watchlist_not_converted_to_debarment(self):
        parsed, _ = load_source(SAMPLES / "watchlist_sample.csv", "NJ_WAGE_VIOLATION_WATCHLIST")
        self.assertEqual(parsed[0]["action"], "WATCHLIST_FINAL_DETERMINATION")
        self.assertNotIn("DEBARMENT", parsed[0]["action"])
        self.assertEqual(parsed[0]["registration_status"], "Wages Still Owed")

    def test_excel_serial_and_slash_dates(self):
        self.assertEqual(parse_date("45478"), "2024-07-05")
        self.assertEqual(parse_date("8/12/2014"), "2014-08-12")
        self.assertEqual(parse_date("08/11/2017"), "2017-08-11")
        self.assertIsNone(parse_date(""))

    def test_schema_drift_fails(self):
        with self.assertRaises(ValueError):
            parse_wall_rows([{"Nope": "x"}])
        with self.assertRaises(ValueError):
            parse_watchlist_rows([{"Nope": "x"}])
        with self.assertRaises(ValueError):
            parse_pwcr_rows([{"Nope": "x"}])


class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.index = build_license_index(load_license_csv(HIC))

    def test_high_confidence_name_address(self):
        wall, _ = load_source(SAMPLES / "wall_sample.csv", "NJ_WALL")
        garden = next(o for o in wall if "GARDEN STATE IMPROVEMENTS" in o["official_business_name"])
        result = match_observation(garden, self.index)
        self.assertEqual(result["match_method"], "high_confidence")
        self.assertTrue(str(result["license_external_key"]).endswith("13VH00012300") or "13VH00012300" in str(result["license_external_key"]))

    def test_exact_pwcr_requires_stored_pwcr_identifier(self):
        parsed, _ = load_source(SAMPLES / "pwcr_sample.csv", "NJ_PWCR_REGISTRATION")
        result = match_observation(parsed[0], self.index)
        self.assertNotEqual(result["match_method"], "exact")
        cands = [
            LicenseCandidate(
                contractor_id="c1",
                external_key="NJ-HIC:HIC-13VH00012300",
                occupation_code="HIC",
                license_number="13VH00012300",
                name="GARDEN STATE IMPROVEMENTS LLC",
                address="100 MAIN ST",
                city="TRENTON",
                postal="08608",
                state="NJ",
                identifier_namespaces={"pwcr": "PWCR-100001"},
            )
        ]
        idx = build_license_index(cands)
        exact = match_observation(parsed[0], idx)
        self.assertEqual(exact["match_method"], "exact")

    def test_name_only_never_auto_attaches(self):
        obs = {
            "source_family": "NJ_WALL",
            "official_business_name": "GARDEN STATE IMPROVEMENTS LLC",
            "individual_name": None,
            "address_line_1": None,
            "city": None,
            "postal_code": None,
            "certificate_or_vendor_id": None,
        }
        result = match_observation(obs, self.index)
        self.assertEqual(result["match_method"], "unresolved")
        self.assertIn("name-only", result["reason"])

    def test_name_city_without_candidate_is_unresolved(self):
        obs = {
            "source_family": "NJ_WALL",
            "official_business_name": "NO SUCH FIRM LLC",
            "individual_name": None,
            "address_line_1": "1 MISSING RD",
            "city": "HOBOKEN",
            "postal_code": "07030",
            "certificate_or_vendor_id": None,
        }
        result = match_observation(obs, self.index)
        self.assertEqual(result["match_method"], "unresolved")

    def test_unmatched_rows_preserved(self):
        parsed, _ = load_source(SAMPLES / "pwcr_sample.csv", "NJ_PWCR_REGISTRATION")
        ledgers = apply_matches(parsed, self.index)
        self.assertEqual(len(parsed), len(ledgers["exact"]) + len(ledgers["high_confidence"]) + len(ledgers["review_required"]) + len(ledgers["conflict"]) + len(ledgers["unresolved"]))
        self.assertGreaterEqual(len(ledgers["unresolved"]) + len(ledgers["high_confidence"]), 1)

    def test_pwcr_certificate_is_not_hic_number(self):
        obs = {
            "source_family": "NJ_PWCR_REGISTRATION",
            "official_business_name": "OTHER",
            "certificate_or_vendor_id": "HIC-13VH00012300",
            "address_line_1": None,
            "city": None,
            "postal_code": None,
            "individual_name": None,
        }
        result = match_observation(obs, self.index)
        self.assertNotEqual(result["match_method"], "exact")


class IdempotencyTests(unittest.TestCase):
    def test_watchlist_duplicate_rows_keep_distinct_locators(self):
        raw = ROOT / "data" / "raw" / "nj_public_works" / "WVW-List.xlsx"
        if not raw.exists():
            self.skipTest("official watchlist not on disk")
        parsed, _ = load_source(raw, "NJ_WAGE_VIOLATION_WATCHLIST")
        keys = [o["source_observation_key"] for o in parsed]
        locators = [o["source_record_locator"] for o in parsed]
        self.assertEqual(len(locators), len(set(locators)))
        self.assertLess(len(set(keys)), len(keys))

    def test_duplicate_event_prevention_and_second_parse(self):
        a, _ = load_source(SAMPLES / "wall_sample.csv", "NJ_WALL")
        b, _ = load_source(SAMPLES / "wall_sample.csv", "NJ_WALL")
        keys_a = [o["source_observation_key"] for o in a]
        keys_b = [o["source_observation_key"] for o in b]
        self.assertEqual(keys_a, keys_b)
        self.assertEqual(len(keys_a), len(set(keys_a)))
        self.assertEqual(
            observation_key(source_family="NJ_WALL", fields={"name": "X"}),
            observation_key(source_family="NJ_WALL", fields={"name": "X"}),
        )

    def test_baseline_only_copy(self):
        sql = (ROOT / "schema" / "migrations" / "013_nj_public_works_sanctions.sql").read_text(encoding="utf-8")
        self.assertIn("is_baseline", sql)
        self.assertIn("internal_only", sql)
        self.assertIn("contractor_id", sql)
        self.assertIn("REFERENCES contractors", sql)
        self.assertIn("official_source_snapshots", sql)
        self.assertIn("official_source_observations", sql)
        self.assertIn("official_source_occurrences", sql)
        self.assertNotIn("CREATE TABLE IF NOT EXISTS nj_source_", sql)


class RegressionTests(unittest.TestCase):
    def test_does_not_duplicate_hic_adapter(self):
        hic = (ROOT / "ingest" / "adapters" / "nj_dca.py").read_text(encoding="utf-8")
        self.assertIn("SOURCE_SYSTEM = \"nj_dca\"", hic)
        pw = (ROOT / "ingest" / "adapters" / "nj_public_works.py").read_text(encoding="utf-8")
        self.assertNotIn("SOURCE_SYSTEM = \"nj_dca\"", pw)

    def test_florida_files_untouched_by_this_ticket_contract(self):
        fl = (ROOT / "ingest" / "adapters" / "fl_dbpr.py").read_text(encoding="utf-8")
        self.assertIn("fl_dbpr", fl)
        self.assertNotIn("NJ_WALL", fl)
        sitemap = (ROOT / "app" / "sitemap.xml" / "route.ts").read_text(encoding="utf-8")
        self.assertNotIn("nj-con-001", sitemap.lower())

    def test_no_new_jersey_page(self):
        self.assertTrue((ROOT / "app" / "new-jersey" / "page.tsx").exists())
        self.assertFalse(any((ROOT / "app" / "new-jersey").glob("*/page.tsx")))


class OfficialFileTests(unittest.TestCase):
    def test_official_xlsx_and_treasury_if_present(self):
        raw = ROOT / "data" / "raw" / "nj_public_works"
        wall = raw / "Wall_Dataset.xlsx"
        watch = raw / "WVW-List.xlsx"
        cons = raw / "Debarment-CONSTRUCTION.txt"
        vend = raw / "Debarment-VENDOR.txt"
        if wall.exists():
            rows = read_xlsx_dicts(wall)
            parsed, rejected = parse_wall_rows(rows)
            self.assertGreater(len(parsed), 100)
            self.assertTrue(all(p["source_family"] == "NJ_WALL" for p in parsed))
            self.assertLess(len(rejected), 20)
        if watch.exists():
            parsed, rejected = parse_watchlist_rows(read_xlsx_dicts(watch))
            self.assertGreater(len(parsed), 100)
            self.assertTrue(all(p["action"] == "WATCHLIST_FINAL_DETERMINATION" for p in parsed))
        if cons.exists():
            parsed, rejected = load_source(cons, "NJ_TREASURY_CONSTRUCTION_DEBARMENT")
            self.assertGreater(len(parsed), 100)
            self.assertTrue(all(p["source_family"] == "NJ_TREASURY_CONSTRUCTION_DEBARMENT" for p in parsed))
        if vend.exists():
            parsed, rejected = load_source(vend, "NJ_TREASURY_VENDOR_DEBARMENT")
            self.assertGreater(len(parsed), 10)
            self.assertTrue(all((p.get("raw_payload") or {}).get("category") == "VENDOR" for p in parsed))


if __name__ == "__main__":
    unittest.main()
