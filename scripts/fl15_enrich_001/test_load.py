"""FL15-ENRICH-001 config pins. No database connection, no contact data."""
from __future__ import annotations

import unittest

from scripts.fl15_enrich_001 import load as fl15
from scripts.md_enrich_001 import load as md


class Fl15ConfigTest(unittest.TestCase):
    def test_pins(self):
        self.assertEqual(fl15.BATCH_ID, "fl15-enrich-001-2026-10-22")
        self.assertEqual(fl15.SOURCE_SYSTEM, "workbook_contact_enrich_fl15_2026_10")
        self.assertEqual(fl15.GO_PHRASE, "FL-CONTACT-ENRICH-15CO-LOAD-GO")
        self.assertEqual(fl15.READY_ROWS, 2732)
        self.assertEqual(fl15.EXPECTED_OBS_TOTAL, 9243)
        self.assertEqual(sum(fl15.EXPECTED_OBS.values()), 9243)
        self.assertNotIn("specialty", fl15.FIELDS)
        self.assertEqual(fl15.COLUMN["address_location"], "address_location")

    def test_rollback_guard_only_this_batch(self):
        fl15.rollback_guard()
        for other in fl15.PROTECTED_BATCHES:
            with self.assertRaises(SystemExit):
                fl15.rollback_guard(other, fl15.SOURCE_SYSTEM)
        self.assertIn("fl15-enrich-001-2026-10-22", fl15.rollback_sql())

    def test_dispatch(self):
        self.assertEqual(md._county_arg(["--county", "fl15"]), "fl15")


if __name__ == "__main__":
    unittest.main()
