"""Fail-closed policy for Florida DBPR unlicensed-activity evidence."""

from __future__ import annotations

from typing import Any, Mapping

SOURCE_SYSTEM = "fl_dbpr"
SOURCE_DATASET = "contractor_disc_ula"
IDENTITY_STATE = "UNRESOLVED"
IDENTITY_METHOD = "NO_OFFICIAL_IDENTITY_IDENTIFIER"
RESOLVER_VERSION = "fl-dbpr-ula-identity-v1"
PUBLICATION_STATE = "INTERNAL"
REVIEW_REASON = "ULA_SOURCE_HAS_NO_AUTHORITATIVE_RESPONDENT_IDENTIFIER"

IDENTITY_EVIDENCE = {
    "authoritative_respondent_identifier_present": False,
    "complaint_number_is_matter_identifier_only": True,
    "automatic_name_address_linkage_prohibited": True,
}


def identity_policy() -> dict[str, Any]:
    """Return the invariant standalone-evidence identity policy."""

    return {
        "identity_state": IDENTITY_STATE,
        "identity_method": IDENTITY_METHOD,
        "resolver_version": RESOLVER_VERSION,
        "license_id": None,
        "contractor_id": None,
        "resolved_license_external_key": None,
        "publication_state": PUBLICATION_STATE,
        "correction_hold": False,
        "retraction_hold": False,
        "review_reason": REVIEW_REASON,
        "identity_evidence": dict(IDENTITY_EVIDENCE),
    }


def semantic_category(row_or_disposition: Mapping[str, Any] | str | None) -> str:
    """Classify official terminology for audit/display QA without rewriting it."""

    if isinstance(row_or_disposition, Mapping):
        value = str(row_or_disposition.get("Disposition") or "").strip()
    else:
        value = str(row_or_disposition or "").strip()
    mapping = {
        "Final Order": "FINAL_ORDER",
        "Citation filed": "CITATION",
        "Notice to Cease & Desist Issued": "ORDER",
        "Mandate": "ORDER",
        "Dismissed": "DISMISSED",
        "No violation found": "DISMISSED",
        "Closed after legal review": "CLOSED_ADMINISTRATIVE",
        "Duplicate Complaint": "CLOSED_ADMINISTRATIVE",
        "Civil Matter - No Jurisdiction": "CLOSED_ADMINISTRATIVE",
        "Insufficient Evidence": "INSUFFICIENT_EVIDENCE",
        "Insufficient Evidence to Prosecute": "INSUFFICIENT_EVIDENCE",
        "": "COMPLAINT_INVESTIGATION",
    }
    return mapping.get(value, "UNKNOWN")


def refresh_decision(
    *, unchanged_snapshot_exists: bool, exact_observation_exists: bool,
    logical_group_exists: bool,
) -> str:
    """Plan a fail-closed refresh without identity or publication side effects."""

    if unchanged_snapshot_exists:
        return "NOOP_UNCHANGED_SNAPSHOT"
    if exact_observation_exists:
        return "NEW_OCCURRENCE_ONLY"
    if logical_group_exists:
        return "REVISION_REVIEW_REQUIRED"
    return "NEW_STANDALONE_EVIDENCE"
