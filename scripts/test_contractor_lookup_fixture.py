"""Boundaries for the local-only Contractor credential lookup preview."""

import json
import unittest
from pathlib import Path

from build_contractor_lookup_fixture import build

ROOT = Path(__file__).resolve().parents[1]


class LookupFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = build()

    def test_only_certified_grains_and_statuses(self):
        rows = self.records
        self.assertEqual(len(rows), 6)
        self.assertEqual([(r["dataset"], r["source_status"]) for r in rows], [
            ("nyc_dob_license_info", "Active"), ("ny_dol_mold", "Active"),
            ("ny_dol_mold", "Expired"), ("ny_elevator", "Active"),
            ("fl_dbpr_asbestos_59", "Current; Active reported"),
            ("nj_dfs_fire_business", "Current status not established"),
        ])
        self.assertEqual(len({r["id"] for r in rows}), 6)
        self.assertTrue(all(r["source_url"].startswith("https://") and
                            len(r["source_sha256"]) == 64 for r in rows))

    def test_no_business_or_person_profile_creation(self):
        self.assertTrue(all(r["contractor_id"] is None and
                            r["canonical_business_id"] is None for r in self.records))
        self.assertEqual({r["dataset"] for r in self.records}, {
            "nyc_dob_license_info", "ny_dol_mold", "ny_elevator",
            "fl_dbpr_asbestos_59", "nj_dfs_fire_business",
        })
        self.assertEqual(self.records[-1]["grain"], "Permit evidence")

    def test_local_route_is_not_canonical_search_or_production(self):
        page = (ROOT / "app/credential-lookup-preview/page.tsx").read_text(encoding="utf-8")
        self.assertIn('process.env.NODE_ENV !== "development"', page)
        self.assertIn("notFound()", page)
        self.assertIn('index: false', page)
        self.assertNotIn("searchContractors", page)
        self.assertNotIn("/contractors/", page)
        self.assertIn("Business identity linkage", page)
        self.assertIn("Not established", page)
        schema = (ROOT / "schema/initial_schema.sql").read_text(encoding="utf-8")
        self.assertIn("contractor_id           UUID REFERENCES contractors (id) ON DELETE SET NULL", schema)
        search = (ROOT / "lib/contractors/queries.ts").read_text(encoding="utf-8")
        self.assertIn("JOIN contractors c ON c.id = l.contractor_id", search)

    def test_fixture_file_matches_generator(self):
        on_disk = json.loads((ROOT / "data/preview/contractor-credential-lookup.json").read_text())
        self.assertEqual(on_disk, self.records)


if __name__ == "__main__":
    unittest.main()
