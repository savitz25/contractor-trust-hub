from __future__ import annotations

import json
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path

from scripts import backfill_fl_regulatory_source_provenance as backfill


class FloridaRegulatoryProvenanceBackfillTests(unittest.TestCase):
    def test_mapping_is_exact_and_deterministic(self) -> None:
        rows = []
        actions = []
        for number in ("1", "2"):
            row = {field: "" for field in backfill.FL_DISCIPLINE_FIELDS}
            row.update({"License Type": "Certified General Contractor", "License Nbr": number, "Complaint Nbr": f"C-{number}"})
            action_id = uuid.uuid4()
            rows.append(row)
            actions.append({
                "id": action_id, "raw_payload": dict(row), "ingest_batch_id": uuid.uuid4(),
                "batch_extracted_at": datetime(2025, 1, 1, tzinfo=timezone.utc),
                "created_at": datetime(2025, 2, 1, tzinfo=timezone.utc),
                "license_id": None, "contractor_id": None,
                "external_key": f"legacy-{number}",
            })
        first, first_stats = backfill.build_mapping(rows, actions)
        second, second_stats = backfill.build_mapping(list(rows), list(actions))
        self.assertEqual(first_stats, second_stats)
        self.assertEqual(backfill.mapping_fingerprint(first), backfill.mapping_fingerprint(second))
        self.assertEqual(2, first_stats["mapped"])
        self.assertEqual(0, first_stats["ambiguous"])

    def test_execution_is_explicit_and_has_no_discipline_mutation_path(self) -> None:
        source = Path(backfill.__file__).read_text(encoding="utf-8")
        self.assertIn('parser.add_argument("--execute", action="store_true")', source)
        lowered = source.lower()
        self.assertNotIn("update discipline_actions", lowered)
        self.assertNotIn("delete from discipline_actions", lowered)
        self.assertNotIn("insert into discipline_actions", lowered)

    def test_committed_manifests_are_stable_id_only(self) -> None:
        mapping = json.loads((backfill.ROOT / "artifacts/cth-fl-state-002a-backfill-manifest.json").read_text())
        reverse = json.loads((backfill.ROOT / "artifacts/cth-fl-state-002a-backfill-reverse-manifest.json").read_text())
        allowed = {"discipline_action_id", "source_observation_key", "row_fingerprint_sha256", "logical_matter_detail_key", "source_record_locator"}
        self.assertEqual(1541, mapping["count"])
        self.assertTrue(all(set(item) == allowed for item in mapping["mappings"]))
        self.assertEqual(1541, len(reverse["observation_ids"]))
        self.assertEqual(1541, len(reverse["occurrence_ids"]))
        core = {key: reverse[key] for key in ("batch_id", "mapping_fingerprint", "execution_fingerprint", "source_checksum", "observation_ids", "occurrence_ids")}
        self.assertEqual(reverse["reverse_manifest_fingerprint"], backfill.fingerprint(core))


if __name__ == "__main__":
    unittest.main()
