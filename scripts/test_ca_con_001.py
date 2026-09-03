"""CA-CON-001 foundation tests. Does not publish /california."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUMMARY = ROOT / "artifacts" / "ca-con-001" / "acquisition-summary.json"
SAMPLE = ROOT / "data" / "samples" / "ca_cslb_master_sample.csv"
ADAPTER = ROOT / "ingest" / "adapters" / "ca_cslb_master.py"
APP = ROOT / "app"


class CaCon001Tests(unittest.TestCase):
    def test_no_california_public_route(self):
        self.assertFalse((APP / "california").exists())
        summary = json.loads(SUMMARY.read_text(encoding="utf-8"))
        self.assertEqual(summary["publication"], "NOT_PUBLISHED")
        self.assertIsNone(summary["public_route"])

    def test_summary_fingerprint_and_counts(self):
        summary = json.loads(SUMMARY.read_text(encoding="utf-8"))
        master = summary["license_master"]
        self.assertEqual(master["coverage"], "ACQUIRED_PARTIAL_STREAM_TRUNCATED")
        self.assertEqual(master["license_rows"], 75572)
        self.assertEqual(master["rows_with_business_phone"], 75483)
        self.assertEqual(master["rows_with_public_email"], 0)
        self.assertEqual(master["email_policy"], "NOT_PROVIDED_BPC_27")
        self.assertEqual(master["primary_status_counts"]["CLEAR"], 67239)
        self.assertEqual(master["sha256"], "f6ebbee6ed6c8b9476414e972382e6fcb4065f2c6e88a19392371a1e1e996838")
        self.assertEqual(summary["official_classification_dictionary"]["option_count"], 78)
        self.assertEqual(summary["dir_electrician"]["certified"]["rows"], 36983)
        self.assertEqual(summary["dosh_asbestos"]["rows"], 321)
        self.assertEqual(summary["dlse_debarment"]["distinct_cslb_ids"], 57)
        self.assertEqual(len(summary["dlse_debarment"]["exact_ids_present_in_acquired_master"]), 0)

    def test_sample_and_adapter_identity(self):
        self.assertTrue(SAMPLE.exists())
        text = SAMPLE.read_text(encoding="utf-8")
        self.assertIn("LicenseNo", text)
        self.assertIn("BusinessPhone", text)
        adapter = ADAPTER.read_text(encoding="utf-8")
        self.assertIn('SOURCE_DATASET = "cslb_public_data_portal_license_master"', adapter)
        self.assertIn("CA-CSLB:{lic}", adapter)
        self.assertIn('email_eligibility": "NOT_IN_SOURCE"', adapter)
        self.assertIn("REVIEW_REQUIRED", adapter)
        from ingest.adapters.ca_cslb_master import iter_master_rows, normalize_status

        rows = list(iter_master_rows(SAMPLE))
        self.assertGreaterEqual(len(rows), 10)
        self.assertTrue(all(r["external_key"].startswith("CA-CSLB:") for r in rows))
        self.assertTrue(all(r["public_email"] is None for r in rows))
        self.assertEqual(normalize_status("CLEAR"), "clear")
        self.assertEqual(normalize_status("Contr Bond Susp"), "suspended")
        self.assertNotEqual(normalize_status("CLEAR"), normalize_status("Contr Bond Susp"))

    def test_semantic_separations(self):
        docs = (ROOT / "docs" / "california" / "ca-con-001-source-manifest.md").read_text(encoding="utf-8")
        self.assertIn("VENDOR ≠ LICENSED CONTRACTOR", docs)
        self.assertIn("PUBLIC WORKS REGISTERED ≠ CSLB STATUS", docs)
        self.assertIn("SEARCH_ONLY", docs)
        self.assertIn("REQUEST_ONLY", docs)
        opp = (ROOT / "docs" / "california" / "ca-con-001-contractor-opportunity.md").read_text(encoding="utf-8")
        self.assertIn("UNKNOWN", opp)
        self.assertIn("No Trust Score", opp)
        self.assertNotRegex(opp, r"best contractors")

    def test_nj_and_florida_surfaces_untouched_by_this_ticket(self):
        self.assertTrue((APP / "new-jersey" / "page.tsx").exists())
        self.assertTrue((APP / "florida" / "page.tsx").exists())
        self.assertTrue((ROOT / "scripts" / "test_nj_con_004.py").exists())


if __name__ == "__main__":
    unittest.main()
