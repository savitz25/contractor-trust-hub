"""PA-CON-001 fingerprint and frozen-grain tests."""
from __future__ import annotations

import copy
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/pennsylvania-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
UI = (ROOT / "components/pennsylvania/pa-state-intel-page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
ASK = (ROOT / "lib/ask/pennsylvania-hic.ts").read_text(encoding="utf-8")
INTERPRET = (ROOT / "lib/ask/interpret.ts").read_text(encoding="utf-8")
CLAIM = (ROOT / "lib/claim/eligibility.ts").read_text(encoding="utf-8")
FINGERPRINT = "ad8e95e11e486c9c124b7da270d6fa38808fa4ab0be5d2008167283728324e9a"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def fingerprint(body: dict) -> str:
    out = {}
    for key, value in body.items():
        if key in {"fingerprint", "generatedAt", "generated_at"}:
            continue
        if key == "clocks" and isinstance(value, dict):
            out[key] = {ck: cv for ck, cv in value.items() if ck != "generatedAt"}
        else:
            out[key] = value
    return hashlib.sha256(dump(out).encode("utf-8")).hexdigest()


class GrainTests(unittest.TestCase):
    def test_hicpa_search_only_is_null(self):
        self.assertEqual(SNAP["hicpa"]["PA_HICPA_ROSTER_STATUS"], "OPEN_SEARCH_ONLY")
        self.assertIsNone(SNAP["hicpa"]["PA_HICPA_ROWS"])
        self.assertIsNone(SNAP["hicpa"]["PA_HICPA_DISTINCT_REGISTRATION_IDS"])
        self.assertIsNone(SNAP["hicpa"]["PA_HICPA_CURRENT_ROWS"])
        self.assertIsNone(SNAP["hero"]["universe_value"])
        self.assertTrue(SNAP["search_only_is_not_zero"])
        self.assertTrue(SNAP["licensing_model"]["hicpa_ne_license"])
        self.assertTrue(SNAP["hicpa"]["source_history"]["relaunch_ne_sourceAsOf"])

    def test_specialty_classes_stay_separate(self):
        self.assertEqual(SNAP["asbestos"]["PA_ASBESTOS_CONTRACTOR_ROWS"], 299)
        self.assertEqual(SNAP["asbestos"]["PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS"], 283)
        self.assertNotEqual(SNAP["asbestos"]["PA_ASBESTOS_CONTRACTOR_ROWS"], SNAP["asbestos"]["PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS"])
        self.assertEqual(SNAP["lead"]["PA_LEAD_CONTRACTOR_ROWS"], 155)
        self.assertEqual(SNAP["lead"]["PA_LEAD_CONTRACTOR_DISTINCT_IDS"], 148)
        self.assertNotEqual(SNAP["asbestos"]["PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS"], SNAP["lead"]["PA_LEAD_CONTRACTOR_DISTINCT_IDS"])
        self.assertEqual(SNAP["asbestos"]["PA_ASBESTOS_INDIVIDUAL_ROWS"], 4985)
        self.assertEqual(SNAP["lead"]["PA_LEAD_INDIVIDUAL_ROWS"], 943)
        self.assertTrue(SNAP["asbestos"]["firm_ne_person"])
        self.assertTrue(SNAP["lead"]["lead_ne_hicpa"])

    def test_debarment_grain(self):
        self.assertEqual(SNAP["debarment"]["PA_PREVAILING_WAGE_DEBARMENT_ROWS"], 6)
        self.assertEqual(SNAP["debarment"]["PA_PREVAILING_WAGE_FIRM_ROWS"], 8)
        self.assertEqual(SNAP["debarment"]["PA_PREVAILING_WAGE_PERSON_ROWS"], 8)
        self.assertTrue(SNAP["debarment"]["debarment_ne_complaint"])
        self.assertTrue(SNAP["debarment"]["firm_ne_person"])
        self.assertEqual(SNAP["debarment"]["name_only_attachment"], "NAME_ONLY_UNSAFE")
        self.assertEqual(SNAP["debarment"]["settlements"]["CURRENT_SOURCE_OBSERVATION"], "NONE")
        self.assertTrue(SNAP["debarment"]["settlements"]["current_observation_ne_historical_clearance"])

    def test_no_local_routes_or_copied_states(self):
        self.assertTrue(SNAP["no_local_pennsylvania_routes"])
        self.assertFalse((ROOT / "app/pennsylvania/philadelphia").exists())
        self.assertFalse((ROOT / "app/pennsylvania/pittsburgh").exists())
        self.assertIn('"/pennsylvania"', SITEMAP)
        self.assertNotIn("/pennsylvania/philadelphia", SITEMAP)
        compact = " ".join(UI.lower().split())
        self.assertIn("not a ranking", compact)
        self.assertNotIn("oregon ccb", compact)
        self.assertNotIn("idfpr", compact)
        self.assertNotIn("nysdol", compact)
        self.assertNotIn(" pa ccb", compact)
        self.assertNotIn("pa_hic", CLAIM)
        self.assertFalse(SNAP["expansion_ledger"]["CLAIM_ELIGIBILITY_BROADENED"])
        self.assertEqual(SNAP["expansion_ledger"]["GRAPH_WRITES"], 0)
        self.assertIn("interpretPennsylvaniaHic", INTERPRET)

    def test_fingerprint_ignores_generated_at(self):
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertEqual(fingerprint(SNAP), FINGERPRINT)
        mutated = copy.deepcopy(SNAP)
        mutated["generatedAt"] = "2099-01-01T00:00:00Z"
        mutated["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(fingerprint(mutated), FINGERPRINT)
        mutated["asbestos"]["PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS"] = 999
        self.assertNotEqual(fingerprint(mutated), FINGERPRINT)

    def test_ask_does_not_use_in_pa_substring(self):
        self.assertNotIn('phraseInText(text, "in pa")', ASK)
        self.assertIn("palm", "in palm beach")


if __name__ == "__main__":
    unittest.main()
