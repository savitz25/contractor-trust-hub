"""Dispatch checks for the consolidated county loaders. No database connection."""
from __future__ import annotations

import unittest
from pathlib import Path


class FloridaDispatchTest(unittest.TestCase):
    def test_miami_dade_default_and_three_county_paths(self):
        from scripts.md_enrich_001 import load as md

        self.assertEqual(md.SOURCE_SYSTEM, "scout_web_enrich_md_2026_10")
        self.assertEqual(md.DEFAULT_BATCH_ID, "md-enrich-001-2026-10-06")
        self.assertIsNone(md._county_arg(["--input-dir", "x"]))
        self.assertEqual(md._county_arg(["--county", "hb"]), "hb")
        self.assertEqual(md._county_arg(["--county", "le"]), "le")
        self.assertEqual(md._county_arg(["--county", "or"]), "or")
        source = Path(md.__file__).read_text(encoding="utf-8")
        self.assertIn("scripts.hb_enrich_001.load", source)
        self.assertIn("scripts.le_enrich_001.load", source)
        self.assertIn("scripts.or_enrich_001.load", source)
        self.assertNotIn("nj_enrich_003", source)

    def test_county_pins_stay_distinct(self):
        from scripts.hb_enrich_001 import load as hb
        from scripts.le_enrich_001 import load as lee
        from scripts.or_enrich_001 import load as orange

        self.assertEqual(hb.BATCH_ID, "hb-enrich-001-2026-10-17")
        self.assertEqual(hb.SOURCE_SYSTEM, "dot_web_enrich_hb_2026_10")
        self.assertEqual(hb.GO_PHRASE, "GO CONTRACTOR HILLSBOROUGH ENRICH LOAD")
        self.assertEqual(lee.BATCH_ID, "le-enrich-001-2026-10-17")
        self.assertEqual(lee.SOURCE_SYSTEM, "dot_web_enrich_le_2026_10")
        self.assertEqual(lee.GO_PHRASE, "GO CONTRACTOR LEE ENRICH LOAD")
        self.assertEqual(orange.BATCH_ID, "or-enrich-001-2026-10-17")
        self.assertEqual(orange.SOURCE_SYSTEM, "dot_web_enrich_or_2026_10")
        self.assertEqual(orange.GO_PHRASE, "GO CONTRACTOR ORANGE ENRICH LOAD")
        self.assertEqual(orange.EXPECTED_OBS_TOTAL, 5743)


class NewJerseyDispatchTest(unittest.TestCase):
    def test_passaic_and_burlington_are_sibling_modules(self):
        from scripts.nj_enrich_002 import load as morris
        from scripts.nj_enrich_003 import load as passaic
        from scripts.nj_enrich_004 import load as burlington

        self.assertEqual(morris.COUNTY.batch_id, "mo-enrich-001-2026-10-17")
        self.assertEqual(morris.GO_PHRASE, "GO CONTRACTOR MORRIS ENRICH LOAD")
        self.assertEqual(passaic.COUNTY.batch_id, "ps-enrich-001-2026-10-17")
        self.assertEqual(passaic.COUNTY.source_system, "dot_web_enrich_ps_2026_10")
        self.assertEqual(passaic.GO_PHRASE, "GO CONTRACTOR PASSAIC ENRICH LOAD")
        self.assertEqual(burlington.COUNTY.batch_id, "bu-enrich-001-2026-10-17")
        self.assertEqual(burlington.COUNTY.source_system, "dot_web_enrich_bu_2026_10")
        self.assertEqual(burlington.GO_PHRASE, "GO CONTRACTOR BURLINGTON ENRICH LOAD")
        self.assertNotEqual(passaic.__file__, burlington.__file__)
        self.assertEqual(passaic._county_arg(["--county", "bu"]), "bu")
        self.assertIsNone(passaic._county_arg(["--package-dir", "x"]))
        source = Path(passaic.__file__).read_text(encoding="utf-8")
        self.assertIn("scripts.nj_enrich_004.load", source)


if __name__ == "__main__":
    unittest.main()
