"""TX-CON-LOCAL-001B harvest QA. No public local routes."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HARVEST = json.loads(
    (ROOT / "data/texas/local/tx-local-001b/harvest-report.json").read_text(encoding="utf-8")
)
SA_ID = json.loads(
    (ROOT / "data/texas/local/san-antonio-bexar/identity-report.json").read_text(encoding="utf-8")
)
SA_PERMITS = json.loads(
    (ROOT / "data/texas/local/san-antonio-bexar/permits-issued-profile.json").read_text(
        encoding="utf-8"
    )
)
HCAD = json.loads(
    (ROOT / "data/texas/local/houston-harris/hcad-profile.json").read_text(encoding="utf-8")
)
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8") if (
    ROOT / "lib/seo/sitemap-data.ts"
).exists() else ""


class TxLocal001B(unittest.TestCase):
    def test_namespaces_do_not_touch_builder3(self) -> None:
        self.assertEqual(
            HARVEST["namespaces"],
            ["tx-local-001b", "san-antonio-bexar", "houston-harris"],
        )
        self.assertEqual(
            HARVEST["builder3_namespaces_untouched"],
            ["austin-travis", "fort-worth-tarrant"],
        )
        self.assertFalse((ROOT / "data/texas/local/austin-travis").exists())
        self.assertFalse((ROOT / "data/texas/local/fort-worth-tarrant").exists())
        self.assertFalse((ROOT / "app/texas/austin").exists())
        self.assertFalse((ROOT / "app/texas/fort-worth").exists())

    def test_no_local_publication_routes(self) -> None:
        self.assertTrue(HARVEST["no_local_routes"])
        self.assertEqual(HARVEST["publication"], "KEEP_DATA_ONLY")
        for path in HARVEST["routes_forbidden"]:
            self.assertFalse((ROOT / "app" / path.lstrip("/")).exists(), path)
            if SITEMAP:
                self.assertNotIn(path, SITEMAP)
        self.assertTrue((ROOT / "app/texas/page.tsx").exists())

    def test_san_antonio_permit_counts_and_no_credential_ids(self) -> None:
        self.assertEqual(SA_PERMITS["rows"], 139124)
        self.assertEqual(SA_PERMITS["permit_number_populated"], 139124)
        self.assertEqual(SA_PERMITS["distinct_contacts"], 18482)
        self.assertFalse(SA_PERMITS["has_local_registration_id"])
        self.assertFalse(SA_PERMITS["has_tdlr_field"])
        self.assertFalse(SA_PERMITS["has_tsbpe_field"])
        self.assertFalse(SA_PERMITS["has_parcel_field"])
        self.assertEqual(HARVEST["san_antonio"]["contractor_registration"], "OPEN_SEARCH_ONLY")

    def test_identity_name_only_is_unsafe_not_unlicensed(self) -> None:
        self.assertEqual(SA_ID["counts"]["exact_local_registration_joins"], 0)
        self.assertEqual(SA_ID["counts"]["exact_tdlr_joins"], 0)
        self.assertEqual(SA_ID["counts"]["exact_tsbpe_joins"], 0)
        self.assertEqual(SA_ID["counts"]["high_confidence_business"], 0)
        self.assertEqual(SA_ID["counts"]["unsafe_name_only"], 18482)
        self.assertTrue(SA_ID["no_tdlr_match_is_not_unlicensed"])
        self.assertEqual(SA_ID["name_only_adverse"], "UNSAFE")

    def test_houston_permit_bulk_not_scraped(self) -> None:
        self.assertEqual(
            HARVEST["houston"]["building_permit_bulk"],
            "SOURCE_NOT_ACQUIRED / SEARCH_ONLY",
        )
        self.assertEqual(HARVEST["houston"]["geography"], "CITY_OF_HOUSTON_NOT_HARRIS_COUNTY")
        self.assertNotEqual(HARVEST["houston"]["building_permit_bulk"], "0")

    def test_hcad_scale_is_harris_not_houston_city(self) -> None:
        self.assertEqual(HCAD["real_acct"]["rows"], 1628241)
        self.assertEqual(HCAD["real_acct"]["situs_populated"], 1628241)
        self.assertEqual(HCAD["personal_property_business"]["rows"], 203185)
        self.assertLess(HCAD["real_acct"]["site_city"]["HOUSTON"], HCAD["real_acct"]["rows"])
        self.assertEqual(HCAD["geographic_grain"], "HARRIS_COUNTY_CAD_NOT_CITY_OF_HOUSTON")
        self.assertEqual(HCAD["owner_dossiers"], "NOT_BUILT")

    def test_bexar_parked_and_no_parcel_join(self) -> None:
        self.assertEqual(
            HARVEST["bexar"]["cad_bulk"],
            "PARKED_REQUEST_OR_NOT_IMMEDIATELY_DOWNLOADABLE",
        )
        self.assertEqual(HARVEST["bexar"]["exact_join_coverage"], 0)

    def test_state_texas_page_untouched_by_local_routes(self) -> None:
        page = (ROOT / "app/texas/page.tsx").read_text(encoding="utf-8")
        self.assertNotIn("/texas/san-antonio", page)
        self.assertNotIn("/texas/houston", page)


if __name__ == "__main__":
    unittest.main()
