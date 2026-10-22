"""Inspection and citation plan for one expansion state.

Certified FL/NJ parsing is reused. Missing optional source columns stay NULL.
This module does not call the CON-OSHA-001B execute path.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

from scripts.con_osha_001b.load_detail import _optional_money, _parse_date
from scripts.con_osha_002.aggregate import AggregatePlan, MemoryLedger
from scripts.con_osha_002.contract import CITATION_TYPES, DELETE_MARKER
from scripts.con_osha_002.eligibility import Hold, LoadError

REQUIRED_INSPECTION = ("activity_nr",)
REQUIRED_CITATION = ("activity_nr", "citation_id", "standard", "viol_type", "current_penalty", "delete_flag")
OPTIONAL_CITATION_DATES = ("contest_date", "final_order_date")


@dataclass
class PlannedInspection:
    activity_nr: str
    open_date: object
    site_city: str | None
    site_state: str | None
    inspection_type: str | None
    close_date: object
    closing_conference_date: object
    citations_verified: bool


@dataclass
class PlannedCitation:
    activity_nr: str
    citation_id: str
    standard: str
    viol_type: str
    current_penalty: Decimal | None
    contest_date: object
    final_order_date: object


@dataclass
class DetailPlan:
    state: str
    batch_id: str
    inspections: list[PlannedInspection]
    citations: list[PlannedCitation]
    bridges: list[tuple[str, str]]
    holds: list[Hold]
    missing_citation_context: int
    steps: tuple[str, ...] = ("aggregate", "inspections", "citations", "bridges")

    @property
    def insert_counts(self) -> dict[str, int]:
        return {
            "inspections": len(self.inspections),
            "citations": len(self.citations),
            "bridges": len(self.bridges),
            "holds": len(self.holds),
        }


def _rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        header = [name.strip() for name in (reader.fieldnames or [])]
        folded = {name.casefold(): name for name in header}
        rows = []
        for raw in reader:
            rows.append({key.casefold(): (raw.get(key) or "").strip() for key in header})
        return list(folded), rows


def _require(header: list[str], required: tuple[str, ...], label: str) -> None:
    missing = [name for name in required if name not in header]
    if missing:
        raise LoadError(f"{label} missing required columns: {', '.join(missing)}")


def _link_status(row: dict[str, str]) -> str:
    return (row.get("derived_link_status") or "").strip().casefold()


def plan_detail(
    aggregate: AggregatePlan,
    ledger: MemoryLedger,
    inspections_path: Path,
    citations_path: Path,
    link_checks_path: Path | None = None,
) -> DetailPlan:
    if (aggregate.state, aggregate.batch_id) not in ledger.aggregate_ready:
        raise LoadError("aggregate batch must be applied before detail")
    inspection_header, inspection_rows = _rows(inspections_path)
    citation_header, citation_rows = _rows(citations_path)
    _require(inspection_header, REQUIRED_INSPECTION, "inspections")
    _require(citation_header, REQUIRED_CITATION, "citations")
    links: dict[tuple[str, str], str] = {}
    if link_checks_path is not None:
        link_header, link_rows = _rows(link_checks_path)
        _require(link_header, ("activity_nr", "citation_id", "derived_link_status"), "citation link checks")
        for row in link_rows:
            links[(row["activity_nr"], row["citation_id"])] = _link_status(row)

    published = aggregate.eligibility.published_activities
    inspections_by_activity = {}
    planned_inspections: list[PlannedInspection] = []
    for row in inspection_rows:
        activity = row["activity_nr"]
        if activity not in published or activity in inspections_by_activity:
            continue
        inspections_by_activity[activity] = row
        if activity in ledger.inspections:
            continue
        planned_inspections.append(
            PlannedInspection(
                activity_nr=activity,
                open_date=_parse_date(row.get("open_date", ""), "open_date"),
                site_city=row.get("site_city") or None,
                site_state=row.get("site_state") or None,
                inspection_type=row.get("inspection_type") or None,
                close_date=_parse_date(row.get("close_date", ""), "close_date") if "close_date" in inspection_header else None,
                closing_conference_date=(
                    _parse_date(row.get("closing_conference_date", ""), "closing_conference_date")
                    if "closing_conference_date" in inspection_header
                    else None
                ),
                citations_verified=False,
            )
        )

    grouped: dict[str, list[PlannedCitation]] = {activity: [] for activity in inspections_by_activity}
    blocked: set[str] = set()
    holds: list[Hold] = []
    missing = 0
    for row in citation_rows:
        activity = row["activity_nr"]
        citation_id = row["citation_id"]
        if activity not in published:
            continue
        marker = row["delete_flag"].strip().upper()
        if marker not in {"", DELETE_MARKER}:
            raise LoadError(f"unexpected DELETE_FLAG value {marker!r}")
        status = links.get((activity, citation_id))
        missing_context = activity not in inspections_by_activity or (links and status != "matched")
        if links and (activity, citation_id) not in links:
            missing_context = True
        if marker == DELETE_MARKER:
            holds.append(Hold(aggregate.state, "", None, activity, citation_id, "deleted_citation"))
            continue
        if missing_context:
            missing += 1
            blocked.add(activity)
            holds.append(Hold(aggregate.state, "", None, activity, citation_id, "missing_citation_context"))
            continue
        viol_type = row["viol_type"].strip().upper()
        if viol_type not in CITATION_TYPES or not row["standard"]:
            holds.append(Hold(aggregate.state, "", None, activity, citation_id, "unsupported_citation"))
            continue
        if (activity, citation_id) in ledger.citations:
            continue
        grouped.setdefault(activity, []).append(
            PlannedCitation(
                activity_nr=activity,
                citation_id=citation_id,
                standard=row["standard"],
                viol_type=viol_type,
                current_penalty=_optional_money(row["current_penalty"], "current_penalty"),
                contest_date=_parse_date(row.get("contest_date", ""), "contest_date"),
                final_order_date=_parse_date(row.get("final_order_date", ""), "final_order_date"),
            )
        )

    citations: list[PlannedCitation] = []
    for inspection in planned_inspections:
        if inspection.activity_nr in blocked:
            inspection.citations_verified = False
            continue
        inspection.citations_verified = True
        citations.extend(grouped.get(inspection.activity_nr, []))
    bridges = []
    for match in aggregate.eligibility.public_matches:
        for activity in match.activities:
            if activity not in inspections_by_activity:
                continue
            key = (match.license_key, activity, aggregate.batch_id)
            if key in ledger.bridges:
                continue
            bridges.append((match.license_key, activity))
    new_holds = []
    for hold in holds:
        key = (hold.state, hold.license_key, hold.activity_nr or "", hold.citation_id or "", hold.reason, aggregate.batch_id)
        if key not in ledger.holds:
            new_holds.append(hold)
    return DetailPlan(
        state=aggregate.state,
        batch_id=aggregate.batch_id,
        inspections=planned_inspections,
        citations=citations,
        bridges=bridges,
        holds=new_holds,
        missing_citation_context=missing,
    )


def apply_detail(plan: DetailPlan, ledger: MemoryLedger) -> None:
    if plan.steps[0] != "aggregate":
        raise LoadError("detail plan must follow the aggregate batch")
    for inspection in plan.inspections:
        ledger.inspections.add(inspection.activity_nr)
    for citation in plan.citations:
        ledger.citations.add((citation.activity_nr, citation.citation_id))
    for license_key, activity in plan.bridges:
        ledger.bridges.add((license_key, activity, plan.batch_id))
    for hold in plan.holds:
        ledger.holds.add((hold.state, hold.license_key, hold.activity_nr or "", hold.citation_id or "", hold.reason, plan.batch_id))
