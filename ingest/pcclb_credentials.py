"""Pinellas PCCLB local credential importer.

C- = local certified contractor
J- = journeyman (not contractor company authorization)
I- = state-registered enrollment IF present
State-certified contractors absent from PCCLB are NOT unlicensed.
"""
from __future__ import annotations

import re
from typing import Any

from ingest.enhanced_county import normalize_full_license, parse_money
from ingest.mdc_contractor_number import is_agency_phone

PARSER_VERSION = "pcclb-credentials-v1"
SOURCE_SYSTEM = "pcclb_local"

PREFIX_C = re.compile(r"^C[-]?", re.I)
PREFIX_J = re.compile(r"^J[-]?", re.I)
PREFIX_I = re.compile(r"^I[-]?", re.I)

HEADER_ALIASES = {
    "local_credential_key": ["license", "license_number", "local_license", "credential_id", "pcclb_number"],
    "classification_raw": ["classification", "class", "license_type", "trade"],
    "person_name_raw": ["contractor", "person", "name", "license_holder"],
    "firm_name_raw": ["business_name", "company", "firm"],
    "status_raw": ["status", "license_status"],
    "issue_date": ["issue_date", "issued"],
    "renewal_date": ["renewal_date"],
    "expiration_date": ["expiration_date", "expires", "expiration"],
    "qualifier_name_raw": ["qualifier"],
    "dbpr_license_raw": ["dbpr_number", "state_license", "full_license"],
    "phone": ["phone", "contact_info", "contact"],
    "email": ["email"],
    "mailing_address": ["mailing_address", "address"],
    "physical_address": ["physical_address", "business_address"],
    "insurance_status_raw": ["insurance_status"],
    "insurance_expiration": ["insurance_expiration"],
    "workers_comp_status_raw": ["workers_comp", "wc_status"],
    "bond_status_raw": ["bond_status"],
    "bond_amount": ["bond_amount"],
}


def license_kind(raw: str | None, classification: str | None) -> str:
    t = f"{raw or ''} {classification or ''}".upper()
    if "JOURNEY" in t or PREFIX_J.match((raw or "").strip()):
        return "journeyman"
    if PREFIX_I.match((raw or "").strip()) or "STATE REGISTERED" in t or "I-LICENSE" in t.replace(" ", ""):
        return "state_registered"
    if PREFIX_C.match((raw or "").strip()) or "COUNTY CERTIFIED" in t or "LOCALLY CERTIFIED" in t:
        return "local_certified"
    return "unknown"


def currentness(status_raw: str | None, kind: str, classification: str | None) -> str:
    s = (status_raw or "").strip().lower()
    t = (classification or "").lower()
    letter = s if len(s) == 1 else ""
    if "preempt" in s or "preempt" in t:
        return "PREEMPTED_CLASS"
    if letter == "r" or "revok" in s:
        return "REVOKED"
    if letter == "e" or "expir" in s:
        return "EXPIRED"
    if letter in {"i", "o"} or "inactive" in s or "hold" in s:
        return "HISTORICAL_LOCAL_LICENSE"
    if letter == "s" or "suspend" in s:
        return "REVOKED"
    active = letter == "a" or "active" in s or s == "current"
    if not active:
        return "UNKNOWN"
    if kind == "state_registered":
        return "STATE_ENROLLED"
    if kind in {"journeyman", "local_certified"}:
        return "CURRENT_LOCAL_AUTHORIZATION"
    return "UNKNOWN"


def parse_pcclb_row(row: dict[str, Any], *, source_system: str = SOURCE_SYSTEM) -> dict[str, Any]:
    lowered = {re.sub(r"[^a-z0-9]+", "_", str(k).lower()).strip("_"): v for k, v in row.items()}

    def pick(canon: str) -> str:
        for alias in HEADER_ALIASES.get(canon, []):
            v = lowered.get(alias)
            if v not in (None, ""):
                return str(v).strip()
        return ""

    key = pick("local_credential_key")
    classification = pick("classification_raw")
    kind = license_kind(key, classification)
    status = pick("status_raw")
    phone = pick("phone")
    return {
        "source_system": source_system,
        "county_slug": "pinellas",
        "jurisdiction_slug": "countywide",
        "local_credential_key": key,
        "certificate_number_raw": key,
        "classification_raw": classification or None,
        "license_kind": kind,
        "is_journeyman": kind == "journeyman",
        "person_name_raw": pick("person_name_raw") or None,
        "firm_name_raw": None if kind == "journeyman" else (pick("firm_name_raw") or None),
        "qualifier_name_raw": pick("qualifier_name_raw") or None,
        "status_raw": status or "unknown",
        "currentness": currentness(status, kind, classification),
        "issue_date": pick("issue_date") or None,
        "renewal_date": pick("renewal_date") or None,
        "expiration_date": pick("expiration_date") or None,
        "dbpr_license_normalized": normalize_full_license(pick("dbpr_license_raw")) or None,
        "insurance_status_raw": pick("insurance_status_raw") or None,
        "insurance_expiration": pick("insurance_expiration") or None,
        "workers_comp_status_raw": pick("workers_comp_status_raw") or None,
        "bond_status_raw": pick("bond_status_raw") or None,
        "bond_amount": parse_money(pick("bond_amount"))[1],
        "mailing_address": pick("mailing_address") or None,
        "physical_address": pick("physical_address") or None,
        "phone": None if is_agency_phone(phone) else (phone or None),
        "email": pick("email") or None,
        "parser_version": PARSER_VERSION,
        "raw_payload": row,
        "contractor_company_authorization": kind == "local_certified",
        "absent_state_certified_is_not_unlicensed": True,
    }
