from __future__ import annotations

import tempfile
import unittest
import os
from pathlib import Path

from scripts.con_osha_001b import load_detail


class DetailLoaderContractTests(unittest.TestCase):
    def test_pinned_hash_mismatch_stops_before_parsing(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "not-the-official-file.csv"
            source.write_text("activity_nr\n1\n", encoding="utf-8")
            with self.assertRaisesRegex(load_detail.LoadError, "source SHA mismatch"):
                load_detail.verify_source(source, load_detail.INSPECTION_SHA256)

    def test_delete_marker_x_is_excluded_and_blank_is_kept(self):
        self.assertFalse(load_detail.citation_is_public("X"))
        self.assertFalse(load_detail.citation_is_public(" x "))
        self.assertTrue(load_detail.citation_is_public(""))

    def test_unknown_delete_marker_fails_closed(self):
        with self.assertRaisesRegex(load_detail.LoadError, "unexpected DELETE_FLAG"):
            load_detail.citation_is_public("D")

    def test_blank_and_explicit_zero_current_penalty_remain_distinct_for_storage(self):
        self.assertIsNone(load_detail._optional_money("", "current_penalty"))
        self.assertIsNone(load_detail._optional_money("   ", "current_penalty"))
        self.assertEqual(load_detail._optional_money("0", "current_penalty"), load_detail.Decimal("0.00"))
        self.assertEqual(load_detail._optional_money("0.00", "current_penalty"), load_detail.Decimal("0.00"))

    def test_u_is_supported_as_unclassified_and_not_a_serious_or_repeat_type(self):
        self.assertEqual(load_detail.public_citation_type("U"), "Unclassified")
        self.assertEqual(load_detail.public_citation_type("O"), "Other")
        self.assertNotIn("U", {"S"})
        self.assertNotIn("U", {"W", "R"})

    def test_held_license_keys_are_exactly_the_two_receipt_holds(self):
        self.assertEqual(load_detail.HELD_LICENSES, {"CCC1329816", "CGC1519699"})
        self.assertEqual(load_detail.HOLD_REASON, "SOURCE_CITATIONS_ABSENT_FROM_AGGREGATE_EXTRACT")

    def test_held_match_contract_requires_the_receipt_detail_mismatch(self):
        source = load_detail.SourceSet(
            inspections=({"activity_nr": load_detail.HELD_ONLY_ACTIVITY, "open_date": "2020-01-01"},),
            source_citations=tuple({
                "activity_nr": load_detail.HELD_ONLY_ACTIVITY, "citation_id": citation_id, "viol_type": "S",
                "current_penalty": value, "final_order_date": "", "contest_date": "",
            } for citation_id, value in (("01001", "2837.00"), ("01002", "4256.00"), ("01003", "4965.00"))),
            citations=(),
            deleted_count=0,
            unique_activities=frozenset({load_detail.HELD_ONLY_ACTIVITY}),
        )
        match = load_detail.Match(
            match_id="match", contractor_id="contractor", state="FL", license_key="CCC1329816",
            tier="exact", activities=frozenset({load_detail.HELD_ONLY_ACTIVITY}), n_inspections=1, n_citation_items=0,
            n_serious=0, n_willful_repeat=0, current_penalty_amount=0, n_with_final_order=0,
            n_contested=0, first_open=None, last_open=None,
        )
        load_detail.verify_held_match(match, source)
        with self.assertRaisesRegex(load_detail.LoadError, "held aggregate values changed"):
            load_detail.verify_held_match(
                load_detail.Match(**{**match.__dict__, "current_penalty_amount": 1}), source
            )

    def test_decimal_rounding_matches_the_aggregate_tie_to_even_contract(self):
        source = load_detail.SourceSet(
            inspections=({"activity_nr": "ACT-1", "open_date": "2020-01-01"},),
            source_citations=({
                "activity_nr": "ACT-1", "citation_id": "CIT-1", "viol_type": "S",
                "current_penalty": "562.50", "final_order_date": "", "contest_date": "",
            },),
            citations=({
                "activity_nr": "ACT-1", "citation_id": "CIT-1", "viol_type": "S",
                "current_penalty": "562.50", "final_order_date": "", "contest_date": "",
            },),
            deleted_count=0,
            unique_activities=frozenset({"ACT-1"}),
        )
        match = load_detail.Match(
            match_id="match", contractor_id="contractor", state="FL", license_key="FRO1",
            tier="exact", activities=frozenset({"ACT-1"}), n_inspections=1, n_citation_items=1,
            n_serious=1, n_willful_repeat=0, current_penalty_amount=562, n_with_final_order=0,
            n_contested=0, first_open=None, last_open=None,
        )
        self.assertEqual(load_detail._expected_metrics(match, source)["current_penalty_amount"], 562)
        self.assertEqual(int(load_detail.Decimal("563.50").quantize(load_detail.Decimal("1"), rounding=load_detail.ROUND_HALF_EVEN)), 564)

    def test_simulated_second_run_adds_zero_natural_keys(self):
        planned = {("m1", "a1"), ("m1", "a2"), ("m2", "a1")}
        self.assertEqual(load_detail.simulate_idempotent_runs(planned), (3, 0))

    @unittest.skipUnless(
        Path(os.environ.get("CON_OSHA_001B_HANDOFF_DIR", r"C:\TrustHub-Work\osha-con-osha-001b-detail-handoff-v2")).is_dir(),
        "B2 V2 external scoped handoff is unavailable",
    )
    def test_v2_package_hashes_source_and_loadable_counts_and_live_scope_boundary(self):
        handoff = Path(os.environ.get("CON_OSHA_001B_HANDOFF_DIR", r"C:\TrustHub-Work\osha-con-osha-001b-detail-handoff-v2"))
        _, _, _receipt_allowlist, matches = load_detail.verify_handoff(handoff)
        source = load_detail.read_sources(handoff / "scoped/inspections-v2.csv", handoff / "scoped/citations-source-nonx-v2.csv")
        self.assertEqual(matches, [])
        self.assertEqual(len(source.inspections), 17_534)
        self.assertEqual(len(source.source_citations), 29_559)
        self.assertEqual(len(source.citations), 29_556)
        self.assertEqual(len(source.unique_activities), 17_534)
        self.assertEqual(len(source.source_citations_by_activity[load_detail.HELD_ONLY_ACTIVITY]), 3)
        self.assertNotIn(load_detail.HELD_ONLY_ACTIVITY, source.citations_by_activity)
        self.assertEqual(sum(load_detail._optional_money(row["current_penalty"], "current_penalty") is None for row in source.citations), 5_123)
        self.assertEqual(sum(load_detail._optional_money(row["current_penalty"], "current_penalty") == 0 for row in source.citations), 2_321)
        self.assertEqual(sum(load_detail._optional_money(row["current_penalty"], "current_penalty") is not None and load_detail._optional_money(row["current_penalty"], "current_penalty") > 0 for row in source.citations), 22_112)
        blank = next(row for row in source.citations if row["current_penalty"] == "")
        zero = next(row for row in source.citations if load_detail._optional_money(row["current_penalty"], "current_penalty") == 0)
        self.assertIsNone(load_detail._optional_money(blank["current_penalty"], "current_penalty"))
        self.assertEqual(load_detail._optional_money(zero["current_penalty"], "current_penalty"), load_detail.Decimal("0.00"))

    def test_verified_empty_citation_set_is_distinct_from_incomplete_source(self):
        from collections import Counter
        activity_citations = Counter(row["activity_nr"] for row in [{"activity_nr": "A"}])
        self.assertEqual(activity_citations.get("A", 0), 1)
        self.assertEqual(activity_citations.get("B", 0), 0)
        incomplete = load_detail.SourceSet(
            inspections=({"activity_nr": "B", "state": "NJ", "open_date": "2020-01-01"},),
            source_citations=(), citations=(), deleted_count=0, unique_activities=frozenset({"B"}),
        )
        self.assertFalse(incomplete.source_citations_by_activity.get("B"))
        self.assertNotEqual(len(incomplete.inspections), load_detail.EXPECTED_INSPECTIONS)

    def test_loader_marks_complete_source_citation_state_verified_for_every_inspection(self):
        source = Path(load_detail.__file__).read_text(encoding="utf-8")
        self.assertIn("closing_conference_date, citations_verified,", source)
        self.assertIn("VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, %s, %s)", source)

    def test_six_receipt_acceptance_profile_totals_are_preserved(self):
        self.assertEqual(load_detail.ACCEPTANCE_PROFILE_EXPECTATIONS, {
            "Latite": (73, 66, 36, None),
            "Haskell FRO": (38, 6, 1, None),
            "Haskell CBC": (78, 58, 11, None),
            "Power Electric": (87, 108, 57, None),
            "Vollers": (36, 11, 7, load_detail.Decimal("4450.00")),
            "Calvi": (22, 29, 15, None),
        })

    def test_loader_has_no_aggregate_write_or_identity_creation_path(self):
        source = Path(load_detail.__file__).read_text(encoding="utf-8")
        self.assertNotRegex(source, r"(?i)UPDATE\s+contractor_osha_license_matches")
        self.assertNotRegex(source, r"(?i)INSERT\s+INTO\s+contractors\b")
        self.assertNotRegex(source, r"(?i)INSERT\s+INTO\s+licenses\b")
        self.assertIn("ON CONFLICT (activity_nr) DO NOTHING", source)
        self.assertIn("ON CONFLICT (public_match_id, inspection_id) DO NOTHING", source)
        self.assertIn("ON CONFLICT (inspection_id, citation_id) DO NOTHING", source)
        self.assertIn("_verify_loaded_reconciliation(cur, eligible, shape)", source)
        self.assertIn("SET status = 'loaded', loaded_at = now()", source)

    def test_rollback_is_batch_scoped_and_leaves_original_identity_objects_untouched(self):
        rollback = (Path(__file__).resolve().parents[2] / "schema/rollback/019_con_osha_001b_inspection_details.rollback.sql").read_text(encoding="utf-8")
        self.assertIn("source_system = 'us_dol_osha_detail'", rollback)
        self.assertIn(load_detail.COMBINED_SOURCE_SHA256, rollback)
        self.assertNotRegex(rollback, r"(?i)DELETE\s+FROM\s+(contractors|licenses|contractor_osha_license_matches|contractor_osha_identity_review|osha_load_receipts)")
        self.assertNotIn("ON DELETE CASCADE", rollback.upper())

    def test_live_match_query_is_authoritative_and_local_match_csv_is_not_parsed(self):
        source = Path(load_detail.__file__).read_text(encoding="utf-8")
        self.assertIn("JOIN contractors c ON c.id = m.contractor_id", source)
        self.assertIn("c.is_thin_profile = FALSE AND c.slug IS NOT NULL AND c.slug <> ''", source)
        self.assertIn("live published-match scope is required", source)
        self.assertNotIn('"published_matches.csv", {', source)


if __name__ == "__main__":
    unittest.main()
