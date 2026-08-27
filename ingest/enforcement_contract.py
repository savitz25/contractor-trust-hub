"""Regulatory & enforcement history ingest contract.

Never flatten complaint / investigation / citation / order into a single 'violation' field.
Complaint ≠ finding. Raw observation ≠ final disposition.
Public wording remains REGULATORY & ENFORCEMENT HISTORY.
"""
from __future__ import annotations

import re
from typing import Any

PARSER_VERSION = "enforcement-contract-v1"

EVENT_TYPES = (
    "complaint",
    "investigation",
    "citation",
    "administrative_fine",
    "hearing",
    "board_action",
    "magistrate_order",
    "final_order",
    "dismissal_no_action",
    "suspension",
    "revocation",
    "unlicensed_case",
)

PUBLIC_LABEL = "REGULATORY & ENFORCEMENT HISTORY"

MDC_SOURCE = "mdc_rer_contractor_enforcement"
PCCLB_SOURCE = "pcclb_enforcement"

HEADER_ALIASES = {
    "record_number": ["record_number", "case_number", "complaint_number", "citation_number", "clb_number"],
    "event_type_raw": ["event_type", "type", "record_type", "stage"],
    "contractor_license_raw": ["license", "coc", "contractor_license", "state_license"],
    "company": ["company", "firm", "business_name"],
    "allegation": ["allegation", "violation_description", "charges"],
    "status_raw": ["status", "stage_status"],
    "disposition_raw": ["disposition", "outcome", "final_action"],
    "fine_amount": ["fine", "fine_amount", "penalty"],
    "hearing_date": ["hearing_date"],
    "event_date": ["event_date", "date", "filed_date"],
}


def normalize_event_type(raw: str | None) -> str:
    s = re.sub(r"[^a-z0-9]+", " ", (raw or "").lower()).strip()
    table = {
        "complaint": "complaint",
        "investigation": "investigation",
        "cite": "citation",
        "citation": "citation",
        "clb ct": "citation",
        "administrative fine": "administrative_fine",
        "admin fine": "administrative_fine",
        "clb af": "administrative_fine",
        "expired permit": "administrative_fine",
        "clb ex": "administrative_fine",
        "hearing": "hearing",
        "board": "board_action",
        "board action": "board_action",
        "magistrate": "magistrate_order",
        "final order": "final_order",
        "order": "final_order",
        "dismiss": "dismissal_no_action",
        "no action": "dismissal_no_action",
        "nolle": "dismissal_no_action",
        "suspension": "suspension",
        "suspend": "suspension",
        "revocation": "revocation",
        "revoke": "revocation",
        "unlicensed": "unlicensed_case",
        "unlicensed contracting": "unlicensed_case",
    }
    for key, value in table.items():
        if key in s:
            return value
    return "complaint" if "complain" in s else "investigation" if s else "complaint"


def is_finding(event_type: str) -> bool:
    return event_type in {
        "final_order",
        "magistrate_order",
        "suspension",
        "revocation",
        "dismissal_no_action",
    }


def parse_enforcement_row(row: dict[str, Any], *, source_system: str, county_slug: str) -> dict[str, Any]:
    if source_system not in {MDC_SOURCE, PCCLB_SOURCE}:
        raise ValueError(f"unsupported enforcement source_system {source_system}")
    lowered = {re.sub(r"[^a-z0-9]+", "_", str(k).lower()).strip("_"): v for k, v in row.items()}

    def pick(canon: str) -> str:
        for alias in HEADER_ALIASES.get(canon, []):
            v = lowered.get(alias)
            if v not in (None, ""):
                return str(v).strip()
        return ""

    event = normalize_event_type(pick("event_type_raw") or pick("record_number"))
    rec = pick("record_number")
    return {
        "source_system": source_system,
        "county_slug": county_slug,
        "record_number": rec,
        "event_type": event,
        "event_type_raw": pick("event_type_raw") or None,
        "is_finding": is_finding(event),
        "complaint_is_not_finding": event == "complaint",
        "contractor_license_raw": pick("contractor_license_raw") or None,
        "company": pick("company") or None,
        "allegation": pick("allegation") or None,
        "status_raw": pick("status_raw") or "unknown",
        "disposition_raw": pick("disposition_raw") or None,
        "fine_amount_raw": pick("fine_amount") or None,
        "hearing_date": pick("hearing_date") or None,
        "event_date": pick("event_date") or None,
        "public_label": PUBLIC_LABEL,
        "flattened_violation_field": None,  # contract: never populate
        "parser_version": PARSER_VERSION,
        "raw_payload": row,
    }
