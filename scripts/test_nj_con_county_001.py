"""NJ-CON-COUNTY-001 four-county publication invariants."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COUNTIES = ROOT / "lib/new-jersey-intelligence/counties"
STATE = json.loads((ROOT / "lib/new-jersey-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
PUB = (ROOT / "lib/new-jersey-intelligence/counties/publication.ts").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
PAGE = ROOT / "app/new-jersey/[county]/page.tsx"
UI = (ROOT / "components/new-jersey/nj-county-page.tsx").read_text(encoding="utf-8")
STATE_UI = (ROOT / "components/new-jersey/nj-state-page.tsx").read_text(encoding="utf-8")
SLUGS = {
    "monmouth": "MONMOUTH",
    "middlesex": "MIDDLESEX",
    "somerset": "SOMERSET",
    "union": "UNION",
}


def load(stem: str) -> dict:
    return json.loads((COUNTIES / f"{stem}.json").read_text(encoding="utf-8"))


class RouteTests(unittest.TestCase):
    def test_route_file(self):
        self.assertTrue(PAGE.exists())

    def test_only_four_slugs(self):
        for stem in SLUGS:
            self.assertTrue((COUNTIES / f"{stem}.json").exists())
        self.assertFalse((COUNTIES / "bergen.json").exists())

    def test_sitemap_and_state_links(self):
        for slug in ("monmouth-county", "middlesex-county", "somerset-county", "union-county"):
            self.assertIn(f'/new-jersey/{slug}', SITEMAP)
            self.assertIn(f"/new-jersey/{slug}", STATE_UI)


class SnapshotTests(unittest.TestCase):
    def test_fips_and_gate(self):
        expected = {
            "monmouth": "34025",
            "middlesex": "34023",
            "somerset": "34035",
            "union": "34039",
        }
        for stem, fips in expected.items():
            snap = load(stem)
            self.assertEqual(snap["county_fips"], fips)
            self.assertTrue(snap["publication_gate"]["indexable"])
            self.assertGreaterEqual(snap["publication_gate"]["family_count"], 3)
            self.assertGreaterEqual(snap["publication_gate"]["finding_count"], 2)
            self.assertIn(snap["fingerprint"], PUB)
            self.assertTrue(snap["invariants"]["p_plus_c_cost_blocked"])
            self.assertTrue(snap["invariants"]["business_address_ne_service_area"])
            self.assertTrue(snap["invariants"]["vendor_ne_licensed_contractor"])

    def test_construction_matches_state_county_rows(self):
        by_name = {c["name"]: c for c in STATE["counties"]}
        for stem, name in SLUGS.items():
            snap = load(stem)
            st = by_name[name]
            self.assertEqual(snap["construction"]["permit_issued_records"], st["permit_issued_records"])
            self.assertEqual(snap["construction"]["certificate_issued_records"], st["certificate_issued_records"])
            self.assertEqual(
                snap["construction"]["total_source_records"],
                st["permit_issued_records"] + st["certificate_issued_records"],
            )
            self.assertIsNone(snap["construction"]["contractor_attribution"])
            self.assertIsNone(snap["construction"]["work_class_composition"])

    def test_union_winfield_and_hip(self):
        snap = load("union")
        names = {r["name"] for r in snap["municipalities"]["rows"]}
        self.assertIn("Winfield Township", names)
        win = next(r for r in snap["municipalities"]["rows"] if r["name"] == "Winfield Township")
        self.assertEqual(win["classification"], "CURRENT_NON_REPORTING")
        self.assertEqual(snap["local"]["program_id"], "UNION_COUNTY_HOME_IMPROVEMENT_PROGRAM")
        self.assertTrue(snap["local"]["not_a_county_contractor_license"])
        self.assertFalse(snap["local"]["participant_list_public"])
        self.assertIn("not a union county contractor license", UI.lower())

    def test_ui_forbids_rankings_and_zero_complaints(self):
        flat = re.sub(r"\s+", " ", UI.lower())
        self.assertIn("not a ranking, recommendation, or trust score", flat)
        self.assertNotIn("best contractor", flat)
        self.assertIn("business address in", flat)
        self.assertIn("complaint is not a violation", flat)
        self.assertNotIn("0 complaints", flat)


class NjsaviTests(unittest.TestCase):
    def test_vendor_semantics(self):
        data = json.loads((COUNTIES / "njsavi-construction-candidates.json").read_text(encoding="utf-8"))
        self.assertGreater(len(data["rows"]), 100)
        self.assertTrue(all(r["not_a_contractor_license"] for r in data["rows"]))
        self.assertTrue(all(r["county"] in SLUGS.values() for r in data["rows"]))
        self.assertTrue(all("contact_name" not in r for r in data["rows"]))


if __name__ == "__main__":
    unittest.main()
