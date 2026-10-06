"""MD-ENRICH-001 loader unit tests (stdlib only, synthetic rows)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import load  # noqa: E402


def row(**kw):
    base = {
        "contractor_id": "00000000-0000-4000-8000-000000000001",
        "license_key": "CGC0000001",
        "display_name": "Example Builders",
        "website_url": "https://www.example.test/",
        "phone": "(305) 555-0100; 305-555-0101 (Broward)",
        "email": "info@example.test",
        "primary_address": "1 DBPR ST MIAMI FL 33101",
        "additional_locations": "Doral, FL",
        "specialties": "Roofing | Roof repair | roofing",
        "source_refs": "https://www.example.test/ | https://www.example.test/contact",
        "scout_confidence": "derived:medium",
        "review_flags": "specialty_outside_license:outside_class;archive_or_blocked_source:blocked_fetch_noted",
        "original_label": "partial",
        "decision_ref": "test",
    }
    base.update(kw)
    return base


class LoaderTest(unittest.TestCase):
    def plan(self, rows, ok=None):
        p = load.Plan(rows=rows)
        load.build_observations(rows, p, ok if ok is not None else {r["contractor_id"] for r in rows})
        return p

    def test_split_and_dedupe(self):
        p = self.plan([row()])
        by = {}
        for o in p.obs:
            by.setdefault(o.field, []).append(o)
        self.assertEqual([o.value_normalized for o in by["phone"]], ["3055550100", "3055550101"])
        self.assertEqual([o.value for o in by["specialty"]], ["Roofing", "Roof repair"])
        self.assertEqual(p.duplicates_collapsed["specialty"], 1)
        self.assertEqual(len(by["address_location"]), 1)
        self.assertNotIn("primary_address", by)
        self.assertEqual(by["website"][0].review_flags[1], "archive_or_blocked_source:blocked_fetch_noted")

    def test_suppressed_contact_and_location(self):
        p = self.plan([row(license_key="CFC1425917")])
        for o in p.obs:
            self.assertEqual(o.is_suppressed, o.field != "specialty", o.field)
            if o.is_suppressed:
                self.assertEqual(o.suppression_reason, load.SUPPRESSION_REASON)

    def test_excluded_identity_writes_nothing(self):
        self.assertEqual(self.plan([row()], ok=set()).obs, [])

    def test_empty_cells_skipped(self):
        p = self.plan([row(email="", additional_locations="  ")])
        self.assertFalse(any(o.field in ("email", "address_location") for o in p.obs))
        self.assertEqual(p.skipped_empty["email"], 1)

    def test_non_http_website_hard_stops(self):
        with self.assertRaises(SystemExit):
            self.plan([row(website_url="ftp://example.test")])

    def test_normalize(self):
        self.assertEqual(load.normalize("website", "HTTPS://Example.test/"), "https://example.test")
        self.assertEqual(load.normalize("phone", "+1 (305) 555-0100"), "3055550100")
        self.assertEqual(load.normalize("email", " Info@Example.TEST "), "info@example.test")


if __name__ == "__main__":
    unittest.main()
