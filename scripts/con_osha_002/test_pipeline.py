"""CON-OSHA-002 loader tests.

Private package and source files are read only when the certified repro
bundle is on this machine. Those files are not copied into Git.
"""

from __future__ import annotations

import ast
import csv
import hashlib
import inspect
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

from scripts.con_osha_001b.load_detail import GO_PHRASE as FLNJ_GO_PHRASE
from scripts.con_osha_002.aggregate import (
    MemoryLedger,
    aggregate_statements,
    apply_aggregate,
    execute_fixture_load,
    execute_load,
    plan_aggregate,
)
from scripts.con_osha_002.contract import (
    B2_CONTRACT_COMMIT,
    B2_PACKAGE_FIELDS,
    B2_SOURCE_SYSTEMS,
    CA_NAME_SOURCE,
    CERTIFIED_ACTIVITY_TOTAL,
    CERTIFIED_CITATION_TOTAL,
    CERTIFIED_CITATIONS,
    CERTIFIED_ELIGIBLE_PROFILES,
    CERTIFIED_ELIGIBLE_TOTAL,
    CERTIFIED_PUBLISHED_ACTIVITIES,
    EXCLUDED_STATES,
    EXPANSION_STATES,
    GO_PHRASE,
    OFFICIAL_INSPECTION_SHA256,
    OFFICIAL_VIOLATION_SHA256,
    SOURCE_ZIP_SHA256,
    STATE_CHECK_NAMES,
    VERIFIED_B2_PACKAGE_SHA256,
)
from scripts.con_osha_002.detail import PlannedCitation, apply_detail, plan_detail, reconcile_initial_penalties
from scripts.con_osha_002.eligibility import LoadError, classify_rows, load_identities, read_package, verify_identities
from scripts.con_osha_002.execute import MemoryConn, execute_fixture_load as fixture_writer
from scripts.con_osha_002.rollback import rollback_sql

ROOT = Path(__file__).resolve().parents[2]
REPRO = Path(r"H:\osha-con-osha-002-g1\six-state-repro")
G1_PACKAGE = Path(r"C:\Users\Michael.Savitsky\contractor-con-osha-002-g1\scripts\osha\package.py")
LINK_ROOT = Path(r"C:\TrustHub-Work\con-osha-002-dryrun-20261022\x")
BATCH = "11111111-1111-4111-8111-111111111111"
OTHER_BATCH = "22222222-2222-4222-8222-222222222222"
C1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
C2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"
C3 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"
C4 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4"
PACKAGE_SHA = "ab" * 32
TARGET_URL = "postgresql://loader.internal:5432/osha_002_test"

PACKAGE_FILES = {
    "CA": "CA-osha-match-package.csv",
    "VA": "VA-osha-match-package.csv",
    "LA": "LA-osha-match-package.csv",
    "NV": "NV-osha-match-package.csv",
    "AZ": "AZ-osha-match-package.csv",
    "TN": "TN-osha-match-package.csv",
}
LINK_FILES = {
    "AZ": LINK_ROOT / "AZ_OSHA_extras_2026-10-21" / "citation_link_checks.csv",
    "CA": LINK_ROOT / "CA_OSHA_extras_2026-10-21_part2of2" / "citation_link_checks.csv",
    "LA": LINK_ROOT / "LA_OSHA_extras_2026-10-21" / "citation_link_checks.csv",
    "NV": LINK_ROOT / "NV_OSHA_extras_2026-10-21" / "citation_link_checks.csv",
    "TN": LINK_ROOT / "TN_OSHA_extras_2026-10-22" / "citation_link_checks.csv",
    "VA": LINK_ROOT / "VA_OSHA_extras_2026-10-21" / "citation_link_checks.csv",
}
OUTSIDE_LINK_GAPS = {"CA": 65, "VA": 0, "LA": 0, "NV": 0, "AZ": 0, "TN": 40}
VERIFIED_EMPTY = {"CA": 146, "VA": 51, "LA": 26, "NV": 15, "AZ": 5, "TN": 8}


def row(**overrides) -> dict[str, str]:
    base = {field: "" for field in B2_PACKAGE_FIELDS}
    base.update({
        "state": "CA",
        "source_system": "ca_cslb",
        "license_key": "100",
        "contractor_id": C1,
        "profile_eligible": "yes",
        "publication_status": "eligible",
        "match_tier": "exact",
        "person_name_licensee": "no",
        "postal_code": "94107",
        "county_name": "San Francisco",
        "osha_activity_nrs": "1001",
        "published_activity_nrs": "1001",
        "ambiguous_activity_nrs": "",
        "n_inspections": "1",
        "n_citation_items": "1",
        "n_serious": "1",
        "n_willful_repeat": "0",
        "current_penalty_amount": "10",
        "initial_penalty_amount": "10",
        "n_with_final_order": "0",
        "n_contested": "0",
    })
    base.update(overrides)
    if base["profile_eligible"] == "yes" and "published_activity_nrs" not in overrides:
        base["published_activity_nrs"] = base["osha_activity_nrs"]
    if base["profile_eligible"] == "yes" and "n_inspections" not in overrides:
        published = [part for part in base["published_activity_nrs"].split(";") if part]
        base["n_inspections"] = str(len(published))
    return base


def held(**overrides) -> dict[str, str]:
    values = {
        "profile_eligible": "no",
        "publication_status": "weak_held",
        "match_tier": "weak",
        "osha_activity_nrs": "",
        "published_activity_nrs": "",
        "ambiguous_activity_nrs": "",
        "n_inspections": "0",
        "n_citation_items": "0",
        "n_serious": "0",
        "n_willful_repeat": "0",
        "current_penalty_amount": "0",
        "initial_penalty_amount": "0",
        "n_with_final_order": "0",
        "n_contested": "0",
    }
    values.update(overrides)
    return row(**values)


def classify(rows, identities, receipt=None):
    return classify_rows(
        rows,
        identities,
        receipt=receipt if receipt is not None else {"ca_name_source": CA_NAME_SOURCE},
    )


def _write_csv(path: Path, header: str, body: str) -> None:
    path.write_text(header + "\n" + body, encoding="utf-8")


def _plan(rows, identities, inspections: str, citations: str, links: str | None = None):
    eligibility = classify(rows, identities)
    eligibility.package_sha256 = PACKAGE_SHA
    ledger = MemoryLedger()
    aggregate = plan_aggregate(eligibility, BATCH)
    apply_aggregate(aggregate, ledger)
    root = Path(tempfile.mkdtemp())
    inspection_path = root / "inspections.csv"
    citation_path = root / "citations.csv"
    _write_csv(inspection_path, "activity_nr,open_date,site_city,site_state", inspections)
    _write_csv(
        citation_path,
        "activity_nr,citation_id,standard,viol_type,current_penalty,initial_penalty,delete_flag,contest_date,final_order_date",
        citations,
    )
    link_path = None
    if links is not None:
        link_path = root / "links.csv"
        _write_csv(link_path, "activity_nr,citation_id,derived_link_status", links)
    detail = plan_detail(aggregate, ledger, inspection_path, citation_path, link_path)
    return eligibility, aggregate, ledger, detail, root


def _load(conn, eligibility, detail, **kwargs):
    calls = []

    def connector(url):
        calls.append(url)
        return conn

    result = execute_fixture_load(
        eligibility,
        detail,
        confirm=kwargs.pop("confirm", GO_PHRASE),
        database_url=kwargs.pop("database_url", TARGET_URL),
        expected_db_host=kwargs.pop("expected_db_host", "loader.internal"),
        expected_db_name=kwargs.pop("expected_db_name", "osha_002_test"),
        identities=kwargs.pop("identities", {(eligibility.source_system, match.license_key): match.contractor_id for match in detail.public_matches}),
        expected_profiles=kwargs.pop("expected_profiles", len(detail.public_matches)),
        expected_activities=kwargs.pop("expected_activities", len({item.activity_nr for item in detail.inspections})),
        expected_citations=kwargs.pop("expected_citations", len(detail.citations)),
        expected_package_sha256=kwargs.pop("expected_package_sha256", eligibility.package_sha256),
        connector=connector,
        source_observed_on=kwargs.pop("source_observed_on", "2026-10-22"),
        batch_id=kwargs.pop("batch_id", BATCH),
        **kwargs,
    )
    return result, calls


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _folded_rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            yield {key.casefold(): (value or "").strip() for key, value in raw.items()}


class PipelineTests(unittest.TestCase):
    def test_b2_contract_has_24_fields_and_tennessee(self):
        self.assertEqual(B2_CONTRACT_COMMIT, "67127bac9d6b2b39fa02d07ec08e053c990346ed")
        self.assertEqual(len(B2_PACKAGE_FIELDS), 24)
        for name in (
            "contractor_id",
            "profile_eligible",
            "publication_status",
            "published_activity_nrs",
            "ambiguous_activity_nrs",
        ):
            self.assertIn(name, B2_PACKAGE_FIELDS)
        self.assertLess(B2_PACKAGE_FIELDS.index("osha_activity_nrs"), B2_PACKAGE_FIELDS.index("published_activity_nrs"))
        self.assertEqual(B2_SOURCE_SYSTEMS["TN"], "tn_blc")
        self.assertEqual(EXPANSION_STATES, ("CA", "VA", "LA", "NV", "AZ", "TN"))
        self.assertEqual(VERIFIED_B2_PACKAGE_SHA256["CA"], "6c914c00d643f368c72de339bd4bb34b4cd5e9eaa3010b4a4c5fecef9e573539")
        self.assertEqual(VERIFIED_B2_PACKAGE_SHA256["VA"], "9c245e2c8ea69af10e2b86d1035a8c68070935439193f4265cdb4bbcb761bded")
        self.assertEqual(VERIFIED_B2_PACKAGE_SHA256["LA"], "547a2c47ee3588dc5af6916bfcef7dff8654e121c4023a303e4ac85120c12c99")
        self.assertEqual(VERIFIED_B2_PACKAGE_SHA256["NV"], "09b4b5c375df649b824473147adaf2e115b3c8fc2ac0b0e685bed46e60151ad7")
        self.assertEqual(VERIFIED_B2_PACKAGE_SHA256["AZ"], "e2a7db8d828fce8394a2dff5f47acc362b71b74e837453fcf3903a077469f143")
        self.assertEqual(VERIFIED_B2_PACKAGE_SHA256["TN"], "77d7a09eb9a1a83da4307de394b5dc861aea395f04ccd71288d65685b04243c0")
        self.assertEqual(sum(CERTIFIED_ELIGIBLE_PROFILES.values()), CERTIFIED_ELIGIBLE_TOTAL)
        self.assertEqual(sum(CERTIFIED_PUBLISHED_ACTIVITIES.values()), CERTIFIED_ACTIVITY_TOTAL)
        self.assertEqual(sum(CERTIFIED_CITATIONS.values()), CERTIFIED_CITATION_TOTAL)
        self.assertTrue(EXCLUDED_STATES.isdisjoint(SOURCE_ZIP_SHA256))
        module = ast.parse(G1_PACKAGE.read_text(encoding="utf-8"))
        found = None
        for node in module.body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == "PACKAGE_FIELDS":
                        found = tuple(ast.literal_eval(node.value))
        self.assertEqual(found, B2_PACKAGE_FIELDS)

    def test_activity_hold_keeps_a_profile_with_other_published_work(self):
        result = classify([
            row(
                osha_activity_nrs="1001;1002;1003;1004",
                published_activity_nrs="1002;1003;1004",
                ambiguous_activity_nrs="1001",
                n_inspections="3",
                n_citation_items="4",
                initial_penalty_amount="8300",
                n_with_final_order="3",
                first_open="1997-01-06",
            ),
            held(
                license_key="AMB",
                contractor_id=C2,
                publication_status="ambiguous_held",
                match_tier="exact",
                osha_activity_nrs="9999",
                ambiguous_activity_nrs="9999",
            ),
            held(license_key="WEAK", contractor_id=C3, osha_activity_nrs="3003"),
        ], {("ca_cslb", "100"): C1})
        self.assertEqual(result.public_profile_count, 1)
        self.assertEqual(len(result.distinct_contractor_ids), 1)
        match = result.public_matches[0]
        self.assertEqual(match.activities, ("1002", "1003", "1004"))
        self.assertEqual(match.matched_activities, ("1001", "1002", "1003", "1004"))
        self.assertEqual(match.public_activity_nrs, "1002;1003;1004")
        self.assertNotIn("1001", match.public_activity_nrs.split(";"))
        self.assertEqual(match.n_inspections, 3)
        self.assertEqual(match.n_citation_items, 4)
        self.assertEqual(match.source_system, "us_dol_osha")
        reasons = {(hold.license_key, hold.reason) for hold in result.holds}
        self.assertIn(("100", "ambiguous_activity"), reasons)
        self.assertIn(("AMB", "ambiguous_activity"), reasons)
        self.assertIn(("WEAK", "weak"), reasons)
        self.assertNotIn("AMB", {item.license_key for item in result.public_matches})

    def test_cross_contractor_publication_stops_and_same_contractor_may_share(self):
        with self.assertRaises(LoadError):
            classify([
                row(license_key="100", contractor_id=C1, osha_activity_nrs="1001"),
                row(license_key="200", contractor_id=C2, osha_activity_nrs="1001"),
            ], {("ca_cslb", "100"): C1, ("ca_cslb", "200"): C2})
        shared = classify([
            row(license_key="100", contractor_id=C1, osha_activity_nrs="1001"),
            row(license_key="300", contractor_id=C1, osha_activity_nrs="1001"),
        ], {("ca_cslb", "100"): C1, ("ca_cslb", "300"): C1})
        self.assertEqual(shared.public_profile_count, 2)
        self.assertEqual(len(shared.distinct_contractor_ids), 1)

    def test_tennessee_is_a_certified_public_source(self):
        result = classify_rows([
            row(state="TN", source_system="tn_blc", license_key="T1", contractor_id=C1),
        ], {("tn_blc", "T1"): C1})
        self.assertEqual(result.public_profile_count, 1)
        self.assertEqual(result.source_system, "tn_blc")
        self.assertEqual(result.public_matches[0].activities, ("1001",))
        self.assertFalse(any(hold.reason == "matcher_unauthorized" for hold in result.holds))

    def test_closed_inputs_and_bad_package_shape_fail(self):
        with self.assertRaises(LoadError):
            classify_rows([row()], {("ca_cslb", "100"): C1}, receipt={})
        with self.assertRaises(LoadError):
            classify([row(profile_eligible="yes", person_name_licensee="yes")], {("ca_cslb", "100"): C1})
        with self.assertRaises(LoadError):
            classify([held(license_key="STALE", n_inspections="4", osha_activity_nrs="1001")], {})
        with self.assertRaises(LoadError):
            classify([
                row(contractor_id=C1),
            ], {("ca_cslb", "100"): C2})
        missing = classify([row()], {})
        self.assertEqual(missing.public_profile_count, 0)
        self.assertIn("no_verified_license", {hold.reason for hold in missing.holds})
        for state, source in (("MA", "ma_board"), ("GA", "ga_board"), ("OH", "oh_board"), ("NC", "nc_board"), ("FL", "fl_dbpr"), ("NJ", "nj_dca")):
            with self.assertRaises(LoadError):
                classify_rows([row(state=state, source_system=source)], {})
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "package.csv"
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=("state", "license_key"))
                writer.writeheader()
                writer.writerow({"state": "CA", "license_key": "100"})
            with self.assertRaises(LoadError):
                read_package(path)
        dated = classify([row(first_open="NaT", last_open="")], {("ca_cslb", "100"): C1})
        self.assertIsNone(dated.public_matches[0].first_open)
        self.assertIsNone(dated.public_matches[0].last_open)

    def test_aggregate_uses_post_hold_counts_and_second_plan_is_empty(self):
        eligibility, aggregate, ledger, detail, root = _plan(
            [row(n_citation_items="1")],
            {("ca_cslb", "100"): C1},
            "1001,2020-01-02,Oakland,CA",
            "1001,01002,1926.501,S,0,10,,NaT,",
            "1001,01002,matched",
        )
        self.assertEqual(detail.citations[0].current_penalty, Decimal("0.00"))
        self.assertEqual(detail.citations[0].initial_penalty, Decimal("10.00"))
        self.assertIsNone(detail.inspections[0].inspection_type)
        self.assertIsNone(detail.inspections[0].close_date)
        self.assertIsNone(detail.inspections[0].closing_conference_date)
        self.assertTrue(detail.ready)
        statements = aggregate_statements(aggregate, detail)
        joined = "\n".join(statements)
        self.assertIn("osha_matched_activity_nrs", joined)
        self.assertIn("1, 1, 1, 0, 0, 0", joined)
        citation_sql = next(statement for statement in statements if "insert_citation" in statement)
        self.assertIn("current_penalty, initial_penalty, contest_date", citation_sql)
        receipt_sql = next(statement for statement in statements if "insert_expansion_receipt" in statement)
        self.assertIn("source_zip_sha256", receipt_sql)
        self.assertLess(receipt_sql.index(SOURCE_ZIP_SHA256["CA"][0]), receipt_sql.index(SOURCE_ZIP_SHA256["CA"][1]))
        self.assertLess(joined.index("insert_match"), joined.index("insert_inspection"))
        self.assertNotIn("DROP TABLE", joined)
        apply_detail(detail, ledger)
        second = plan_aggregate(eligibility, BATCH, ledger)
        self.assertEqual(second.insert_counts["matches"], 0)
        self.assertEqual(second.insert_counts["receipts"], 0)
        again = plan_detail(second, ledger, root / "inspections.csv", root / "citations.csv", root / "links.csv")
        self.assertEqual(again.insert_counts, {"inspections": 0, "citations": 0, "bridges": 0, "holds": 0})
        eligibility.package_sha256 = "not-a-hash"
        with self.assertRaises(LoadError):
            aggregate_statements(plan_aggregate(eligibility, BATCH), detail)

    def test_missing_detail_holds_the_profile_and_preserves_null_penalties(self):
        _eligibility, _aggregate, _ledger, detail, _root = _plan(
            [
                row(license_key="100", contractor_id=C1, osha_activity_nrs="1001", n_citation_items="2"),
                row(license_key="200", contractor_id=C2, osha_activity_nrs="1002", n_citation_items="1"),
                row(license_key="300", contractor_id=C3, osha_activity_nrs="1003", n_citation_items="1"),
                row(license_key="400", contractor_id=C4, osha_activity_nrs="1004", n_citation_items="0"),
            ],
            {("ca_cslb", key): contractor for key, contractor in (("100", C1), ("200", C2), ("300", C3), ("400", C4))},
            "1001,2020-05-01,Oakland,CA\n1002,2020-05-02,Oakland,CA\n1003,2020-05-03,Oakland,CA",
            "\n".join([
                "1001,01001,1926.501,S,,,,,",
                "1001,01002,1926.501,S,0,10,,,",
                "1001,0100X,1926.501,S,5,100,X,,",
                "1002,02001,1926.501,S,5,1,,,",
                "1003,03001,,S,5,1,,,",
            ]),
            "\n".join([
                "1001,01001,matched",
                "1001,01002,matched",
                "1001,0100X,matched",
                "1002,02001,missing_citation_context",
                "1003,03001,matched",
                "9998,08888,missing",
            ]),
        )
        self.assertFalse(detail.ready)
        self.assertEqual([match.license_key for match in detail.public_matches], ["100"])
        penalties = {item.citation_id: item.current_penalty for item in detail.citations}
        self.assertIsNone(penalties["01001"])
        self.assertEqual(penalties["01002"], Decimal("0.00"))
        self.assertNotIn("0100X", penalties)
        initials = {item.citation_id: item.initial_penalty for item in detail.citations}
        self.assertIsNone(initials["01001"])
        self.assertEqual(initials["01002"], Decimal("10.00"))
        self.assertNotIn("0100X", initials)
        reasons = {hold.reason for hold in detail.holds}
        self.assertIn("deleted_citation", reasons)
        self.assertIn("missing_citation_context", reasons)
        self.assertIn("unsupported_citation", reasons)
        self.assertIn("missing_inspection", reasons)
        self.assertIn("incomplete_detail", reasons)
        self.assertEqual(detail.missing_citation_context, 1)
        self.assertTrue(all(not hasattr(item, "official_url") for item in detail.inspections))
        with self.assertRaises(LoadError):
            apply_detail(detail, MemoryLedger())
        calls = []
        with self.assertRaises(LoadError):
            execute_load(detail=detail, confirm=GO_PHRASE, connector=lambda url: calls.append(url))
        self.assertEqual(calls, [])

    def test_citation_count_mismatch_stops_before_a_partial_plan(self):
        with self.assertRaises(LoadError):
            _plan(
                [row(n_citation_items="5")],
                {("ca_cslb", "100"): C1},
                "1001,2020-01-02,Oakland,CA",
                "1001,01002,1926.501,S,0,10,,,",
                "1001,01002,matched",
            )

    def test_verified_empty_inspection_is_not_a_zero_citation_placeholder(self):
        _eligibility, _aggregate, _ledger, detail, _root = _plan(
            [row(osha_activity_nrs="1001", n_citation_items="0", n_serious="0", current_penalty_amount="0", initial_penalty_amount="0")],
            {("ca_cslb", "100"): C1},
            "1001,2021-01-01,Oakland,CA",
            "",
            None,
        )
        self.assertTrue(detail.ready)
        self.assertEqual(detail.citations, [])
        self.assertEqual(detail.verified_empty_inspections, 1)
        self.assertTrue(detail.inspections[0].citations_verified)

    def test_loader_is_go_gated_idempotent_and_rolls_back(self):
        eligibility, _aggregate, _ledger, detail, _root = _plan(
            [row(
                osha_activity_nrs="1001;1002",
                published_activity_nrs="1002",
                ambiguous_activity_nrs="1001",
                n_citation_items="1",
                n_serious="1",
            )],
            {("ca_cslb", "100"): C1},
            "1002,2020-01-02,Oakland,CA",
            "1002,01002,1926.501,S,,10,,",
            None,
        )
        self.assertTrue(detail.ready)
        self.assertIsNone(detail.citations[0].current_penalty)
        self.assertEqual(detail.citations[0].initial_penalty, Decimal("10.00"))
        conn = MemoryConn()
        first, calls = _load(conn, eligibility, detail)
        self.assertEqual(calls, [TARGET_URL])
        self.assertEqual(first["matches"], 1)
        self.assertEqual(first["inspections"], 1)
        self.assertEqual(first["citations"], 1)
        self.assertEqual(first["bridges"], 1)
        stored = next(iter(conn.matches.values()))
        self.assertEqual(stored["public_activities"], "1002")
        self.assertEqual(stored["provenance"], "1001;1002")
        self.assertLess(conn.steps.index("insert_match"), conn.steps.index("insert_inspection"))
        receipts_after_first = conn.inserted["receipts"]
        self.assertEqual(receipts_after_first, 3)
        by_dataset = {}
        for batch, dataset, digest in conn.detail_receipts:
            receipt_row = conn.detail_receipts[(batch, dataset, digest)]
            self.assertEqual(batch, BATCH)
            by_dataset[dataset] = (digest, receipt_row)
        inspection_dataset = f"con-osha-002:{detail.state}:inspections"
        citation_dataset = f"con-osha-002:{detail.state}:citations"
        self.assertEqual(set(by_dataset), {inspection_dataset, citation_dataset})
        inspection_digest, inspection_row = by_dataset[inspection_dataset]
        citation_digest, citation_row = by_dataset[citation_dataset]
        self.assertEqual(inspection_digest, detail.inspection_sha256)
        self.assertEqual(citation_digest, detail.citation_sha256)
        self.assertNotEqual(inspection_row["id"], citation_row["id"])
        self.assertEqual(
            (inspection_row["inspection_rows"], inspection_row["loadable"], inspection_row["citation_rows"]),
            (1, 0, 0),
        )
        self.assertEqual(
            (citation_row["inspection_rows"], citation_row["loadable"], citation_row["citation_rows"]),
            (0, 1, 1),
        )
        self.assertEqual(conn.inspections["1002"]["receipt_id"], inspection_row["id"])
        self.assertEqual(conn.citations[("1002", "01002")]["receipt_id"], citation_row["id"])
        self.assertEqual(conn.citations[("1002", "01002")]["initial_penalty"], Decimal("10.00"))
        self.assertEqual(next(iter(conn.bridges.values()))["receipt_id"], inspection_row["id"])
        self.assertEqual(next(iter(conn.receipts.values()))["zips"], SOURCE_ZIP_SHA256["CA"])
        second, _calls = _load(conn, eligibility, detail)
        self.assertEqual(second["matches"], 0)
        self.assertEqual(second["holds"], 0)
        self.assertEqual(second["inspections"], 0)
        self.assertEqual(second["citations"], 0)
        self.assertEqual(second["bridges"], 0)
        self.assertEqual(conn.inserted["receipts"], receipts_after_first)
        self.assertEqual(len(conn.detail_receipts), 2)
        self.assertEqual(next(iter(conn.receipts.values()))["zips"], SOURCE_ZIP_SHA256["CA"])
        self.assertEqual(len(conn.inspections), 1)

        mismatch = MemoryConn()
        mismatch.force_reconcile_mismatch = True
        with self.assertRaises(LoadError):
            _load(mismatch, eligibility, detail)
        self.assertTrue(mismatch.rolled_back)
        self.assertEqual(mismatch.matches, {})
        self.assertEqual(mismatch.inspections, {})
        self.assertEqual(mismatch.citations, {})

        legacy = MemoryConn()
        legacy.state_checks = {
            name: "CHECK ((state = ANY (ARRAY['FL'::bpchar, 'NJ'::bpchar])))"
            for name in STATE_CHECK_NAMES
        }
        with self.assertRaises(LoadError):
            _load(legacy, eligibility, detail)
        self.assertEqual(legacy.matches, {})

        widened_pilot = MemoryConn()
        widened_pilot.pilot_states = "CHECK ((pilot_states = 'FL,NJ,CA'::text))"
        with self.assertRaises(LoadError):
            _load(widened_pilot, eligibility, detail)
        self.assertEqual(widened_pilot.matches, {})

        wrong_db = MemoryConn()
        wrong_db.database_name = "production"
        with self.assertRaises(LoadError):
            _load(wrong_db, eligibility, detail)
        self.assertTrue(wrong_db.rolled_back)
        self.assertEqual(wrong_db.matches, {})

        def fail_if_called(_url):
            raise AssertionError("connector should not be called")

        with self.assertRaises(LoadError):
            execute_load()
        with self.assertRaises(LoadError):
            execute_load(eligibility, detail, confirm="nope", connector=fail_if_called)
        with self.assertRaises(LoadError):
            execute_load(
                eligibility, detail, confirm=GO_PHRASE, database_url=TARGET_URL,
                expected_db_host="other.example", expected_db_name="osha_002_test",
                identities={(eligibility.source_system, "100"): C1},
                expected_profiles=1, expected_activities=1, expected_citations=1,
                expected_package_sha256=PACKAGE_SHA, source_observed_on="2026-10-22",
                batch_id=BATCH, connector=fail_if_called,
            )
        with self.assertRaises(LoadError):
            execute_load(
                eligibility, detail, confirm=GO_PHRASE, database_url=TARGET_URL,
                expected_db_host="loader.internal", expected_db_name="osha_002_test",
                identities={(eligibility.source_system, "100"): C1},
                expected_profiles=1706, expected_activities=2615, expected_citations=6903,
                expected_package_sha256=PACKAGE_SHA, official=True,
                source_observed_on="2026-10-22", batch_id=BATCH, connector=fail_if_called,
            )

    def test_initial_penalty_preserves_null_zero_positive_and_excludes_deleted(self):
        _eligibility, _aggregate, _ledger, detail, _root = _plan(
            [row(n_citation_items="3", n_serious="3", initial_penalty_amount="15")],
            {("ca_cslb", "100"): C1},
            "1001,2020-01-02,Oakland,CA",
            "\n".join([
                "1001,01001,1926.501,S,,,,,",
                "1001,01002,1926.501,O,0,0,,,",
                "1001,01003,1926.501,S,15.25,15.25,,,",
                "1001,0100X,1926.501,S,100,100,X,,",
            ]),
        )
        self.assertTrue(detail.ready)
        stored = {item.citation_id: item.initial_penalty for item in detail.citations}
        self.assertIsNone(stored["01001"])
        self.assertEqual(stored["01002"], Decimal("0.00"))
        self.assertEqual(stored["01003"], Decimal("15.25"))
        self.assertNotIn("0100X", stored)
        self.assertIn("deleted_citation", {hold.reason for hold in detail.holds})
        _shared_eligibility, _shared_aggregate, _shared_ledger, shared, _shared_root = _plan(
            [
                row(license_key="100", contractor_id=C1, initial_penalty_amount="10"),
                row(license_key="300", contractor_id=C1, initial_penalty_amount="10"),
            ],
            {("ca_cslb", "100"): C1, ("ca_cslb", "300"): C1},
            "1001,2020-01-02,Oakland,CA",
            "1001,01002,1926.501,S,,10,,",
        )
        self.assertEqual(len(shared.public_matches), 2)
        self.assertEqual(len(shared.citations), 1)
        self.assertEqual(shared.citations[0].initial_penalty, Decimal("10.00"))

    def test_initial_penalty_rounding_matches_b2_half_even(self):
        class Profile:
            def __init__(self, amount):
                self.activities = ("1001",)
                self.n_citation_items = 1
                self.initial_penalty_amount = amount

        def citation(text, amount):
            return PlannedCitation(
                activity_nr="1001",
                citation_id="01001",
                standard="1926.501",
                viol_type="S",
                current_penalty=None,
                initial_penalty=amount,
                initial_penalty_text=text,
                contest_date=None,
                final_order_date=None,
            )

        reconcile_initial_penalties([Profile(12)], [citation("12.5", Decimal("12.50"))])
        reconcile_initial_penalties([Profile(2)], [citation("1.5", Decimal("1.50"))])
        reconcile_initial_penalties([Profile(15)], [citation("15.25", Decimal("15.25"))])
        with self.assertRaises(LoadError):
            reconcile_initial_penalties([Profile(13)], [citation("12.5", Decimal("12.50"))])
        with self.assertRaises(LoadError) as tampered:
            reconcile_initial_penalties([Profile(12)], [citation("12.5", Decimal("13.00"))])
        self.assertIn("source evidence", str(tampered.exception))

    def test_missing_initial_penalty_evidence_stops(self):
        eligibility = classify([row()], {("ca_cslb", "100"): C1})
        eligibility.package_sha256 = PACKAGE_SHA
        ledger = MemoryLedger()
        aggregate = plan_aggregate(eligibility, BATCH)
        apply_aggregate(aggregate, ledger)
        root = Path(tempfile.mkdtemp())
        _write_csv(root / "inspections.csv", "activity_nr,open_date", "1001,2020-01-02")
        _write_csv(
            root / "citations.csv",
            "activity_nr,citation_id,standard,viol_type,current_penalty,delete_flag",
            "1001,01002,1926.501,S,10,",
        )
        with self.assertRaises(LoadError) as missing_column:
            plan_detail(aggregate, ledger, root / "inspections.csv", root / "citations.csv")
        self.assertIn("initial_penalty", str(missing_column.exception))
        self.assertNotIn("certified aggregate", str(missing_column.exception))

        class Bare:
            activity_nr = "1001"

        class Profile:
            activities = ("1001",)
            n_citation_items = 1
            initial_penalty_amount = 10

        with self.assertRaises(LoadError) as bare:
            reconcile_initial_penalties([Profile()], [Bare()])
        self.assertIn("unavailable", str(bare.exception))

        ready, _ready_aggregate, _ready_ledger, detail, _detail_root = _plan(
            [row(n_citation_items="1")],
            {("ca_cslb", "100"): C1},
            "1001,2020-01-02,Oakland,CA",
            "1001,01002,1926.501,S,,10,,",
        )
        detail.citations[0].initial_penalty = Decimal("99.00")
        calls = []

        def connector(url):
            calls.append(url)
            return MemoryConn()

        with self.assertRaises(LoadError) as tampered:
            execute_fixture_load(
                ready, detail, confirm=GO_PHRASE, database_url=TARGET_URL,
                expected_db_host="loader.internal", expected_db_name="osha_002_test",
                identities={(ready.source_system, "100"): C1},
                expected_profiles=1, expected_activities=1, expected_citations=1,
                expected_package_sha256=PACKAGE_SHA, connector=connector,
                source_observed_on="2026-10-22", batch_id=BATCH,
            )
        self.assertIn("source evidence", str(tampered.exception))
        self.assertEqual(calls, [])

    def test_conflicting_detail_receipt_and_citation_association_roll_back(self):
        eligibility, _aggregate, _ledger, detail, _root = _plan(
            [row(n_citation_items="1")],
            {("ca_cslb", "100"): C1},
            "1001,2020-01-02,Oakland,CA",
            "1001,01002,1926.501,S,,10,,",
        )
        inspection_dataset = f"con-osha-002:{detail.state}:inspections"
        citation_dataset = f"con-osha-002:{detail.state}:citations"
        bad_hash = MemoryConn()
        bad_hash.detail_receipts[(BATCH, citation_dataset, "ff" * 32)] = {
            "id": "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
            "inspection_rows": 0,
            "loadable": 1,
            "citation_rows": 1,
        }
        with self.assertRaises(LoadError) as conflict:
            _load(bad_hash, eligibility, detail)
        self.assertIn("existing detail receipt provenance", str(conflict.exception))
        self.assertTrue(bad_hash.rolled_back)
        self.assertEqual(bad_hash.matches, {})
        self.assertEqual(bad_hash.citations, {})
        self.assertIn((BATCH, citation_dataset, "ff" * 32), bad_hash.detail_receipts)

        duplicate = MemoryConn()
        duplicate.detail_receipts[(BATCH, citation_dataset, detail.citation_sha256)] = {
            "id": "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
            "inspection_rows": 0,
            "loadable": 1,
            "citation_rows": 1,
        }
        duplicate.detail_receipts[(BATCH, citation_dataset, "ee" * 32)] = {
            "id": "dddddddd-dddd-4ddd-8ddd-ddddddddddd3",
            "inspection_rows": 0,
            "loadable": 1,
            "citation_rows": 1,
        }
        with self.assertRaises(LoadError):
            _load(duplicate, eligibility, detail)
        self.assertTrue(duplicate.rolled_back)
        self.assertEqual(duplicate.matches, {})

        inspection_receipt = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"
        citation_receipt = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"
        inspection_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3"
        linked = MemoryConn()
        linked.detail_receipts[(BATCH, inspection_dataset, detail.inspection_sha256)] = {
            "id": inspection_receipt,
            "inspection_rows": 1,
            "loadable": 0,
            "citation_rows": 0,
        }
        linked.detail_receipts[(BATCH, citation_dataset, detail.citation_sha256)] = {
            "id": citation_receipt,
            "inspection_rows": 0,
            "loadable": 1,
            "citation_rows": 1,
        }
        linked.inspections["1001"] = {
            "id": inspection_id,
            "state": "CA",
            "digest": detail.inspection_sha256,
            "batch_id": BATCH,
            "verified": True,
            "receipt_id": inspection_receipt,
        }
        linked.inspection_ids[inspection_id] = "1001"
        linked.citations[("1001", "01002")] = {
            "batch_id": BATCH,
            "digest": detail.citation_sha256,
            "receipt_id": inspection_receipt,
            "initial_penalty": detail.citations[0].initial_penalty,
        }
        with self.assertRaises(LoadError) as association:
            _load(linked, eligibility, detail)
        self.assertIn("inspection-source receipt", str(association.exception))
        self.assertTrue(linked.rolled_back)
        self.assertEqual(linked.matches, {})
        self.assertEqual(linked.citations[("1001", "01002")]["receipt_id"], inspection_receipt)

        penalty = MemoryConn()
        penalty.detail_receipts[(BATCH, inspection_dataset, detail.inspection_sha256)] = {
            "id": inspection_receipt,
            "inspection_rows": 1,
            "loadable": 0,
            "citation_rows": 0,
        }
        penalty.detail_receipts[(BATCH, citation_dataset, detail.citation_sha256)] = {
            "id": citation_receipt,
            "inspection_rows": 0,
            "loadable": 1,
            "citation_rows": 1,
        }
        penalty.inspections["1001"] = {
            "id": inspection_id,
            "state": "CA",
            "digest": detail.inspection_sha256,
            "batch_id": BATCH,
            "verified": True,
            "receipt_id": inspection_receipt,
        }
        penalty.inspection_ids[inspection_id] = "1001"
        penalty.citations[("1001", "01002")] = {
            "batch_id": BATCH,
            "digest": detail.citation_sha256,
            "receipt_id": citation_receipt,
            "initial_penalty": Decimal("1.00"),
        }
        with self.assertRaises(LoadError) as penalty_conflict:
            _load(penalty, eligibility, detail)
        self.assertIn("different provenance", str(penalty_conflict.exception))
        self.assertTrue(penalty.rolled_back)
        self.assertEqual(penalty.matches, {})
        self.assertEqual(penalty.citations[("1001", "01002")]["initial_penalty"], Decimal("1.00"))

    def test_altered_zip_hash_rolls_back(self):
        eligibility, _aggregate, _ledger, detail, _root = _plan(
            [row(n_citation_items="1")],
            {("ca_cslb", "100"): C1},
            "1001,2020-01-02,Oakland,CA",
            "1001,01002,1926.501,S,,10,,",
        )
        conn = MemoryConn()
        conn.receipts[("CA", BATCH)] = {
            "id": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
            "profiles": 1,
            "inspections": 1,
            "citations": 1,
            "zips": ("0" * 64,),
        }
        with self.assertRaises(LoadError) as caught:
            _load(conn, eligibility, detail)
        self.assertIn("ZIP", str(caught.exception))
        self.assertTrue(conn.rolled_back)
        self.assertEqual(conn.matches, {})
        self.assertEqual(conn.inspections, {})
        self.assertEqual(conn.citations, {})
        self.assertEqual(conn.receipts[("CA", BATCH)]["zips"], ("0" * 64,))

    def test_official_false_cannot_bypass_certified_pins(self):
        eligibility, _aggregate, _ledger, detail, _root = _plan(
            [row(n_citation_items="1")],
            {("ca_cslb", "100"): C1},
            "1001,2020-01-02,Oakland,CA",
            "1001,01002,1926.501,S,,10,,",
        )
        calls = []

        def recorder(url):
            calls.append(url)
            raise AssertionError("connector must not be called")

        with self.assertRaises(LoadError) as bypass:
            execute_load(
                eligibility, detail, confirm=GO_PHRASE, database_url=TARGET_URL,
                expected_db_host="loader.internal", expected_db_name="osha_002_test",
                identities={(eligibility.source_system, "100"): C1},
                expected_profiles=1, expected_activities=1, expected_citations=1,
                expected_package_sha256=PACKAGE_SHA, official=False,
                source_observed_on="2026-10-22", batch_id=BATCH, connector=recorder,
            )
        self.assertIn("cannot override", str(bypass.exception))
        self.assertEqual(calls, [])
        with self.assertRaises(LoadError) as arbitrary:
            execute_load(
                eligibility, detail, confirm=GO_PHRASE, database_url=TARGET_URL,
                expected_db_host="loader.internal", expected_db_name="osha_002_test",
                identities={(eligibility.source_system, "100"): C1},
                expected_profiles=1706, expected_activities=2615, expected_citations=6903,
                expected_package_sha256=VERIFIED_B2_PACKAGE_SHA256["CA"], official=False,
                source_observed_on="2026-10-22", batch_id=BATCH, connector=recorder,
            )
        self.assertIn("official inspection or violation hash", str(arbitrary.exception))
        self.assertEqual(calls, [])
        detail.inspection_sha256 = OFFICIAL_INSPECTION_SHA256
        detail.citation_sha256 = OFFICIAL_VIOLATION_SHA256
        with self.assertRaises(LoadError) as counts:
            execute_load(
                eligibility, detail, confirm=GO_PHRASE, database_url=TARGET_URL,
                expected_db_host="loader.internal", expected_db_name="osha_002_test",
                identities={(eligibility.source_system, "100"): C1},
                expected_profiles=1706, expected_activities=2615, expected_citations=6903,
                expected_package_sha256=VERIFIED_B2_PACKAGE_SHA256["CA"],
                source_observed_on="2026-10-22", batch_id=BATCH, connector=recorder,
            )
        self.assertIn("preflight", str(counts.exception))
        self.assertEqual(calls, [])
        self.assertNotIn("import psycopg", inspect.getsource(fixture_writer))
        with self.assertRaises(LoadError):
            fixture_writer()

    def test_per_state_rollback_and_migration_020_are_exact(self):
        for state in EXPANSION_STATES:
            sql = rollback_sql(state, BATCH)
            self.assertIn(f"state = '{state}'", sql)
            self.assertIn("contractor_osha_citations", sql)
            self.assertLess(sql.index("DELETE FROM contractor_osha_citations"), sql.index("DELETE FROM contractor_osha_match_inspections"))
            self.assertLess(sql.index("DELETE FROM contractor_osha_match_inspections"), sql.index("DELETE FROM contractor_osha_inspections"))
            self.assertNotRegex(sql, r"DELETE\s+FROM\s+(contractors|licenses|osha_load_receipts)\b")
            for other in EXPANSION_STATES:
                if other != state:
                    self.assertNotIn(f"state = '{other}'", sql)
        with self.assertRaises(LoadError):
            rollback_sql("FL", BATCH)
        with self.assertRaises(LoadError):
            rollback_sql("CA", "00000000-0000-0000-0000-000000000000")

        migration = (ROOT / "schema/migrations/020_con_osha_002_state_expansion.sql").read_text(encoding="utf-8")
        rollback = (ROOT / "schema/rollback/020_con_osha_002_state_expansion.rollback.sql").read_text(encoding="utf-8")
        earlier = (ROOT / "schema/migrations/019_con_osha_001b_inspection_details.sql").read_text(encoding="utf-8")
        self.assertIn("DRAFT ONLY: do not execute", migration)
        self.assertNotIn("FOR rec IN", migration)
        self.assertIn("RAISE EXCEPTION", migration)
        self.assertIn("osha_matched_activity_nrs", migration)
        self.assertIn("incomplete_detail", migration)
        self.assertIn("missing_inspection", migration)
        self.assertIn("pilot_states", migration)
        self.assertNotIn("ALTER TABLE osha_load_receipts", migration)
        for name in STATE_CHECK_NAMES:
            self.assertIn(name, migration)
        self.assertIn("state IN ('FL', 'NJ')", earlier)
        self.assertNotIn("'CA'", earlier)
        self.assertIn("DROP COLUMN IF EXISTS osha_matched_activity_nrs", rollback)
        self.assertIn("refuse to shrink OSHA state checks", rollback)
        self.assertNotRegex(rollback, r"(?i)^DELETE\s+FROM\s+contractors")

    def test_flnj_flags_and_public_reads_stay_closed(self):
        self.assertNotEqual(GO_PHRASE, FLNJ_GO_PHRASE)
        certified = (ROOT / "scripts/con_osha_001b/load_detail.py").read_text(encoding="utf-8")
        self.assertIn(FLNJ_GO_PHRASE, certified)
        self.assertIn('inspection_counts != {"FL": 12_339, "NJ": 5_195}', certified)
        for name in ("contract.py", "eligibility.py", "aggregate.py", "detail.py", "execute.py", "rollback.py"):
            source = (ROOT / "scripts/con_osha_002" / name).read_text(encoding="utf-8")
            self.assertNotIn("scripts.osha.match", source)
            self.assertNotIn("def _classify", source)
            self.assertNotIn("osha.gov/ords", source)
            self.assertNotIn("DATABASE_URL", source)
        flag = (ROOT / "lib/osha/flag.ts").read_text(encoding="utf-8")
        self.assertIn('const DEFAULT_PUBLISHED_STATES = ["FL", "NJ"]', flag)
        self.assertIn("CON_OSHA_001_PROFILE", flag)
        self.assertIn("CON_OSHA_001B_DETAIL", flag)
        detail_sql = (ROOT / "lib/osha/load-inspection-details.ts").read_text(encoding="utf-8")
        self.assertNotIn("osha_matched_activity_nrs", detail_sql)
        self.assertIn("isOshaDetailEnabled()", detail_sql)
        public_sql = (ROOT / "lib/osha/public-record.ts").read_text(encoding="utf-8")
        self.assertNotIn("osha_matched_activity_nrs", public_sql)
        self.assertNotIn("osha_activity_nrs", public_sql)

    def test_certified_six_state_population_when_bundle_is_present(self):
        packages = REPRO / "packages"
        inspections = REPRO / "inputs" / "inspections.csv"
        violations = REPRO / "inputs" / "violations.csv"
        licenses = REPRO / "inputs" / "licenses.csv"
        if not packages.is_dir() or not inspections.is_file() or not violations.is_file() or not licenses.is_file():
            self.skipTest("private six-state repro bundle is not on this machine")
        self.assertEqual(_sha256(inspections), OFFICIAL_INSPECTION_SHA256)
        self.assertEqual(_sha256(violations), OFFICIAL_VIOLATION_SHA256)
        identities = load_identities(licenses)
        published = {}
        citation_totals = {}
        eligible_rows = {}
        distinct_contractors = {}
        partial = []
        for state, filename in PACKAGE_FILES.items():
            _digest, rows = read_package(packages / filename, expect_known_hash=True)
            eligibility = classify_rows(
                rows,
                receipt={"ca_name_source": CA_NAME_SOURCE} if state == "CA" else None,
            )
            verify_identities(eligibility, identities)
            eligible_rows[state] = eligibility.public_profile_count
            distinct_contractors[state] = len(eligibility.distinct_contractor_ids)
            published[state] = set(eligibility.published_activities)
            citation_totals[state] = eligibility.citation_count
            self.assertEqual(eligible_rows[state], CERTIFIED_ELIGIBLE_PROFILES[state])
            self.assertEqual(distinct_contractors[state], CERTIFIED_ELIGIBLE_PROFILES[state])
            self.assertEqual(len(published[state]), CERTIFIED_PUBLISHED_ACTIVITIES[state])
            self.assertEqual(citation_totals[state], CERTIFIED_CITATIONS[state])
            self.assertEqual(sum(match.n_inspections for match in eligibility.public_matches), len(published[state]))
            if state == "CA":
                partial = [
                    match for match in eligibility.public_matches
                    if len(match.matched_activities) > len(match.activities)
                ]
        self.assertEqual(sum(eligible_rows.values()), CERTIFIED_ELIGIBLE_TOTAL)
        self.assertEqual(sum(distinct_contractors.values()), CERTIFIED_ELIGIBLE_TOTAL)
        union = set()
        for activities in published.values():
            self.assertTrue(union.isdisjoint(activities))
            union |= activities
        self.assertEqual(len(union), CERTIFIED_ACTIVITY_TOTAL)
        self.assertEqual(len(partial), 1)
        self.assertEqual(len(partial[0].activities), 3)
        self.assertEqual(len(partial[0].matched_activities), 4)
        self.assertEqual(partial[0].n_inspections, 3)
        self.assertEqual(partial[0].n_citation_items, 4)
        self.assertEqual(partial[0].initial_penalty_amount, 8300)
        self.assertEqual(partial[0].n_with_final_order, 3)
        self.assertEqual(partial[0].first_open, "1997-01-06")

        found_inspections = {state: set() for state in EXPANSION_STATES}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            inspection_handles = {}
            citation_handles = {}
            inspection_writers = {}
            citation_writers = {}
            for state in EXPANSION_STATES:
                inspection_handles[state] = (root / f"{state}-inspections.csv").open("w", encoding="utf-8", newline="")
                citation_handles[state] = (root / f"{state}-citations.csv").open("w", encoding="utf-8", newline="")
                inspection_writers[state] = csv.writer(inspection_handles[state], lineterminator="\n")
                citation_writers[state] = csv.writer(citation_handles[state], lineterminator="\n")
                inspection_writers[state].writerow(["activity_nr", "open_date", "site_city", "site_state"])
                citation_writers[state].writerow([
                    "activity_nr", "citation_id", "standard", "viol_type", "current_penalty",
                    "initial_penalty", "delete_flag", "contest_date", "final_order_date",
                ])
            blank_penalties = {state: 0 for state in EXPANSION_STATES}
            zero_penalties = {state: 0 for state in EXPANSION_STATES}
            blank_initial = {state: 0 for state in EXPANSION_STATES}
            zero_initial = {state: 0 for state in EXPANSION_STATES}
            positive_initial = {state: 0 for state in EXPANSION_STATES}
            loadable = {state: {} for state in EXPANSION_STATES}
            try:
                for record in _folded_rows(inspections):
                    activity = record.get("activity_nr", "")
                    site_state = record.get("site_state", "").upper()
                    if activity in published.get(site_state, ()):
                        found_inspections[site_state].add(activity)
                        inspection_writers[site_state].writerow([
                            activity, record.get("open_date", ""), record.get("site_city", ""), site_state,
                        ])
                for record in _folded_rows(violations):
                    activity = record.get("activity_nr", "")
                    state = next((code for code, activities in published.items() if activity in activities), "")
                    if not state:
                        continue
                    marker = record.get("delete_flag", "").upper()
                    penalty = record.get("current_penalty", "")
                    initial = record.get("initial_penalty", "")
                    if marker == "X":
                        citation_writers[state].writerow([
                            activity, record.get("citation_id", ""), record.get("standard", ""),
                            record.get("viol_type", ""), penalty, initial, "X",
                            record.get("contest_date", ""), record.get("final_order_date", ""),
                        ])
                        continue
                    loadable[state][(activity, record.get("citation_id", ""))] = penalty
                    if penalty == "":
                        blank_penalties[state] += 1
                    elif Decimal(penalty) == 0:
                        zero_penalties[state] += 1
                    if initial == "":
                        blank_initial[state] += 1
                    elif Decimal(initial) == 0:
                        zero_initial[state] += 1
                    else:
                        positive_initial[state] += 1
                    citation_writers[state].writerow([
                        activity, record.get("citation_id", ""), record.get("standard", ""),
                        record.get("viol_type", ""), penalty, initial, "",
                        record.get("contest_date", ""), record.get("final_order_date", ""),
                    ])
            finally:
                for handle in (*inspection_handles.values(), *citation_handles.values()):
                    handle.close()

            published_keys = {state: set(loadable[state]) for state in EXPANSION_STATES}
            for state, activities in published.items():
                self.assertEqual(found_inspections[state], activities)
                self.assertEqual(len(loadable[state]), CERTIFIED_CITATIONS[state])
                link_path = LINK_FILES[state]
                self.assertTrue(link_path.is_file(), state)
                seen = {}
                outside_missing = 0
                for record in _folded_rows(link_path):
                    key = (record.get("activity_nr", ""), record.get("citation_id", ""))
                    status = record.get("derived_link_status", "").casefold()
                    if key in published_keys[state]:
                        seen[key] = status
                    elif status in {"missing", "missing_citation_context"}:
                        outside_missing += 1
                self.assertEqual(set(seen), published_keys[state])
                self.assertTrue(all(status == "matched" for status in seen.values()))
                self.assertEqual(outside_missing, OUTSIDE_LINK_GAPS[state])

                digest, rows = read_package(packages / PACKAGE_FILES[state], expect_known_hash=True)
                eligibility = classify_rows(
                    rows,
                    receipt={"ca_name_source": CA_NAME_SOURCE} if state == "CA" else None,
                    package_sha256=digest,
                )
                ledger = MemoryLedger()
                aggregate = plan_aggregate(eligibility, BATCH)
                apply_aggregate(aggregate, ledger)
                detail = plan_detail(
                    aggregate,
                    ledger,
                    root / f"{state}-inspections.csv",
                    root / f"{state}-citations.csv",
                )
                self.assertTrue(detail.ready, state)
                self.assertEqual(detail.incomplete_profiles, ())
                self.assertEqual(len(detail.public_matches), CERTIFIED_ELIGIBLE_PROFILES[state])
                self.assertEqual(len({item.activity_nr for item in detail.inspections}), CERTIFIED_PUBLISHED_ACTIVITIES[state])
                self.assertEqual(len(detail.citations), CERTIFIED_CITATIONS[state])
                self.assertEqual(sum(match.n_citation_items for match in detail.public_matches), CERTIFIED_CITATIONS[state])
                self.assertEqual(detail.missing_citation_context, 0)
                empty = {item.activity_nr for item in detail.inspections} - {item.activity_nr for item in detail.citations}
                self.assertEqual(len(empty), VERIFIED_EMPTY[state])
                plan_blank = sum(1 for item in detail.citations if item.current_penalty is None)
                plan_zero = sum(1 for item in detail.citations if item.current_penalty == Decimal("0.00"))
                self.assertEqual(plan_blank, blank_penalties[state])
                self.assertEqual(plan_zero, zero_penalties[state])
                plan_initial_blank = sum(1 for item in detail.citations if item.initial_penalty is None)
                plan_initial_zero = sum(1 for item in detail.citations if item.initial_penalty == Decimal("0.00"))
                plan_initial_positive = sum(
                    1 for item in detail.citations
                    if item.initial_penalty is not None and item.initial_penalty > 0
                )
                self.assertEqual(plan_initial_blank, blank_initial[state])
                self.assertEqual(plan_initial_zero, zero_initial[state])
                self.assertEqual(plan_initial_positive, positive_initial[state])
                self.assertEqual(
                    plan_initial_blank + plan_initial_zero + plan_initial_positive,
                    CERTIFIED_CITATIONS[state],
                )
                self.assertTrue(all(item.inspection_type is None and item.close_date is None for item in detail.inspections))
            self.assertGreater(sum(blank_penalties.values()), 0)
            self.assertGreater(sum(zero_penalties.values()), 0)


if __name__ == "__main__":
    unittest.main()
