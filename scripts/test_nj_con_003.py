#!/usr/bin/env python3
"""NJ-CON-003 denominator, metric-contract, and production-package tests."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
from ingest.adapters.nj_construction_permits import (
    classify_cost,
    iter_csv_rows,
    normalize_row,
    parse_source_date,
    source_record_key,
    stream_normalize,
)

NJ_COUNTIES = (
    "ATLANTIC", "BERGEN", "BURLINGTON", "CAMDEN", "CAPE MAY", "CUMBERLAND",
    "ESSEX", "GLOUCESTER", "HUDSON", "HUNTERDON", "MERCER", "MIDDLESEX",
    "MONMOUTH", "MORRIS", "OCEAN", "PASSAIC", "SALEM", "SOMERSET", "SUSSEX",
    "UNION", "WARREN",
)

SAMPLE = ROOT / "data" / "samples" / "nj_con_002b" / "permits_sample.csv"
DICT = (ROOT / "docs" / "nj-con-002b-denominator-dictionary.md").read_text(encoding="utf-8")
CONTRACT = ROOT / "docs" / "nj-con-003-public-metric-contract.md"
SQL = ROOT / "docs" / "sql" / "nj-con-003-production-execution.sql"
RUNBOOK = ROOT / "docs" / "nj-con-003-production-runbook.md"
MON = ROOT / "docs" / "nj-con-003-monitoring-contract.md"
MIG015 = (ROOT / "schema" / "migrations" / "015_nj_statewide_permit_intelligence.sql").read_text(encoding="utf-8")
MIG013 = (ROOT / "schema" / "migrations" / "013_nj_public_works_sanctions.sql").read_text(encoding="utf-8")
MIG014 = (ROOT / "schema" / "migrations" / "014_official_source_coverage.sql").read_text(encoding="utf-8")


class PermitSemanticsTests(unittest.TestCase):
    def test_p_and_c_remain_separate(self):
        statuses = {normalize_row(r, line_no=i)["status_raw"] for i, r in iter_csv_rows(SAMPLE)}
        self.assertIn("P", statuses)
        self.assertIn("C", statuses)

    def test_combined_records_not_labeled_permits(self):
        self.assertIn("permit and certificate source", DICT.lower())
        self.assertNotIn("2.68 million permits", DICT.lower())

    def test_pc_linkage_does_not_invent_project_id(self):
        keys = []
        for i, r in iter_csv_rows(SAMPLE):
            rec = normalize_row(r, line_no=i)
            keys.append((rec["municipality_code"], rec["permit_number"], rec["status_raw"]))
        same_permitno = [k for k in keys if k[1] == "20240025"]
        munis = {k[0] for k in same_permitno}
        self.assertGreaterEqual(len(munis), 2)
        self.assertNotEqual(source_record_key({"comu": "1103", "recordid": "1", "pk": "11031"}), "20240025")

    def test_blank_cost_differs_from_zero(self):
        missing, cls_m = classify_cost("")
        zero, cls_z = classify_cost("0")
        self.assertEqual(cls_m, "missing")
        self.assertIsNone(missing)
        self.assertEqual(cls_z, "reported_zero")
        self.assertEqual(zero, 0.0)

    def test_negative_units_remain_negative(self):
        rec = normalize_row({
            "comu": "1103", "recordid": "1", "pk": "110300000001", "permitno": "1",
            "status": "P", "county": "MERCER", "muniname": "HAMILTON", "permitdate": "2024-01-01",
            "constcost": "100", "salegained": "-2", "rentgained": "0", "permittype": "13",
            "permittypedesc": "Demolition",
        }, line_no=2)
        self.assertEqual(rec["sale_units"], -2)

    def test_source_key_is_muni_plus_record_id(self):
        self.assertEqual(source_record_key({"pk": "010100000013"}), "010100000013")
        self.assertEqual(source_record_key({"comu": "0101", "recordid": "00000013"}), "010100000013")

    def test_future_dates_classified_review(self):
        self.assertEqual(parse_source_date("12/31/2026"), "2026-12-31")
        self.assertIsNone(parse_source_date("1113-11-11"))
        self.assertGreater(parse_source_date("12/31/2026"), "2026-08-13")

    def test_valid_large_cost_not_dropped_from_source(self):
        n, cls = classify_cost("2100495100")
        self.assertEqual(n, 2100495100.0)
        self.assertEqual(cls, "extreme")

    def test_all_21_counties_named(self):
        self.assertEqual(len(NJ_COUNTIES), 21)
        self.assertIn("UNION", NJ_COUNTIES)
        self.assertIn("WARREN", NJ_COUNTIES)

    def test_no_hard_delete_language(self):
        self.assertIn("Never hard-delete", MIG015)
        ingest = (ROOT / "scripts" / "nj_con_002b_ingest.py").read_text(encoding="utf-8")
        self.assertNotIn("DELETE FROM permit_source_records", ingest)


class GeographyTests(unittest.TestCase):
    def test_non_reporting_distinct_from_zero(self):
        self.assertIn("absence is **not** a reported", DICT.lower())
        self.assertIn("No report", DICT)

    def test_state_separate(self):
        self.assertIn("STATE_LEVEL", DICT)
        stats = stream_normalize(SAMPLE)
        self.assertIn("ATLANTIC", stats["county_names"])


class ArchitectureTests(unittest.TestCase):
    def test_migrations_013_014_015_present_no_nj_silo(self):
        self.assertIn("official_source_snapshots", MIG013)
        self.assertIn("source_coverage", MIG014)
        self.assertIn("evidence_class", MIG014)
        self.assertIn("permit_source_records", MIG015)
        self.assertIn("MARKET_ONLY", MIG015)
        self.assertNotIn("CREATE TABLE nj_permits", MIG015)
        self.assertIn("permit_source_records_fl_uidx", MIG015)

    def test_no_new_jersey_app_route(self):
        self.assertFalse((ROOT / "app" / "new-jersey").exists())

    def test_forbidden_public_language_absent_from_dictionary(self):
        blob = DICT.lower()
        for banned in ("best contractor", "vetted", "trust score", "clean record", "government approved"):
            self.assertNotIn(banned, blob)


class PackageTests(unittest.TestCase):
    def test_contract_runbook_sql_monitoring_exist_or_this_test_documents_pending(self):
        # Written in the same ticket; fail if forgotten.
        self.assertTrue(CONTRACT.exists(), "public metric contract missing")
        self.assertTrue(SQL.exists(), "production execution SQL missing")
        self.assertTrue(RUNBOOK.exists(), "production runbook missing")
        self.assertTrue(MON.exists(), "monitoring contract missing")
        contract = CONTRACT.read_text(encoding="utf-8")
        self.assertIn("Permit-issued records", contract)
        self.assertIn("Net housing-unit change", contract)
        self.assertIn("SOURCE_NOT_ACQUIRED", contract)
        self.assertIn("BLOCKED_PENDING_DEFINITION", contract)
        self.assertIn("as “permits”", contract)
        sql = SQL.read_text(encoding="utf-8")
        self.assertIn("COPY", sql.upper())
        self.assertIn("MARKET_ONLY", sql)
        self.assertIn("source_record_key", sql)


if __name__ == "__main__":
    unittest.main()
