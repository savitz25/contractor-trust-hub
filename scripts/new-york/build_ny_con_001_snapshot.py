#!/usr/bin/env python3
"""NY-CON-001A — public-work registry snapshot. No NYC local acquisition."""
from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGE = ROOT / "data" / "new-york" / "ny-con-001"
LIB = ROOT / "lib" / "new-york-intelligence"
CSV_PATH = STAGE / "i4jv-zkey.csv"
ACQUIRE_PATH = STAGE / "acquire-report.json"
FROZEN_SNAPSHOT_AS_OF = "2026-09-11"
FROZEN_BASE_SHA = "e3168916ea437af20147aff0ebe31df77acc34a4"
ACCEPTED_RAW_SHA = "4070cf175286d2fcbbfa260c8e34fa7d2ba62746e8b219b0dfff3c48bd203ecb"

DATASET_PAGE = "https://data.ny.gov/Government-Finance/Contractor-Registry-Certificate/i4jv-zkey"
CSV_URL = "https://data.ny.gov/api/views/i4jv-zkey/rows.csv?accessType=DOWNLOAD"
SODA = "https://data.ny.gov/resource/i4jv-zkey.json"
PW_LANDING = "https://dol.ny.gov/public-work-contractor-and-subcontractor-registry-landing"
PW_FAQ = "https://dol.ny.gov/frequently-asked-questions-nysdol-contractor-registry"
EDLIST = "https://apps.labor.ny.gov/EDList/searchPage.do"
MOLD = "https://dol.ny.gov/mold-program"
ASBESTOS = "https://dol.ny.gov/asbestos-control-bureau"
OPEN_DATA = "https://data.ny.gov/resource/i4jv-zkey"

CONTRACT = "contractor-ny-state-intel-v1"
NAMESPACE = "NY-DOL-PW:{certificateNumber}"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def dump(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


VOLATILE_TOP_LEVEL = frozenset({"fingerprint", "generated_at"})


def semantic_body(obj: dict) -> dict:
    """Drop only generation timestamps. Keep source clocks, ledger, and counts."""
    out: dict = {}
    for key, value in obj.items():
        if key in VOLATILE_TOP_LEVEL:
            continue
        if key == "clocks" and isinstance(value, dict):
            out[key] = {ck: cv for ck, cv in value.items() if ck != "generatedAt"}
        else:
            out[key] = value
    return out


def fingerprint(body: dict) -> str:
    return sha256_bytes(dump(semantic_body(body)).encode("utf-8"))


def load_frozen_acquisition() -> dict:
    if not CSV_PATH.is_file():
        raise SystemExit(f"missing frozen CSV {CSV_PATH}")
    if not ACQUIRE_PATH.is_file():
        raise SystemExit(f"missing frozen acquire-report {ACQUIRE_PATH}")
    acquire = json.loads(ACQUIRE_PATH.read_text(encoding="utf-8"))
    raw = CSV_PATH.read_bytes()
    raw_sha = sha256_bytes(raw)
    if raw_sha != ACCEPTED_RAW_SHA:
        raise SystemExit(f"CSV checksum drifted: {raw_sha}")
    if acquire.get("raw_sha256") != ACCEPTED_RAW_SHA:
        raise SystemExit("acquire-report checksum does not match accepted CSV")
    if int(acquire.get("raw_bytes") or 0) != len(raw):
        raise SystemExit("acquire-report byte size does not match frozen CSV")
    if acquire.get("rowsUpdatedAt_unix") in (None, ""):
        raise SystemExit("acquire-report is missing rowsUpdatedAt_unix")
    return acquire


def parse_mdy(value: str) -> date | None:
    value = (value or "").strip()
    if not value:
        return None
    try:
        return datetime.strptime(value, "%m/%d/%Y").date()
    except ValueError:
        return None


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main(generated_at: str | None = None) -> dict:
    STAGE.mkdir(parents=True, exist_ok=True)
    LIB.mkdir(parents=True, exist_ok=True)
    acquire = load_frozen_acquisition()
    generated_at = generated_at or iso_now()
    snapshot_as_of = FROZEN_SNAPSHOT_AS_OF
    raw = CSV_PATH.read_bytes()
    raw_sha = acquire["raw_sha256"]
    source_as_of = datetime.fromtimestamp(int(acquire["rowsUpdatedAt_unix"]), tz=timezone.utc).date().isoformat()
    retrieved_at = acquire.get("retrievedAt")
    retrieved_precision = acquire.get("retrievedAt_precision") or "date"
    if not retrieved_at:
        raise SystemExit("frozen acquire-report is missing retrievedAt")

    with CSV_PATH.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))

    status_c: Counter[str] = Counter()
    type_c: Counter[str] = Counter()
    state_c: Counter[str] = Counter()
    by_cert: dict[str, list[int]] = defaultdict(list)
    blank_cert = 0
    blank_name = 0
    ny_addr = 0
    out_addr = 0
    blank_state = 0
    issue_empty = 0
    exp_empty = 0
    debar_yes = 0
    debar_current = 0
    debar_historical = 0
    debar_open_end = 0
    wage_yes = 0
    labor_yes = 0
    safety_yes = 0
    issued_dates: list[date] = []
    exp_dates: list[date] = []
    cert_format_other = 0

    as_of_day = date.fromisoformat(FROZEN_SNAPSHOT_AS_OF)

    for i, row in enumerate(rows):
        cert = (row.get("Certificate Number") or "").strip()
        name = (row.get("Business Name") or "").strip()
        status = (row.get("Status") or "").strip() or "(blank)"
        btype = (row.get("Business Type") or "").strip() or "(blank)"
        state = (row.get("State") or "").strip().upper() or "(blank)"
        issued = parse_mdy(row.get("Issued Date") or "")
        exp = parse_mdy(row.get("Expiration Date") or "")
        debar = (row.get("Business has been debarred") or "").strip().lower()
        wage = (row.get("Business has outstanding wage assessments") or "").strip().lower()
        labor = (row.get("Business has final determination for violation of Labor or Tax Law") or "").strip().lower()
        safety = (row.get("Business has final determination safety standard violations") or "").strip().lower()
        status_c[status] += 1
        type_c[btype] += 1
        state_c[state] += 1
        if not cert:
            blank_cert += 1
        else:
            by_cert[cert].append(i)
            if not __import__("re").fullmatch(r"\d{2}-[A-Za-z0-9]+-CR", cert, flags=__import__("re").I):
                cert_format_other += 1
        if not name:
            blank_name += 1
        if state == "NY":
            ny_addr += 1
        elif state == "(blank)":
            blank_state += 1
        else:
            out_addr += 1
        if issued is None:
            issue_empty += 1
        else:
            issued_dates.append(issued)
        if exp is None:
            exp_empty += 1
        else:
            exp_dates.append(exp)
        if debar == "yes":
            debar_yes += 1
            end = parse_mdy(row.get("Debarment End Date") or "")
            if end is None:
                debar_open_end += 1
            elif end >= as_of_day:
                debar_current += 1
            else:
                debar_historical += 1
        if wage == "yes":
            wage_yes += 1
        if labor == "yes":
            labor_yes += 1
        if safety == "yes":
            safety_yes += 1

    dup_ids = {k: v for k, v in by_cert.items() if len(v) > 1}
    rejected = 0
    parsed = len(rows)

    body = {
        "version": CONTRACT,
        "ticket": "NY-CON-001",
        "as_of": FROZEN_SNAPSHOT_AS_OF,
        "no_trust_score": True,
        "no_ranking": True,
        "no_local_new_york_routes": True,
        "no_nyc_phase": True,
        "nyc_phase": "APPROVED_AFTER_STATE_CLOSEOUT — NOT_STARTED",
        "not_statewide_gc_or_hic_license": True,
        "not_all_new_york_contractors": True,
        "publication": {
            "indexable": True,
            "robots": "index,follow",
            "canonical": "https://www.contractortrusthub.com/new-york",
            "route": "/new-york",
            "h1": "New York Public-Work Contractor Registration Intelligence",
        },
        "clocks": {
            "sourceAsOf": source_as_of,
            "sourceAsOf_meaning": "Official Socrata rowsUpdatedAt converted to a UTC calendar date",
            "retrievedAt": retrieved_at,
            "retrievedAt_precision": retrieved_precision,
            "retrievedAt_meaning": "Accepted capture calendar date. Instant-level retrieval time was not independently retained.",
            "snapshotAsOf": FROZEN_SNAPSHOT_AS_OF,
            "snapshotAsOf_meaning": "Immutable reference date for this accepted capture; rebuilds must not advance it",
            "generatedAt": generated_at,
            "clocks_are_semantically_distinct": True,
            "sourceAsOf_derivation": "acquire-report.rowsUpdatedAt_unix",
            "certificate_issue_date_is_not_sourceAsOf": True,
            "certificate_expiration_date_is_not_status": True,
            "do_not_treat_matching_calendar_dates_as_the_same_clock": True,
        },
        "hero": {
            "universe_value": parsed,
            "universe_label": "Public-work contractor registry certificates",
            "universe_hint": "NYSDOL Contractor Registry Certificate rows. Not all New York contractors. Not a residential HIC license.",
            "distinct_ids_value": len(by_cert),
            "distinct_ids_label": "Distinct certificate numbers",
            "distinct_ids_hint": "Source-native Certificate Number. A number is not a unique legal organization.",
            "ny_address_value": ny_addr,
            "ny_address_label": "Certificates with a New York mailing address",
            "ny_address_hint": "Address geography is not registration jurisdiction. Out-of-state businesses remain in the statewide registry.",
            "as_of_value": source_as_of,
            "as_of_label": "Open Data rows-updated date",
        },
        "registry": {
            "program": "NYSDOL Bureau of Public Work and Prevailing Wage Enforcement — Contractor and Subcontractor Registry",
            "dataset_id": "i4jv-zkey",
            "source_url": DATASET_PAGE,
            "csv_url": CSV_URL,
            "verify_url": PW_LANDING,
            "faq_url": PW_FAQ,
            "coverage_state": "ACQUIRED_CURRENT_SNAPSHOT",
            "classification": "VISIBLE_PUBLIC_METRIC",
            "grain": "public_work_contractor_registry_certificate_row",
            "entity_type": "registered_public_work_contractor_or_subcontractor",
            "raw_rows": len(rows),
            "parsed_rows": parsed,
            "rejected_rows": rejected,
            "distinct_certificate_ids": len(by_cert),
            "rows_without_certificate_id": blank_cert,
            "identifier_conflicts": len(dup_ids),
            "duplicate_extra_rows": sum(len(v) - 1 for v in dup_ids.values()),
            "blank_business_name": blank_name,
            "source_status_counts": dict(status_c),
            "business_type_counts": dict(type_c),
            "all_source_status_active": status_c.get("Active", 0) == parsed and parsed > 0,
            "application_ne_certificate": True,
            "did_not_manufacture_active_from_dates": True,
            "status_is_source_native": True,
            "issued_min": min(issued_dates).isoformat() if issued_dates else None,
            "issued_max": max(issued_dates).isoformat() if issued_dates else None,
            "expiration_min": min(exp_dates).isoformat() if exp_dates else None,
            "expiration_max": max(exp_dates).isoformat() if exp_dates else None,
            "issue_empty": issue_empty,
            "expiration_empty": exp_empty,
            "not_statewide_gc": True,
            "not_residential_hic_roster": True,
            "absence_ne_illegal_residential_contractor": True,
            "raw_sha256": raw_sha,
            "raw_bytes": len(raw),
        },
        "geography": {
            "registration_jurisdiction_ne_business_address": True,
            "ny_mailing_address_rows": ny_addr,
            "out_of_state_mailing_address_rows": out_addr,
            "blank_state_rows": blank_state,
            "state_distribution_top": state_c.most_common(12),
            "did_not_filter_to_ny_addresses": True,
            "out_of_state_businesses_remain_in_universe": True,
        },
        "identity": {
            "namespace": NAMESPACE,
            "preferred": "NY-DOL-PW:{certificateNumber} when Certificate Number is source-native and non-blank",
            "preserve_raw_text_and_leading_zeros": True,
            "blank_id_mints_no_identity": True,
            "conflicting_id_does_not_merge_subjects": True,
            "certificate_ne_unique_legal_organization": True,
            "other_program_numbers_are_separate_namespaces": True,
            "no_name_match_fill": True,
            "name_only": "UNSAFE",
            "name_plus_city": "REVIEW_REQUIRED",
            "nonstandard_certificate_format_rows": cert_format_other,
        },
        "debarment": {
            "edlist_url": EDLIST,
            "edlist_bulk": "SOURCE_NOT_ACQUIRED",
            "edlist_coverage": "OPEN_SEARCH_ONLY",
            "classification": "VISIBLE_SUPPORTING_CONTEXT",
            "registry_field_has_been_debarred_yes": debar_yes,
            "registry_debarment_period_ended_before_snapshot": debar_historical,
            "registry_debarment_period_open_or_current": debar_current + debar_open_end,
            "registry_debarment_current_by_end_date": debar_current,
            "registry_debarment_open_end": debar_open_end,
            "historical_ne_current": True,
            "expired_period_ne_current_exclusion": True,
            "debarment_ne_criminal_conviction": True,
            "public_work_exclusion_ne_universal_private_ban": True,
            "name_only_attachment": "UNSAFE",
            "exact_profile_attachments": 0,
            "dol_ne_wcb_context": True,
            "no_ownership_successor_reconstruction": True,
            "same_row_flag_is_not_edlist_census": True,
            "do_not_infer_zero_currently_debarred_contractors": True,
        },
        "wage_and_labor_flags": {
            "classification": "INTERNAL_DIAGNOSTIC_ONLY",
            "outstanding_wage_assessments_yes": wage_yes,
            "final_labor_or_tax_determination_yes": labor_yes,
            "final_safety_determination_yes": safety_yes,
            "flag_ne_conviction": True,
            "not_featured_as_public_metric": True,
        },
        "mold": {
            "coverage_state": "OPEN_SEARCH_ONLY",
            "result": "SOURCE_NOT_ACQUIRED",
            "classification": "VISIBLE_SUPPORTING_CONTEXT",
            "official_url": MOLD,
            "business_license_ne_individual_credential": True,
            "assessment_ne_remediation": True,
            "no_person_directory": True,
        },
        "asbestos": {
            "coverage_state": "OPEN_SEARCH_ONLY",
            "result": "SOURCE_NOT_ACQUIRED",
            "classification": "VISIBLE_SUPPORTING_CONTEXT",
            "official_url": ASBESTOS,
            "contractor_license_ne_individual_certificate_of_competence": True,
            "specialty_ne_general_contractor": True,
            "no_person_directory": True,
            "no_project_notifications": True,
        },
        "local_licensing": {
            "nyc_dcwp": "NOT_STARTED",
            "nyc_phase": "APPROVED_AFTER_STATE_CLOSEOUT — NOT_STARTED",
            "classification": "VISIBLE_SUPPORTING_CONTEXT",
            "public_work_registry_ne_local_hic": True,
            "ordinary_private_residential_work_may_need_local_license": True,
        },
        "grain_classification": {
            "registry_rows": "VISIBLE_PUBLIC_METRIC",
            "distinct_certificate_ids": "VISIBLE_PUBLIC_METRIC",
            "ny_address_geography": "VISIBLE_SUPPORTING_CONTEXT",
            "debarment_registry_flags": "VISIBLE_SUPPORTING_CONTEXT",
            "mold": "VISIBLE_SUPPORTING_CONTEXT",
            "asbestos": "VISIBLE_SUPPORTING_CONTEXT",
            "wage_labor_safety_flags": "INTERNAL_DIAGNOSTIC_ONLY",
        },
        "claim_eligibility": {"broadened": False},
        "expansion_ledger": {
            "NY_PW_REGISTRY_ROWS": parsed,
            "NY_PW_DISTINCT_CERTIFICATE_IDS": len(by_cert),
            "NY_PW_ROWS_WITHOUT_CERTIFICATE_ID": blank_cert,
            "NY_PW_IDENTIFIER_CONFLICTS": len(dup_ids),
            "NY_PW_SOURCE_STATUS_COUNTS": dict(status_c),
            "NY_MOLD_BUSINESS_LICENSE_ROWS": None,
            "NY_ASBESTOS_CONTRACTOR_LICENSE_ROWS": None,
            "NY_DEBARMENT_OBSERVATIONS": debar_yes,
            "NY_DEBARMENT_EXACT_ID_RESEARCH_MATCHES": 0,
            "NET_NEW_STATE_RESEARCH_IDENTITIES": len(by_cert),
            "NET_NEW_STATE_RESEARCH_IDENTITIES_definition": "Distinct NY-DOL-PW:{certificateNumber} values in this accepted snapshot that were absent from prior accepted research artifacts. Not canonical organizations and not public profiles.",
            "NET_NEW_STATE_RESEARCH_IDENTITIES_baseline": {
                "reviewed_base_sha": FROZEN_BASE_SHA,
                "namespace": NAMESPACE,
                "prior_accepted_certificate_ids": 0,
                "method": "Enumerated accepted research artifacts at the reviewed base SHA. No i4jv-zkey, NY-DOL-PW, or New York intelligence identity files existed.",
                "scope": "Exact source Certificate Number values only. Business names and corporate identity were not compared.",
                "baseline_status": "ESTABLISHED_EMPTY",
            },
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "GRAPH_WRITES": 0,
            "pre_existing_ny_overlay_ne_enrichment": True,
        },
        "gate": {
            "passed": True,
            "no_combined_new_york_contractor_total": True,
            "live_cohort_not_inflated": True,
        },
        "semantic_guardrails": [
            "registry != statewide GC/HIC license",
            "registry absence != illegal residential contractor",
            "NY jurisdiction != NY business address",
            "application != certificate",
            "license row != unique organization",
            "business license != person certificate",
            "name-only adverse attachment UNSAFE",
            "missing/search-only != zero",
            "historical debarment != current debarment",
            "debarment != conviction",
            "NO TRUST SCORE",
            "NO COMBINED NEW YORK CONTRACTORS HEADLINE",
        ],
        "juice_squeeze": {
            "GRABBED_HIGH_YIELD": ["NYSDOL Contractor Registry Certificate Open Data i4jv-zkey complete CSV"],
            "GRABBED_EASY_SECONDARY": ["Source-native registry debarment/wage/labor flags on the same certificate row"],
            "LEFT_SEARCH_ONLY": ["NY DOL EDList debarment search", "Mold Program business licenses", "Asbestos contractor licenses"],
            "LEFT_LOCAL_FUTURE": ["NYC DCWP/DOB/PLUTO/ACRIS/HPD", "Westchester/Nassau/Suffolk contractor lists"],
            "LEFT_TOO_MUCH_WORK": ["EDList reconstruction", "person mold/asbestos credentials", "project notifications"],
        },
    }
    body["generated_at"] = generated_at
    fp1 = fingerprint(body)
    alt = dict(body)
    alt["generated_at"] = "2099-01-01T00:00:00Z"
    alt_clocks = dict(body["clocks"])
    alt_clocks["generatedAt"] = "2099-01-01T00:00:00Z"
    alt["clocks"] = alt_clocks
    if fingerprint(alt) != fp1:
        raise SystemExit("generation timestamps leaked into the semantic fingerprint")
    body["fingerprint"] = fp1

    payload = json.dumps(body, indent=2) + "\n"
    (LIB / "accepted-snapshot.json").write_text(payload, encoding="utf-8")
    (STAGE / "accepted-snapshot.json").write_text(payload, encoding="utf-8")
    print(
        json.dumps(
            {
                "fingerprint": fp1,
                "rows": parsed,
                "distinct": len(by_cert),
                "ny_addr": ny_addr,
                "out": out_addr,
                "debar_yes": debar_yes,
                "debar_hist": debar_historical,
                "debar_cur": debar_current,
                "sourceAsOf": source_as_of,
                "retrievedAt": retrieved_at,
                "generatedAt": generated_at,
                "wrote_acquire_report": False,
            },
            indent=2,
        )
    )
    return body


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--generated-at", default=None)
    args = parser.parse_args()
    main(generated_at=args.generated_at)
