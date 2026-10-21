from __future__ import annotations

import tempfile
import unittest
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
            inspections=({"activity_nr": "ACT-1", "open_date": "2020-01-01"},),
            citations=tuple({
                "activity_nr": "ACT-1", "citation_id": str(index), "viol_type": "S",
                "current_penalty": value, "final_order_date": "", "contest_date": "",
            } for index, value in enumerate(("5000.00", "4000.00", "3058.00"))),
            deleted_count=0,
            unique_activities=frozenset({"ACT-1"}),
        )
        match = load_detail.Match(
            match_id="match", contractor_id="contractor", state="FL", license_key="CCC1329816",
            tier="exact", activities=frozenset({"ACT-1"}), n_inspections=1, n_citation_items=0,
            n_serious=0, n_willful_repeat=0, current_penalty_amount=0, n_with_final_order=0,
            n_contested=0, first_open=None, last_open=None,
        )
        load_detail.verify_held_match(match, source)
        with self.assertRaisesRegex(load_detail.LoadError, "held aggregate values changed"):
            load_detail.verify_held_match(
                load_detail.Match(**{**match.__dict__, "current_penalty_amount": 1}), source
            )

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
        self.assertIn("ON CONFLICT (public_match_id, activity_nr) DO NOTHING", source)
        self.assertIn("ON CONFLICT (inspection_id, citation_id) DO NOTHING", source)
        self.assertIn("_verify_loaded_reconciliation(cur, eligible, shape)", source)
        self.assertIn("SET status = 'loaded', loaded_at = now()", source)

    def test_rollback_is_batch_scoped_and_leaves_original_identity_objects_untouched(self):
        rollback = (Path(__file__).resolve().parents[2] / "schema/rollback/019_con_osha_001b_inspection_details.rollback.sql").read_text(encoding="utf-8")
        self.assertIn("source_system = 'us_dol_osha_detail'", rollback)
        self.assertIn(load_detail.COMBINED_SOURCE_SHA256, rollback)
        self.assertNotRegex(rollback, r"(?i)DELETE\s+FROM\s+(contractors|licenses|contractor_osha_license_matches|contractor_osha_identity_review|osha_load_receipts)")
        self.assertNotIn("ON DELETE CASCADE", rollback.upper())


if __name__ == "__main__":
    unittest.main()
