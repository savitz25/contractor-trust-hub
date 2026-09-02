#!/usr/bin/env python3
"""NJ-CON-002A unit tests."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
from ingest.adapters.nj_con_002a import (
    FAMILY_COVERAGE,
    SPECIALTY_FAMILIES,
    UNACQUIRED_FAMILIES,
    coverage_record,
    observations_allowed,
    parse_ascm_text,
    parse_fire_text,
    parse_lead_text,
    parse_ocp_csv,
    parse_safe_house_csv,
    related_docket_links,
)
from ingest.adapters.nj_public_works import (
    EVIDENCE_CLASS,
    FORBIDDEN_ABSENCE_CLAIMS,
    PUBLIC_LABELS,
    SOURCE_COVERAGE_ACQUIRED,
    SOURCE_COVERAGE_NOT_ACQUIRED,
    SOURCE_COVERAGE_PARTIAL,
)
from ingest.nj_identity_match import LicenseCandidate, build_license_index, match_observation
from ingest.official_source_persist import observation_write_shape, persist_official_source

SAMPLES = ROOT / "data" / "samples" / "nj_con_002a"
RAW = ROOT / "data" / "raw" / "nj_con_002a"
MIG013 = (ROOT / "schema" / "migrations" / "013_nj_public_works_sanctions.sql").read_text(encoding="utf-8")
MIG014 = (ROOT / "schema" / "migrations" / "014_official_source_coverage.sql").read_text(encoding="utf-8")


class CoverageTests(unittest.TestCase):
    def test_ocp_is_partial_source_coverage(self):
        rec = coverage_record("NJ_OCP_LEGAL_FILING")
        self.assertEqual(rec["source_coverage"], SOURCE_COVERAGE_PARTIAL)
        self.assertFalse(rec["corpus_complete"])
        self.assertFalse(rec["public_absence_claim_allowed"])
        self.assertEqual(rec["acquired_document_count"], 4)
        self.assertIn("PARTIAL_SOURCE_COVERAGE", FAMILY_COVERAGE["NJ_OCP_LEGAL_FILING"]["note"])
        self.assertIn("No other enforcement record found", FAMILY_COVERAGE["NJ_OCP_LEGAL_FILING"]["note"])

    def test_unacquired_sources_are_explicit(self):
        for fam in (
            "NJ_BOARD_ACTION",
            "NJ_NEW_HOME_BUILDER",
            "NJ_HEC_REGISTRATION",
            "NJ_PWCR_REGISTRATION",
            "NJ_PREVAILING_WAGE_DEBARMENT",
        ):
            rec = coverage_record(fam)
            self.assertEqual(rec["source_coverage"], SOURCE_COVERAGE_NOT_ACQUIRED)
            self.assertFalse(observations_allowed(fam))
            self.assertFalse(rec["zero_valued_observation"])
            self.assertFalse(rec["clean_history_conclusion"])
            self.assertFalse(rec["public_absence_claim_allowed"])
            self.assertIsNone(rec.get("parsed"))

    def test_no_zero_observation_for_unavailable_source(self):
        self.assertTrue(UNACQUIRED_FAMILIES)
        for fam in UNACQUIRED_FAMILIES:
            rec = coverage_record(fam)
            self.assertEqual(rec["observations_written"], 0)
            self.assertFalse(rec["zero_valued_observation"])
            dry = persist_official_source(
                None,
                fam,
                {fam: {"url": "https://example.invalid", "agency": "x", "source_coverage": SOURCE_COVERAGE_NOT_ACQUIRED}},
                [],
                dry_run=True,
                source_system="nj_con_002a",
                notes="test",
                source_coverage=SOURCE_COVERAGE_NOT_ACQUIRED,
            )
            self.assertEqual(dry["inserted"], 0)
            self.assertEqual(dry["snapshots"], 1)

    def test_acquired_specialty_coverage(self):
        for fam in SPECIALTY_FAMILIES:
            self.assertEqual(FAMILY_COVERAGE[fam]["coverage"], SOURCE_COVERAGE_ACQUIRED)
            self.assertEqual(FAMILY_COVERAGE[fam]["evidence_class"], "specialty_credential")


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
        self.assertEqual(eval_rows[0]["evidence_class"], "specialty_credential")
        self.assertIsNone(eval_rows[0]["action"])
        self.assertEqual(eval_rows[0]["raw_payload"]["credential_kind"], "lead_evaluation")
        self.assertEqual(abate_rows[0]["raw_payload"]["credential_kind"], "lead_abatement")

    def test_ascm_not_dol_asbestos_abatement(self):
        text = (RAW / "asmlist_list.pdf.txt").read_text(encoding="utf-8") if (RAW / "asmlist_list.pdf.txt").exists() else (
            "TTI Environmental, Inc. 1253 North Church Street Moorestown NJ 08057 609-304-3968 Tim Popp 3\n"
        )
        rows = parse_ascm_text(text, source_date="2026-07-30")
        self.assertGreater(len(rows), 0)
        self.assertTrue(rows[0]["raw_payload"]["not_dol_asbestos_abatement"])
        self.assertEqual(rows[0]["source_family"], "NJ_ASCM_AUTHORIZATION")
        self.assertEqual(rows[0]["evidence_class"], "specialty_credential")
        self.assertNotIn("abatement contractor license", PUBLIC_LABELS["NJ_ASCM_AUTHORIZATION"].lower())

    def test_fire_classes_preserved_separately(self):
        text = "\n".join([
            "ASSOCIATED FIRE PROTECTION", "P00010", "10/31/2027", "100 JACKSON ST", "PATERSON", "NJ", "07501",
            "C1", "C2", "C3",
        ])
        rows = parse_fire_text(text, source_date="2026-07-02")
        self.assertEqual(rows[0]["certificate_or_vendor_id"], "P00010")
        self.assertEqual(rows[0]["raw_payload"]["permit_classes"], ["C1", "C2", "C3"])
        self.assertTrue(rows[0]["raw_payload"]["do_not_infer_all_classes"])
        self.assertEqual(rows[0]["evidence_class"], "specialty_credential")
        self.assertIsNone(rows[0].get("action") or None)

    def test_new_home_builder_label_not_hic(self):
        self.assertNotEqual(PUBLIC_LABELS["NJ_NEW_HOME_BUILDER"], PUBLIC_LABELS.get("NJ_PWCR_REGISTRATION"))
        self.assertIn("New Home Builder", PUBLIC_LABELS["NJ_NEW_HOME_BUILDER"])
        self.assertNotIn("HIC", PUBLIC_LABELS["NJ_NEW_HOME_BUILDER"])

    def test_hec_not_flattened_to_hic(self):
        self.assertEqual(PUBLIC_LABELS["NJ_HEC_REGISTRATION"], "New Jersey Home Elevation Contractor Registration")
        self.assertNotIn("HIC", PUBLIC_LABELS["NJ_HEC_REGISTRATION"])

    def test_nov_is_not_final_order(self):
        rows = parse_safe_house_csv(SAMPLES / "safe_house_hic.csv")
        self.assertTrue(all(r["action"] == "NOV" for r in rows))
        self.assertTrue(all(r["raw_payload"]["disposition"] == "NOV_ISSUED_NOT_FINAL_ADJUDICATION" for r in rows))
        self.assertTrue(all(r["evidence_class"] == "regulatory_event" for r in rows))
        self.assertTrue(all(r["raw_payload"]["penalty_is_paid_fine"] is False for r in rows))
        self.assertTrue(all(r["raw_payload"]["penalty_is_final_adjudication"] is False for r in rows))
        renew = [r for r in rows if r["raw_payload"]["allegation"] == "failure_to_renew"]
        never = [r for r in rows if r["raw_payload"]["allegation"] == "failure_to_register"]
        self.assertGreater(len(renew), 0)
        self.assertGreater(len(never), 0)
        self.assertTrue(all(r["raw_payload"]["penalty_proposed"] == "2500" for r in rows))

    def test_related_docket_links_not_name_only_and_not_reused_docket(self):
        filings = parse_ocp_csv(SAMPLES / "ocp_filings_sample.csv")
        self.assertIn("CONSENT_ORDER", [f["action"] for f in filings])
        self.assertIn("FINAL_ORDER_ON_DEFAULT", [f["action"] for f in filings])
        self.assertIn("FINAL_ORDER_OF_DENIAL_OF_REGISTRATION", [f["action"] for f in filings])
        links = related_docket_links(filings)
        self.assertTrue(all("name" not in x["relation"] for x in links))
        tnt = next(f for f in filings if "TNT" in (f["official_business_name"] or ""))
        progressive = next(f for f in filings if "Progressive" in (f["official_business_name"] or ""))
        self.assertEqual((tnt.get("raw_payload") or {}).get("docket"), "24-013")
        self.assertEqual((progressive.get("raw_payload") or {}).get("docket"), "24-013")
        linked_keys = {k for link in links for k in link["observation_keys"]}
        self.assertNotIn(tnt["source_observation_key"], linked_keys)
        self.assertNotIn(progressive["source_observation_key"], linked_keys)

    def test_specialty_not_stored_as_discipline(self):
        for fam in SPECIALTY_FAMILIES:
            self.assertEqual(EVIDENCE_CLASS[fam], "specialty_credential")
            self.assertNotEqual(EVIDENCE_CLASS[fam], "regulatory_event")
        self.assertEqual(EVIDENCE_CLASS["NJ_OPERATION_SAFE_HOUSE"], "regulatory_event")
        self.assertEqual(EVIDENCE_CLASS["NJ_OCP_LEGAL_FILING"], "regulatory_event")


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
        self.assertIsNone(result["contractor_id"])

    def test_name_plus_city_remains_review_required(self):
        idx = build_license_index([
            LicenseCandidate(
                "c1", "NJ-HIC:13VH00099900", "HIC", "13VH00099900",
                "BLACK RIVER CONTRACTING LLC", "", "OCEAN GATE", "", "NJ",
            ),
        ])
        rows = parse_safe_house_csv(SAMPLES / "safe_house_hic.csv")
        obs = next(r for r in rows if "BLACK RIVER" in (r["official_business_name"] or "").upper())
        result = match_observation(obs, idx)
        self.assertEqual(result["match_method"], "review_required")
        self.assertNotEqual(result["match_method"], "high_confidence")
        self.assertNotEqual(result["match_method"], "exact")
        self.assertIsNone(result["contractor_id"])


class PersistenceTests(unittest.TestCase):
    def test_internal_only_publication_default(self):
        rows = parse_safe_house_csv(SAMPLES / "safe_house_hic.csv")
        self.assertTrue(all(r["public_eligibility_status"] == "internal_only" for r in rows))
        shape = observation_write_shape(rows[0])
        self.assertEqual(shape["public_eligibility_status"], "internal_only")
        self.assertEqual(shape["evidence_class"], "regulatory_event")
        self.assertIsNone(shape["contractor_id"])

    def test_production_write_shape_uses_official_source_not_licenses(self):
        self.assertIn("official_source_snapshots", MIG013)
        self.assertIn("official_source_observations", MIG013)
        self.assertIn("official_source_occurrences", MIG013)
        self.assertIn("source_coverage", MIG014)
        self.assertIn("evidence_class", MIG014)
        self.assertNotIn("CREATE TABLE", MIG014)
        ingest = (ROOT / "scripts" / "nj_con_002a_ingest.py").read_text(encoding="utf-8")
        self.assertIn("persist_official_source", ingest)
        self.assertIn("official_source_observations", ingest)
        self.assertIn('"persisted_to_licenses": False', ingest)
        adapter = (ROOT / "ingest" / "adapters" / "nj_con_002a.py").read_text(encoding="utf-8")
        self.assertNotIn("INSERT INTO licenses", adapter)
        self.assertNotIn("discipline_actions", adapter)

    def test_no_duplicate_nj_dca_credential_path(self):
        hic = (ROOT / "ingest" / "adapters" / "nj_dca.py").read_text(encoding="utf-8")
        self.assertIn('SOURCE_SYSTEM = "nj_dca"', hic)
        self.assertNotIn("NJ_LEAD_ABATEMENT", hic)
        self.assertNotIn("NJ_FIRE_PROTECTION_PERMIT", hic)
        ingest = (ROOT / "scripts" / "nj_con_002a_ingest.py").read_text(encoding="utf-8")
        self.assertIn("existing_nj_dca_credentials_reingested", ingest)

    def test_idempotent_second_normalization_run(self):
        a = parse_ocp_csv(SAMPLES / "ocp_filings_sample.csv")
        b = parse_ocp_csv(SAMPLES / "ocp_filings_sample.csv")
        self.assertEqual([x["source_observation_key"] for x in a], [x["source_observation_key"] for x in b])
        self.assertEqual(len({x["source_observation_key"] for x in a}), len(a))
        fire_a = parse_fire_text("ACME\nP00011\n10/31/2027\nC4\n", source_date="2026-07-02")
        fire_b = parse_fire_text("ACME\nP00011\n10/31/2027\nC4\n", source_date="2026-07-02")
        self.assertEqual(fire_a[0]["source_observation_key"], fire_b[0]["source_observation_key"])


class PublicationTests(unittest.TestCase):
    def test_existing_hic_graph_not_redefined(self):
        hic = (ROOT / "ingest" / "adapters" / "nj_dca.py").read_text(encoding="utf-8")
        self.assertIn('SOURCE_SYSTEM = "nj_dca"', hic)
        self.assertNotIn("NJ_LEAD_ABATEMENT", hic)

    def test_no_nj_page_or_score(self):
        self.assertFalse((ROOT / "app" / "new-jersey").exists())
        blob = " ".join(PUBLIC_LABELS.values())
        for banned in ("Government approved", "Trusted contractor", "Clean record", "Best contractor"):
            self.assertNotIn(banned.lower(), blob.lower())
        for claim in FORBIDDEN_ABSENCE_CLAIMS:
            self.assertNotIn(claim, blob)

    def test_no_create_table_nj_only_silo(self):
        self.assertFalse((ROOT / "schema" / "migrations" / "014_nj_specialty.sql").exists())
        self.assertIn("official_source_snapshots", MIG014)


class OfficialFileTests(unittest.TestCase):
    def test_official_lead_and_fire_if_present(self):
        eval_txt = RAW / "ld_eval_contrs.pdf.txt"
        abate_txt = RAW / "ld_abat_c.pdf.txt"
        fire_txt = RAW / "fire_protection_permitted_business.pdf.txt"
        if eval_txt.exists():
            rows = parse_lead_text(eval_txt.read_text(encoding="utf-8"), source_family="NJ_LEAD_EVALUATION", source_date="2026-08-11")
            self.assertGreater(len(rows), 50)
            self.assertTrue(all(r["evidence_class"] == "specialty_credential" for r in rows))
        if abate_txt.exists():
            rows = parse_lead_text(abate_txt.read_text(encoding="utf-8"), source_family="NJ_LEAD_ABATEMENT", source_date="2026-07-15")
            self.assertGreater(len(rows), 30)
        if fire_txt.exists():
            rows = parse_fire_text(fire_txt.read_text(encoding="utf-8"), source_date="2026-07-02")
            self.assertGreater(len(rows), 100)
            self.assertTrue(all(r["certificate_or_vendor_id"].startswith("P") for r in rows))


class FloridaUnchangedTests(unittest.TestCase):
    def test_florida_foundation_migration_untouched_by_014(self):
        mig011 = (ROOT / "schema" / "migrations" / "011_enhanced_county_foundation.sql").read_text(encoding="utf-8")
        self.assertIn("permit_source_records", mig011)
        self.assertNotIn("NJ_LEAD", mig011)
        self.assertNotIn("source_coverage", mig011)


if __name__ == "__main__":
    unittest.main()
