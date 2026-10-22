"""GO-gated expansion load. Importing this module does not connect or write.

The caller must pass the Founder phrase, the expected database host, and the
expected database name. A mismatch stops before any insert. This file does not
read an environment connection string and does not open Production on import.
"""

from __future__ import annotations

import copy
from urllib.parse import urlparse
from uuid import uuid4

from scripts.con_osha_002.aggregate import AggregatePlan, plan_aggregate
from scripts.con_osha_002.contract import (
    CERTIFIED_CITATIONS,
    CERTIFIED_ELIGIBLE_PROFILES,
    CERTIFIED_PUBLISHED_ACTIVITIES,
    EXPANSION_BATCH_SOURCE,
    GO_PHRASE,
    MATCH_SOURCE_SYSTEM,
    OFFICIAL_INSPECTION_SHA256,
    OFFICIAL_VIOLATION_SHA256,
    STATE_CHECK_NAMES,
    VERIFIED_B2_PACKAGE_SHA256,
)
from scripts.con_osha_002.eligibility import Eligibility, LoadError, verify_identities

WIDE_STATE_CHECK = (
    "CHECK ((state = ANY (ARRAY['FL'::bpchar, 'NJ'::bpchar, 'CA'::bpchar, "
    "'VA'::bpchar, 'LA'::bpchar, 'NV'::bpchar, 'AZ'::bpchar, 'TN'::bpchar])))"
)
PILOT_STATES_MARK = "FL,NJ"


class MemoryConn:
    """Disposable transaction stand-in for the write path. Not a production database."""

    def __init__(self):
        self.database_name = "osha_002_test"
        self.server_version = 160000
        self.state_checks = {name: WIDE_STATE_CHECK for name in STATE_CHECK_NAMES}
        self.pilot_states = "CHECK ((pilot_states = 'FL,NJ'::text))"
        self.tables_present = True
        self.force_reconcile_mismatch = False
        self.steps: list[str] = []
        self.inserted = {"matches": 0, "holds": 0, "inspections": 0, "citations": 0, "bridges": 0, "receipts": 0}
        self.matches = {}
        self.holds = set()
        self.inspections = {}
        self.inspection_ids = {}
        self.citations = {}
        self.bridges = set()
        self.receipts = {}
        self.detail_receipts = {}
        self.batches = {}
        self.rolled_back = False
        self.committed = False
        self._snapshot = None

    def __enter__(self):
        self._snapshot = self._capture()
        self.rolled_back = False
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type:
            self.rollback()
        else:
            self.committed = True
            self._snapshot = self._capture()
        return False

    def cursor(self):
        return MemoryCursor(self)

    def close(self):
        return None

    def rollback(self):
        self.rolled_back = True
        if self._snapshot is not None:
            self._restore(self._snapshot)

    def _capture(self):
        return copy.deepcopy({
            "matches": self.matches,
            "holds": self.holds,
            "inspections": self.inspections,
            "inspection_ids": self.inspection_ids,
            "citations": self.citations,
            "bridges": self.bridges,
            "receipts": self.receipts,
            "detail_receipts": self.detail_receipts,
            "batches": self.batches,
            "inserted": self.inserted,
        })

    def _restore(self, snapshot):
        self.matches = snapshot["matches"]
        self.holds = snapshot["holds"]
        self.inspections = snapshot["inspections"]
        self.inspection_ids = snapshot["inspection_ids"]
        self.citations = snapshot["citations"]
        self.bridges = snapshot["bridges"]
        self.receipts = snapshot["receipts"]
        self.detail_receipts = snapshot["detail_receipts"]
        self.batches = snapshot["batches"]
        self.inserted = snapshot["inserted"]


class MemoryCursor:
    def __init__(self, conn: MemoryConn):
        self.conn = conn
        self._row = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=None):
        step = _step_name(sql)
        self.conn.steps.append(step)
        params = params or ()
        handler = getattr(self, f"_step_{step}", None)
        if handler is None:
            raise LoadError(f"memory loader has no step {step}")
        self._row = handler(params)

    def fetchone(self):
        return self._row

    def _step_probe_target(self, _params):
        return (self.conn.database_name, self.conn.server_version)

    def _step_probe_schema(self, _params):
        if not self.conn.tables_present:
            return (None, None, None, None, None, None, None, None, None)
        checks = [self.conn.state_checks.get(name) for name in STATE_CHECK_NAMES]
        return (True, True, True, True, True, *checks, self.conn.pilot_states)

    def _step_lock(self, _params):
        return (True,)

    def _step_insert_batch(self, params):
        batch_id, _source, _dataset, digest = params
        if batch_id not in self.conn.batches:
            self.conn.batches[batch_id] = digest
            return (batch_id,)
        if self.conn.batches[batch_id] != digest:
            raise LoadError("existing batch hash does not match")
        return None

    def _step_insert_expansion_receipt(self, params):
        state, batch_id = params[0], params[1]
        key = (state, batch_id)
        if key in self.conn.receipts:
            return None
        receipt_id = str(uuid4())
        self.conn.receipts[key] = {
            "id": receipt_id,
            "profiles": params[5],
            "inspections": params[6],
            "citations": params[7],
        }
        self.conn.inserted["receipts"] += 1
        return (receipt_id,)

    def _step_select_expansion_receipt(self, params):
        state, batch_id = params
        found = self.conn.receipts.get((state, batch_id))
        if not found:
            return None
        return (found["id"], found["profiles"], found["inspections"], found["citations"])

    def _step_insert_match(self, params):
        contractor_id, license_key, state = params[0], params[1], params[2]
        batch_id = params[6]
        public_activities = params[18]
        provenance = params[19]
        key = (state, license_key, batch_id)
        if key in self.conn.matches:
            return None
        match_id = str(uuid4())
        self.conn.matches[key] = {
            "id": match_id,
            "contractor_id": contractor_id,
            "public_activities": public_activities,
            "provenance": provenance,
        }
        self.conn.inserted["matches"] += 1
        return (match_id,)

    def _step_select_match(self, params):
        state, license_key, batch_id = params
        found = self.conn.matches.get((state, license_key, batch_id))
        return (found["id"], found["contractor_id"]) if found else None

    def _step_select_match_provenance(self, params):
        state, license_key, batch_id = params
        found = self.conn.matches.get((state, license_key, batch_id))
        if not found:
            return None
        return (found["public_activities"], found["provenance"])

    def _step_insert_hold(self, params):
        key = tuple(params[:6]) + (params[7],)
        if key in self.conn.holds:
            return None
        self.conn.holds.add(key)
        self.conn.inserted["holds"] += 1
        return (str(uuid4()),)

    def _step_insert_detail_receipt(self, params):
        batch_id, dataset, digest, inspection_rows, _loadable, citation_rows = params
        key = (batch_id, dataset, digest)
        if key in self.conn.detail_receipts:
            return None
        receipt_id = str(uuid4())
        self.conn.detail_receipts[key] = {
            "id": receipt_id,
            "inspection_rows": inspection_rows,
            "citation_rows": citation_rows,
        }
        self.conn.inserted["receipts"] += 1
        return (receipt_id,)

    def _step_select_detail_receipt(self, params):
        batch_id, dataset, digest = params
        found = self.conn.detail_receipts.get((batch_id, dataset, digest))
        if not found:
            return None
        return (found["id"], found["inspection_rows"], found["citation_rows"])

    def _step_insert_inspection(self, params):
        activity, state, _open, _city, _site, _kind, _close, _closing, verified, batch_id, _receipt, digest = params
        if activity in self.conn.inspections:
            return None
        inspection_id = str(uuid4())
        self.conn.inspections[activity] = {
            "id": inspection_id,
            "state": state,
            "digest": digest,
            "batch_id": batch_id,
            "verified": verified,
        }
        self.conn.inspection_ids[inspection_id] = activity
        self.conn.inserted["inspections"] += 1
        return (inspection_id,)

    def _step_select_inspection(self, params):
        activity, = params
        found = self.conn.inspections.get(activity)
        if not found or "id" not in found:
            return None
        return (found["id"], found["state"], found["digest"])

    def _step_insert_citation(self, params):
        _inspection_id, activity, citation_id = params[0], params[1], params[2]
        batch_id = params[8]
        digest = params[10]
        key = (activity, citation_id)
        if key in self.conn.citations:
            return None
        if activity not in self.conn.inspections or "id" not in self.conn.inspections[activity]:
            raise LoadError("citation requires a normalized inspection")
        self.conn.citations[key] = {"batch_id": batch_id, "digest": digest}
        self.conn.inserted["citations"] += 1
        return (str(uuid4()),)

    def _step_select_citation(self, params):
        inspection_id, citation_id = params
        activity = self.conn.inspection_ids.get(inspection_id)
        if activity is None:
            return None
        found = self.conn.citations.get((activity, citation_id))
        if not found:
            return None
        return (found["digest"],)

    def _step_insert_bridge(self, params):
        match_id, _contractor, state, license_key, _inspection, activity, batch_id = params[:7]
        key = (match_id, activity, batch_id)
        if key in self.conn.bridges:
            return None
        if activity not in self.conn.inspections:
            raise LoadError("bridge requires a normalized inspection")
        stored = self.conn.matches.get((state, license_key, batch_id))
        if stored is None or activity not in stored["public_activities"].split(";"):
            raise LoadError("bridge activity is not in the published activity list")
        self.conn.bridges.add(key)
        self.conn.inserted["bridges"] += 1
        return (match_id,)

    def _step_reconcile(self, params):
        state, batch_id = params[0], params[1]
        profiles = sum(1 for key in self.conn.matches if key[0] == state and key[2] == batch_id)
        activities = sum(
            1 for row in self.conn.inspections.values()
            if row.get("state") == state and row.get("batch_id") == batch_id
        )
        citations = sum(
            1
            for (activity, _citation_id), meta in self.conn.citations.items()
            if meta["batch_id"] == batch_id and self.conn.inspections.get(activity, {}).get("state") == state
        )
        if self.conn.force_reconcile_mismatch:
            profiles += 1
        return (profiles, activities, citations)


def _step_name(sql: str) -> str:
    for line in sql.splitlines():
        text = line.strip()
        if text.startswith("-- step "):
            return text.removeprefix("-- step ").strip()
    raise LoadError("SQL step is not labeled")


def _state_definition_ok(definition: str | None) -> bool:
    if not definition:
        return False
    if any(code not in definition for code in ("FL", "NJ", "CA", "VA", "LA", "NV", "AZ", "TN")):
        return False
    compact = "".join(definition.split())
    return compact == "".join(WIDE_STATE_CHECK.split()) or compact == "".join(
        WIDE_STATE_CHECK.replace("bpchar", "character(2)").split()
    )


def execute_load(
    eligibility: Eligibility | None = None,
    detail=None,
    *,
    confirm: str = "",
    database_url: str = "",
    expected_db_host: str = "",
    expected_db_name: str = "",
    identities: dict | None = None,
    expected_profiles: int | None = None,
    expected_activities: int | None = None,
    expected_citations: int | None = None,
    expected_package_sha256: str = "",
    official: bool = False,
    connector=None,
    source_observed_on: str = "",
    batch_id: str = "",
):
    if confirm != GO_PHRASE:
        raise LoadError("database writes require the exact Founder GO phrase")
    if eligibility is None or detail is None:
        raise LoadError("execute_load requires an eligibility plan and a detail plan")
    if not detail.ready:
        raise LoadError("detail reconciliation is incomplete; refusing to write")
    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgresql", "postgres"} or not parsed.hostname:
        raise LoadError("target URL must name a PostgreSQL host")
    if not expected_db_host or parsed.hostname.casefold() != expected_db_host.casefold():
        raise LoadError("target DB host does not match the expected host")
    if not expected_db_name:
        raise LoadError("expected database name is required")
    if identities is None:
        raise LoadError("an existing license identity map is required")
    if not source_observed_on:
        raise LoadError("source_observed_on is required")
    verify_identities(eligibility, identities)
    state = eligibility.state
    if official:
        expected_profiles = CERTIFIED_ELIGIBLE_PROFILES[state]
        expected_activities = CERTIFIED_PUBLISHED_ACTIVITIES[state]
        expected_citations = CERTIFIED_CITATIONS[state]
        expected_package_sha256 = VERIFIED_B2_PACKAGE_SHA256[state]
        if detail.inspection_sha256 != OFFICIAL_INSPECTION_SHA256 or detail.citation_sha256 != OFFICIAL_VIOLATION_SHA256:
            raise LoadError("official inspection or violation hash does not match the pin")
    if expected_profiles is None or expected_activities is None or expected_citations is None:
        raise LoadError("exact expected counts are required before writing")
    if not expected_package_sha256:
        raise LoadError("expected package sha256 is required")
    if eligibility.package_sha256 != expected_package_sha256:
        raise LoadError("package sha256 does not match the preflight pin")
    if official and expected_package_sha256 != VERIFIED_B2_PACKAGE_SHA256[state]:
        raise LoadError("official package pin does not match the certified hash")
    if len(detail.public_matches) != expected_profiles:
        raise LoadError("preflight profile count does not match the expected count")
    activity_count = len({row.activity_nr for row in detail.inspections})
    if activity_count != expected_activities or len(detail.citations) != expected_citations:
        raise LoadError("preflight detail counts do not match the expected counts")
    if sum(match.n_citation_items for match in detail.public_matches) != expected_citations:
        raise LoadError("retained citation totals do not match the expected count")
    if sum(match.n_inspections for match in detail.public_matches) != expected_activities:
        raise LoadError("retained inspection totals do not match published activities")

    if connector is None:
        try:
            import psycopg
        except ImportError as exc:
            raise LoadError("psycopg is required only for an explicitly authorized load") from exc
        connector = psycopg.connect
    conn = connector(database_url)
    inserted = {"matches": 0, "holds": 0, "inspections": 0, "citations": 0, "bridges": 0}
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("-- step probe_target\nSELECT current_database(), current_setting('server_version_num')::int")
                database_name, server_version = cur.fetchone()
                if database_name.casefold() != expected_db_name.casefold():
                    raise LoadError("target DB name does not match the expected name")
                if server_version < 150000:
                    raise LoadError("target database must be PostgreSQL 15 or newer")
                cur.execute(
                    "-- step probe_schema\n"
                    "SELECT to_regclass('public.contractor_osha_license_matches') IS NOT NULL, "
                    "to_regclass('public.contractor_osha_expansion_holds') IS NOT NULL, "
                    "to_regclass('public.osha_expansion_load_receipts') IS NOT NULL, "
                    "to_regclass('public.contractor_osha_inspections') IS NOT NULL, "
                    "to_regclass('public.contractor_osha_citations') IS NOT NULL, "
                    "(SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'contractor_osha_license_matches_state_check'), "
                    "(SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'contractor_osha_identity_review_state_check'), "
                    "(SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'contractor_osha_inspections_state_check'), "
                    "(SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'contractor_osha_match_inspections_state_check'), "
                    "(SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                    "  WHERE conrelid = 'public.osha_load_receipts'::regclass "
                    "    AND pg_get_constraintdef(oid) LIKE '%pilot_states%' LIMIT 1)"
                )
                schema = cur.fetchone()
                if schema is None or any(flag is not True for flag in schema[:5]):
                    raise LoadError("migration 020 tables are not all present")
                if not all(_state_definition_ok(value) for value in schema[5:9]):
                    raise LoadError("OSHA state checks are not the exact eight-state constraints")
                pilot = schema[9] or ""
                if PILOT_STATES_MARK not in pilot or "CA" in pilot:
                    raise LoadError("osha_load_receipts.pilot_states is no longer FL,NJ")
                cur.execute("-- step lock\nSELECT pg_advisory_xact_lock(hashtext(%s))", (f"con-osha-002:{state}:{expected_package_sha256}",))
                plan = plan_aggregate(eligibility, batch_id)
                if detail.batch_id != plan.batch_id or detail.state != eligibility.state:
                    raise LoadError("detail plan does not match the aggregate batch")
                _write_batch(cur, plan, detail, source_observed_on, inserted)
                cur.execute(
                    "-- step reconcile\n"
                    "SELECT "
                    "(SELECT count(*) FROM contractor_osha_license_matches WHERE state = %s AND ingest_batch_id = %s::uuid), "
                    "(SELECT count(*) FROM contractor_osha_inspections WHERE state = %s AND source_batch_id = %s::uuid), "
                    "(SELECT count(*) FROM contractor_osha_citations c JOIN contractor_osha_inspections i ON i.id = c.inspection_id "
                    "  WHERE i.state = %s AND c.source_batch_id = %s::uuid)",
                    (state, plan.batch_id, state, plan.batch_id, state, plan.batch_id),
                )
                profiles, activities, citations = cur.fetchone()
                if (profiles, activities, citations) != (expected_profiles, expected_activities, expected_citations):
                    raise LoadError("loaded counts do not match the preflight; rolling back")
        return {"mode": "loaded", "database": expected_db_name, "state": state, **inserted}
    finally:
        conn.close()


def _write_batch(cur, plan: AggregatePlan, detail, observed: str, inserted: dict) -> None:
    state = plan.state
    batch = plan.batch_id
    digest = plan.eligibility.package_sha256
    cur.execute(
        "-- step insert_batch\n"
        "INSERT INTO ingest_batches (id, source_system, source_dataset, checksum_sha256) "
        "VALUES (%s::uuid, %s, %s, %s) ON CONFLICT (id) DO NOTHING RETURNING id",
        (batch, EXPANSION_BATCH_SOURCE, f"con-osha-002:{state}", digest),
    )
    cur.fetchone()
    cur.execute(
        "-- step insert_expansion_receipt\n"
        "INSERT INTO osha_expansion_load_receipts "
        "(state, ingest_batch_id, b2_source_system, b2_package_sha256, ca_name_source, "
        "public_profile_count, inspection_count, citation_count, ambiguous_activity_count, "
        "missing_citation_context_count, held_row_count) "
        "VALUES (%s, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
        "ON CONFLICT (state, ingest_batch_id) DO NOTHING RETURNING id",
        (
            state, batch, plan.eligibility.source_system, digest,
            "licensee_name_raw" if state == "CA" else None,
            len(detail.public_matches),
            len({row.activity_nr for row in detail.inspections}),
            len(detail.citations),
            len(plan.eligibility.ambiguous_activities),
            detail.missing_citation_context,
            len(plan.eligibility.holds) + len(detail.holds),
        ),
    )
    receipt = cur.fetchone()
    profile_count = len(detail.public_matches)
    inspection_count = len({row.activity_nr for row in detail.inspections})
    citation_count = len(detail.citations)
    if receipt is None:
        cur.execute(
            "-- step select_expansion_receipt\n"
            "SELECT id, public_profile_count, inspection_count, citation_count "
            "FROM osha_expansion_load_receipts WHERE state = %s AND ingest_batch_id = %s::uuid",
            (state, batch),
        )
        receipt = cur.fetchone()
        if receipt is None:
            raise LoadError("expansion receipt was not created")
        if (receipt[1], receipt[2], receipt[3]) != (profile_count, inspection_count, citation_count):
            raise LoadError("existing expansion receipt counts do not match")
    receipt_id = receipt[0]
    for match in detail.public_matches:
        if match.public_activity_nrs != ";".join(match.activities):
            raise LoadError("public activity list drifted from published activities")
        if set(match.activities) & set(match.matched_activities) != set(match.activities):
            raise LoadError("public activity list is not a subset of provenance")
        cur.execute(
            "-- step insert_match\n"
            "INSERT INTO contractor_osha_license_matches "
            "(contractor_id, license_key, state, match_tier, source_system, source_dataset, "
            "ingest_batch_id, receipt_id, expansion_receipt_id, n_inspections, first_open, last_open, "
            "n_citation_items, n_serious, n_willful_repeat, initial_penalty_amount, current_penalty_amount, "
            "n_with_final_order, n_contested, osha_activity_nrs, osha_matched_activity_nrs, source_observed_on) "
            "VALUES (%s::uuid, %s, %s, %s, %s, %s, %s::uuid, NULL, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT ON CONSTRAINT contractor_osha_license_matches_idem DO NOTHING RETURNING id",
            (
                match.contractor_id, match.license_key, state, match.match_tier, MATCH_SOURCE_SYSTEM,
                f"con-osha-002:{state}", batch, receipt_id, match.n_inspections, match.first_open, match.last_open,
                match.n_citation_items, match.n_serious, match.n_willful_repeat, match.initial_penalty_amount,
                match.current_penalty_amount, match.n_with_final_order, match.n_contested,
                match.public_activity_nrs, match.provenance_activity_nrs, observed,
            ),
        )
        created = cur.fetchone()
        if created is None:
            cur.execute(
                "-- step select_match_provenance\n"
                "SELECT osha_activity_nrs, osha_matched_activity_nrs "
                "FROM contractor_osha_license_matches "
                "WHERE state = %s AND license_key = %s AND ingest_batch_id = %s::uuid",
                (state, match.license_key, batch),
            )
            existing = cur.fetchone()
            if existing is None:
                raise LoadError("public match disappeared")
            if existing[0] != match.public_activity_nrs or existing[1] != match.provenance_activity_nrs:
                raise LoadError("existing public match has different activity provenance")
        else:
            inserted["matches"] += 1
    for hold in list(plan.eligibility.holds) + list(detail.holds):
        cur.execute(
            "-- step insert_hold\n"
            "INSERT INTO contractor_osha_expansion_holds "
            "(state, license_key, contractor_id, activity_nr, citation_id, hold_reason, expansion_receipt_id, ingest_batch_id) "
            "VALUES (%s, %s, %s::uuid, %s, %s, %s, %s::uuid, %s::uuid) "
            "ON CONFLICT (state, license_key, COALESCE(activity_nr, ''), COALESCE(citation_id, ''), hold_reason, ingest_batch_id) "
            "DO NOTHING RETURNING id",
            (state, hold.license_key, hold.contractor_id, hold.activity_nr, hold.citation_id, hold.reason, receipt_id, batch),
        )
        if cur.fetchone() is not None:
            inserted["holds"] += 1
    detail_dataset = f"con-osha-002:{state}:inspections"
    cur.execute(
        "-- step insert_detail_receipt\n"
        "INSERT INTO osha_detail_load_receipts "
        "(source_batch_id, source_dataset, source_hash, inspection_rows, loadable_citation_rows, citation_rows) "
        "VALUES (%s::uuid, %s, %s, %s, %s, %s) "
        "ON CONFLICT (source_batch_id, source_dataset, source_hash) DO NOTHING RETURNING id",
        (batch, detail_dataset, detail.inspection_sha256, len(detail.inspections), len(detail.citations), len(detail.citations)),
    )
    detail_row = cur.fetchone()
    if detail_row is None:
        cur.execute(
            "-- step select_detail_receipt\n"
            "SELECT id, inspection_rows, loadable_citation_rows "
            "FROM osha_detail_load_receipts "
            "WHERE source_batch_id = %s::uuid AND source_dataset = %s AND source_hash = %s",
            (batch, detail_dataset, detail.inspection_sha256),
        )
        detail_row = cur.fetchone()
        if detail_row is None:
            raise LoadError("detail receipt was not created")
        if (detail_row[1], detail_row[2]) != (len(detail.inspections), len(detail.citations)):
            raise LoadError("existing detail receipt counts do not match")
    detail_receipt = detail_row[0]
    inspection_ids = {}
    for inspection in detail.inspections:
        cur.execute(
            "-- step insert_inspection\n"
            "INSERT INTO contractor_osha_inspections "
            "(activity_nr, state, open_date, site_city, site_state, inspection_type, close_date, "
            "closing_conference_date, citations_verified, source_batch_id, receipt_id, source_hash) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::uuid, %s::uuid, %s) "
            "ON CONFLICT (activity_nr) DO NOTHING RETURNING id",
            (
                inspection.activity_nr, state, inspection.open_date, inspection.site_city, inspection.site_state,
                inspection.inspection_type, inspection.close_date, inspection.closing_conference_date,
                inspection.citations_verified, batch, detail_receipt, detail.inspection_sha256,
            ),
        )
        created = cur.fetchone()
        if created is not None:
            inserted["inspections"] += 1
            inspection_ids[inspection.activity_nr] = created[0]
        else:
            cur.execute(
                "-- step select_inspection\n"
                "SELECT id, state, source_hash FROM contractor_osha_inspections WHERE activity_nr = %s",
                (inspection.activity_nr,),
            )
            existing = cur.fetchone()
            if existing is None:
                raise LoadError("normalized inspection disappeared")
            if str(existing[1]).strip() != state or existing[2] != detail.inspection_sha256:
                raise LoadError("existing normalized inspection has different provenance")
            inspection_ids[inspection.activity_nr] = existing[0]
    for citation in detail.citations:
        cur.execute(
            "-- step insert_citation\n"
            "INSERT INTO contractor_osha_citations "
            "(inspection_id, activity_nr, citation_id, standard, viol_type, current_penalty, "
            "contest_date, final_order_date, delete_flag, source_batch_id, receipt_id, source_hash) "
            "VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, NULL, %s::uuid, %s::uuid, %s) "
            "ON CONFLICT (inspection_id, citation_id) DO NOTHING RETURNING id",
            (
                inspection_ids[citation.activity_nr], citation.activity_nr, citation.citation_id, citation.standard,
                citation.viol_type, citation.current_penalty, citation.contest_date, citation.final_order_date,
                batch, detail_receipt, detail.citation_sha256,
            ),
        )
        created_citation = cur.fetchone()
        if created_citation is None:
            cur.execute(
                "-- step select_citation\n"
                "SELECT source_hash FROM contractor_osha_citations "
                "WHERE inspection_id = %s::uuid AND citation_id = %s",
                (inspection_ids[citation.activity_nr], citation.citation_id),
            )
            existing_citation = cur.fetchone()
            if existing_citation is None or existing_citation[0] != detail.citation_sha256:
                raise LoadError("existing citation has different provenance")
        else:
            inserted["citations"] += 1
    for license_key, activity in detail.bridges:
        cur.execute(
            "-- step select_match\n"
            "SELECT id, contractor_id FROM contractor_osha_license_matches "
            "WHERE state = %s AND license_key = %s AND ingest_batch_id = %s::uuid",
            (state, license_key, batch),
        )
        match_row = cur.fetchone()
        if match_row is None:
            raise LoadError("detail bridge has no aggregate match")
        cur.execute(
            "-- step insert_bridge\n"
            "INSERT INTO contractor_osha_match_inspections "
            "(public_match_id, contractor_id, state, license_key, inspection_id, activity_nr, "
            "source_batch_id, receipt_id, source_hash) "
            "VALUES (%s::uuid, %s::uuid, %s, %s, %s::uuid, %s, %s::uuid, %s::uuid, %s) "
            "ON CONFLICT (public_match_id, inspection_id) DO NOTHING RETURNING public_match_id",
            (
                match_row[0], match_row[1], state, license_key, inspection_ids[activity], activity,
                batch, detail_receipt, detail.inspection_sha256,
            ),
        )
        if cur.fetchone() is not None:
            inserted["bridges"] += 1
