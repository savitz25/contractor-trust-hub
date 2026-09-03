"""CA-CON-002 California publication invariants."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = json.loads((ROOT / "lib/california-intelligence/accepted-snapshot.json").read_text(encoding="utf-8"))
A001 = json.loads((ROOT / "artifacts/ca-con-001/acquisition-summary.json").read_text(encoding="utf-8"))
UI = (ROOT / "components/california/ca-state-page.tsx").read_text(encoding="utf-8")
SEARCH_UI = (ROOT / "components/california/ca-inventory-search.tsx").read_text(encoding="utf-8")
SEARCH = (ROOT / "lib/california-intelligence/search.ts").read_text(encoding="utf-8")
JSONLD = (ROOT / "lib/california-intelligence/jsonld.ts").read_text(encoding="utf-8")
PAGE = ROOT / "app/california/page.tsx"
SITEMAP = (ROOT / "lib/seo/sitemap-data.ts").read_text(encoding="utf-8")
FOOTER = (ROOT / "components/layout/SiteFooter.tsx").read_text(encoding="utf-8")
HEADER = (ROOT / "lib/nav/header-nav.ts").read_text(encoding="utf-8")
PUB = (ROOT / "lib/california-intelligence/publication.ts").read_text(encoding="utf-8")
PAID = (ROOT / "docs/california/cslb-paid-full-file-decision.md").read_text(encoding="utf-8")
INVENTORY = ROOT / "public/california-inventory.json"
UI_FLAT = re.sub(r"\s+", " ", UI.lower())


class PublicationTests(unittest.TestCase):
    def test_01_route_exists(self):
        self.assertTrue(PAGE.exists())

    def test_02_indexable(self):
        self.assertTrue(SNAP["publication"]["indexable"])
        self.assertEqual(SNAP["publication"]["robots"], "index,follow")

    def test_03_canonical(self):
        self.assertEqual(SNAP["publication"]["canonical"], "https://www.contractortrusthub.com/california")

    def test_04_sitemap_nav(self):
        self.assertIn('path: "/california"', SITEMAP)
        self.assertIn('href: "/california"', HEADER)
        self.assertIn("/california", FOOTER)

    def test_05_fingerprint(self):
        self.assertEqual(len(SNAP["fingerprint"]), 64)
        self.assertIn(SNAP["fingerprint"], PUB)
        self.assertEqual(SNAP["version"], "contractor-ca-state-intel-v1")


class MasterCoverageTests(unittest.TestCase):
    def test_06_row_count(self):
        self.assertEqual(SNAP["license_master"]["license_rows"], 75572)
        self.assertEqual(SNAP["license_master"]["distinct_license_numbers"], 75572)
        self.assertEqual(SNAP["license_master"]["license_rows"], A001["license_master"]["license_rows"])

    def test_07_coverage_truncated(self):
        self.assertEqual(SNAP["coverage"]["status"], "ACQUIRED_PARTIAL_STREAM_TRUNCATED")
        self.assertFalse(SNAP["coverage"]["complete_universe_claimed"])
        self.assertIsNone(SNAP["coverage"]["complete_renewable_count"])
        self.assertIn("unknown", UI_FLAT)
        self.assertNotRegex(UI, r"California has 75,572 contractors")

    def test_08_status_reconciliation(self):
        counts = SNAP["license_master"]["primary_status_counts"]
        self.assertEqual(counts["CLEAR"], 67239)
        self.assertEqual(sum(counts.values()), 75572)
        self.assertTrue(SNAP["license_master"]["clear_is_not_verified"])
        self.assertTrue(SNAP["license_master"]["suspension_is_not_revocation"])
        self.assertNotEqual(counts["CLEAR"], counts["Work Comp Susp"])
        self.assertIn("Work Comp Susp", counts)
        self.assertIn("Contr Bond Susp", counts)

    def test_09_classifications(self):
        self.assertEqual(SNAP["classifications"]["official_option_count"], 78)
        self.assertEqual(SNAP["classifications"]["observed_token_count"], 81)
        self.assertEqual(SNAP["classifications"]["token_counts"]["B"], 30813)
        self.assertEqual(SNAP["classifications"]["token_counts"]["C10"], 8659)
        self.assertIn("not a ranking", SNAP["classifications"]["note"].lower())

    def test_10_phones_and_contacts(self):
        self.assertEqual(SNAP["contacts"]["business_phone_public_eligible"], 75483)
        self.assertEqual(SNAP["contacts"]["email_rows"], 0)
        self.assertEqual(SNAP["contacts"]["email_policy"], "NOT_PROVIDED_BPC_27")
        self.assertEqual(SNAP["contacts"]["mailing_address_policy"], "REVIEW_REQUIRED")
        self.assertTrue(SNAP["contacts"]["business_phone_is_not_personal"])
        self.assertTrue(SNAP["contacts"]["mail_address_is_not_service_area"])
        self.assertIn("PUBLIC_ELIGIBLE", UI)

    def test_11_no_complete_universe_claim(self):
        self.assertIn("not the complete", UI_FLAT)
        self.assertIn("acquired rows", UI_FLAT)
        self.assertIn("UNKNOWN", UI)


class OverlayTests(unittest.TestCase):
    def test_12_asbestos_exact(self):
        self.assertEqual(SNAP["asbestos"]["rows"], 321)
        self.assertEqual(SNAP["asbestos"]["distinct_cslb_ids"], 312)
        self.assertEqual(SNAP["asbestos"]["exact_joins_to_extract"], 65)
        self.assertIn("EXACT", SNAP["asbestos"]["attach_rule"])

    def test_13_dlse_exact(self):
        self.assertEqual(SNAP["dlse"]["distinct_cslb_ids"], 57)
        self.assertEqual(SNAP["dlse"]["exact_joins_to_extract"], 0)
        self.assertEqual(len(SNAP["dlse"]["exact_cslb_ids"]), 57)
        self.assertIsNone(SNAP["dlse"]["currently_debarred_count"])
        self.assertIn("976339", SNAP["dlse"]["exact_cslb_ids"])

    def test_14_no_unsafe_name_attach(self):
        self.assertIn("Name-only is UNSAFE", SNAP["identity"]["adverse_attach_rule"])
        self.assertIn("EXACT", SNAP["identity"]["adverse_attach_rule"])

    def test_15_personnel(self):
        self.assertFalse(SNAP["personnel"]["acquired"])
        self.assertFalse(SNAP["personnel"]["publish_people_as_profiles"])
        self.assertFalse(SNAP["personnel"]["page_blocker"])

    def test_16_wc(self):
        self.assertFalse(SNAP["workers_comp"]["standalone_file_acquired"])
        self.assertTrue(SNAP["workers_comp"]["clear_is_not_current_wc"])
        self.assertEqual(SNAP["workers_comp"]["source_native_work_comp_susp"], 1044)
        self.assertFalse(SNAP["workers_comp"]["page_blocker"])

    def test_17_electrician(self):
        self.assertEqual(SNAP["electrician"]["certified_rows"], 36983)
        self.assertEqual(SNAP["electrician"]["trainee_rows"], 19661)
        self.assertFalse(SNAP["electrician"]["has_cslb_license_id"])
        self.assertEqual(SNAP["electrician"]["net_new_contractor_businesses"], 0)

    def test_18_pwcr_vendor(self):
        self.assertEqual(SNAP["pwcr"]["coverage"], "SEARCH_ONLY")
        self.assertEqual(SNAP["vendor"]["coverage"], "SEARCH_ONLY")
        self.assertFalse(SNAP["pwcr"]["acquired"])
        self.assertFalse(SNAP["vendor"]["acquired"])

    def test_19_paid_full_file(self):
        self.assertEqual(SNAP["paid_full_file"]["decision"], "DO_NOT_BUY_FOR_CA_CON_002")
        self.assertFalse(SNAP["paid_full_file"]["page_blocker"])
        self.assertIn("DO_NOT_BUY", PAID)
        self.assertIn("$235", PAID)


class SearchAndSeoTests(unittest.TestCase):
    def test_20_inventory_label(self):
        self.assertEqual(SNAP["coverage"]["inventory_label"], "Acquired CSLB public-data rows")
        self.assertIn("Acquired CSLB public-data rows", SEARCH_UI)
        self.assertTrue(INVENTORY.exists())
        self.assertGreater(INVENTORY.stat().st_size, 1_000_000)

    def test_21_search_filters(self):
        self.assertIn("filterCaInventory", SEARCH)
        self.assertIn("classification", SEARCH)
        self.assertIn("status", SEARCH)
        self.assertIn("zip", SEARCH)
        self.assertIn("Verify with CSLB", SEARCH_UI)

    def test_22_jsonld_allowed_and_forbidden(self):
        self.assertIn('"WebPage"', JSONLD)
        self.assertIn("BreadcrumbList", JSONLD)
        self.assertIn("Dataset", JSONLD)
        self.assertIn("ItemList", JSONLD)
        self.assertNotIn("AggregateRating", JSONLD)
        self.assertNotIn("Review", JSONLD)
        self.assertTrue(SNAP["no_review_schema"])
        self.assertTrue(SNAP["no_aggregate_rating"])
        self.assertTrue(SNAP["no_trust_score"])

    def test_23_no_trust_score_copy(self):
        self.assertIn("No Trust Score", UI)
        self.assertNotRegex(UI, r"best contractors")
        self.assertNotIn("Trust Score ranking", UI)

    def test_24_no_county_pages(self):
        self.assertTrue(SNAP["geography"]["no_california_county_pages"])
        self.assertFalse((ROOT / "app/california").is_dir() and (ROOT / "app/california" / "[county]").exists())
        self.assertIn("No California county pages", UI)

    def test_25_findings(self):
        self.assertGreaterEqual(len(SNAP["findings"]), 3)

    def test_26_nj_florida_untouched(self):
        self.assertTrue((ROOT / "app/new-jersey/page.tsx").exists())
        self.assertTrue((ROOT / "app/new-jersey/monmouth-county/page.tsx").exists() or (ROOT / "app/new-jersey/[county]/page.tsx").exists())
        self.assertTrue((ROOT / "app/florida/page.tsx").exists())


class SearchBehaviorTests(unittest.TestCase):
    def test_27_python_filter(self):
        rows = [
            ["111", "ALPHA BUILDERS", "Los Angeles", "90001", "Los Angeles", "CLEAR", "B,C10", "2135551111", ""],
            ["222", "BETA PLUMBING", "Sacramento", "95814", "Sacramento", "Work Comp Susp", "C36", "9165552222", "1"],
            ["333", "GAMMA ROOFING", "Fresno", "93701", "Fresno", "CLEAR", "C39", "", ""],
        ]
        # inline copy of the TS contract
        def filt(q="", status="", classification="", city="", zip_=""):
            cls = re.sub(r"[^A-Za-z0-9]", "", classification).upper()
            digits = re.sub(r"\D", "", q)
            out = []
            for row in rows:
                if status and row[5] != status:
                    continue
                if cls:
                    tokens = [re.sub(r"[^A-Z0-9]", "", t).upper() for t in row[6].split(",")]
                    if cls not in tokens:
                        continue
                if city and city.lower() not in row[2].lower():
                    continue
                if zip_ and not row[3].startswith(zip_):
                    continue
                if q:
                    ql = q.lower()
                    if digits == q.strip() and len(digits) >= 3:
                        if row[0] != digits:
                            continue
                    elif (
                        ql not in row[1].lower()
                        and ql not in row[2].lower()
                        and (not digits or digits not in row[0])
                    ):
                        continue
                out.append(row)
            return out

        self.assertEqual(filt(q="111")[0][1], "ALPHA BUILDERS")
        self.assertEqual(len(filt(classification="C-10")), 1)
        self.assertEqual(len(filt(status="CLEAR")), 2)
        self.assertEqual(len(filt(city="Fresno")), 1)
        self.assertEqual(len(filt(zip_="958")), 1)
        self.assertEqual(len(filt(q="zzz")), 0)


if __name__ == "__main__":
    unittest.main()
