#!/usr/bin/env python3
import hashlib
import unittest
from pathlib import Path


class RegulatorySourceMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.migration = Path("schema/migrations/009_regulatory_source_observations.sql").read_text(encoding="utf-8")
        cls.initial = Path("schema/initial_schema.sql").read_text(encoding="utf-8")
        cls.loader = Path("scripts/load_fl_dbpr_to_postgres.py").read_text(encoding="utf-8")

    def test_migration_is_structure_only(self):
        upper = self.migration.upper()
        self.assertNotIn("UPDATE DISCIPLINE_ACTIONS", upper)
        self.assertNotIn("DELETE FROM", upper)
        self.assertNotIn("INSERT INTO", upper)
        self.assertNotIn("ALTER TABLE DISCIPLINE_ACTIONS", upper)
        self.assertNotIn("AZ_ROC", upper)
        self.assertNotIn("NJ_ENFORCEMENT", upper)

    def test_two_table_contract_and_restrictive_foreign_keys(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS regulatory_source_observations", self.migration)
        self.assertIn("CREATE TABLE IF NOT EXISTS regulatory_source_occurrences", self.migration)
        self.assertIn("REFERENCES discipline_actions (id) ON DELETE RESTRICT", self.migration)
        self.assertIn("REFERENCES ingest_batches (id) ON DELETE RESTRICT", self.migration)
        self.assertIn("source_payload                JSONB NOT NULL", self.migration)
        self.assertIn("enforce_regulatory_source_observation_immutability", self.migration)
        self.assertIn("regulatory_source_observations_immutable_trg", self.migration)

    def test_uniqueness_does_not_use_weak_identifiers(self):
        self.assertIn("UNIQUE (source_system, source_dataset, source_observation_key)", self.migration)
        self.assertIn("source_file_checksum_sha256, source_record_locator", self.migration)
        for prohibited in ("UNIQUE (complaint", "UNIQUE (logical_matter", "UNIQUE (respondent", "UNIQUE (license_number"):
            self.assertNotIn(prohibited, self.migration)

    def test_initial_schema_matches_migration_contract(self):
        for token in (
            "regulatory_source_observations",
            "regulatory_source_occurrences",
            "regulatory_source_observations_identity_unique",
            "regulatory_source_occurrences_identity_unique",
        ):
            self.assertIn(token, self.initial)

    def test_loader_requires_provenance_and_stays_fail_closed(self):
        for token in (
            "--discipline-fiscal-year",
            "--discipline-source-file",
            "--discipline-source-url",
            "--discipline-source-checksum",
            "source_observation_key_v2",
            "REVISION_REVIEW_REQUIRED",
            "contractor_id = NULL",
            'publication_state = \'INTERNAL\'',
        ):
            self.assertIn(token, self.loader)
        self.assertNotIn("license_by_number", self.loader)

    def test_migration_008_is_immutable(self):
        digest = hashlib.sha256(Path("schema/migrations/008_fl_adverse_evidence_safety.sql").read_bytes()).hexdigest()
        self.assertEqual(digest, "1b110240c4487bbb3dfe74ac2ef893aca3defbc93afaedd23aad3732133adeb8")


if __name__ == "__main__":
    unittest.main()
