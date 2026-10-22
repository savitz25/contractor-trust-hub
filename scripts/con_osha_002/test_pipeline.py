"""CON-OSHA-002 planner tests. No database connection."""

from __future__ import annotations

import csv
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

from scripts.con_osha_001b.load_detail import GO_PHRASE as FLNJ_GO_PHRASE
from scripts.con_osha_002.aggregate import (
    MemoryLedger,
    aggregate_statements,
    apply_aggregate,
    execute_load,
    plan_aggregate,
)
from scripts.con_osha_002.contract import (
    B2_PACKAGE_FIELDS,
    CA_NAME_SOURCE,
    EXCLUDED_STATES,
    EXPANSION_STATES,
    GO_PHRASE,
    SOURCE_ZIP_SHA256,
)
from scripts.con_osha_002.detail import plan_detail, apply_detail
from scripts.con_osha_002.eligibility import LoadError, classify_rows
from scripts.con_osha_002.rollback import rollback_sql

ROOT = Path(__file__).resolve().parents[2]
BATCH = "11111111-1111-1111-1111-111111111111"
OTHER_BATCH = "22222222-2222-2222-2222-222222222222"


def row(**overrides) -> dict[str, str]:
    base = {field: "" for field in B2_PACKAGE_FIELDS}
    base.update({
        "state": "CA",
        "source_system": "ca_cslb",
        "license_key": "100",
        "match_tier": "exact",
        "person_name_licensee": "no",
        "postal_code": "94107",
        "county_name": "San Francisco",
        "n_inspections": "1",
        "osha_activity_nrs": "1001",
        "n_citation_items": "1",
        "n_serious": "1",
        "n_willful_repeat": "0",
        "current_penalty_amount": "10",
        "initial_penalty_amount": "10",
        "n_with_final_order": "0",
        "n_contested": "0",
    })
    base.update(overrides)
    return base


def classify(rows, identities, receipt=None):
    return classify_rows(rows, identities, receipt=receipt if receipt is not None else {"ca_name_source": CA_NAME_SOURCE})


class PipelineTests(unittest.TestCase):
    def test_six_state_configuration_and_excluded_states(self):
        self.assertEqual(EXPANSION_STATES, ("CA", "VA", "LA", "NV", "AZ", "TN"))
        for state in EXPANSION_STATES:
            hashes = SOURCE_ZIP_SHA256[state]
            self.assertGreaterEqual(len(hashes), 1)
            for digest in hashes:
                self.assertEqual(len(digest), 64)
        self.assertTrue(EXCLUDED_STATES.isdisjoint(SOURCE_ZIP_SHA256))

    def test_b2_contract_publishes_exact_and_holds_the_rest(self):
        identities = {
            ("ca_cslb", "100"): "c-1",
            ("ca_cslb", "200"): "c-2",
            ("ca_cslb", "AMB1"): "c-3",
            ("ca_cslb", "AMB2"): "c-4",
        }
        rows = [
            row(),
            row(license_key="200", match_tier="strong", osha_activity_nrs="2002"),
            row(license_key="WEAK", match_tier="weak", osha_activity_nrs="3003"),
            row(license_key="PERSON", match_tier="exact", person_name_licensee="yes", osha_activity_nrs="4004"),
            row(license_key="NOLIC", osha_activity_nrs="5005"),
            row(license_key="NAME", postal_code="", county_name="", osha_activity_nrs="6006"),
            row(license_key="AMB1", osha_activity_nrs="9999"),
            row(license_key="AMB2", osha_activity_nrs="9999;7007"),
        ]
        result = classify(rows, identities)
        self.assertEqual(sorted(match.license_key for match in result.public_matches), ["100", "200"])
        self.assertTrue(all(match.source_system == "us_dol_osha" for match in result.public_matches))
        self.assertEqual(result.source_system, "ca_cslb")
        held = {(hold.license_key, hold.reason) for hold in result.holds}
        self.assertIn(("WEAK", "weak"), held)
        self.assertIn(("PERSON", "person_name"), held)
        self.assertIn(("NOLIC", "no_verified_license"), held)
        self.assertIn(("NAME", "name_only"), held)
        self.assertIn(("AMB1", "ambiguous_activity"), held)
        self.assertIn(("AMB2", "ambiguous_activity"), held)
        self.assertEqual(result.ambiguous_activities, {"9999"})

    def test_same_contractor_may_share_an_activity(self):
        identities = {("ca_cslb", "100"): "c-1", ("ca_cslb", "300"): "c-1"}
        result = classify([
            row(osha_activity_nrs="1001"),
            row(license_key="300", osha_activity_nrs="1001"),
        ], identities)
        self.assertEqual(result.ambiguous_activities, set())
        self.assertEqual(result.public_profile_count, 2)

    def test_tennessee_is_not_a_public_identity_source(self):
        result = classify_rows([
            row(state="TN", source_system="tn_blc", license_key="T1"),
        ], {("tn_blc", "T1"): "c-1"})
        self.assertEqual(result.public_profile_count, 0)
        self.assertEqual(result.holds[0].reason, "matcher_unauthorized")

    def test_california_requires_licensee_name_raw(self):
        with self.assertRaises(LoadError):
            classify_rows([row()], {("ca_cslb", "100"): "c-1"}, receipt={})
        result = classify([row()], {("ca_cslb", "100"): "c-1"})
        self.assertEqual(result.public_profile_count, 1)

    def test_excluded_and_flnj_packages_are_refused(self):
        for state, source in (("MA", "ma_board"), ("FL", "fl_dbpr"), ("NJ", "nj_dca")):
            with self.assertRaises(LoadError):
                classify_rows([row(state=state, source_system=source)], {})

    def test_package_header_must_match_b2(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "package.csv"
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=("state", "license_key"))
                writer.writeheader()
                writer.writerow({"state": "CA", "license_key": "100"})
            from scripts.con_osha_002.eligibility import read_package
            with self.assertRaises(LoadError):
                read_package(path)

    def test_aggregate_before_detail_and_second_run_is_empty(self):
        eligibility = classify([row()], {("ca_cslb", "100"): "c-1"})
        ledger = MemoryLedger()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            inspections = root / "inspections.csv"
            citations = root / "citations.csv"
            links = root / "links.csv"
            inspections.write_text("activity_nr,open_date,site_city,site_state\n1001,2020-01-02,Oakland,CA\n", encoding="utf-8")
            citations.write_text(
                "activity_nr,citation_id,standard,viol_type,current_penalty,delete_flag,contest_date\n"
                "1001,01001,1926.501,S,,X,\n"
                "1001,01002,1926.501,S,0,,NaT\n",
                encoding="utf-8",
            )
            links.write_text(
                "activity_nr,citation_id,derived_link_status\n1001,01001,matched\n1001,01002,matched\n",
                encoding="utf-8",
            )
            with self.assertRaises(LoadError):
                plan_detail(plan_aggregate(eligibility, BATCH), ledger, inspections, citations, links)
            first = plan_aggregate(eligibility, BATCH)
            self.assertEqual(first.steps, ("ingest_batch", "expansion_receipt", "matches", "holds"))
            self.assertLess(first.steps.index("ingest_batch"), first.steps.index("matches"))
            apply_aggregate(first, ledger)
            detail = plan_detail(first, ledger, inspections, citations, links)
            self.assertEqual(detail.steps[0], "aggregate")
            self.assertEqual(detail.inspections[0].inspection_type, None)
            self.assertIsNone(detail.inspections[0].close_date)
            self.assertIsNone(detail.inspections[0].closing_conference_date)
            self.assertTrue(detail.inspections[0].citations_verified)
            self.assertEqual(len(detail.citations), 1)
            self.assertEqual(detail.citations[0].current_penalty, Decimal("0.00"))
            self.assertIsNone(detail.citations[0].contest_date)
            apply_detail(detail, ledger)
            second = plan_aggregate(eligibility, BATCH, ledger)
            self.assertEqual(second.insert_counts["matches"], 0)
            self.assertEqual(second.insert_counts["receipts"], 0)
            self.assertEqual(second.insert_counts["ingest_batches"], 0)
            again = plan_detail(second, ledger, inspections, citations, links)
            self.assertEqual(again.insert_counts, {"inspections": 0, "citations": 0, "bridges": 0, "holds": 0})

    def test_optional_columns_null_penalty_and_missing_context(self):
        eligibility = classify([
            row(license_key="100", osha_activity_nrs="1001;1002"),
        ], {("ca_cslb", "100"): "c-1"})
        ledger = MemoryLedger()
        apply_aggregate(plan_aggregate(eligibility, BATCH), ledger)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "inspections.csv").write_text(
                "activity_nr,open_date\n1001,2020-05-01\n1002,NaT\n",
                encoding="utf-8",
            )
            (root / "citations.csv").write_text(
                "activity_nr,citation_id,standard,viol_type,current_penalty,delete_flag\n"
                "1001,01001,1926.501,S,,\n"
                "1001,01002,1926.501,S,0,\n"
                "1001,01003,1926.501,,, \n"
                "1002,02001,1926.501,S,5,\n"
                "1002,02002,1926.501,,,\n",
                encoding="utf-8",
            )
            (root / "links.csv").write_text(
                "activity_nr,citation_id,derived_link_status\n"
                "1001,01001,matched\n"
                "1001,01002,matched\n"
                "1001,01003,matched\n"
                "1002,02001,missing_citation_context\n"
                "1002,02002,missing\n",
                encoding="utf-8",
            )
            detail = plan_detail(
                plan_aggregate(eligibility, BATCH, ledger),
                ledger,
                root / "inspections.csv",
                root / "citations.csv",
                root / "links.csv",
            )
        verified = {item.activity_nr: item for item in detail.inspections}
        self.assertTrue(verified["1001"].citations_verified)
        self.assertIsNone(verified["1001"].inspection_type)
        self.assertFalse(verified["1002"].citations_verified)
        penalties = {item.citation_id: item.current_penalty for item in detail.citations}
        self.assertIsNone(penalties["01001"])
        self.assertEqual(penalties["01002"], Decimal("0.00"))
        self.assertNotIn("01003", penalties)
        self.assertNotIn("02001", penalties)
        self.assertEqual(detail.missing_citation_context, 2)
        self.assertIn("unsupported_citation", {hold.reason for hold in detail.holds})
        self.assertTrue(all(getattr(item, "official_url", None) is None for item in detail.inspections))

    def test_verified_inspection_with_no_citations(self):
        eligibility = classify([row(osha_activity_nrs="1001", n_citation_items="0")], {("ca_cslb", "100"): "c-1"})
        ledger = MemoryLedger()
        apply_aggregate(plan_aggregate(eligibility, BATCH), ledger)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "inspections.csv").write_text("activity_nr,open_date\n1001,2021-01-01\n", encoding="utf-8")
            (root / "citations.csv").write_text(
                "activity_nr,citation_id,standard,viol_type,current_penalty,delete_flag\n",
                encoding="utf-8",
            )
            detail = plan_detail(plan_aggregate(eligibility, BATCH, ledger), ledger, root / "inspections.csv", root / "citations.csv")
        self.assertTrue(detail.inspections[0].citations_verified)
        self.assertEqual(detail.citations, [])

    def test_per_state_rollback_is_batch_scoped(self):
        for state in EXPANSION_STATES:
            sql = rollback_sql(state, BATCH)
            self.assertIn(f"state = '{state}'", sql)
            self.assertIn(BATCH, sql)
            self.assertIn("us_dol_osha_expansion", sql)
            self.assertNotRegex(sql, r"DELETE\s+FROM\s+(contractors|licenses|osha_load_receipts)\b")
            for other in EXPANSION_STATES:
                if other != state:
                    self.assertNotIn(f"state = '{other}'", sql)
        with self.assertRaises(LoadError):
            rollback_sql("FL", BATCH)
        with self.assertRaises(LoadError):
            rollback_sql("CA", "00000000-0000-0000-0000-000000000000")
        other = rollback_sql("VA", OTHER_BATCH)
        self.assertIn(OTHER_BATCH, other)
        self.assertNotIn(BATCH, other)

    def test_package_dates_and_aggregate_sql_stay_closed(self):
        eligibility = classify([
            row(first_open="NaT", last_open=""),
        ], {("ca_cslb", "100"): "c-1"})
        self.assertIsNone(eligibility.public_matches[0].first_open)
        self.assertIsNone(eligibility.public_matches[0].last_open)
        eligibility.package_sha256 = "ab" * 32
        statements = aggregate_statements(plan_aggregate(eligibility, BATCH))
        joined = "\n".join(statements)
        self.assertIn("contractor_osha_expansion_holds", joined)
        self.assertIn("ON CONFLICT ON CONSTRAINT contractor_osha_license_matches_idem", joined)
        self.assertNotIn("DROP TABLE", joined)
        eligibility.package_sha256 = "not-a-hash"
        with self.assertRaises(LoadError):
            aggregate_statements(plan_aggregate(eligibility, BATCH))
        unauthorized = classify([
            row(state="TN", source_system="tn_blc", license_key="T1"),
        ], {})
        unauthorized.package_sha256 = "ab" * 32
        with self.assertRaises(LoadError):
            aggregate_statements(plan_aggregate(unauthorized, BATCH))

    def test_database_execution_and_flnj_loader_stay_closed(self):
        with self.assertRaises(LoadError):
            execute_load()
        self.assertNotEqual(GO_PHRASE, FLNJ_GO_PHRASE)
        certified = (ROOT / "scripts/con_osha_001b/load_detail.py").read_text(encoding="utf-8")
        self.assertIn(FLNJ_GO_PHRASE, certified)
        self.assertIn('inspection_counts != {"FL": 12_339, "NJ": 5_195}', certified)
        for name in ("contract.py", "eligibility.py", "aggregate.py", "detail.py", "rollback.py"):
            source = (ROOT / "scripts/con_osha_002" / name).read_text(encoding="utf-8")
            self.assertNotIn("scripts.osha.match", source)
            self.assertNotIn("def _classify", source)
            self.assertNotIn("osha.gov/ords", source)
            self.assertNotIn("DATABASE_URL", source)
        migration_019 = (ROOT / "schema/migrations/019_con_osha_001b_inspection_details.sql").read_text(encoding="utf-8")
        self.assertIn("state IN ('FL', 'NJ')", migration_019)
        self.assertNotIn("'CA'", migration_019)
        migration_020 = (ROOT / "schema/migrations/020_con_osha_002_state_expansion.sql").read_text(encoding="utf-8")
        rollback = (ROOT / "schema/rollback/020_con_osha_002_state_expansion.rollback.sql").read_text(encoding="utf-8")
        for state in EXPANSION_STATES:
            self.assertIn(f"'{state}'", migration_020)
        self.assertIn("refuse to shrink OSHA state checks", rollback)
        self.assertIn("pilot_states", migration_020)
        self.assertNotIn("DROP TABLE contractors", migration_020)
        self.assertNotRegex(rollback, r"(?i)^DELETE\s+FROM\s+contractors")


if __name__ == "__main__":
    unittest.main()
