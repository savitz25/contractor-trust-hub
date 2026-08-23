#!/usr/bin/env python3
import unittest
from pathlib import Path

from ingest.regulatory.fl_dbpr_identity import FloridaDbprCredentialResolver, LicenseCredential


class ResolverTests(unittest.TestCase):
    def setUp(self):
        self.resolver = FloridaDbprCredentialResolver([
            LicenseCredential("abc", "CGC12345", "CGC", "12345", "06"),
            LicenseCredential("xyz", "CCC12345", "CCC", "12345", "06"),
            LicenseCredential("fro", "FRO77", "FRO", "77", "06"),
        ])

    def test_exact_full_key_wins_collision(self):
        r = self.resolver.resolve(source_dataset="contractor_disc_lic", license_type="Certified General Contractor", license_number="12345")
        self.assertEqual((r.identity_state, r.proposed_license_id), ("EXACT", "abc"))

    def test_deterministic_dictionary_mapping(self):
        r = self.resolver.resolve(source_dataset="contractor_disc_lic", license_type="Construction Financial Officer", license_number="77")
        self.assertEqual((r.identity_state, r.proposed_license_id), ("DETERMINISTIC", "fro"))

    def test_unknown_type_fails_closed(self):
        r = self.resolver.resolve(source_dataset="contractor_disc_lic", license_type="Future Mystery Type", license_number="12345")
        self.assertEqual(r.identity_state, "REVIEW_REQUIRED")
        self.assertIsNone(r.proposed_license_id)

    def test_missing_credential_is_unresolved(self):
        r = self.resolver.resolve(source_dataset="contractor_disc_lic", license_type="Certified General Contractor", license_number="99999")
        self.assertEqual(r.identity_state, "UNRESOLVED")

    def test_name_only_never_links(self):
        r = self.resolver.resolve(source_dataset="contractor_disc_ula", license_type="Certified General Contractor", license_number=None, respondent_name="Same Name")
        self.assertEqual(r.identity_state, "UNRESOLVED")
        self.assertIsNone(r.proposed_license_id)

    def test_type_conflict_does_not_fall_back_to_numeric_core(self):
        r = self.resolver.resolve(source_dataset="contractor_disc_lic", license_type="Certified Building Contractor", license_number="12345")
        self.assertEqual(r.identity_state, "REVIEW_REQUIRED")
        self.assertIsNone(r.proposed_license_id)

    def test_loader_has_no_legacy_numeric_map(self):
        source = Path("scripts/load_fl_dbpr_to_postgres.py").read_text(encoding="utf-8")
        self.assertNotIn("license_by_number", source)
        self.assertIn("FloridaDbprCredentialResolver", source)
        self.assertIn("contractor_id = NULL", source)
        self.assertIn("publication_state = 'INTERNAL'", source)
        discipline_section = source.split("def load_discipline(", 1)[1]
        discipline_sql = discipline_section.split('    sql = """', 1)[1].split('    """', 1)[0]
        self.assertEqual(discipline_sql.count("%s"), 32)

    def test_public_read_paths_use_gate_without_filtering_licenses(self):
        expected = {
            "lib/contractors/queries.ts": 4,
            "lib/discovery/florida-list.ts": 3,
            "lib/discovery/queries.ts": 1,
            "lib/plan/matching.ts": 1,
        }
        for filename, count in expected.items():
            source = Path(filename).read_text(encoding="utf-8")
            self.assertEqual(source.count("${PUBLIC_REGULATORY_SQL}"), count, filename)
        contractor_queries = Path("lib/contractors/queries.ts").read_text(encoding="utf-8")
        self.assertNotIn("FROM licenses\n    WHERE contractor_id = $1\n      AND ${PUBLIC_REGULATORY_SQL}", contractor_queries)
        self.assertNotIn("PUBLIC_REGULATORY_SQL", Path("lib/arizona/stats.ts").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
