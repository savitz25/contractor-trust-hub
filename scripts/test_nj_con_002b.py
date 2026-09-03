#!/usr/bin/env python3
"""NJ-CON-002B statewide permit market-intelligence tests. No database required."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

from ingest.adapters.nj_construction_permits import (
    NON_REPORTING_MUNICIPALITIES,
    SOURCE_SYSTEM,
    attribution_for_row,
    inspect_party_fields,
    iter_csv_rows,
    normalize_row,
    parse_source_date,
    permit_write_shape,
    source_record_key,
    stream_normalize,
    window_status_for_process_date,
)

SAMPLE = ROOT / "data" / "samples" / "nj_con_002b" / "permits_sample.csv"
MIG011 = (ROOT / "schema" / "migrations" / "011_enhanced_county_foundation.sql").read_text(encoding="utf-8")
MIG015 = (ROOT / "schema" / "migrations" / "015_nj_statewide_permit_intelligence.sql").read_text(encoding="utf-8")


class GrainAndKeyTests(unittest.TestCase):
    def test_pk_is_muni_plus_record_id(self):
        row = {"comu": "0101", "recordid": "00000013", "pk": "010100000013", "permitno": "21-70071"}
        self.assertEqual(source_record_key(row), "010100000013")
        self.assertEqual(source_record_key({"comu": "0101", "recordid": "00000013"}), "010100000013")

    def test_permit_number_is_not_the_identity(self):
        stats = stream_normalize(SAMPLE)
        keys = []
        permitnos = []
        for line, row in iter_csv_rows(SAMPLE):
            rec = normalize_row(row, line_no=line)
            if rec["rejected_reason"]:
                continue
            keys.append(rec["source_record_key"])
            permitnos.append(rec["permit_number"])
        self.assertEqual(permitnos.count("20240025"), 2)
        munis = {source_record_key(row)[:4] for _, row in iter_csv_rows(SAMPLE) if row.get("permitno") == "20240025"}
        self.assertEqual(munis, {"1103", "1507"})
        self.assertFalse(stats["permit_number_globally_unique"])

    def test_duplicate_source_keys_are_counted_not_double_parsed(self):
        stats = stream_normalize(SAMPLE)
        self.assertEqual(stats["quality"]["duplicate_keys"], 1)
        self.assertGreaterEqual(stats["quality"]["parsed"], 7)
        self.assertEqual(stream_normalize(SAMPLE)["quality"]["parsed"], stats["quality"]["parsed"])


class QualityTests(unittest.TestCase):
    def test_missing_cost_extreme_cost_invalid_date_missing_geo(self):
        stats = stream_normalize(SAMPLE)
        q = stats["quality"]
        self.assertGreaterEqual(q["missing_costs"], 1)
        self.assertGreaterEqual(q["invalid_extreme_costs"], 1)
        self.assertGreaterEqual(q["missing_dates"], 1)
        self.assertGreaterEqual(q["invalid_extreme_dates"], 1)
        self.assertGreaterEqual(q["missing_geography"], 1)
        self.assertEqual(q["rejected"], 0)

    def test_slash_and_iso_dates(self):
        self.assertEqual(parse_source_date("10/02/2017"), "2017-10-02")
        self.assertEqual(parse_source_date("2021-07-20T00:00:00.000"), "2021-07-20")
        self.assertIsNone(parse_source_date("1113-11-11T00:00:00.000"))
        self.assertIsNone(parse_source_date("2925-08-15"))

    def test_p_versus_c_status(self):
        statuses = []
        for line, row in iter_csv_rows(SAMPLE):
            rec = normalize_row(row, line_no=line)
            statuses.append((rec["status_raw"], rec["status_normalized"]))
        self.assertIn(("P", "issued"), statuses)
        self.assertIn(("C", "closed"), statuses)


class AttributionTests(unittest.TestCase):
    def test_no_contractor_fields_market_only(self):
        header = next(iter_csv_rows(SAMPLE))[1].keys()
        party = inspect_party_fields(header)
        self.assertFalse(party["explicit_contractor_fields"])
        self.assertFalse(party["license_identifiers_present"])
        self.assertEqual(party["default_attribution"], "MARKET_ONLY")
        for line, row in iter_csv_rows(SAMPLE):
            rec = normalize_row(row, line_no=line)
            att = rec["attribution"]
            self.assertEqual(att["identity_state"], "MARKET_ONLY")
            self.assertFalse(att["public_attachment_allowed"])
            self.assertIsNone(rec["contractor_name_raw"])
            self.assertIsNone(rec["contractor_license_raw"])
            self.assertIsNone(rec["applicant_name_raw"])
            self.assertIsNone(rec["owner_name_raw"])
            self.assertIsNone(rec["property_address"])
            shape = permit_write_shape(rec)
            self.assertEqual(shape["attribution"]["identity_state"], "MARKET_ONLY")
            self.assertNotEqual(shape["attribution"]["identity_state"], "CONFIRMED")

    def test_name_only_attachment_impossible(self):
        att = attribution_for_row({"permitno": "1", "muniname": "TRENTON"})
        self.assertEqual(att["identity_state"], "MARKET_ONLY")
        self.assertIn("not contractor work history", att["reason"])


class GeographyTests(unittest.TestCase):
    def test_non_reporting_is_not_unknown(self):
        self.assertEqual(len(NON_REPORTING_MUNICIPALITIES), 8)
        stats = stream_normalize(SAMPLE)
        for item in stats["non_reporting_municipalities"]:
            self.assertIn(item["treatment"], {"non_reporting", "reported_despite_agency_note"})
            self.assertNotEqual(item["treatment"], "unknown")


class WindowTests(unittest.TestCase):
    def test_age_out_is_not_cancellation(self):
        self.assertEqual(
            window_status_for_process_date("2026-01-01", "2026-08-07"),
            "IN_CURRENT_SOURCE_SNAPSHOT",
        )
        self.assertEqual(
            window_status_for_process_date("2018-01-01", "2026-08-07"),
            "OUTSIDE_STATED_RETENTION_WINDOW_BUT_PRESENT",
        )
        ingest = (ROOT / "scripts" / "nj_con_002b_ingest.py").read_text(encoding="utf-8")
        self.assertIn("Never hard-deletes", ingest)
        self.assertNotIn("DELETE FROM permit_source_records", ingest)


class ArchitectureTests(unittest.TestCase):
    def test_reuses_permit_source_records_not_nj_silo(self):
        self.assertIn("permit_source_records", MIG011)
        self.assertIn("permit_lifecycle_events", MIG011)
        self.assertIn("permit_attributions", MIG011)
        self.assertIn("MARKET_ONLY", MIG015)
        self.assertIn("source_record_key", MIG015)
        self.assertIn("nj_dca_construction_permits", MIG015)
        self.assertNotIn("CREATE TABLE nj_permits", MIG015)
        self.assertIn("permit_source_records_fl_uidx", MIG015)
        ingest = (ROOT / "scripts" / "nj_con_002b_ingest.py").read_text(encoding="utf-8")
        self.assertIn("permit_source_records", ingest)
        self.assertIn("nj_permits_silo", ingest)

    def test_florida_unique_preserved_as_partial_index(self):
        self.assertIn("source_system IS DISTINCT FROM 'nj_dca_construction_permits'", MIG015)
        self.assertIn("UNIQUE (source_system, source_jurisdiction, permit_number)", MIG011)

    def test_no_public_nj_page_or_score(self):
        self.assertTrue((ROOT / "app" / "new-jersey" / "page.tsx").exists())
        self.assertFalse(any((ROOT / "app" / "new-jersey").glob("*/page.tsx")))
        ingest = (ROOT / "scripts" / "nj_con_002b_ingest.py").read_text(encoding="utf-8")
        self.assertIn("no_public_permit_attribution", ingest)
        for banned in ("best contractor", "Trust Score", "ranked"):
            self.assertNotIn(banned, ingest.lower() if banned.islower() else ingest)

    def test_source_system_is_not_nj_dca_hic(self):
        self.assertEqual(SOURCE_SYSTEM, "nj_dca_construction_permits")
        hic = (ROOT / "ingest" / "adapters" / "nj_dca.py").read_text(encoding="utf-8")
        self.assertIn('SOURCE_SYSTEM = "nj_dca"', hic)
        self.assertNotIn("nj_dca_construction_permits", hic)


class MarketIntelTests(unittest.TestCase):
    def test_state_county_work_type_totals(self):
        stats = stream_normalize(SAMPLE)
        self.assertGreater(stats["state_totals"]["rows"], 0)
        self.assertIn("Alteration", stats["work_type_mix"])
        self.assertGreaterEqual(stats["counties_observed"], 1)
        self.assertIn("ATLANTIC", stats["county_names"])


if __name__ == "__main__":
    unittest.main()
