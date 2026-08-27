"""Miami-Dade CTQB / Certificate of Competency importer.

EnerGov Consumer Protection business licenses are not CTQB COCs.
Certificate of eligibility is not silently a COC.
Journeyman is not contractor company authorization.
"""
from __future__ import annotations

import re
from typing import Any

from ingest.enhanced_county import normalize_full_license, parse_money
from ingest.mdc_contractor_number import is_agency_phone

PARSER_VERSION = "mdc-ctqb-credentials-v1"
SOURCE_SYSTEM = "mdc_ctqb_coc"
REFUSED_SYSTEMS = frozenset({"mdc_energov_css", "energov", "consumer_protection"})

HEADER_ALIASES = {
    "local_credential_key": [
        "coc_number",
        "certificate_number",
        "cert_no",
        "license_number",
        "local_credential_key",
        "contractor_license",
    ],
    "classification_raw": ["classification", "class", "category", "trade"],
    "credential_type": ["credential_type", "type", "record_type", "certificate_type"],
    "person_name_raw": ["person", "person_name", "qualifier", "license_holder", "name"],
    "firm_name_raw": ["company", "firm", "business_name", "company_name"],
    "qualifier_name_raw": ["qualifier", "qualifier_name"],
    "status_raw": ["status", "license_status", "current_status"],
    "issue_date": ["issue_date", "issued"],
    "renewal_date": ["renewal_date", "renewed"],
    "expiration_date": ["expiration_date", "expires", "expiration"],
    "dbpr_license_raw": ["dbpr_number", "dbpr_license", "state_license", "full_license"],
    "phone": ["phone", "business_phone", "telephone"],
    "email": ["email", "business_email"],
    "mailing_address": ["mailing_address", "mail_address", "address"],
    "physical_address": ["physical_address", "business_address"],
    "insurance_status_raw": ["insurance_status", "liability_status"],
    "insurance_expiration": ["insurance_expiration"],
    "workers_comp_status_raw": ["workers_comp", "wc_status"],
    "bond_status_raw": ["bond_status"],
    "bond_amount": ["bond_amount"],
}


def refuse_if_energov(source_system: str) -> None:
    if (source_system or "").lower() in REFUSED_SYSTEMS:
        raise ValueError("EnerGov Consumer Protection licenses are not CTQB Certificates of Competency")


def currentness(status_raw: str | None, credential_type: str | None, classification: str | None) -> str:
    t = f"{credential_type or ''} {classification or ''}".lower()
    s = (status_raw or "").lower()
    if "preempt" in s or "preempt" in t:
        return "PREEMPTED_CLASS"
    if "revok" in s:
        return "REVOKED"
    if "expir" in s or "lapsed" in s or "null and void" in s:
        return "EXPIRED"
    if "eligib" in t and "competenc" not in t:
        return "UNKNOWN"  # eligibility is not a COC; keep raw type
    if "verif" in t or "state certified" in t or "voluntary registration" in t:
        return "STATE_ENROLLED"
    if "historic" in s or "inactive" in s:
        return "HISTORICAL_LOCAL_LICENSE"
    if "active" in s or "current" in s:
        return "CURRENT_LOCAL_AUTHORIZATION"
    return "UNKNOWN"


def is_journeyman(credential_type: str | None, classification: str | None) -> bool:
    t = f"{credential_type or ''} {classification or ''}".lower()
    return "journeyman" in t or "journeymen" in t


def is_eligibility(credential_type: str | None, classification: str | None) -> bool:
    t = f"{credential_type or ''} {classification or ''}".lower()
    return "eligib" in t


def parse_ctqb_row(row: dict[str, Any], *, source_system: str = SOURCE_SYSTEM) -> dict[str, Any]:
    refuse_if_energov(source_system)
    lowered = {re.sub(r"[^a-z0-9]+", "_", str(k).lower()).strip("_"): v for k, v in row.items()}

    def pick(canon: str) -> str:
        for alias in HEADER_ALIASES.get(canon, []):
            v = lowered.get(alias)
            if v not in (None, ""):
                return str(v).strip()
        return ""

    cred_type = pick("credential_type")
    classification = pick("classification_raw")
    status = pick("status_raw")
    key = pick("local_credential_key")
    journeyman = is_journeyman(cred_type, classification)
    eligibility = is_eligibility(cred_type, classification)
    phone = pick("phone")
    return {
        "source_system": source_system,
        "county_slug": "miami-dade",
        "jurisdiction_slug": "unincorporated" if "verif" in cred_type.lower() else "countywide",
        "local_credential_key": key,
        "certificate_number_raw": key,
        "classification_raw": classification or None,
        "credential_type": cred_type or None,
        "is_journeyman": journeyman,
        "is_eligibility_not_coc": eligibility,
        "person_name_raw": pick("person_name_raw") or None,
        "firm_name_raw": None if journeyman else (pick("firm_name_raw") or None),
        "qualifier_name_raw": pick("qualifier_name_raw") or None,
        "status_raw": status or "unknown",
        "currentness": currentness(status, cred_type, classification),
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
        "contractor_company_authorization": bool(key) and not journeyman and not eligibility,
    }
