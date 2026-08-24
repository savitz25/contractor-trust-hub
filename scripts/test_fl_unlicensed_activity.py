from __future__ import annotations

import json
import unittest
from collections import Counter
from pathlib import Path

from ingest.regulatory.fl_dbpr_ula import (
    IDENTITY_METHOD, IDENTITY_STATE, RESOLVER_VERSION, identity_policy,
    refresh_decision, semantic_category,
)
from ingest.regulatory.source_observation import (
    FL_DISCIPLINE_FIELDS, FL_LOGICAL_MATTER_FIELDS, FL_ULA_FIELDS,
    FL_ULA_LOGICAL_MATTER_FIELDS, classify_observation,
)
from scripts import ingest_fl_unlicensed_activity as executor


class FloridaUnlicensedActivityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads((executor.ROOT / "artifacts/cth-fl-state-003-ula-execution-manifest.json").read_text())
        cls.reverse = json.loads((executor.ROOT / "artifacts/cth-fl-state-003-ula-reverse-manifest.json").read_text())
        cls.review = json.loads((executor.ROOT / "artifacts/cth-fl-state-003-ula-architecture-review.json").read_text())

    def test_field_contracts_do_not_change_licensed_defaults(self) -> None:
        self.assertEqual(17, len(FL_DISCIPLINE_FIELDS))
        self.assertEqual(7, len(FL_LOGICAL_MATTER_FIELDS))
        self.assertEqual(16, len(FL_ULA_FIELDS))
        self.assertEqual(("Complaint Nbr", "License Type", "Respondent Name", "Classification", "Entered Date", "Violation Code"), FL_ULA_LOGICAL_MATTER_FIELDS)

    def test_identity_is_uniformly_standalone(self) -> None:
        policy = identity_policy()
        self.assertEqual("UNRESOLVED", policy["identity_state"])
        self.assertIsNone(policy["license_id"])
        self.assertIsNone(policy["contractor_id"])
        self.assertIsNone(policy["resolved_license_external_key"])
        entries = self.manifest["entries"]
        self.assertEqual(11691, len(entries))
        self.assertEqual({IDENTITY_STATE: 11691}, dict(Counter(item["identity_state"] for item in entries)))
        self.assertEqual({IDENTITY_METHOD}, {item["identity_method"] for item in entries})
        self.assertEqual({RESOLVER_VERSION}, {item["resolver_version"] for item in entries})

    def test_manifest_determinism_scope_and_relations(self) -> None:
        core = {key: self.manifest[key] for key in ("manifest_version", "source_system", "source_dataset", "source_files", "batches", "entries")}
        self.assertEqual(executor.digest(core), self.manifest["manifest_fingerprint"])
        allowed = {"fiscal_year", "source_file_checksum", "source_record_locator", "source_observation_key", "row_fingerprint_sha256", "logical_matter_detail_key", "semantic_category", "identity_state", "identity_method", "resolver_version", "discipline_action_id", "observation_id", "occurrence_id", "ingest_batch_id"}
        self.assertTrue(all(set(item) == allowed for item in self.manifest["entries"]))
        for key in ("source_observation_key", "discipline_action_id", "observation_id", "occurrence_id"):
            self.assertEqual(11691, len({item[key] for item in self.manifest["entries"]}))
        self.assertEqual(5, len({item["ingest_batch_id"] for item in self.manifest["batches"]}))

    def test_reverse_manifest_scope(self) -> None:
        core = {key: self.reverse[key] for key in ("execution_manifest_fingerprint", "source_checksums", "batch_ids", "discipline_action_ids", "observation_ids", "occurrence_ids")}
        self.assertEqual(executor.digest(core), self.reverse["reverse_manifest_fingerprint"])
        self.assertEqual([5, 11691, 11691, 11691], [len(self.reverse[key]) for key in ("batch_ids", "discipline_action_ids", "observation_ids", "occurrence_ids")])
        self.assertFalse(self.reverse["automatic_rollback_authorized"])

    def test_semantic_fixtures(self) -> None:
        fixtures = {
            "Final Order": "FINAL_ORDER", "Citation filed": "CITATION",
            "Notice to Cease & Desist Issued": "ORDER", "Mandate": "ORDER",
            "Dismissed": "DISMISSED", "No violation found": "DISMISSED",
            "Insufficient Evidence": "INSUFFICIENT_EVIDENCE",
            "Insufficient Evidence to Prosecute": "INSUFFICIENT_EVIDENCE",
            "Closed after legal review": "CLOSED_ADMINISTRATIVE",
            "Duplicate Complaint": "CLOSED_ADMINISTRATIVE",
            "Civil Matter - No Jurisdiction": "CLOSED_ADMINISTRATIVE",
            "": "COMPLAINT_INVESTIGATION",
        }
        for raw, expected in fixtures.items():
            self.assertEqual(expected, semantic_category(raw))
        self.assertEqual(executor.EXPECTED_SEMANTICS, self.review["delta"]["semantic_counts"])

    def test_reobservation_revision_and_multiline_contract(self) -> None:
        self.assertEqual("EXACT_REOBSERVATION", classify_observation(exact_observation_exists=True, logical_group_exists=True))
        self.assertEqual("REVISION_REVIEW_REQUIRED", classify_observation(exact_observation_exists=False, logical_group_exists=True))
        self.assertEqual("NEW_OBSERVATION", classify_observation(exact_observation_exists=False, logical_group_exists=False))
        base = {field: "" for field in FL_ULA_FIELDS}
        base.update({"Complaint Nbr": "M1", "Respondent Name": "Example", "Disposition": "Final Order", "Violation Code": "A"})
        changed = dict(base, **{"Discipline Date - Description": "Different official detail"})
        self.assertNotEqual(executor.observation_key(base), executor.observation_key(changed))
        self.assertEqual(executor.logical_key(base), executor.logical_key(changed))
        self.assertEqual("NOOP_UNCHANGED_SNAPSHOT", refresh_decision(unchanged_snapshot_exists=True, exact_observation_exists=True, logical_group_exists=True))
        self.assertEqual("NEW_OCCURRENCE_ONLY", refresh_decision(unchanged_snapshot_exists=False, exact_observation_exists=True, logical_group_exists=True))
        self.assertEqual("REVISION_REVIEW_REQUIRED", refresh_decision(unchanged_snapshot_exists=False, exact_observation_exists=False, logical_group_exists=True))
        self.assertEqual("NEW_STANDALONE_EVIDENCE", refresh_decision(unchanged_snapshot_exists=False, exact_observation_exists=False, logical_group_exists=False))

    def test_executor_is_opt_in_insert_only(self) -> None:
        source = Path(executor.__file__).read_text(encoding="utf-8")
        self.assertIn('parser.add_argument("--execute", action="store_true")', source)
        lowered = source.lower()
        for forbidden in ("update discipline_actions", "update regulatory_source_observations", "update regulatory_source_occurrences", "delete from", "on conflict"):
            self.assertNotIn(forbidden, lowered)
        self.assertEqual(1, source.count("conn.commit()"))
        self.assertNotIn("FloridaDbprCredentialResolver", source)
        self.assertNotIn("FROM licenses", source)
        self.assertNotIn("FROM contractors", source)

    def test_public_read_paths_fail_closed(self) -> None:
        publication = (executor.ROOT / "lib/regulatory/publication.ts").read_text(encoding="utf-8")
        self.assertIn("d.publication_state = 'PUBLIC_ELIGIBLE'", publication)
        self.assertIn("d.contractor_id IS NOT NULL", publication)
        self.assertEqual(0, self.review["publication"]["public_eligible"])
        self.assertEqual(0, self.review["publication"]["contractor_linked"])
        self.assertEqual(0, self.review["publication"]["license_linked"])


if __name__ == "__main__":
    unittest.main()
