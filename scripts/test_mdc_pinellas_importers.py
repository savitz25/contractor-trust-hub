#!/usr/bin/env python3
"""Prompt 2 importer / classifier tests. No production writes."""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ingest.city_of_miami_permits import SOURCE_JURISDICTION, parse_city_row  # noqa: E402
from ingest.enforcement_contract import (  # noqa: E402
    MDC_SOURCE,
    PCCLB_SOURCE,
    parse_enforcement_row,
)
from ingest.mdc_contractor_number import (  # noqa: E402
    classify_contractor_number,
    identity_from_namespace,
    is_agency_phone,
)
from ingest.mdc_local_credentials import parse_ctqb_row, refuse_if_energov  # noqa: E402
from ingest.mdc_opendata import contact_observations, stage_a, stage_b, stage_c, stage_d  # noqa: E402
from ingest.pcclb_credentials import parse_pcclb_row  # noqa: E402
from ingest.pinellas_bdrs_permits import BELLEAIR_BLUFFS_BDRS_END, parse_bdrs_row  # noqa: E402

failed = 0
FIX = ROOT / "docs/intelligence/enhanced-county/fixtures"


def assert_(cond: bool, msg: str) -> None:
    global failed
    if not cond:
        print("FAIL:", msg)
        failed += 1
    else:
        print("PASS:", msg)


def main() -> int:
    ns = classify_contractor_number("CGC1508486")
    assert_(ns["namespace"] == "DBPR_FULL_PREFIXED", "DBPR prefix CGC")
    ns = classify_contractor_number("ccc-1328178")
    assert_(ns["namespace"] == "DBPR_FULL_PREFIXED" and ns["normalized"] == "CCC1328178", "normalize CCC")
    ns = classify_contractor_number("EC13001606")
    assert_(ns["namespace"] == "DBPR_FULL_PREFIXED", "ECLB EC prefix")
    ns = classify_contractor_number("FPC17000066")
    assert_(ns["namespace"] == "DBPR_FULL_PREFIXED", "FPC prefix")
    ns = classify_contractor_number("19B000138")
    assert_(ns["namespace"] == "MIAMI_DADE_COC", "MDC COC")
    ns = classify_contractor_number("11P000450")
    assert_(ns["namespace"] == "MIAMI_DADE_COC", "MDC COC plumbing-style")
    ns = classify_contractor_number("95BS00368")
    assert_(ns["namespace"] == "MIAMI_DADE_COC", "MDC COC two-letter class")
    ns = classify_contractor_number("", "OWNER")
    assert_(ns["namespace"] == "OWNER_BUILDER", "OWNER name")
    ns = classify_contractor_number("OWNER", "OWNER BUILDER")
    assert_(ns["namespace"] == "OWNER_BUILDER", "OWNER number")
    ns = classify_contractor_number("1234567")
    assert_(ns["namespace"] == "OTHER_LOCAL_IDENTIFIER", "numeric core not DBPR")
    ns = classify_contractor_number("ZZZ99999")
    assert_(ns["namespace"] == "AMBIGUOUS", "unknown prefix")
    ns = classify_contractor_number("")
    assert_(ns["namespace"] == "BLANK", "blank")

    assert_(identity_from_namespace("DBPR_FULL_PREFIXED", dbpr_exists=True)[0] == "CONFIRMED", "full DBPR CONFIRMED")
    assert_(identity_from_namespace("DBPR_FULL_PREFIXED", dbpr_exists=False)[0] == "REVIEW_REQUIRED", "prefixed not in warehouse")
    assert_(identity_from_namespace("MIAMI_DADE_COC")[0] == "UNRESOLVED", "COC without crosswalk UNRESOLVED")
    assert_(identity_from_namespace("MIAMI_DADE_COC", local_crosswalk=True)[0] == "CONFIRMED", "COC crosswalk CONFIRMED")
    assert_(identity_from_namespace("OWNER_BUILDER")[0] == "UNRESOLVED", "OWNER UNRESOLVED")
    assert_(identity_from_namespace("OTHER_LOCAL_IDENTIFIER")[0] == "UNRESOLVED", "numeric UNRESOLVED")
    assert_(identity_from_namespace("BLANK", has_name=True)[0] == "REVIEW_REQUIRED", "name-only REVIEW")
    assert_(is_agency_phone("786-315-2880"), "MDC agency phone")
    assert_(not is_agency_phone("(305)586-5835"), "contractor phone")

    fixture = FIX / "TEST_ONLY_mdc_opendata.jsonl"
    audit = stage_a(fixture)
    assert_(audit["test_only"] is True, "opendata fixture TEST_ONLY")
    assert_(audit["row_count"] == 5, "five fixture rows")
    parsed = stage_b(fixture)
    assert_(any(p["valuation"] is None for p in parsed), "missing valuation stays NULL")
    owner = next(p for p in parsed if p["owner_builder"])
    assert_(owner["contractor_namespace"] == "OWNER_BUILDER", "OWNER namespace")
    numeric = next(p for p in parsed if p["contractor_license_normalized"] == "1234567")
    assert_(numeric["contractor_namespace"] == "OTHER_LOCAL_IDENTIFIER", "numeric namespace")
    assert_(numeric["contractor_phone_is_agency"] is True, "agency phone flagged")
    assoc = next(p for p in parsed if p["process_kind"] == "associated_county_review")
    assert_(assoc["source_jurisdiction"] == "associated_county_review", "M/MBLD not municipal history")
    known = {"CGC1508486"}
    parsed = stage_c(parsed, known_dbpr=known)
    assert_(any(p["identity_state"] == "CONFIRMED" for p in parsed), "CONFIRMED on warehouse hit")
    assert_(next(p for p in parsed if p["owner_builder"])["identity_state"] == "UNRESOLVED", "OWNER identity")
    assert_(next(p for p in parsed if p["contractor_license_normalized"] == "1234567")["identity_state"] == "UNRESOLVED", "numeric UNRESOLVED")
    contacts = contact_observations(parsed)
    assert_(all(c["is_agency_number"] is False for c in contacts), "no agency phones stored")
    report = stage_d(parsed, audit, contacts)
    assert_(report["duplicate_keys"] >= 1, "duplicate permit key")
    assert_(report["stage_e"] == "NOT_LOADED", "no Stage E")

    with (FIX / "TEST_ONLY_mdc_ctqb.csv").open(encoding="utf-8") as fh:
        certs = [parse_ctqb_row(r) for r in csv.DictReader(fh)]
    j = next(c for c in certs if c["is_journeyman"])
    assert_(j["contractor_company_authorization"] is False, "journeyman not contractor")
    elig = next(c for c in certs if c["is_eligibility_not_coc"])
    assert_(elig["contractor_company_authorization"] is False, "eligibility not COC")
    preempt = next(c for c in certs if c["currentness"] == "PREEMPTED_CLASS")
    assert_(preempt["certificate_number_raw"] == "HIST-1", "preempted class")
    try:
        refuse_if_energov("mdc_energov_css")
        assert_(False, "EnerGov refused")
    except ValueError:
        assert_(True, "EnerGov refused")

    with (FIX / "TEST_ONLY_pcclb.csv").open(encoding="utf-8") as fh:
        pc = [parse_pcclb_row(r) for r in csv.DictReader(fh)]
    assert_(next(c for c in pc if c["license_kind"] == "journeyman")["contractor_company_authorization"] is False, "J- not contractor")
    assert_(next(c for c in pc if c["license_kind"] == "state_registered")["currentness"] == "STATE_ENROLLED", "I- STATE_ENROLLED")
    assert_(next(c for c in pc if c["status_raw"] == "E")["currentness"] == "EXPIRED", "expired C-")
    assert_(all(c["absent_state_certified_is_not_unlicensed"] for c in pc), "state-certified absence not unlicensed")

    with (FIX / "TEST_ONLY_pinellas_bdrs.csv").open(encoding="utf-8") as fh:
        permits = [parse_bdrs_row(r) for r in csv.DictReader(fh)]
    keys = [p["record_key"] for p in permits]
    assert_(len(keys) == len(set(keys)), "same permit number different AHJ is distinct")
    uninc = next(p for p in permits if p["source_jurisdiction"] == "unincorporated" and p["permit_number"] == "B-100")
    olds = next(p for p in permits if p["source_jurisdiction"] == "oldsmar")
    assert_(uninc["record_key"] != olds["record_key"], "AHJ scoped key")
    missing = next(p for p in permits if p["permit_number"] == "B-100" and p["source_jurisdiction"] == "oldsmar")
    assert_(missing["valuation"] is None, "blank valuation not zero")
    ownerp = next(p for p in permits if p["permit_number"] == "B-300")
    assert_(ownerp["identity_state"] == "UNRESOLVED", "BDRS OWNER UNRESOLVED")
    try:
        parse_bdrs_row(
            {
                "permit_number": "X",
                "jurisdiction": "Belleair Bluffs",
                "issue_date": "2025-08-16",
                "license_number": "CGC1",
            }
        )
        assert_(False, "Belleair Bluffs post-cutover refused")
    except ValueError as e:
        assert_(BELLEAIR_BLUFFS_BDRS_END in str(e), "Belleair Bluffs cutover")

    city = parse_city_row({"PermitNumber": "BD13015611", "PermitStatus": "Final", "FULLADDR": "1 Main"})
    assert_(city["source_jurisdiction"] == SOURCE_JURISDICTION == "miami", "City of Miami AHJ")
    assert_("CITY OF MIAMI AHJ ONLY" in city["coverage"], "coverage label")

    enf = parse_enforcement_row(
        {"case_number": "C-1", "type": "complaint", "status": "open"},
        source_system=MDC_SOURCE,
        county_slug="miami-dade",
    )
    assert_(enf["event_type"] == "complaint" and enf["is_finding"] is False, "complaint not finding")
    assert_(enf["flattened_violation_field"] is None, "no flattened violation")
    cit = parse_enforcement_row(
        {"record_number": "CLB-CT-1", "type": "citation", "disposition": "fine"},
        source_system=PCCLB_SOURCE,
        county_slug="pinellas",
    )
    assert_(cit["event_type"] == "citation", "citation distinct")
    fin = parse_enforcement_row(
        {"record_number": "FO-1", "event_type": "final order"},
        source_system=PCCLB_SOURCE,
        county_slug="pinellas",
    )
    assert_(fin["is_finding"] is True, "final order is finding")

    print("summary failed", failed)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
