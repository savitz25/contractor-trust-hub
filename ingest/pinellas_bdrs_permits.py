"""Pinellas BDRS Accela permit importer.

Key remains (source_system, source_jurisdiction, permit_number).
Not countywide. Partner cities stay distinct jurisdictions.
Belleair Bluffs after 2025-08-15 is SAFEbuilt, not this warehouse.
"""
from __future__ import annotations

import re
from typing import Any

from ingest.enhanced_county import normalize_full_license, parse_money, permit_record_key
from ingest.mdc_contractor_number import classify_contractor_number, identity_from_namespace

PARSER_VERSION = "pinellas-bdrs-permits-v1"
SOURCE_SYSTEM = "pinellas_bdrs_accela"
BELLEAIR_BLUFFS_BDRS_END = "2025-08-15"

PARTNER_SLUGS = {
    "belleair beach": "belleair-beach",
    "belleair shore": "belleair-shore",
    "belleair shores": "belleair-shore",
    "indian rocks beach": "indian-rocks-beach",
    "kenneth city": "kenneth-city",
    "oldsmar": "oldsmar",
    "safety harbor": "safety-harbor",
    "unincorporated": "unincorporated",
    "unincorporated pinellas": "unincorporated",
    "pinellas county": "unincorporated",
}

HEADER_ALIASES = {
    "permit_number": ["permit_number", "permitno", "permit", "record_number"],
    "source_record_id": ["accela_id", "record_id", "alt_id", "capid"],
    "jurisdiction": ["jurisdiction", "municipality", "city", "agency"],
    "property_address": ["address", "site_address", "property_address"],
    "parcel_id": ["parcel", "parcel_id", "folio"],
    "permit_type_raw": ["permit_type", "type", "work_type"],
    "work_description": ["description", "work_description", "scope"],
    "contractor_name_raw": ["contractor_name", "contractor"],
    "contractor_license_raw": ["license_number", "state_license", "dbpr_license", "contractor_license"],
    "local_contractor_id": ["local_license", "pcclb_license", "c_license"],
    "qualifier_name_raw": ["qualifier"],
    "application_date": ["application_date", "opened_date", "file_date"],
    "issue_date": ["issue_date", "issued"],
    "expiration_date": ["expiration_date", "expires"],
    "final_date": ["final_date", "completed_date", "closed_date"],
    "status_raw": ["status", "record_status"],
    "valuation": ["valuation", "job_value", "estimated_value"],
}


def jurisdiction_slug(raw: str | None) -> str:
    n = re.sub(r"\s+", " ", (raw or "").strip().lower())
    return PARTNER_SLUGS.get(n, n.replace(" ", "-") or "unknown")


def parse_bdrs_row(row: dict[str, Any], *, source_system: str = SOURCE_SYSTEM) -> dict[str, Any]:
    lowered = {re.sub(r"[^a-z0-9]+", "_", str(k).lower()).strip("_"): v for k, v in row.items()}

    def pick(canon: str) -> str:
        for alias in HEADER_ALIASES.get(canon, []):
            v = lowered.get(alias)
            if v not in (None, ""):
                return str(v).strip()
        return ""

    jur = jurisdiction_slug(pick("jurisdiction"))
    number = pick("permit_number")
    sid = pick("source_record_id") or None
    raw_val, val = parse_money(pick("valuation"))
    lic = pick("contractor_license_raw")
    ns = classify_contractor_number(lic, pick("contractor_name_raw"))
    issue = pick("issue_date") or None
    if jur == "belleair-bluffs" and issue and issue > BELLEAIR_BLUFFS_BDRS_END:
        raise ValueError(
            "Belleair Bluffs new permits after 2025-08-15 are SAFEbuilt, not County BDRS. "
            "Do not mix warehouses."
        )
    state, method = identity_from_namespace(
        ns["namespace"],
        dbpr_exists=False,
        has_name=bool(pick("contractor_name_raw")),
    )
    return {
        "source_system": source_system,
        "source_jurisdiction": jur,
        "county_slug": "pinellas",
        "municipality": None if jur == "unincorporated" else jur,
        "permit_number": number,
        "source_record_id": sid,
        "record_key": permit_record_key(source_system, jur, number, None),
        "permit_type_raw": pick("permit_type_raw") or None,
        "work_description": pick("work_description") or None,
        "property_address": pick("property_address") or None,
        "parcel_id": pick("parcel_id") or None,
        "contractor_name_raw": pick("contractor_name_raw") or None,
        "contractor_license_raw": lic or None,
        "contractor_license_normalized": ns["normalized"] or None,
        "local_contractor_id": pick("local_contractor_id") or None,
        "qualifier_name_raw": pick("qualifier_name_raw") or None,
        "application_date": pick("application_date") or None,
        "issue_date": issue,
        "expiration_date": pick("expiration_date") or None,
        "final_date": pick("final_date") or None,
        "status_raw": pick("status_raw") or "unknown",
        "status_normalized": "unknown",
        "valuation_raw": raw_val,
        "valuation": val,
        "identity_state": state,
        "identity_method": method,
        "parser_version": PARSER_VERSION,
        "raw_payload": row,
        "dbpr_normalized_for_lookup": normalize_full_license(lic) or None,
    }
