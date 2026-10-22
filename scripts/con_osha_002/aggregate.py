"""State-parameterized aggregate plan. Detail bridges are a later step."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from scripts.con_osha_002.contract import (
    B2_SOURCE_SYSTEMS,
    EXPANSION_BATCH_SOURCE,
    EXPANSION_STATES,
    MATCH_SOURCE_SYSTEM,
)
from scripts.con_osha_002.eligibility import Eligibility, LoadError, PublicMatch


@dataclass
class MemoryLedger:
    aggregate_ready: set[tuple[str, str]] = field(default_factory=set)
    matches: set[tuple[str, str, str]] = field(default_factory=set)
    holds: set[tuple[str, str, str, str, str, str]] = field(default_factory=set)
    inspections: set[str] = field(default_factory=set)
    citations: set[tuple[str, str]] = field(default_factory=set)
    bridges: set[tuple[str, str, str]] = field(default_factory=set)
    receipts: set[tuple[str, str]] = field(default_factory=set)
    batches: set[str] = field(default_factory=set)


@dataclass
class AggregatePlan:
    state: str
    batch_id: str
    eligibility: Eligibility
    new_matches: list[PublicMatch]
    new_holds: list
    steps: tuple[str, ...] = ("ingest_batch", "expansion_receipt", "matches", "holds", "inspections", "citations", "bridges")

    @property
    def insert_counts(self) -> dict[str, int]:
        return {
            "ingest_batches": 0 if self.batch_id in self._ledger_batches else 1,
            "receipts": 1 if (self.state, self.batch_id) not in self._ledger_receipts else 0,
            "matches": len(self.new_matches),
            "holds": len(self.new_holds),
        }

    _ledger_batches: set[str] = field(default_factory=set)
    _ledger_receipts: set[tuple[str, str]] = field(default_factory=set)


def _uuid(value: str) -> str:
    try:
        return str(UUID(value))
    except ValueError as exc:
        raise LoadError("batch id must be a UUID") from exc


def plan_aggregate(eligibility: Eligibility, batch_id: str, ledger: MemoryLedger | None = None) -> AggregatePlan:
    if eligibility.state not in EXPANSION_STATES:
        raise LoadError("aggregate state is not an expansion state")
    batch = _uuid(batch_id)
    ledger = ledger or MemoryLedger()
    new_matches = []
    for row in eligibility.public_matches:
        key = (row.state, row.license_key, batch)
        if key not in ledger.matches:
            new_matches.append(row)
    new_holds = []
    for hold in eligibility.holds:
        key = (
            hold.state,
            hold.license_key,
            hold.activity_nr or "",
            hold.citation_id or "",
            hold.reason,
            batch,
        )
        if key not in ledger.holds:
            new_holds.append(hold)
    return AggregatePlan(
        state=eligibility.state,
        batch_id=batch,
        eligibility=eligibility,
        new_matches=new_matches,
        new_holds=new_holds,
        _ledger_batches=set(ledger.batches),
        _ledger_receipts=set(ledger.receipts),
    )


def apply_aggregate(plan: AggregatePlan, ledger: MemoryLedger) -> None:
    """Record a dry-run apply. This does not open a database connection."""
    if plan.steps[0] != "ingest_batch" or "matches" not in plan.steps:
        raise LoadError("aggregate plan is missing ownership steps")
    if plan.steps.index("matches") > plan.steps.index("inspections"):
        raise LoadError("aggregate matches must be planned before inspection bridges")
    ledger.batches.add(plan.batch_id)
    ledger.receipts.add((plan.state, plan.batch_id))
    for row in plan.new_matches:
        ledger.matches.add((row.state, row.license_key, plan.batch_id))
    for hold in plan.new_holds:
        ledger.holds.add((
            hold.state,
            hold.license_key,
            hold.activity_nr or "",
            hold.citation_id or "",
            hold.reason,
            plan.batch_id,
        ))
    ledger.aggregate_ready.add((plan.state, plan.batch_id))


def aggregate_statements(plan: AggregatePlan, detail) -> list[str]:
    """Parameterized statements. execute_load is the only runner.

    Inspection and citation counts come from the reconciled detail plan.
    osha_activity_nrs is the published list. The pre-hold list is a separate column.
    """
    state = plan.state
    batch = plan.batch_id
    digest = plan.eligibility.package_sha256
    source = plan.eligibility.source_system or ""
    if detail is None or detail.state != state or detail.batch_id != batch:
        raise LoadError("aggregate SQL requires the reconciled detail plan")
    if not detail.ready:
        raise LoadError("aggregate SQL refuses an incomplete detail reconciliation")
    if state not in EXPANSION_STATES:
        raise LoadError("aggregate SQL state is not an expansion state")
    if source not in B2_SOURCE_SYSTEMS.values():
        raise LoadError("aggregate SQL requires an authorized B2 source system")
    if len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
        raise LoadError("aggregate SQL requires a lowercase package sha256")
    _uuid(batch)
    profiles = len(detail.public_matches)
    inspections = len({row.activity_nr for row in detail.inspections})
    citations = len(detail.citations)
    ambiguous = len(plan.eligibility.ambiguous_activities)
    held = len(plan.eligibility.holds) + len(detail.holds)
    if not all(isinstance(count, int) and count >= 0 for count in (profiles, inspections, citations, ambiguous, held)):
        raise LoadError("aggregate SQL counts must be non-negative integers")
    ca_name = "NULL" if state != "CA" else "'licensee_name_raw'"
    return [
        (
            "-- con-osha-002-step insert_batch\n"
            "INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256) "
            f"VALUES ('{batch}'::uuid, '{EXPANSION_BATCH_SOURCE}', 'con-osha-002:{state}', '{digest}') "
            "ON CONFLICT (id) DO NOTHING"
        ),
        (
            "-- con-osha-002-step insert_expansion_receipt\n"
            "INSERT INTO osha_expansion_load_receipts "
            "(state, ingest_batch_id, b2_source_system, b2_package_sha256, ca_name_source, "
            "public_profile_count, inspection_count, citation_count, ambiguous_activity_count, "
            "missing_citation_context_count, held_row_count) "
            f"VALUES ('{state}', '{batch}'::uuid, '{source}', '{digest}', {ca_name}, "
            f"{profiles}, {inspections}, {citations}, {ambiguous}, {detail.missing_citation_context}, {held}) "
            "ON CONFLICT (state, ingest_batch_id) DO NOTHING"
        ),
        (
            "-- con-osha-002-step insert_match\n"
            "INSERT INTO contractor_osha_license_matches "
            "(contractor_id, license_key, state, match_tier, source_system, source_dataset, "
            "ingest_batch_id, receipt_id, expansion_receipt_id, n_inspections, first_open, last_open, "
            "n_citation_items, n_serious, n_willful_repeat, initial_penalty_amount, current_penalty_amount, "
            "n_with_final_order, n_contested, osha_activity_nrs, osha_matched_activity_nrs, source_observed_on) "
            f"VALUES (%s, %s, '{state}', %s, '{MATCH_SOURCE_SYSTEM}', 'con-osha-002:{state}', "
            f"'{batch}'::uuid, NULL, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT ON CONSTRAINT contractor_osha_license_matches_idem DO NOTHING"
        ),
        (
            "-- con-osha-002-step insert_hold\n"
            "INSERT INTO contractor_osha_expansion_holds "
            "(state, license_key, contractor_id, activity_nr, citation_id, hold_reason, "
            "expansion_receipt_id, ingest_batch_id) "
            f"VALUES ('{state}', %s, %s, %s, %s, %s, %s::uuid, '{batch}'::uuid) "
            "ON CONFLICT (state, license_key, COALESCE(activity_nr, ''), COALESCE(citation_id, ''), "
            "hold_reason, ingest_batch_id) DO NOTHING"
        ),
        (
            "-- con-osha-002-step insert_inspection\n"
            "INSERT INTO contractor_osha_inspections "
            "(activity_nr, state, open_date, site_city, site_state, inspection_type, close_date, "
            "closing_conference_date, citations_verified, source_batch_id, receipt_id, source_hash) "
            f"VALUES (%s, '{state}', %s, %s, %s, %s, %s, %s, %s, '{batch}'::uuid, %s::uuid, %s) "
            "ON CONFLICT (activity_nr) DO NOTHING"
        ),
        (
            "-- con-osha-002-step insert_citation\n"
            "INSERT INTO contractor_osha_citations "
            "(inspection_id, activity_nr, citation_id, standard, viol_type, current_penalty, "
            "contest_date, final_order_date, delete_flag, source_batch_id, receipt_id, source_hash) "
            f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NULL, '{batch}'::uuid, %s::uuid, %s) "
            "ON CONFLICT (inspection_id, citation_id) DO NOTHING"
        ),
        (
            "-- con-osha-002-step insert_bridge\n"
            "INSERT INTO contractor_osha_match_inspections "
            "(public_match_id, contractor_id, state, license_key, inspection_id, activity_nr, "
            "source_batch_id, receipt_id, source_hash) "
            f"VALUES (%s, %s, '{state}', %s, %s, %s, '{batch}'::uuid, %s::uuid, %s) "
            "ON CONFLICT (public_match_id, inspection_id) DO NOTHING"
        ),
    ]


def execute_load(*args, **kwargs):
    from scripts.con_osha_002.execute import execute_load as run
    return run(*args, **kwargs)
