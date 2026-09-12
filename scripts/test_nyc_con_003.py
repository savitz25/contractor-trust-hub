"""NYC-CON-003A ACRIS property document intelligence invariants."""
from __future__ import annotations

import copy
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/new-york-city-acris-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
DOB = json.loads((ROOT / "lib/new-york-city-dob-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
DCWP = json.loads((ROOT / "lib/new-york-city-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
NY = json.loads((ROOT / "lib/new-york-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
ACQ = json.loads((ROOT / "data/new-york/nyc-con-003/acquire-report.json").read_text(encoding="utf-8"))
PAGE = (ROOT / "app/new-york/new-york-city/page.tsx").read_text(encoding="utf-8")
UI = (ROOT / "components/new-york/nyc-local-intel-page.tsx").read_text(encoding="utf-8")
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
FINGERPRINT = "d02fa51c886bbe434703cd0bd0fe5446c08f27c10e9f540c062cb54c37a85135"


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(body: dict) -> str:
    out = {}
    for key, value in body.items():
        if key in {"fingerprint", "generated_at"}:
            continue
        if key == "clocks" and isinstance(value, dict):
            clocks = {}
            for ck, cv in value.items():
                if ck == "generatedAt":
                    continue
                if isinstance(cv, dict):
                    clocks[ck] = {ik: iv for ik, iv in cv.items() if ik != "generatedAt"}
                else:
                    clocks[ck] = cv
            out[key] = clocks
        else:
            out[key] = value
    return hashlib.sha256(dump(out).encode("utf-8")).hexdigest()


class NycCon003Tests(unittest.TestCase):
    def test_sources_and_window(self):
        self.assertEqual(SNAP["master"]["dataset_id"], "bnx9-e6tj")
        self.assertEqual(SNAP["legals"]["dataset_id"], "8h5j-fqxa")
        self.assertEqual(SNAP["master"]["parsed_rows"], 581566)
        self.assertEqual(SNAP["master"]["distinct_document_ids"], 580444)
        self.assertNotEqual(SNAP["master"]["parsed_rows"], SNAP["legals"]["parsed_rows"])
        self.assertEqual(SNAP["window"]["date_field"], "recorded_datetime")
        self.assertEqual(ACQ["master"]["sha256"], SNAP["master"]["raw_sha256"])

    def test_bbl_and_multi_lot(self):
        self.assertEqual(SNAP["linking"]["distinct_bbls"], 258026)
        self.assertEqual(SNAP["linking"]["documents_with_1_bbl"], 536285)
        self.assertEqual(SNAP["linking"]["documents_with_gt1_bbl"], 41578)
        self.assertEqual(SNAP["linking"]["max_bbls_per_document"], 1241)
        self.assertEqual(SNAP["linking"]["documents_with_gt1_legal_row"], 45842)
        self.assertEqual(SNAP["linking"]["max_legal_rows_per_document"], 1318)
        self.assertEqual(SNAP["linking"]["documents_with_unit_legal_row"], 229652)
        self.assertEqual(SNAP["linking"]["addresses_with_gt1_bbl"], 9826)
        self.assertTrue(SNAP["linking"]["no_source_native_condo_flag"])
        self.assertGreater(SNAP["linking"]["max_bbls_per_document"], 1)
        self.assertEqual(SNAP["identity"]["bbl_namespace"], "NYC-BBL:{bbl}")
        self.assertEqual(SNAP["identity"]["document_namespace"], "NYC-ACRIS-DOC:{document_id}")

    def test_firewalls(self):
        self.assertTrue(SNAP["no_title_chain"])
        self.assertTrue(SNAP["no_beneficial_ownership"])
        self.assertEqual(SNAP["identity"]["name_only"], "UNSAFE")
        self.assertEqual(SNAP["expansion_ledger"]["GRAPH_WRITES"], 0)
        self.assertEqual(SNAP["expansion_ledger"]["EXACT_PROFILE_ATTACHMENTS"], 0)
        self.assertEqual(SNAP["coverage"]["state"], "PARTIAL")
        self.assertEqual(SNAP["coverage"]["staten_island_recording_office"], "ABSENT")
        self.assertTrue(SNAP["master"]["document_amt_ne_market_value"])

    def test_prior_layers_frozen(self):
        self.assertEqual(DCWP["fingerprint"], "f2eeebd447fef501c4ebfd8dd74273a68be76e7d213ac18c6bf64e152a4a5bc2")
        self.assertEqual(DOB["fingerprint"], "67618b431526d91ae33ffe36b717469a44ae386b611afa6980d9011068d08dc9")
        self.assertEqual(NY["fingerprint"], "27f39aad84544a1ecfb4db74934ddbac55f94bd087b2a9cf3b5de20305685f14")
        self.assertEqual(DOB["expansion_ledger"]["NET_NEW_LOCAL_BBL_IDENTITIES"], 66923)
        self.assertEqual(SITEMAP.count("/new-york/new-york-city"), 1)
        self.assertTrue(SNAP["not_a_second_nyc_page"])

    def test_page_module(self):
        self.assertIn("loadNycAcrisView", PAGE)
        self.assertIn("recorded-docs", UI)
        self.assertIn("not a title search", UI.lower())
        self.assertIn("no source-native condo flag", UI.lower())
        self.assertNotIn("AggregateRating", UI)

    def test_fingerprint(self):
        self.assertEqual(SNAP["fingerprint"], FINGERPRINT)
        self.assertEqual(fingerprint(SNAP), FINGERPRINT)
        mut = copy.deepcopy(SNAP)
        mut["master"]["parsed_rows"] = 1
        self.assertNotEqual(fingerprint(mut), FINGERPRINT)
        mut2 = copy.deepcopy(SNAP)
        mut2["legals"]["parsed_rows"] = 1
        self.assertNotEqual(fingerprint(mut2), FINGERPRINT)
        mut3 = copy.deepcopy(SNAP)
        mut3["linking"]["distinct_bbls"] = 1
        self.assertNotEqual(fingerprint(mut3), FINGERPRINT)
        mut4 = copy.deepcopy(SNAP)
        mut4["clocks"]["master"]["sourceAsOf"] = "1999-01-01"
        self.assertNotEqual(fingerprint(mut4), FINGERPRINT)
        mut5 = copy.deepcopy(SNAP)
        mut5["coverage"]["state"] = "COMPLETE"
        self.assertNotEqual(fingerprint(mut5), FINGERPRINT)
        alt = copy.deepcopy(SNAP)
        alt["generated_at"] = "2099-01-01T00:00:00Z"
        alt["clocks"]["generatedAt"] = "2099-01-01T00:00:00Z"
        self.assertEqual(fingerprint(alt), FINGERPRINT)


if __name__ == "__main__":
    unittest.main()
