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
            Fails closed: an existing same-named index that does not exactly match this script's
            intended schema/table/column/predicate, or that is not valid+ready, is treated as a
            BLOCKER, never as "close enough" / a safe no-op.
  --apply   Actually runs CREATE INDEX CONCURRENTLY. Requires --check to have passed and requires
            the operator to also pass --i-understand-this-touches-production, so this can never be
            invoked by accident. Sets a short lock_timeout (~5s) immediately before the DDL so the
            build fails fast rather than queuing indefinitely behind an incompatible lock -- this is
            deliberately NOT a statement_timeout: a legitimate concurrent build can validly run far
            longer than 5s once it acquires its lock, and must not be killed for that. Still safe to
            interrupt: CONCURRENTLY never blocks writers, and an interrupted build only ever leaves
            an INVALID index behind (see the runbook), never a partial/corrupt one and never a
            table lock.
  --verify  Read-only post-apply verification. Exits non-zero if ANY required condition fails:
            index missing/invalid/not-ready, wrong schema/table/column/predicate, the contact query
            still Seq Scans public_contact_observations, the intended index does not appear in the
            plan, either fixture's actual row count differs from the count established during
            EA-CT-001 QA, or the query itself errors.

This script never uses BEGIN/COMMIT and never sets statement_timeout for --apply (see above).
All catalog lookups are explicitly schema-qualified to 'public' -- an identically-named object in
another schema must never satisfy any check here.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ingest.env import load_dotenv_files  # noqa: E402

MIG = ROOT / "schema" / "migrations" / "016_public_contact_observations_confirmed_license_idx.sql"
INDEX_NAME = "public_contact_observations_confirmed_license_idx"
TABLE_NAME = "public_contact_observations"
SCHEMA_NAME = "public"
EXPECTED_COLUMN = "attributed_license_id"

# Real, fixed-position fixtures established during EA-CT-001 QA -- never redrawn. Row counts are
# the actual counts confirmed live during that QA (JEMKO: 1 phone + 1 mailing_address = 2;
# zero-contact contractor: 0). --verify treats a deviation from these as a FAIL, not a note --
# a changed count would mean the index changed which rows the query returns, which must never
# happen for a pure performance index.
JEMKO_SLUG = "cgc061782-jemko-developmant-corp"
JEMKO_EXPECTED_ROWS = 2
ZERO_CONTACT_SLUG = "mn-qb115394-james-t-otterkill"
ZERO_CONTACT_EXPECTED_ROWS = 0

CONTACT_QUERY = """
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
CONTACT_KINDS = [
    "phone", "phone_extension", "email", "website",
    "physical_address", "mailing_address", "additional_location",
]


def connect(url: str, autocommit: bool):
    import psycopg

    return psycopg.connect(url, autocommit=autocommit)


def inspect_index(conn) -> dict:
    """
    Catalog-based inspection of any object currently named INDEX_NAME, explicitly schema-qualified
    -- an identically-named index/table in a different schema never satisfies this. Structural
    facts (schema, table, indexed column) come from pg_class/pg_namespace/pg_index/pg_attribute,
    never from the display-formatted indexdef string. The partial predicate is read via
    pg_get_expr(indpred, indrelid) -- the catalog's own canonical rendering of the stored
    expression -- and matched tolerantly against the required semantic components, since Postgres
    may canonicalize `is_agency_number = false` as `NOT is_agency_number` (or vice versa) and no
    simpler generic boolean-equivalence check exists in SQL alone.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              n.nspname AS index_schema,
              tn.nspname AS table_schema,
              t.relname AS table_name,
              i.indisvalid,
              i.indisready,
              pg_get_expr(i.indpred, i.indrelid) AS predicate_expr,
              (
                SELECT array_agg(a.attname ORDER BY k.ord)
                FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
              ) AS indexed_columns
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_index i ON i.indexrelid = c.oid
            JOIN pg_class t ON t.oid = i.indrelid
            JOIN pg_namespace tn ON tn.oid = t.relnamespace
            WHERE c.relname = %s
            """,
            (INDEX_NAME,),
        )
        row = cur.fetchone()
        if row is None:
            return {"exists": False}

        index_schema, table_schema, table_name, indisvalid, indisready, predicate_expr, indexed_columns = row
        indexed_columns = list(indexed_columns or [])
        norm_pred = re.sub(r"\s+", " ", (predicate_expr or "")).strip().lower()

        predicate_has_confirmed = "attribution_class = 'confirmed'" in norm_pred
        predicate_has_non_agency = (
            "is_agency_number = false" in norm_pred
            or "not is_agency_number" in norm_pred
            or "is_agency_number is false" in norm_pred
        )
        predicate_has_not_null = "attributed_license_id is not null" in norm_pred

        info = {
            "exists": True,
            "index_schema": index_schema,
            "table_schema": table_schema,
            "table_name": table_name,
            "indisvalid": bool(indisvalid),
            "indisready": bool(indisready),
            "indexed_columns": indexed_columns,
            "predicate_expr": predicate_expr,
            "schema_ok": index_schema == SCHEMA_NAME and table_schema == SCHEMA_NAME,
            "table_ok": table_name == TABLE_NAME,
            "column_ok": indexed_columns == [EXPECTED_COLUMN],
            "predicate_ok": predicate_has_confirmed and predicate_has_non_agency and predicate_has_not_null,
        }
        info["ready"] = info["indisvalid"] and info["indisready"]
        info["matches_intent"] = (
            info["schema_ok"] and info["table_ok"] and info["column_ok"] and info["predicate_ok"]
        )
        return info


def print_index_mismatch(info: dict) -> None:
    if not info["schema_ok"]:
        print(f"  MISMATCH: schema is (index={info['index_schema']}, table={info['table_schema']}), expected both '{SCHEMA_NAME}'.")
    if not info["table_ok"]:
        print(f"  MISMATCH: indexed table is '{info['table_name']}', expected '{TABLE_NAME}'.")
    if not info["column_ok"]:
        print(f"  MISMATCH: indexed column(s) are {info['indexed_columns']}, expected ['{EXPECTED_COLUMN}'].")
    if not info["predicate_ok"]:
        print(f"  MISMATCH: partial predicate does not match intent. Actual: {info['predicate_expr']!r}")


def run_checks(conn) -> dict:
    """Read-only. Never executes DDL. Safe to run anytime, including during the current incident."""
    out: dict = {}
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT to_regclass('{SCHEMA_NAME}.{TABLE_NAME}') IS NOT NULL AS exists"
        )
        out["table_exists"] = cur.fetchone()[0]

        cur.execute(f"SELECT count(*)::bigint FROM {SCHEMA_NAME}.{TABLE_NAME}")
        out["current_row_count"] = cur.fetchone()[0]

        cur.execute("SELECT current_database(), inet_server_addr()::text, current_user")
        db, addr, user = cur.fetchone()
        out["connected_database"] = db
        out["connected_server_addr"] = addr
        out["connected_user"] = user

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

    out["index"] = inspect_index(conn)
    return out


def print_checks(checks: dict) -> bool:
    """Returns True if it is safe to proceed to --apply."""
    print("=== pre-apply checks ===")
    for k, v in checks.items():
        if k == "index":
            continue
        print(f"  {k}: {v}")
    index = checks["index"]
    print(f"  index: {index}")

    safe = True
    if not checks["table_exists"]:
        print(f"BLOCKER: {SCHEMA_NAME}.{TABLE_NAME} does not exist on this connection.")
        safe = False

    if index["exists"]:
        if index["matches_intent"] and index["ready"]:
            print("NOTE: an index of this name already exists, matches the intended definition exactly, and is valid+ready -- --apply would be a safe no-op.")
        else:
            print(
                "BLOCKER: an object named "
                f"{INDEX_NAME} already exists but does NOT exactly match the intended "
                "schema/table/column/predicate, or is not valid+ready. Failing closed -- "
                "--apply is NOT treated as a safe no-op. Investigate and resolve manually "
                "(see the runbook's rollback/rebuild procedure) before proceeding."
            )
            if not index["matches_intent"]:
                print_index_mismatch(index)
            if not index["ready"]:
                print(f"  NOT READY: indisvalid={index['indisvalid']} indisready={index['indisready']}")
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


def run_verify(conn) -> bool:
    """
    Read-only post-apply verification. Every check below is a hard PASS/FAIL, printed as such;
    returns True only if every single one passed. Never treats a printed failure as informational.
    """
    results: list[tuple[str, bool, str]] = []

    def check(label: str, passed: bool, detail: str = "") -> None:
        results.append((label, passed, detail))
        print(f"{'PASS' if passed else 'FAIL'}  {label}" + (f" -- {detail}" if detail else ""))

    index = inspect_index(conn)
    check("index exists", index["exists"])
    if not index["exists"]:
        check("ALL CHECKS", False, "cannot continue -- index does not exist")
        return False

    check("index schema/table/column/predicate match intent", index["matches_intent"],
          "" if index["matches_intent"] else "see MISMATCH detail below")
    if not index["matches_intent"]:
        print_index_mismatch(index)
    check("index is valid", index["indisvalid"])
    check("index is ready", index["indisready"])

    if not (index["matches_intent"] and index["indisvalid"] and index["indisready"]):
        check("ALL CHECKS", False, "index exists but is unusable/incorrect -- stopping before running data checks")
        return all(p for _, p, _ in results)

    with conn.cursor() as cur:
        for label, slug, expected_rows in [
            ("JEMKO (contact-bearing)", JEMKO_SLUG, JEMKO_EXPECTED_ROWS),
            ("zero-contact fixture", ZERO_CONTACT_SLUG, ZERO_CONTACT_EXPECTED_ROWS),
        ]:
            try:
                cur.execute("SELECT id FROM contractors WHERE slug = %s", (slug,))
                contractor_row = cur.fetchone()
                if not contractor_row:
                    check(f"{label}: fixture contractor found", False, f"slug not found: {slug}")
                    continue
                contractor_id = contractor_row[0]

                # 1. Actual data result, not just the plan -- proves row-level stability, not only shape.
                cur.execute(CONTACT_QUERY, (contractor_id, CONTACT_KINDS))
                rows = cur.fetchall()
                check(
                    f"{label}: row count is exactly {expected_rows}",
                    len(rows) == expected_rows,
                    f"got {len(rows)}",
                )

                # 2. Plan shape (read-only EXPLAIN ANALYZE) -- separate query, same SQL text.
                cur.execute(f"EXPLAIN (ANALYZE, FORMAT TEXT) {CONTACT_QUERY}", (contractor_id, CONTACT_KINDS))
                plan_text = "\n".join(r[0] for r in cur.fetchall())
                uses_seq_scan = f"Seq Scan on {TABLE_NAME}" in plan_text
                uses_index = INDEX_NAME in plan_text
                exec_time_match = re.search(r"Execution Time:\s*([\d.]+)\s*ms", plan_text)
                exec_time = exec_time_match.group(1) if exec_time_match else "unknown"
                check(f"{label}: no Seq Scan on {TABLE_NAME}", not uses_seq_scan)
                check(f"{label}: intended index appears in the plan", uses_index)
                print(f"      ({label}) execution time: {exec_time} ms (pre-index baseline was ~16ms full-scan; informational only, not a pass/fail cutoff)")
                print(plan_text)
            except Exception as exc:  # noqa: BLE001 -- deliberately broad: any query error is a hard FAIL here
                check(f"{label}: contact query executed without error", False, repr(exc))

    all_passed = all(p for _, p, _ in results)
    print(f"\n=== verify {'PASSED' if all_passed else 'FAILED'} ({sum(p for _, p, _ in results)}/{len(results)} checks passed) ===")
    return all_passed


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
        index = checks["index"]
        if index["exists"] and index["matches_intent"] and index["ready"]:
            print("Index already exists, matches intent, and is ready. Nothing to do.")
            return 0
        sql = MIG.read_text(encoding="utf-8")
        print(
            "\nApplying (autocommit, no transaction wrapper -- required for CONCURRENTLY). "
            "Setting lock_timeout=5s (NOT statement_timeout) so the build fails fast if it "
            "cannot immediately acquire its initial lock, rather than queuing indefinitely; "
            "once acquired, the build itself is not subject to any timeout here."
        )
        with conn.cursor() as cur:
            cur.execute("SET lock_timeout = '5s'")
            cur.execute(sql)
        print("Applied. Run --verify next.")
        return 0

    if args.verify:
        conn = connect(url, autocommit=True)
        return 0 if run_verify(conn) else 1

    # default: --check
    conn = connect(url, autocommit=True)
    safe = print_checks(run_checks(conn))
    return 0 if safe else 1


if __name__ == "__main__":
    raise SystemExit(main())
