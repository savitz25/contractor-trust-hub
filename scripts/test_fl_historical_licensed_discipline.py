from __future__ import annotations

import json
import unittest
from collections import Counter
from pathlib import Path

from scripts import ingest_fl_historical_licensed_discipline as executor


class FloridaHistoricalLicensedDisciplineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads((executor.ROOT / "artifacts/cth-fl-state-002-historical-ingestion-manifest.json").read_text())
        cls.reverse = json.loads((executor.ROOT / "artifacts/cth-fl-state-002-historical-ingestion-reverse-manifest.json").read_text())
        cls.review = json.loads((executor.ROOT / "artifacts/cth-fl-state-002-historical-ingestion-execution-review.json").read_text())

    def test_manifest_fingerprint_and_partition(self) -> None:
        core = {key:self.manifest[key] for key in ("manifest_version","source_system","source_dataset","source_files","batches","entries")}
        self.assertEqual(self.manifest["manifest_fingerprint"], executor.digest(core))
        self.assertEqual(4916, len(self.manifest["entries"]))
        self.assertEqual({k:v for k,v in executor.EXPECTED_NEW_BY_YEAR.items() if v}, dict(Counter(item["fiscal_year"] for item in self.manifest["entries"])))
        self.assertEqual(executor.EXPECTED_RESOLUTION, dict(Counter(item["identity_state"] for item in self.manifest["entries"])))

    def test_manifest_is_non_pii_and_relationally_complete(self) -> None:
        allowed = {"fiscal_year","source_file_checksum","source_record_locator","source_observation_key","row_fingerprint_sha256","logical_matter_detail_key","identity_state","identity_method","resolver_version","proposed_license_id","proposed_license_external_key","review_reason_code","discipline_action_id","observation_id","occurrence_id","ingest_batch_id"}
        self.assertTrue(all(set(item) == allowed for item in self.manifest["entries"]))
        for key in ("discipline_action_id","observation_id","occurrence_id"):
            self.assertEqual(4916, len({item[key] for item in self.manifest["entries"]}))
        batch_ids = {item["ingest_batch_id"] for item in self.manifest["batches"]}
        self.assertEqual(4, len(batch_ids))
        self.assertTrue(all(item["ingest_batch_id"] in batch_ids for item in self.manifest["entries"]))
        self.assertNotIn("2024-25", {item["fiscal_year"] for item in self.manifest["entries"]})

    def test_reverse_manifest_fingerprint_and_scope(self) -> None:
        core = {key:self.reverse[key] for key in ("execution_manifest_fingerprint","source_checksums","batch_ids","discipline_action_ids","observation_ids","occurrence_ids")}
        self.assertEqual(self.reverse["reverse_manifest_fingerprint"], executor.digest(core))
        self.assertEqual([4,4916,4916,4916], [len(self.reverse["batch_ids"]),len(self.reverse["discipline_action_ids"]),len(self.reverse["observation_ids"]),len(self.reverse["occurrence_ids"])])
        self.assertFalse(self.reverse["automatic_rollback_authorized"])

    def test_executor_is_opt_in_insert_only_single_commit(self) -> None:
        source = Path(executor.__file__).read_text(encoding="utf-8")
        self.assertIn('parser.add_argument("--execute",action="store_true")', source)
        lowered = source.lower()
        for forbidden in ("update discipline_actions","update regulatory_source_observations","update regulatory_source_occurrences","delete from","on conflict"):
            self.assertNotIn(forbidden, lowered)
        self.assertEqual(1, source.count("conn.commit()"))
        self.assertIn("'INTERNAL'", source)
        self.assertIn("NULL,%s", source)

    def test_review_asserts_zero_production_mutation_and_collisions(self) -> None:
        self.assertEqual(0, self.review["production_transaction"]["mutations"])
        self.assertTrue(all(value == 0 for value in self.review["collision_checks"].values()))
        self.assertEqual({"safe_targets_valid":1388,"fail_closed_without_target":3528}, self.review["license_target_validation"])
        self.assertEqual(0, self.review["publication"]["predicted_public_eligible"])


if __name__ == "__main__":
    unittest.main()
