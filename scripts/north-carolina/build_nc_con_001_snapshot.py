#!/usr/bin/env python3
"""Build contractor-nc-state-intel-v1. NCLBGC/NCBEEC/PHFS bulk rosters stay OPEN_SEARCH_ONLY."""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEBAR = ROOT / "data/north-carolina/nc-con-001/raw/debarred-vendors.csv"
OUT = ROOT / "lib/north-carolina-intelligence/accepted-snapshot.json"
ARTIFACT = ROOT / "artifacts/nc-con-001-public-snapshot.json"
GENERATION_KEYS = frozenset({"generatedAt", "fingerprint", "generated_at"})

EXPECTED = {
    "debar": 236,
    "licensed_summary_licenses": 49,
    "unlicensed_cases": 43,
    "phfs_attorney_rows": 91,
}


def dumps(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha_body(obj: dict[str, Any]) -> str:
    body = {k: v for k, v in obj.items() if k not in GENERATION_KEYS}
    clocks = copy.deepcopy(body.get("clocks") or {})
    clocks.pop("generatedAt", None)
    body["clocks"] = clocks
    return hashlib.sha256(dumps(body).encode("utf-8")).hexdigest()


def build() -> dict[str, Any]:
    debar = list(csv.DictReader(DEBAR.open(encoding="utf-8-sig", newline="")))
    if len(debar) != EXPECTED["debar"]:
        raise SystemExit(f"debarment drifted {len(debar)}")
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    snap: dict[str, Any] = {
        "version": "contractor-nc-state-intel-v1",
        "ticket": "NC-CON-001",
        "publicationPath": "/north-carolina",
        "canonical": "https://www.contractortrusthub.com/north-carolina",
        "generatedAt": generated,
        "snapshotAsOf": "2026-09-17",
        "hero": {
            "universe_label": "Current NCLBGC general-contractor census",
            "universe_value": None,
            "universe_hint": "OPEN_SEARCH_ONLY. Not 38,523 mixed records. Search-only is not zero.",
            "discipline_label": "Licensed case-summary licenses in recent Board PDFs",
            "discipline_value": 49,
            "unlicensed_label": "Unlicensed injunction cases in Spring 2026 PDF",
            "unlicensed_value": 43,
            "debarment_label": "NC DOA debarred-vendor rows",
            "debarment_value": 236,
        },
        "clocks": {
            "nclbgc_sourceAsOf": None,
            "nclbgc_sourceAsOf_reason": "Public portal is search-only; mailing-list is paid. No bulk current census.",
            "nclbgc_limitation_source": "NCLBGC classifications-and-limitations / GS 87-10(a1) / 2026 Laws book",
            "nclbgc_limitation_as_of": "2026-01",
            "licensed_summaries_periods": ["2025-10/2025-12", "2026-01/2026-03"],
            "unlicensed_summaries_period": "2026-01/2026-03",
            "discipline_profile_coverage": "complaints filed 2022 or later that resulted in discipline",
            "phfs_attorney_page_retrievedAt": "2026-09-17T17:30:00Z",
            "doa_debarment_sourceAsOf": "2021-06-01",
            "doa_debarment_revision_note": "Official page: files last revised 6/1/2021; no changes since.",
            "retrievedAt": "2026-09-17T17:30:00Z",
            "snapshotAsOf": "2026-09-17",
            "generatedAt": generated,
            "retrievedAt_is_not_sourceAsOf": True,
            "april_2026_38523_is_not_current_snapshot": True,
        },
        "nclbgc": {
            "NC_NCLBGC_ROSTER_STATUS": "OPEN_SEARCH_ONLY",
            "NC_NCLBGC_ROWS": None,
            "NC_NCLBGC_DISTINCT_LICENSE_NUMBERS": None,
            "NC_NCLBGC_ACTIVE_ROWS": None,
            "NC_NCLBGC_INACTIVE_ROWS": None,
            "NC_NCLBGC_INVALID_ROWS": None,
            "NC_NCLBGC_STATUS_UNKNOWN_ROWS": None,
            "NC_BUILDING_CLASS_LICENSES": None,
            "NC_RESIDENTIAL_CLASS_LICENSES": None,
            "NC_HIGHWAY_CLASS_LICENSES": None,
            "NC_PUBLIC_UTILITIES_CLASS_LICENSES": None,
            "NC_SPECIALTY_CLASS_LICENSES": None,
            "NC_LIMITED_LICENSES": None,
            "NC_INTERMEDIATE_LICENSES": None,
            "NC_UNLIMITED_LICENSES": None,
            "NC_QUALIFIER_RELATIONSHIPS": None,
            "search_only_is_not_zero": True,
            "mixed_38523_is_not_active_census": True,
            "threshold_usd": 40000,
            "threshold_is_not_every_job": True,
            "licensee_ne_qualifier": True,
            "classification_ne_limitation": True,
            "limitation_ne_quality": True,
            "building_may_include_specialty_work": True,
            "roofing_not_only_s_roofing": True,
            "namespace": "NC-NCLBGC:{license_number}",
            "search_url": "https://portal.nclbgc.org/Public/Search",
            "mailing_list_fee_usd": 25,
            "do_not_purchase": True,
        },
        "limitations": {
            "Limited": {"single_project_ceiling_usd": 750000, "quality": False},
            "Intermediate": {"single_project_ceiling_usd": 1500000, "quality": False},
            "Unlimited": {"single_project_ceiling_usd": None, "unrestricted": True, "quality": False},
            "unlimited_is_not_best": True,
        },
        "classifications": {
            "core": ["Building Contractor", "Residential Contractor", "Highway Contractor", "Public Utilities Contractor", "Specialty Contractor"],
            "unclassified_includes_all_core": True,
            "specialty_includes_s_roofing": True,
            "do_not_invent_single_trade_field": True,
        },
        "discipline": {
            "profile_linked_coverage": "2022_OR_LATER_COMPLAINTS_THAT_RESULTED_IN_DISCIPLINE",
            "NC_NCLBGC_DISCIPLINE_PROFILES_WITH_LINKS": None,
            "NC_NCLBGC_DISCIPLINARY_DOCUMENTS": None,
            "NC_NCLBGC_UNIQUE_DISCIPLINARY_MATTERS": None,
            "profile_endpoint_observed": True,
            "no_link_ne_clean_history": True,
            "complaint_ne_discipline": True,
            "consent_order_ne_criminal_conviction": True,
            "final_decision_ne_complaint_filing": True,
            "example_license": "L.53462",
            "example_documents": 2,
        },
        "licensed_summaries": {
            "coverage": "PARTIAL_RECENT_PERIODS",
            "NC_NCLBGC_LICENSED_CASE_SUMMARY_ROWS": 49,
            "grain": "distinct L. license numbers in Oct-Dec 2025 and Jan-Mar 2026 Board PDFs",
            "not_complete_2022_2026_census": True,
        },
        "unlicensed": {
            "coverage": "PARTIAL_SPRING_2026_PDF",
            "NC_NCLBGC_UNLICENSED_ORDER_ROWS": 43,
            "NC_NCLBGC_UNLICENSED_UNIQUE_CASES": 43,
            "unlicensed_ne_licensee": True,
            "name_only": "UNSAFE",
        },
        "recovery_fund": {
            "NC_RECOVERY_FUND_PUBLIC_RECORD_STATUS": "CONTEXT_ONLY",
            "NC_RECOVERY_FUND_ROWS": None,
            "hearing_ne_adverse_finding": True,
            "claim_ne_award": True,
        },
        "electrical": {
            "NC_ELECTRICAL_ROSTER_STATUS": "OPEN_SEARCH_ONLY",
            "NC_ELECTRICAL_ROWS": None,
            "NC_ELECTRICAL_DISTINCT_LICENSE_IDS": None,
            "NC_ELECTRICAL_BUSINESS_ROWS": None,
            "NC_ELECTRICAL_PERSON_ROWS": None,
            "NC_ELECTRICAL_DISCIPLINARY_ROWS": None,
            "search_url": "https://arls-public.ncbeec.org/public/search",
            "paid_listing_fee_usd": 50,
            "person_ne_business": True,
            "search_only_is_not_zero": True,
        },
        "phfs": {
            "NC_PHFS_ROSTER_STATUS": "OPEN_SEARCH_ONLY",
            "NC_PHFS_ROWS": None,
            "NC_PHFS_DISTINCT_LICENSE_IDS": None,
            "NC_PHFS_CONTRACTOR_ROWS": None,
            "NC_PHFS_TECHNICIAN_ROWS": None,
            "search_url": "https://public.nclicensing.org/Public/Search",
            "contractor_ne_technician": True,
            "plumbing_ne_heating": True,
            "fuel_piping_ne_fire_sprinkler": True,
            "search_only_is_not_zero": True,
        },
        "phfs_attorney": {
            "coverage": "PARTIAL_CURRENT_BOARD_PAGE",
            "NC_PHFS_ATTORNEY_REPORT_ROWS": 91,
            "NC_PHFS_UNIQUE_REGULATORY_MATTERS": 91,
            "source_url": "https://nclicensing.org/attorneys-report/",
            "licensed_ne_unlicensed": True,
            "allegation_ne_final_finding": True,
            "name_only": "UNSAFE",
        },
        "doa_debarment": {
            "NC_DOA_DEBARRED_VENDOR_ROWS": 236,
            "NC_DOA_DEBARRED_VENDOR_SOURCE_AS_OF": "2021-06-01",
            "no_recent_revision_ne_currently_verified_clean": True,
            "debarment_ne_licensing_discipline": True,
            "vendor_ne_licensed_gc": True,
            "name_only": "UNSAFE",
        },
        "ncdot": {
            "NC_NCDOT_PREQUALIFIED_ROWS": None,
            "status": "NOT_ACQUIRED",
            "prequalification_ne_nclbgc_license": True,
            "prequalification_ne_endorsement": True,
        },
        "permits": {
            "NC_BUILDING_PERMIT_CAPABILITY": "LOCAL_OR_FRAGMENTED",
            "no_statewide_permit_census": True,
        },
        "identity": {
            "preferred": "exact NCLBGC / NCBEEC / PHFS license number",
            "EXACT_SOURCE_NATIVE_CROSSWALKS": 0,
            "NAME_ONLY_UNSAFE": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REVIEW_REQUIRED": 0,
        },
        "adverse_publication": {
            "ADVERSE_SOURCES_FOUND": 5,
            "ADVERSE_SOURCES_ACQUIRED": 4,
            "ADVERSE_ROWS_ACQUIRED": None,
            "UNIQUE_REGULATORY_MATTERS": None,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REVIEW_REQUIRED": 0,
            "UNRESOLVED": None,
            "INTERNAL_ONLY": 0,
            "PUBLICATION_PENDING": 0,
            "PUBLIC_READY_PROFILES": 0,
            "PUBLICLY_RENDERED_PROFILES": 0,
            "BUSINESS_RESPONSE_READY": False,
            "SEARCH_SUPPORTED": True,
            "do_not_add_grains": True,
        },
        "expansion_ledger": {
            "NET_NEW_STATE_RESEARCH_IDENTITIES": 0,
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "CLAIM_ELIGIBILITY_BROADENED": False,
        },
        "gate": {"live_cohort_not_inflated": True},
        "no_local_north_carolina_routes": True,
        "no_ranking": True,
        "no_trust_score": True,
        "local_work_needed_now": "NO",
        "semantic_guardrails": [
            "$40,000 threshold != every job requires NCLBGC license",
            "38,523 mixed records != active contractors",
            "licensee != qualifier",
            "classification != limitation",
            "Unlimited != best",
            "Building/Residential may encompass roofing; S(Roofing) is not the only roofing path",
            "electrical board != NCLBGC",
            "PHFS board != NCLBGC",
            "complaint != discipline",
            "unlicensed injunction != licensed discipline",
            "DOA debarment != contractor license",
            "search-only != zero",
            "NO TRUST SCORE",
            "NO COMBINED NORTH CAROLINA CONTRACTORS TOTAL",
            "NO CHARLOTTE OR RALEIGH ROUTES",
        ],
        "fingerprint": "",
    }
    snap["fingerprint"] = sha_body(snap)
    return snap


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    snap = build()
    if args.check:
        current = json.loads(OUT.read_text(encoding="utf-8"))
        expected = sha_body(snap)
        actual = sha_body(current)
        if expected != actual:
            raise SystemExit(f"NC snapshot fingerprint drifted: {actual} != {expected}")
        if current["fingerprint"] != actual:
            raise SystemExit("stored fingerprint mismatch")
        print("build_nc_con_001_snapshot --check pass", actual)
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(snap, indent=2) + "\n"
    OUT.write_text(text, encoding="utf-8")
    ARTIFACT.write_text(text, encoding="utf-8")
    print("wrote", OUT, snap["fingerprint"])


if __name__ == "__main__":
    main()
