"""Fail-closed Florida Recovery Fund source policy and audit semantics."""

from __future__ import annotations

from typing import Mapping

SOURCE_SYSTEM = "fl_dbpr"
SOURCE_DATASET = "contractor_disc_rf"
PUBLICATION_STATE = "INTERNAL"
SCORING_IMPACT = 0
CONTRACTOR_LINKING_ALLOWED = False


def claim_stage(value: str | None) -> str:
    text = (value or "").strip().casefold()
    if text == "rf claim granted":
        return "CLAIM_APPROVED"
    if text == "rf claim closed":
        return "CLAIM_CLOSED"
    return "UNKNOWN"


def detail_type(value: str | None) -> str:
    text = (value or "").strip().casefold()
    if "rf reimbursement" in text:
        return "REIMBURSEMENT_RECORDED"
    if "suspend license" in text:
        return "LICENSE_SUSPENSION_RECORDED"
    return "OTHER_DETAIL"


def semantic_categories(row: Mapping[str, str]) -> dict[str, str]:
    return {
        "claim_stage": claim_stage(row.get("Disposition")),
        "detail_type": detail_type(row.get("Discipline Date - Description")),
    }


def semantic_assertions() -> dict[str, object]:
    return {
        "generalized_wrongdoing": False,
        "liability_inferred": False,
        "consumer_loss_inferred": False,
        "payment_or_amount_inferred": False,
        "scoring_impact": SCORING_IMPACT,
    }


def refresh_decision(*, unchanged_snapshot_exists: bool, exact_observation_exists: bool,
                     logical_group_exists: bool) -> str:
    if unchanged_snapshot_exists:
        return "NOOP_UNCHANGED_SNAPSHOT"
    if exact_observation_exists:
        return "NEW_OCCURRENCE_ONLY"
    if logical_group_exists:
        return "REVISION_REVIEW_REQUIRED"
    return "NEW_RECOVERY_FUND_DETAIL"
