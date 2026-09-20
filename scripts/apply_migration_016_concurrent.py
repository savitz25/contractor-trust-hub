#!/usr/bin/env python3
"""
EA-CT-001-INDEX: apply 016_public_contact_observations_confirmed_license_idx.sql.

*** NOT the standard migration pattern. ***
Every other scripts/apply_migration_0NN.py in this repo opens a psycopg connection with the
default autocommit=False and runs the whole migration file inside one implicit transaction,
then conn.commit()'s it. CREATE INDEX CONCURRENTLY cannot run inside a transaction block at all
(PostgreSQL raises an error and aborts), so this script explicitly uses autocommit=True and
never opens a transaction. Do not "fix" this script to match the other ones -- that would break it.

Modes (default is the safest: read-only):
  --check   (default) Read-only pre-apply checks only. Never executes DDL. Safe to run anytime.
  --apply   Actually runs CREATE INDEX CONCURRENTLY. Requires --check to have passed and requires
            the operator to also pass --i-understand-this-touches-production, so this can never be
            invoked by accident. Still safe to interrupt: CONCURRENTLY never blocks writers, and an
            interrupted build only ever leaves an INVALID index behind (see the runbook), never a
            partial/corrupt one and never a table lock.
  --verify  Read-only post-apply verification only (index validity, definition, EXPLAIN ANALYZE
            on a contact-bearing and a zero-contact contractor).

This script never uses BEGIN/COMMIT and never touches statement_timeout in a way that could abort
a legitimate long-running concurrent build (see --apply's own timeout notes below).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402

MIG = ROOT / "schema" / "migrations" / "016_public_contact_observations_confirmed_license_idx.sql"
INDEX_NAME = "public_contact_observations_confirmed_license_idx"

# Real, fixed-position fixtures established during EA-CT-001 QA -- never redrawn.
JEMKO_SLUG = "cgc061782-jemko-developmant-corp"  # has 2 CONFIRMED, non-agency contacts
ZERO_CONTACT_SLUG = "mn-qb115394-james-t-otterkill"  # has none


def connect(url: str, autocommit: bool):
    import psycopg

    conn = psycopg.connect(url, autocommit=autocommit)
    return conn


def run_checks(conn) -> dict:
    """Read-only. Never executes DDL. Safe to run anytime, including during the current incident."""
    out: dict = {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT to_regclass('public.public_contact_observations') IS NOT NULL AS exists"
        )
        out["table_exists"] = cur.fetchone()[0]

        cur.execute("SELECT count(*)::bigint FROM public_contact_observations")
        out["current_row_count"] = cur.fetchone()[0]

        cur.execute(
            """
            SELECT indexname, indexdef FROM pg_indexes
            WHERE tablename = 'public_contact_observations' AND indexname = %s
            """,
            (INDEX_NAME,),
        )
        row = cur.fetchone()
        out["index_already_exists_per_pg_indexes"] = row is not None
        out["existing_index_def"] = row[1] if row else None

        # A prior failed CONCURRENTLY build leaves an entry in pg_class/pg_index but marks
        # indisvalid = false. pg_indexes (above) does not distinguish valid from invalid; this
        # does. If this is ever true, do NOT re-run CREATE INDEX CONCURRENTLY IF NOT EXISTS --
        # Postgres sees the name as already taken and will silently no-op, permanently leaving the
        # invalid index in place. Drop it first (see the runbook).
        cur.execute(
            """
            SELECT i.indisvalid
            FROM pg_class c
            JOIN pg_index i ON i.indexrelid = c.oid
            WHERE c.relname = %s
            """,
            (INDEX_NAME,),
        )
        row = cur.fetchone()
        out["existing_index_is_invalid"] = (row is not None) and (row[0] is False)

        cur.execute("SELECT current_database(), inet_server_addr()::text, current_user")
        db, addr, user = cur.fetchone()
        out["connected_database"] = db
        out["connected_server_addr"] = addr
        out["connected_user"] = user

        # Long-running transactions can hold snapshots that make CREATE INDEX CONCURRENTLY's
        # second (validation) pass wait indefinitely for them to finish. This does not block
        # normal reads/writes, but the build itself will sit "in progress" until they clear.
        cur.execute(
            """
            SELECT pid, now() - xact_start AS duration, state, left(query, 120) AS query
            FROM pg_stat_activity
            WHERE xact_start IS NOT NULL
              AND now() - xact_start > interval '2 minutes'
              AND pid <> pg_backend_pid()
            ORDER BY duration DESC
            """
        )
        out["long_running_transactions"] = [
            {"pid": r[0], "duration": str(r[1]), "state": r[2], "query": r[3]} for r in cur.fetchall()
        ]

    return out


def print_checks(checks: dict) -> bool:
    """Returns True if it is safe to proceed to --apply."""
    print("=== pre-apply checks ===")
    for k, v in checks.items():
        print(f"  {k}: {v}")
    safe = True
    if not checks["table_exists"]:
        print("BLOCKER: public_contact_observations does not exist on this connection.")
        safe = False
    if checks["index_already_exists_per_pg_indexes"] and not checks["existing_index_is_invalid"]:
        print("NOTE: index already exists and is valid -- nothing to do, --apply would be a safe no-op.")
    if checks["existing_index_is_invalid"]:
        print(
            "BLOCKER: an INVALID index of this name already exists (a prior CONCURRENTLY build "
            "failed or was cancelled). CREATE INDEX CONCURRENTLY IF NOT EXISTS will silently "
            "no-op and leave it invalid. Run DROP INDEX CONCURRENTLY IF EXISTS "
            f"{INDEX_NAME}; first, then re-run --check."
        )
        safe = False
    if checks["long_running_transactions"]:
        print(
            f"CAUTION: {len(checks['long_running_transactions'])} transaction(s) open >2 minutes. "
            "A concurrent index build's validation pass may wait on these. Not a blocker by "
            "itself, but confirm this is expected before proceeding, especially during the "
            "current session/IO-pressure incident."
        )
    print(
        "\nThis script does NOT check the live incident dashboard/status page for you -- confirm "
        "with whoever owns that incident that a low-impact CONCURRENTLY build (no table lock, "
        "no blocking of reads/writes) is acceptable to run right now before using --apply."
    )
    return safe


def run_verify(conn) -> None:
    """Read-only. Confirms the index is valid, matches the intended definition, and improves the plan."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT i.indisvalid, ix.indexdef
            FROM pg_indexes ix
            JOIN pg_class c ON c.relname = ix.indexname
            JOIN pg_index i ON i.indexrelid = c.oid
            WHERE ix.tablename = 'public_contact_observations' AND ix.indexname = %s
            """,
            (INDEX_NAME,),
        )
        row = cur.fetchone()
        if not row:
            print(f"VERIFY FAIL: index {INDEX_NAME} does not exist.")
            return
        is_valid, indexdef = row
        print(f"index exists, indisvalid={is_valid}")
        print(f"definition: {indexdef}")
        if not is_valid:
            print("VERIFY FAIL: index exists but is INVALID. See rollback/rebuild procedure in the runbook.")
            return

        query = """
            SELECT o.id, o.attributed_license_id, o.kind, o.value, o.value_normalized,
                   o.source_system, o.source_url, o.retrieved_at, o.currentness
            FROM public_contact_observations o
            JOIN licenses l ON l.id = o.attributed_license_id
            WHERE l.contractor_id = %s
              AND o.attribution_class = 'CONFIRMED'
              AND o.is_agency_number = false
              AND o.kind = ANY(%s)
            ORDER BY o.kind, o.retrieved_at DESC NULLS LAST
        """
        kinds = [
            "phone", "phone_extension", "email", "website",
            "physical_address", "mailing_address", "additional_location",
        ]
        for label, slug in [("contact-bearing (JEMKO)", JEMKO_SLUG), ("zero-contact", ZERO_CONTACT_SLUG)]:
            cur.execute("SELECT id FROM contractors WHERE slug = %s", (slug,))
            contractor_row = cur.fetchone()
            if not contractor_row:
                print(f"VERIFY SKIP: fixture contractor slug not found: {slug}")
                continue
            cur.execute(f"EXPLAIN (ANALYZE, FORMAT TEXT) {query}", (contractor_row[0], kinds))
            plan_text = "\n".join(r[0] for r in cur.fetchall())
            uses_seq_scan = "Seq Scan on public_contact_observations" in plan_text
            uses_index = INDEX_NAME in plan_text
            print(f"\n--- {label} ---")
            print(plan_text)
            print(f"uses_seq_scan_on_observations={uses_seq_scan} uses_new_index={uses_index}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Read-only pre-apply checks (default).")
    mode.add_argument("--apply", action="store_true", help="Actually run CREATE INDEX CONCURRENTLY.")
    mode.add_argument("--verify", action="store_true", help="Read-only post-apply verification.")
    parser.add_argument(
        "--i-understand-this-touches-production",
        action="store_true",
        help="Required alongside --apply. Confirms the operator has reviewed the runbook.",
    )
    args = parser.parse_args()

    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL missing", file=sys.stderr)
        return 2
    from ingest.env import normalize_database_url

    url = normalize_database_url(url)

    if args.apply:
        if not args.i_understand_this_touches_production:
            print(
                "Refusing to --apply without --i-understand-this-touches-production. "
                "Read docs/ops/EA-CT-001-INDEX-RUNBOOK.md first.",
                file=sys.stderr,
            )
            return 2
        conn = connect(url, autocommit=True)
        checks = run_checks(conn)
        if not print_checks(checks):
            print("Pre-apply checks failed. Not applying.", file=sys.stderr)
            return 1
        if checks["index_already_exists_per_pg_indexes"] and not checks["existing_index_is_invalid"]:
            print("Index already valid. Nothing to do.")
            return 0
        sql = MIG.read_text(encoding="utf-8")
        print("\nApplying (autocommit, no transaction wrapper -- required for CONCURRENTLY)...")
        with conn.cursor() as cur:
            cur.execute(sql)
        print("Applied. Run --verify next.")
        return 0

    if args.verify:
        conn = connect(url, autocommit=True)
        run_verify(conn)
        return 0

    # default: --check
    conn = connect(url, autocommit=True)
    safe = print_checks(run_checks(conn))
    return 0 if safe else 1


if __name__ == "__main__":
    raise SystemExit(main())
