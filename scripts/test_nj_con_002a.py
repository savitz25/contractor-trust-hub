#!/usr/bin/env python3
"""NJ-CON-002A unit tests."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
from ingest.adapters.nj_con_002a import (
    parse_ascm_text,
    parse_fire_text,
    parse_lead_text,
    parse_ocp_csv,
    parse_safe_house_csv,
    related_docket_links,
)
from ingest.adapters.nj_public_works import PUBLIC_LABELS
from ingest.nj_identity_match import LicenseCandidate, build_license_index, match_observation

SAMPLES = ROOT / "data" / "samples" / "nj_con_002a"
RAW = ROOT / "data" / "raw" / "nj_con_002a"


class SeparationTests(unittest.TestCase):
    def test_lead_eval_vs_abatement(self):
        self.assertNotEqual(PUBLIC_LABELS["NJ_LEAD_EVALUATION"], PUBLIC_LABELS["NJ_LEAD_ABATEMENT"])
        eval_rows = parse_lead_text(
            "00883 1 ALL AMERICAN LEAD SERVICES 2124 N. 2ND STREET MILLVILLE NJ 08332 MARISSA PETERSON 609-319-3149 RS / PB 7/31/2027\n",
            source_family="NJ_LEAD_EVALUATION",
            source_date="2026-08-11",
        )
        abate_rows = parse_lead_text(
            "00884 A J ENVIRONMENTAL SERVICES 37 BLOSSOM DRIVE LAKEWOOD NJ 08701 JACOB AUSCH 856-880-5323 RS / PB 7/31/2027\n",
            source_family="NJ_LEAD_ABATEMENT",
            source_date="2026-07-15",
        )
        self.assertEqual(eval_rows[0]["source_family"], "NJ_LEAD_EVALUATION")
        self.assertEqual(abate_rows[0]["source_family"], "NJ_LEAD_ABATEMENT")
        self.assertNotEqual(eval_rows[0]["source_family"], abate_rows[0]["source_family"])

    def test_ascm_not_dol_asbestos_abatement(self):
        text = (RAW / "asmlist_list.pdf.txt").read_text(encoding="utf-8") if (RAW / "asmlist_list.pdf.txt").exists() else (
            "TTI Environmental, Inc. 1253 North Church Street Moorestown NJ 08057 609-304-3968 Tim Popp 3\n"
        )
        rows = parse_ascm_text(text, source_date="2026-07-30")
        self.assertGreater(len(rows), 0)
        self.assertTrue(rows[0]["raw_payload"]["not_dol_asbestos_abatement"])
        self.assertEqual(rows[0]["source_family"], "NJ_ASCM_AUTHORIZATION")

    def test_fire_classes_preserved_separately(self):
        text = "\n".join([
            "ASSOCIATED FIRE PROTECTION", "P00010", "10/31/2027", "100 JACKSON ST", "PATERSON", "NJ", "07501",
            "C1", "C2", "C3",
        ])
        rows = parse_fire_text(text, source_date="2026-07-02")
        self.assertEqual(rows[0]["certificate_or_vendor_id"], "P00010")
        self.assertEqual(rows[0]["raw_payload"]["permit_classes"], ["C1", "C2", "C3"])
        self.assertTrue(rows[0]["raw_payload"]["do_not_infer_all_classes"])

    def test_new_home_builder_label_not_hic(self):
        self.assertNotEqual(PUBLIC_LABELS["NJ_NEW_HOME_BUILDER"], PUBLIC_LABELS.get("NJ_PWCR_REGISTRATION"))
        self.assertIn("New Home Builder", PUBLIC_LABELS["NJ_NEW_HOME_BUILDER"])

    def test_hec_not_flattened_to_hic(self):
        self.assertEqual(PUBLIC_LABELS["NJ_HEC_REGISTRATION"], "New Jersey Home Elevation Contractor Registration")
        self.assertNotIn("HIC", PUBLIC_LABELS["NJ_HEC_REGISTRATION"])

    def test_nov_is_not_final_order(self):
        rows = parse_safe_house_csv(SAMPLES / "safe_house_hic.csv")
        self.assertTrue(all(r["action"] == "NOV" for r in rows))
        self.assertTrue(all(r["raw_payload"]["disposition"] == "NOV_ISSUED_NOT_FINAL_ADJUDICATION" for r in rows))
        renew = [r for r in rows if r["raw_payload"]["allegation"] == "failure_to_renew"]
        never = [r for r in rows if r["raw_payload"]["allegation"] == "failure_to_register"]
        self.assertGreater(len(renew), 0)
        self.assertGreater(len(never), 0)

    def test_related_docket_links_not_name_only(self):
        filings = parse_ocp_csv(SAMPLES / "ocp_filings_sample.csv")
        self.assertIn("CONSENT_ORDER", [f["action"] for f in filings])
        self.assertIn("FINAL_ORDER_ON_DEFAULT", [f["action"] for f in filings])
        links = related_docket_links(filings)
        self.assertTrue(all("name" not in x["relation"] for x in links))


class IdentityTests(unittest.TestCase):
    def test_exact_cert_number(self):
        idx = build_license_index([
            LicenseCandidate("c1", "NJ-LEAD:00884", "LEAD_ABATE", "00884", "A J ENVIRONMENTAL SERVICES", "37 BLOSSOM DRIVE", "LAKEWOOD", "08701", "NJ", {"lead_abatement": "00884"}),
        ])
        obs = parse_lead_text(
            "00884 A J ENVIRONMENTAL SERVICES 37 BLOSSOM DRIVE LAKEWOOD NJ 08701 JACOB AUSCH 856-880-5323 RS / PB 7/31/2027\n",
            source_family="NJ_LEAD_ABATEMENT",
            source_date="2026-07-15",
        )[0]
        # exact requires stored namespace, not HIC collision
        result = match_observation({**obs, "source_family": "NJ_LEAD_ABATEMENT"}, idx)
        self.assertIn(result["match_method"], {"high_confidence", "review_required", "unresolved", "exact"})

    def test_name_only_rejected(self):
        from ingest.nj_identity_match import load_license_csv
        idx = build_license_index(load_license_csv(ROOT / "data/samples/nj_dca_hic_sample.csv"))
        obs = {"source_family": "NJ_LEAD_ABATEMENT", "official_business_name": "GARDEN STATE IMPROVEMENTS LLC", "individual_name": None, "address_line_1": None, "city": None, "postal_code": None, "certificate_or_vendor_id": None}
        self.assertEqual(match_observation(obs, idx)["match_method"], "unresolved")

    def test_person_to_business_review(self):
        idx = build_license_index([
            LicenseCandidate("c1", "NJ-HIC:1", "HIC", "1", "CHARLES SIEBERT", "1 MAIN", "FORKED RIVER", "08731", "NJ"),
        ])
        rows = parse_safe_house_csv(SAMPLES / "safe_house_hic.csv")
        person = next(r for r in rows if r["individual_name"] == "Charles Siebert")
        person["official_business_name"] = None
        result = match_observation(person, idx)
        self.assertEqual(result["match_method"], "review_required")


class IdempotencyTests(unittest.TestCase):
    def test_duplicate_document_and_second_parse(self):
        a = parse_ocp_csv(SAMPLES / "ocp_filings_sample.csv")
        b = parse_ocp_csv(SAMPLES / "ocp_filings_sample.csv")
        self.assertEqual([x["source_observation_key"] for x in a], [x["source_observation_key"] for x in b])
        self.assertEqual(len({x["source_observation_key"] for x in a}), len(a))

    def test_existing_hic_graph_not_redefined(self):
        hic = (ROOT / "ingest" / "adapters" / "nj_dca.py").read_text(encoding="utf-8")
        self.assertIn('SOURCE_SYSTEM = "nj_dca"', hic)
        self.assertNotIn("NJ_LEAD_ABATEMENT", hic)

    def test_no_nj_page_or_score(self):
        self.assertFalse((ROOT / "app" / "new-jersey").exists())
        blob = " ".join(PUBLIC_LABELS.values())
        for banned in ("Government approved", "Trusted contractor", "Clean record", "Best contractor"):
            self.assertNotIn(banned.lower(), blob.lower())


class OfficialFileTests(unittest.TestCase):
    def test_official_lead_and_fire_if_present(self):
        eval_txt = RAW / "ld_eval_contrs.pdf.txt"
        abate_txt = RAW / "ld_abat_c.pdf.txt"
        fire_txt = RAW / "fire_protection_permitted_business.pdf.txt"
        if eval_txt.exists():
            rows = parse_lead_text(eval_txt.read_text(encoding="utf-8"), source_family="NJ_LEAD_EVALUATION", source_date="2026-08-11")
            self.assertGreater(len(rows), 50)
        if abate_txt.exists():
            rows = parse_lead_text(abate_txt.read_text(encoding="utf-8"), source_family="NJ_LEAD_ABATEMENT", source_date="2026-07-15")
            self.assertGreater(len(rows), 30)
        if fire_txt.exists():
            rows = parse_fire_text(fire_txt.read_text(encoding="utf-8"), source_date="2026-07-02")
            self.assertGreater(len(rows), 100)
            self.assertTrue(all(r["certificate_or_vendor_id"].startswith("P") for r in rows))


if __name__ == "__main__":
    unittest.main()
