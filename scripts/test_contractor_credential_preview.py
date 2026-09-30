import unittest
from pathlib import Path

from contractor_credential_preview import build_preview


class CredentialPreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.preview = build_preview()

    def test_source_counts_and_denominator(self):
        sources = self.preview["sources"]
        self.assertEqual([sources[key]["count"] for key in sources], [9752, 2510, 302, 228, 542])
        self.assertEqual(self.preview["canonical_business_count_change"], 0)
        self.assertEqual(self.preview["person_profiles_created"], 0)
        self.assertTrue(all(s["canonical_business_id"] is None for s in sources.values()))

    def test_status_grain(self):
        sources = self.preview["sources"]
        self.assertEqual(sources["ny_dol_mold"]["raw_statuses"], {"Active": 1761, "Expired": 749})
        self.assertEqual(sources["ny_elevator"]["raw_statuses"], {"Active": 212, "Expired": 90})
        self.assertEqual(sources["fl_dbpr_asbestos_59"]["raw_statuses"], {"C|-": 172, "C|A": 56})
        self.assertEqual(sources["nj_dfs_fire_business"]["example"]["status_label"],
                         "Permit listed; current status unverified")
        self.assertEqual(sources["fl_dbpr_asbestos_59"]["source_grain"], "SOURCE-NATIVE BUSINESS LICENSE")

    def test_existing_search_excludes_unattached_licenses(self):
        root = Path(__file__).resolve().parents[1]
        schema = (root / "schema/initial_schema.sql").read_text(encoding="utf-8")
        search = (root / "lib/contractors/queries.ts").read_text(encoding="utf-8")
        self.assertIn("contractor_id           UUID REFERENCES contractors (id) ON DELETE SET NULL", schema)
        self.assertIn("JOIN contractors c ON c.id = l.contractor_id", search)
        self.assertIn("JOIN licenses l ON l.contractor_id = c.id", search)


if __name__ == "__main__":
    unittest.main()
