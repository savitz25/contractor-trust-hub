"""Inspection and citation reconciliation for one expansion state.

Certified FL/NJ parsing is reused. Missing optional source columns stay NULL.
A published activity without an inspection row, or a citation that cannot be
verified, holds the whole license. A missing citation is not stored as zero.
This module does not call the CON-OSHA-001B execute path.
"""

from __future__ import annotations

import csv
import hashlib
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

from scripts.con_osha_001b.load_detail import _optional_money, _parse_date
from scripts.con_osha_002.aggregate import AggregatePlan, MemoryLedger
from scripts.con_osha_002.contract import CITATION_TYPES, DELETE_MARKER
from scripts.con_osha_002.eligibility import Hold, LoadError, PublicMatch

REQUIRED_INSPECTION = ("activity_nr",)
REQUIRED_CITATION = ("activity_nr", "citation_id", "standard", "viol_type", "current_penalty", "delete_flag")


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
    incomplete_profiles: tuple[str, ...] = ()
    public_matches: tuple[PublicMatch, ...] = ()
    inspection_sha256: str = ""
    citation_sha256: str = ""
    verified_empty_inspections: int = 0
    steps: tuple[str, ...] = ("aggregate", "inspections", "citations", "bridges")

    @property
    def insert_counts(self) -> dict[str, int]:
        return {
            "inspections": len(self.inspections),
            "citations": len(self.citations),
            "bridges": len(self.bridges),
            "holds": len(self.holds),
        }

    @property
    def ready(self) -> bool:
        return not self.incomplete_profiles


def _rows(path: Path) -> tuple[str, list[str], list[dict[str, str]]]:
    payload = path.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    text = payload.decode("utf-8-sig")
    reader = csv.DictReader(text.splitlines())
    header = [name.strip() for name in (reader.fieldnames or [])]
    folded = [name.casefold() for name in header]
    rows = []
    for raw in reader:
        rows.append({key.casefold(): (raw.get(key) or "").strip() for key in header})
    return digest, folded, rows


def _require(header: list[str], required: tuple[str, ...], label: str) -> None:
    missing = [name for name in required if name not in header]
    if missing:
        raise LoadError(f"{label} missing required columns: {', '.join(missing)}")


def _link_status(row: dict[str, str]) -> str:
    return (row.get("derived_link_status") or "").strip().casefold()


def _optional_column(header: list[str], row: dict[str, str], name: str):
    if name not in header:
        return None
    return _parse_date(row.get(name, ""), name)


def plan_detail(
    aggregate: AggregatePlan,
    ledger: MemoryLedger,
    inspections_path: Path,
    citations_path: Path,
    link_checks_path: Path | None = None,
) -> DetailPlan:
    if (aggregate.state, aggregate.batch_id) not in ledger.aggregate_ready:
        raise LoadError("aggregate batch must be applied before detail")
    inspection_sha, inspection_header, inspection_rows = _rows(inspections_path)
    citation_sha, citation_header, citation_rows = _rows(citations_path)
    _require(inspection_header, REQUIRED_INSPECTION, "inspections")
    _require(citation_header, REQUIRED_CITATION, "citations")
    links: dict[tuple[str, str], str] = {}
    if link_checks_path is not None:
        _link_sha, link_header, link_rows = _rows(link_checks_path)
        _require(link_header, ("activity_nr", "citation_id", "derived_link_status"), "citation link checks")
        for row in link_rows:
            links[(row["activity_nr"], row["citation_id"])] = _link_status(row)

    inspections_by_activity: dict[str, dict[str, str]] = {}
    for row in inspection_rows:
        activity = row["activity_nr"]
        if activity and activity not in inspections_by_activity:
            inspections_by_activity[activity] = row

    citations_by_activity: dict[str, list[dict[str, str]]] = {}
    for row in citation_rows:
        citations_by_activity.setdefault(row["activity_nr"], []).append(row)

    planned_inspections: list[PlannedInspection] = []
    planned_citations: list[PlannedCitation] = []
    bridges: list[tuple[str, str]] = []
    holds: list[Hold] = []
    public_matches: list[PublicMatch] = []
    incomplete: list[str] = []
    missing = 0
    verified_empty = 0
    seen_holds: set[tuple] = set()
    seen_citations: set[tuple[str, str]] = set()

    def add_hold(hold: Hold) -> None:
        key = (hold.state, hold.license_key, hold.activity_nr or "", hold.citation_id or "", hold.reason, aggregate.batch_id)
        if key in ledger.holds or key in seen_holds:
            return
        seen_holds.add(key)
        holds.append(hold)

    for match in aggregate.eligibility.public_matches:
        failure = _profile_failure(match, inspections_by_activity, citations_by_activity, links)
        if failure is not None:
            reason, activity, citation_id, missed = failure
            missing += missed
            incomplete.append(match.license_key)
            add_hold(Hold(aggregate.state, match.license_key, match.contractor_id, activity, citation_id, reason))
            add_hold(Hold(aggregate.state, match.license_key, match.contractor_id, None, None, "incomplete_detail"))
            continue
        public_matches.append(match)
        loadable_for_match = 0
        empty_for_match = 0
        for activity in match.activities:
            row = inspections_by_activity[activity]
            loadable, deleted_holds, empty = _activity_citations(aggregate.state, match, activity, citations_by_activity.get(activity, []))
            for hold in deleted_holds:
                add_hold(hold)
            if empty:
                empty_for_match += 1
            loadable_for_match += len(loadable)
            if activity in ledger.inspections:
                continue
            planned_inspections.append(PlannedInspection(
                activity_nr=activity,
                open_date=_parse_date(row.get("open_date", ""), "open_date"),
                site_city=row.get("site_city") or None,
                site_state=row.get("site_state") or None,
                inspection_type=row.get("inspection_type") or None,
                close_date=_optional_column(inspection_header, row, "close_date"),
                closing_conference_date=_optional_column(inspection_header, row, "closing_conference_date"),
                citations_verified=True,
            ))
            for citation in loadable:
                key = (activity, citation.citation_id)
                if key in ledger.citations or key in seen_citations:
                    continue
                seen_citations.add(key)
                planned_citations.append(citation)
            bridge_key = (match.license_key, activity, aggregate.batch_id)
            if bridge_key not in ledger.bridges:
                bridges.append((match.license_key, activity))
        if loadable_for_match != match.n_citation_items:
            raise LoadError("loadable citations do not equal the certified citation total")
        verified_empty += empty_for_match

    return DetailPlan(
        state=aggregate.state,
        batch_id=aggregate.batch_id,
        inspections=_unique_inspections(planned_inspections),
        citations=planned_citations,
        bridges=bridges,
        holds=holds,
        missing_citation_context=missing,
        incomplete_profiles=tuple(incomplete),
        public_matches=tuple(public_matches),
        inspection_sha256=inspection_sha,
        citation_sha256=citation_sha,
        verified_empty_inspections=verified_empty,
    )


def _unique_inspections(rows: list[PlannedInspection]) -> list[PlannedInspection]:
    found: dict[str, PlannedInspection] = {}
    for row in rows:
        found.setdefault(row.activity_nr, row)
    return list(found.values())


def _profile_failure(
    match: PublicMatch,
    inspections_by_activity: dict[str, dict[str, str]],
    citations_by_activity: dict[str, list[dict[str, str]]],
    links: dict[tuple[str, str], str],
) -> tuple[str, str | None, str | None, int] | None:
    missed = 0
    first: tuple[str, str | None, str | None] | None = None
    for activity in match.activities:
        if activity not in inspections_by_activity:
            if first is None:
                first = ("missing_inspection", activity, None)
            continue
        for row in citations_by_activity.get(activity, []):
            marker = row["delete_flag"].strip().upper()
            if marker not in {"", DELETE_MARKER}:
                raise LoadError(f"unexpected DELETE_FLAG value {marker!r}")
            if marker == DELETE_MARKER:
                continue
            status = links.get((activity, row["citation_id"]))
            if links and status != "matched":
                missed += 1
                if first is None:
                    first = ("missing_citation_context", activity, row["citation_id"])
                continue
            viol_type = row["viol_type"].strip().upper()
            if viol_type not in CITATION_TYPES or not row["standard"]:
                if first is None:
                    first = ("unsupported_citation", activity, row["citation_id"])
    if first is None:
        return None
    return (first[0], first[1], first[2], missed)


def _activity_citations(
    state: str,
    match: PublicMatch,
    activity: str,
    rows: list[dict[str, str]],
) -> tuple[list[PlannedCitation], list[Hold], bool]:
    loadable: list[PlannedCitation] = []
    holds: list[Hold] = []
    for row in rows:
        marker = row["delete_flag"].strip().upper()
        if marker == DELETE_MARKER:
            holds.append(Hold(state, match.license_key, match.contractor_id, activity, row["citation_id"], "deleted_citation"))
            continue
        loadable.append(PlannedCitation(
            activity_nr=activity,
            citation_id=row["citation_id"],
            standard=row["standard"],
            viol_type=row["viol_type"].strip().upper(),
            current_penalty=_optional_money(row["current_penalty"], "current_penalty"),
            contest_date=_parse_date(row.get("contest_date", ""), "contest_date"),
            final_order_date=_parse_date(row.get("final_order_date", ""), "final_order_date"),
        ))
    return loadable, holds, not loadable


def apply_detail(plan: DetailPlan, ledger: MemoryLedger) -> None:
    if plan.steps[0] != "aggregate":
        raise LoadError("detail plan must follow the aggregate batch")
    if not plan.ready:
        raise LoadError("detail reconciliation is incomplete; refusing to apply")
    for inspection in plan.inspections:
        ledger.inspections.add(inspection.activity_nr)
    for citation in plan.citations:
        ledger.citations.add((citation.activity_nr, citation.citation_id))
    for license_key, activity in plan.bridges:
        ledger.bridges.add((license_key, activity, plan.batch_id))
    for hold in plan.holds:
        ledger.holds.add((hold.state, hold.license_key, hold.activity_nr or "", hold.citation_id or "", hold.reason, plan.batch_id))
