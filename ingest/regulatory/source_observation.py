"""Versioned identity contracts for immutable regulatory source observations.

Observation identity is source provenance identity, never license, contractor,
or publication identity. Logical matter keys are review/grouping hints only.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from typing import Any

SOURCE_OBSERVATION_ALGORITHM = "source-observation-key-v2"
LOGICAL_MATTER_ALGORITHM = "logical-matter-detail-key-v1"

FL_DISCIPLINE_FIELDS: tuple[str, ...] = (
    "License Type",
    "License Nbr",
    "Respondent Name",
    "Address Line 1",
    "Address Line 2",
    "Address Line 3",
    "City",
    "State",
    "ZIP Code",
    "County",
    "Complaint Nbr",
    "Classification",
    "Entered Date",
    "Disposition",
    "Disposition Date",
    "Discipline Date - Description",
    "Violation Code",
)

FL_LOGICAL_MATTER_FIELDS: tuple[str, ...] = (
    "Complaint Nbr",
    "License Type",
    "License Nbr",
    "Respondent Name",
    "Classification",
    "Entered Date",
    "Violation Code",
)

FL_ULA_FIELDS: tuple[str, ...] = (
    "License Type",
    "Respondent Name",
    "Address Line 1",
    "Address Line 2",
    "Address Line 3",
    "City",
    "State",
    "ZIP Code",
    "County",
    "Complaint Nbr",
    "Classification",
    "Entered Date",
    "Disposition",
    "Disposition Date",
    "Discipline Date - Description",
    "Violation Code",
)

FL_ULA_LOGICAL_MATTER_FIELDS: tuple[str, ...] = (
    "Complaint Nbr",
    "License Type",
    "Respondent Name",
    "Classification",
    "Entered Date",
    "Violation Code",
)


def canonical_source_value(value: Any) -> str:
    """Apply intentionally narrow parsing normalization.

    Null becomes the empty string, embedded CRLF/CR becomes LF, and outer
    whitespace is trimmed to match the established DBPR adapter parser. No case
    folding, punctuation removal, internal whitespace collapsing, date
    rewriting, or numeric normalization is performed.
    """

    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def canonical_source_row(
    row: Mapping[str, Any], fields: Sequence[str] = FL_DISCIPLINE_FIELDS
) -> dict[str, str]:
    """Return an ordered-field canonical row suitable for stable JSON hashing."""

    return {field: canonical_source_value(row.get(field)) for field in fields}


def _canonical_json(value: Mapping[str, str]) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def row_fingerprint_sha256(
    row: Mapping[str, Any], fields: Sequence[str] = FL_DISCIPLINE_FIELDS
) -> str:
    """Hash only the exact canonical official row."""

    return hashlib.sha256(_canonical_json(canonical_source_row(row, fields))).hexdigest()


def source_observation_key_v2(
    *,
    source_system: str,
    source_dataset: str,
    row: Mapping[str, Any],
    fields: Sequence[str] = FL_DISCIPLINE_FIELDS,
) -> str:
    """Build the durable exact source-observation identity."""

    envelope = {
        "algorithm": SOURCE_OBSERVATION_ALGORITHM,
        "source_system": canonical_source_value(source_system),
        "source_dataset": canonical_source_value(source_dataset),
        "row": canonical_source_row(row, fields),
    }
    digest = hashlib.sha256(
        json.dumps(envelope, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return f"{source_system}:{source_dataset}:v2:{digest}"


def logical_matter_detail_key_v1(
    *,
    source_system: str,
    source_dataset: str,
    row: Mapping[str, Any],
    fields: Sequence[str] = FL_LOGICAL_MATTER_FIELDS,
) -> str:
    """Build a conservative revision-review grouping key.

    Collision on this key never authorizes deduplication, supersession, evidence
    linkage, or publication.
    """

    envelope = {
        "algorithm": LOGICAL_MATTER_ALGORITHM,
        "source_system": canonical_source_value(source_system),
        "source_dataset": canonical_source_value(source_dataset),
        "row": canonical_source_row(row, fields),
    }
    digest = hashlib.sha256(
        json.dumps(envelope, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return f"{source_system}:{source_dataset}:logical-v1:{digest}"


def classify_observation(
    *, exact_observation_exists: bool, logical_group_exists: bool
) -> str:
    """Pure fail-closed decision used by loaders and tests."""

    if exact_observation_exists:
        return "EXACT_REOBSERVATION"
    if logical_group_exists:
        return "REVISION_REVIEW_REQUIRED"
    return "NEW_OBSERVATION"
