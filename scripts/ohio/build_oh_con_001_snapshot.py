#!/usr/bin/env python3
"""Build contractor-oh-state-intel-v1 from frozen OCILB and SFM no-fee rosters."""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
OCILB_RAW = ROOT / "data/ohio/ocilb/raw"
SFM_RAW = ROOT / "data/ohio/sfm/raw"
OCILB_MANIFEST = ROOT / "data/ohio/ocilb/acquire-manifest.json"
SFM_MANIFEST = ROOT / "data/ohio/sfm/acquire-manifest.json"
OUT = ROOT / "lib/ohio-intelligence/accepted-snapshot.json"
ARTIFACT = ROOT / "artifacts/oh-con-001-public-snapshot.json"
GENERATION_KEYS = frozenset({"generatedAt", "fingerprint", "generated_at"})
TRADES = ("el", "hv", "hy", "pl", "re")
PREFIX = {"el": "EL", "hv": "HV", "hy": "HY", "pl": "PL", "re": "RE"}


def dumps(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha_body(obj: dict[str, Any]) -> str:
    body = {k: v for k, v in obj.items() if k not in GENERATION_KEYS}
    clocks = copy.deepcopy(body.get("clocks") or {})
    clocks.pop("generatedAt", None)
    body["clocks"] = clocks
    return hashlib.sha256(dumps(body).encode("utf-8")).hexdigest()


def load_csv(path: Path) -> list[dict[str, str]]:
    data = path.read_bytes()
    sha_path = path.with_name(path.name.replace(".csv", ".sha256"))
    claimed = sha_path.read_text(encoding="utf-8").strip()
    digest = hashlib.sha256(data).hexdigest()
    if digest != claimed:
        raise SystemExit(f"checksum mismatch {path.name}: {digest} != {claimed}")
    return list(csv.DictReader(data.decode("utf-8-sig").splitlines()))


def cred_parts(formatted: str) -> tuple[str, str]:
    m = re.match(r"^([A-Z]{2})\.(\d+)$", (formatted or "").strip(), re.I)
    if not m:
        return "", ""
    return m.group(1).upper(), m.group(2)


def status_bucket(raw: str) -> str:
    s = re.sub(r"\s+", " ", (raw or "").strip().upper())
    if s == "ACTIVE":
        return "ACTIVE"
    if "ACTIVE IN RENEWAL" in s:
        return "ACTIVE_IN_RENEWAL"
    if "INACTIVE" in s or s == "ESCROW":
        return "INACTIVE"
    if "EXPIRED" in s:
        return "EXPIRED"
    if "SUSPEND" in s:
        return "SUSPENDED"
    if "REVOK" in s:
        return "REVOKED"
    if not s:
        return "BLANK"
    return "OTHER"


def trade_block(rows: list[dict[str, str]], slug: str) -> dict[str, Any]:
    formatted: set[str] = set()
    numeric: set[str] = set()
    persons: set[str] = set()
    companies: set[str] = set()
    status_rows = Counter()
    status_unique = Counter()
    escrow_rows = 0
    blank_company = 0
    seen_cred_status: dict[str, str] = {}
    for row in rows:
        cred = (row.get("FormattedCredential") or "").strip()
        pref, num = cred_parts(cred)
        formatted.add(cred)
        if num:
            numeric.add(num)
        persons.add(((row.get("Name") or "").strip().upper() + "|" + (row.get("LastName") or "").strip().upper()))
        co = (row.get("Company") or "").strip()
        if co.upper() == "ESCROW":
            escrow_rows += 1
        elif co:
            companies.add(co.upper())
        else:
            blank_company += 1
        bucket = status_bucket(row.get("Status") or "")
        status_rows[bucket] += 1
        if cred and cred not in seen_cred_status:
            seen_cred_status[cred] = bucket
    for bucket in seen_cred_status.values():
        status_unique[bucket] += 1
    return {
        "OH_OCILB_ROWS": len(rows),
        "OH_OCILB_DISTINCT_CREDENTIALS": len(formatted),
        "OH_OCILB_DISTINCT_NUMERIC_IDS": len(numeric),
        "OH_OCILB_DISTINCT_PERSON_KEYS": len(persons),
        "OH_OCILB_DISTINCT_COMPANY_NAMES": len(companies),
        "escrow_company_rows": escrow_rows,
        "blank_company_rows": blank_company,
        "status_row_bucket": dict(status_rows),
        "status_distinct_credential_bucket": dict(status_unique),
        "prefix": PREFIX[slug],
        "formatted_punctuation": f"{PREFIX[slug]}.#####",
    }


def build() -> dict[str, Any]:
    ocilb_man = json.loads(OCILB_MANIFEST.read_text(encoding="utf-8"))
    sfm_man = json.loads(SFM_MANIFEST.read_text(encoding="utf-8"))
    by_trade = {t: load_csv(OCILB_RAW / f"ocilb_{t}_roster.csv") for t in TRADES}
    all_rows: list[dict[str, str]] = []
    for t in TRADES:
        all_rows.extend(by_trade[t])

    formatted: set[str] = set()
    numeric: set[str] = set()
    persons: set[str] = set()
    companies: set[str] = set()
    numeric_to_trades: dict[str, set[str]] = defaultdict(set)
    numeric_to_person: dict[str, set[str]] = defaultdict(set)
    person_to_numeric: dict[str, set[str]] = defaultdict(set)
    bridges: set[tuple[str, str]] = set()
    status_rows = Counter()
    escrow_rows = 0
    for row in all_rows:
        cred = (row.get("FormattedCredential") or "").strip()
        pref, num = cred_parts(cred)
        formatted.add(cred)
        pk = (row.get("Name") or "").strip().upper() + "|" + (row.get("LastName") or "").strip().upper()
        persons.add(pk)
        if num:
            numeric.add(num)
            numeric_to_trades[num].add(pref)
            numeric_to_person[num].add(pk)
            person_to_numeric[pk].add(num)
        co = (row.get("Company") or "").strip()
        if co.upper() == "ESCROW":
            escrow_rows += 1
        elif co:
            companies.add(co.upper())
            if cred:
                bridges.add((cred, co.upper()))
        status_rows[status_bucket(row.get("Status") or "")] += 1

    multi_trade = sum(1 for trades in numeric_to_trades.values() if len(trades) > 1)
    person_multi_numeric = sum(1 for ids in person_to_numeric.values() if len(ids) > 1)
    numeric_multi_person = sum(1 for p in numeric_to_person.values() if len(p) > 1)

    fire_co = load_csv(SFM_RAW / "sfm_fire_companies_roster.csv")
    fire_ind = load_csv(SFM_RAW / "sfm_fire_individuals_roster.csv")
    fire_co_cred = {(r.get("Credential") or "").strip() for r in fire_co}
    fire_co_status = Counter(status_bucket(r.get("License Status") or "") for r in fire_co)
    fire_co_type = Counter((r.get("Licensee Type") or "").strip() for r in fire_co)
    fire_ind_cred = {(r.get("Credential") or "").strip() for r in fire_ind}
    fire_ind_names = {(r.get("Name") or "").strip().upper() for r in fire_ind}
    fire_ind_cat = Counter((r.get("Category") or "").strip() or "(blank)" for r in fire_ind)
    fire_ind_cred_status: dict[str, set[str]] = defaultdict(set)
    for r in fire_ind:
        c = (r.get("Credential") or "").strip()
        fire_ind_cred_status[c].add(status_bucket(r.get("License Status") or ""))
    fire_ind_status_cred = Counter()
    mixed_status = 0
    for c, st in fire_ind_cred_status.items():
        if len(st) == 1:
            fire_ind_status_cred[next(iter(st))] += 1
        else:
            mixed_status += 1
            fire_ind_status_cred["MIXED"] += 1

    trades_meta = {t: next(x for x in ocilb_man["trades"] if x["trade"] == t) for t in TRADES}
    retrieved = ocilb_man["retrievedAt"]
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    files = {
        t: {
            "path": f"data/ohio/ocilb/raw/ocilb_{t}_roster.csv",
            "sha256": trades_meta[t]["sha256"],
            "bytes": trades_meta[t]["bytes"],
            "sourceRecordCount": trades_meta[t]["sourceRecordCount"],
            "rosterIdnt": trades_meta[t]["rosterIdnt"],
        }
        for t in TRADES
    }
    el = trade_block(by_trade["el"], "el")
    hv = trade_block(by_trade["hv"], "hv")
    hy = trade_block(by_trade["hy"], "hy")
    pl = trade_block(by_trade["pl"], "pl")
    re = trade_block(by_trade["re"], "re")

    snap: dict[str, Any] = {
        "version": "contractor-oh-state-intel-v1",
        "ticket": "OH-CON-001",
        "publicationPath": "/ohio",
        "canonical": "https://www.contractortrusthub.com/ohio",
        "generatedAt": generated,
        "snapshotAsOf": "2026-09-18",
        "hero": {
            "universe_label": "Distinct OCILB numeric license identities in the current no-fee listing",
            "universe_value": len(numeric),
            "universe_hint": "Not 12,461 trade-credential rows. Not a statewide general-contractor census. Not every Ohio residential contractor. One person can hold multiple trade prefixes on the same numeric identity.",
            "electrical_label": "OCILB electrical credentials (EL.)",
            "electrical_value": el["OH_OCILB_DISTINCT_CREDENTIALS"],
            "fire_installer_label": "Distinct SFM fire-protection individual certificate IDs",
            "fire_installer_value": len(fire_ind_cred - {""}),
        },
        "clocks": {
            "ocilb_roster_generated_via": "elicense4.com.ohio.gov Generate Roster (OCLIB No Fee Required)",
            "ocilb_roster_retrievedAt": retrieved,
            "ocilb_fileDownload": "https://elicense4.com.ohio.gov/Lookup/FileDownload.aspx",
            "sfm_roster_retrievedAt": sfm_man["retrievedAt"],
            "sfm_generate": "https://elicense7.com.ohio.gov/Lookup/GenerateRoster.aspx",
            "retrievedAt": retrieved,
            "snapshotAsOf": "2026-09-18",
            "generatedAt": generated,
            "retrievedAt_is_not_license_effective_date": True,
            "current_listing_is_not_historical_inactive_census": True,
        },
        "regulatory_model": {
            "primary_regulator": "Ohio Department of Commerce — Division of Industrial Compliance",
            "primary_board": "Ohio Construction Industry Licensing Board (OCILB)",
            "statute": "ORC Chapter 4740",
            "not_universal_contractor_license": True,
            "not_statewide_general_contractor_license": True,
            "not_universal_residential_contractor_license": True,
            "licensed_construction_project_excludes_residential_building": True,
            "OH_GENERAL_CONTRACTOR_STATE_ROSTER_STATUS": "UNSUPPORTED",
            "trades": ["Electrical", "HVAC", "Hydronics", "Plumbing", "Refrigeration"],
            "prefixes_source_native": ["EL.", "HV.", "HY.", "PL.", "RE."],
            "license_holder_is_individual": True,
            "company_association_is_not_company_license": True,
            "credential_ne_company": True,
            "company_ne_license_holder": True,
            "local_registration_may_apply": True,
            "local_registration_ne_ocilb_license": True,
        },
        "ocilb": {
            "OH_OCILB_ROSTER_STATUS": "ACQUIRED_CURRENT_NO_FEE_LISTING",
            "OH_OCILB_ALL_TRADE_CREDENTIAL_ROWS": len(all_rows),
            "OH_OCILB_DISTINCT_FORMATTED_CREDENTIALS": len(formatted),
            "OH_OCILB_DISTINCT_LICENSE_HOLDERS": len(numeric),
            "OH_OCILB_DISTINCT_LICENSEE_PERSONS": len(persons),
            "OH_OCILB_DISTINCT_ASSOCIATED_COMPANY_NAMES": len(companies),
            "SOURCE_CREDENTIAL_ROWS": len(all_rows),
            "DISTINCT_FORMATTED_CREDENTIALS": len(formatted),
            "DISTINCT_NUMERIC_LICENSE_HOLDERS": len(numeric),
            "DISTINCT_LICENSEE_PERSONS": len(persons),
            "DISTINCT_ASSOCIATED_COMPANIES": len(companies),
            "do_not_sum_trade_rows_as_unique_contractors": True,
            "escrow_encoded_as_company_string_rows": escrow_rows,
            "escrow_is_not_a_company": True,
            "search_url": "https://elicense4.com.ohio.gov/Lookup/LicenseLookup.aspx",
            "generate_roster_url": "https://elicense4.com.ohio.gov/Lookup/GenerateRoster.aspx",
            "files": files,
            "columns": [
                "FormattedCredential",
                "Name",
                "LastName",
                "Type",
                "Status",
                "State",
                "County",
                "Effective Date",
                "Expiration Date",
                "Company",
                "Company Address",
                "Company Address 2",
                "Company City",
                "Company State",
                "Company Zip",
                "Company Phone",
                "Company Fax",
                "Company Email",
            ],
            "training_agency_excluded": True,
            "current_listing_statuses_observed": ["ACTIVE", "ACTIVE IN RENEWAL"],
            "inactive_expired_suspended_revoked_not_in_current_listing": True,
            "missing_inactive_in_current_listing_is_not_zero_inactive_licenses": True,
        },
        "electrical": {
            **el,
            "OH_OCILB_ELECTRICAL_ROWS": el["OH_OCILB_ROWS"],
            "OH_OCILB_ELECTRICAL_DISTINCT_CREDENTIALS": el["OH_OCILB_DISTINCT_CREDENTIALS"],
        },
        "hvac": {
            **hv,
            "OH_OCILB_HVAC_ROWS": hv["OH_OCILB_ROWS"],
            "OH_OCILB_HVAC_DISTINCT_CREDENTIALS": hv["OH_OCILB_DISTINCT_CREDENTIALS"],
        },
        "hydronics": {
            **hy,
            "OH_OCILB_HYDRONICS_ROWS": hy["OH_OCILB_ROWS"],
            "OH_OCILB_HYDRONICS_DISTINCT_CREDENTIALS": hy["OH_OCILB_DISTINCT_CREDENTIALS"],
        },
        "plumbing": {
            **pl,
            "OH_OCILB_PLUMBING_ROWS": pl["OH_OCILB_ROWS"],
            "OH_OCILB_PLUMBING_DISTINCT_CREDENTIALS": pl["OH_OCILB_DISTINCT_CREDENTIALS"],
        },
        "refrigeration": {
            **re,
            "OH_OCILB_REFRIGERATION_ROWS": re["OH_OCILB_ROWS"],
            "OH_OCILB_REFRIGERATION_DISTINCT_CREDENTIALS": re["OH_OCILB_DISTINCT_CREDENTIALS"],
        },
        "multi_trade": {
            "OH_OCILB_MULTI_TRADE_NUMERIC_HOLDERS": multi_trade,
            "person_key_with_multiple_numeric_ids": person_multi_numeric,
            "numeric_id_with_multiple_person_keys": numeric_multi_person,
            "do_not_merge_persons_by_name": True,
            "same_numeric_id_may_span_trade_prefixes": True,
            "example": "HY.10621 and PL.10621 are the same numeric identity across trades",
        },
        "status": {
            "OH_OCILB_ACTIVE_CREDENTIAL_ROWS": status_rows.get("ACTIVE", 0),
            "OH_OCILB_ACTIVE_IN_RENEWAL_ROWS": status_rows.get("ACTIVE_IN_RENEWAL", 0),
            "OH_OCILB_INACTIVE_ROWS": status_rows.get("INACTIVE", 0),
            "OH_OCILB_EXPIRED_ROWS": status_rows.get("EXPIRED", 0),
            "OH_OCILB_SUSPENDED_ROWS": status_rows.get("SUSPENDED", 0),
            "OH_OCILB_REVOKED_ROWS": status_rows.get("REVOKED", 0),
            "OH_OCILB_STATUS_OTHER_ROWS": status_rows.get("OTHER", 0) + status_rows.get("BLANK", 0),
            "raw_and_normalized_separate": True,
            "active_in_renewal_is_not_expired": True,
            "active_in_renewal_is_not_inactive": True,
            "do_not_add_incompatible_trade_rows_as_active_contractors": True,
        },
        "company_relationships": {
            "OH_OCILB_COMPANY_LOOKUP_STATUS": "OPEN_SEARCH_ONLY",
            "OH_OCILB_COMPANY_LOOKUP_URL": "https://apps.com.ohio.gov/dico/CompanyLicenseeLookup/",
            "OH_OCILB_EXACT_LICENSEE_COMPANY_RELATIONSHIPS": len(bridges),
            "bridge_source": "OCILB no-fee Generate Roster Company column",
            "not_fuzzy_name_match": True,
            "individual_assigned_to_contracting_company": True,
            "company_does_not_own_the_license": True,
            "employer_lookup_ui_not_bulk_acquired": True,
        },
        "license_lookup_fields_observed": [
            "individual name",
            "company",
            "public address",
            "formatted credential",
            "license type",
            "issue date",
            "expiration date",
            "status",
            "status reason",
            "continuing education",
            "renewal requirements",
        ],
        "local_registration": {
            "local_may_regulate_or_require_registration": True,
            "local_registration_ne_ocilb_license": True,
            "municipal_gc_registration_ne_statewide_license": True,
            "columbus_contractor_ne_statewide_credential": True,
            "no_local_harvest_this_ticket": True,
        },
        "discipline": {
            "OH_OCILB_DISCIPLINE_COVERAGE": "OPEN_SEARCH_ONLY",
            "OH_OCILB_DISCIPLINE_DOCUMENT_ROWS": None,
            "OH_OCILB_UNIQUE_DISCIPLINARY_MATTERS": None,
            "OH_OCILB_SUSPENSION_MATTERS": None,
            "OH_OCILB_REVOCATION_MATTERS": None,
            "OH_OCILB_FINE_MATTERS": None,
            "OH_OCILB_ADDITIONAL_CE_MATTERS": None,
            "OH_OCILB_REFUSAL_MATTERS": None,
            "OH_OCILB_EXACT_LICENSE_ATTACHMENTS": 0,
            "complaint_ne_disciplinary_action": True,
            "notice_ne_final_order": True,
            "fine_ne_revocation": True,
            "suspension_ne_revocation": True,
            "additional_ce_ne_suspension": True,
            "criminal_conviction_ne_administrative_action": True,
            "search_only_is_not_zero": True,
        },
        "unlicensed": {
            "OH_OCILB_UNLICENSED_ENFORCEMENT_COVERAGE": "OPEN_SEARCH_ONLY",
            "OH_OCILB_UNLICENSED_ENFORCEMENT_ROWS": None,
            "statute": "ORC 4740.13 / 4740.16",
            "ag_may_seek_injunction": True,
            "no_news_derived_blacklist": True,
            "search_only_is_not_zero": True,
        },
        "low_voltage_firewall": {
            "orc_4740_13_d": True,
            "fire_alarm_lt_50v_excluded_from_ocilb_electrical": True,
            "burglar_alarm_cabling_teledata_sound_communication_landscape_lt_50v_excluded": True,
            "absence_of_el_credential_does_not_prove_low_voltage_fire_alarm_unlicensed": True,
            "research_sfm_certification_path": True,
        },
        "fire_protection": {
            "OH_FIRE_INSTALLER_ROSTER_STATUS": "ACQUIRED_CURRENT_NO_FEE_LISTING",
            "OH_FIRE_INSTALLER_ROWS": len(fire_ind),
            "OH_FIRE_INSTALLER_DISTINCT_CERT_IDS": len(fire_ind_cred - {""}),
            "OH_FIRE_INSTALLER_DISTINCT_NAMES": len(fire_ind_names - {""}),
            "OH_FIRE_INSTALLER_STATUS_DISTINCT_CERTS": dict(fire_ind_status_cred),
            "OH_FIRE_INSTALLER_MIXED_STATUS_CERTS": mixed_status,
            "OH_FIRE_COMPANY_CERT_ROWS": len(fire_co),
            "OH_FIRE_COMPANY_DISTINCT_CERT_IDS": len(fire_co_cred - {""}),
            "OH_FIRE_COMPANY_STATUS": dict(fire_co_status),
            "OH_FIRE_COMPANY_TYPES": dict(fire_co_type),
            "OH_FIRE_DESIGNER_ROWS": None,
            "OH_FIRE_WATER_BASED_DESIGNER_ROWS": None,
            "OH_FIRE_ALARM_DESIGNER_ROWS": None,
            "OH_FIRE_SPECIAL_HAZARDS_DESIGNER_ROWS": None,
            "OH_FIRE_DESIGNER_COVERAGE": "OPEN_SEARCH_ONLY",
            "bbs_public_lookup_future_update": True,
            "installer_ne_company": True,
            "installer_ne_designer": True,
            "designer_ne_ocilb_contractor": True,
            "sfm_ne_ocilb": True,
            "category_rows_are_not_unique_installers": True,
            "largest_individual_category": "Fire Alarms / Detection",
            "largest_individual_category_rows": fire_ind_cat.get("Fire Alarms / Detection", 0),
            "individual_prefix": "54.",
            "company_prefixes": ["50.", "52.", "53."],
            "search_url": "https://elicense7.com.ohio.gov/Lookup/LicenseLookup.aspx",
            "files": {
                "companies": {
                    "path": "data/ohio/sfm/raw/sfm_fire_companies_roster.csv",
                    "sha256": next(x["sha256"] for x in sfm_man["rosters"] if x["slug"] == "fire_companies"),
                    "bytes": next(x["bytes"] for x in sfm_man["rosters"] if x["slug"] == "fire_companies"),
                },
                "individuals": {
                    "path": "data/ohio/sfm/raw/sfm_fire_individuals_roster.csv",
                    "sha256": next(x["sha256"] for x in sfm_man["rosters"] if x["slug"] == "fire_individuals"),
                    "bytes": next(x["bytes"] for x in sfm_man["rosters"] if x["slug"] == "fire_individuals"),
                },
            },
        },
        "prevailing_wage": {
            "OH_PREVAILING_WAGE_DEBARMENT_ROWS": None,
            "OH_PREVAILING_WAGE_COVERAGE": "RATES_PORTAL_OHID_NO_PUBLIC_CONTRACTOR_ENFORCEMENT_CATALOG",
            "portal": "https://pwr.com.ohio.gov/",
            "rates_are_not_contractor_identities": True,
            "search_only_is_not_zero": True,
        },
        "permits": {
            "OH_BUILDING_PERMIT_CAPABILITY": "LOCAL_OR_FRAGMENTED",
            "no_statewide_permit_census": True,
            "no_local_permit_acquisition_this_ticket": True,
        },
        "identity": {
            "preferred": "exact OCILB formatted credential (EL./HV./HY./PL./RE.) or exact numeric license identity",
            "EXACT_OCILB_FORMATTED_CREDENTIALS": len(formatted),
            "EXACT_OCILB_NUMERIC_IDENTITIES": len(numeric),
            "EXACT_OCILB_PERSON_COMPANY_BRIDGES": len(bridges),
            "EXACT_SFM_INSTALLER_CERT_IDS": len(fire_ind_cred - {""}),
            "EXACT_SFM_COMPANY_CERT_IDS": len(fire_co_cred - {""}),
            "EXACT_SOURCE_NATIVE_CROSSWALKS": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "NAME_ONLY_UNSAFE": 0,
            "REVIEW_REQUIRED": 0,
            "do_not_attach_adverse_by_name": True,
        },
        "adverse_publication": {
            "ADVERSE_SOURCES_FOUND": 3,
            "ADVERSE_SOURCES_ACQUIRED": 0,
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
            "REMAINING_ADVERSE_GAPS": [
                "OCILB discipline bulk catalog",
                "unlicensed injunction catalog",
                "prevailing-wage contractor enforcement catalog",
            ],
            "WITHHELD_REASON_COUNTS": {"OPEN_SEARCH_ONLY": 3},
            "do_not_add_licensing_fire_discipline_into_one_total": True,
        },
        "expansion_ledger": {
            "NET_NEW_STATE_RESEARCH_IDENTITIES": len(numeric),
            "NET_NEW_STATE_RESEARCH_IDENTITIES_definition": "Distinct OCILB numeric license identities in the current no-fee listing. Not trade-credential row sum. Not SFM certificates. Not canonical organizations and not public profiles.",
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_CONTRACTOR_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "CLAIM_ELIGIBILITY_BROADENED": False,
        },
        "gate": {"live_cohort_not_inflated": True},
        "no_local_ohio_routes": True,
        "no_ranking": True,
        "no_trust_score": True,
        "local_work_needed_now": "NO",
        "semantic_guardrails": [
            "OCILB != statewide general-contractor license",
            "OCILB != universal residential-contractor license",
            "five-trade credential sum != unique contractors",
            "licensed individual != contracting company",
            "credential != company",
            "ACTIVE IN RENEWAL != expired",
            "ACTIVE IN RENEWAL != inactive",
            "ESCROW company string != contracting company",
            "Company lookup UI != fuzzy name match",
            "SFM installer != OCILB electrical contractor",
            "SFM company != SFM individual",
            "BBS designer != installer != OCILB contractor",
            "low-voltage fire alarm != automatically OCILB EL",
            "absence of EL. != proof a fire-alarm contractor is unlicensed",
            "prevailing-wage rates != contractor identities",
            "permits LOCAL_OR_FRAGMENTED",
            "discipline search-only != zero",
            "unlicensed enforcement search-only != zero",
            "NO TRUST SCORE",
            "NO COLUMBUS CLEVELAND CINCINNATI TOLEDO AKRON DAYTON INTEL ROUTES",
            "NO COMBINED OCILB+SFM+DISCIPLINE TOTAL",
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
        existing = json.loads(OUT.read_text(encoding="utf-8"))
        if sha_body(existing) != existing["fingerprint"]:
            raise SystemExit("stored fingerprint drifted from body")
        if sha_body(snap) != existing["fingerprint"]:
            raise SystemExit(f"rebuild fingerprint {sha_body(snap)} != stored {existing['fingerprint']}")
        print("check PASS", existing["fingerprint"])
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(snap, indent=2, ensure_ascii=False) + "\n"
    OUT.write_text(text, encoding="utf-8")
    ARTIFACT.write_text(text, encoding="utf-8")
    print("wrote", OUT, snap["fingerprint"])
    print("hero", snap["hero"]["universe_value"], "el", snap["electrical"]["OH_OCILB_ELECTRICAL_DISTINCT_CREDENTIALS"])


if __name__ == "__main__":
    main()
