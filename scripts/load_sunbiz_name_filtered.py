#!/usr/bin/env python3
"""
Load Sunbiz quarterly entities that can possibly high-confidence-match DBPR contractors.

Streams cordata.zip, keeps only rows whose name_normalized is in the set of
contractor/license name variants. Typically << full 12.8M universe.
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ingest.adapters.fl_sunbiz import parse_corporate_line  # noqa: E402
from ingest.normalize import fei_digits, normalize_entity_name  # noqa: E402
from scripts.load_sunbiz_to_postgres import (  # noqa: E402
    SOURCE_SYSTEM,
    _require_psycopg,
    connect_dsn,
    create_batch,
    parse_date,
)
from scripts.load_sunbiz_quarterly_stream import row_to_tuple  # noqa: E402

log = logging.getLogger("load_sunbiz_filtered")


def load_contractor_name_set(conn) -> set[str]:
    names: set[str] = set()
    with conn.cursor() as cur:
        cur.execute("SET statement_timeout = 0")
        cur.execute(
            """
            SELECT display_name, legal_name, dba_name FROM contractors
            """
        )
        for display, legal, dba in cur:
            for n in (display, legal, dba):
                nn = normalize_entity_name(n or "")
                if nn:
                    names.add(nn)
        cur.execute(
            """
            SELECT DISTINCT licensee_name_raw, dba_name_raw FROM licenses
            WHERE licensee_name_raw IS NOT NULL OR dba_name_raw IS NOT NULL
            """
        )
        for lic, dba in cur:
            for n in (lic, dba):
                nn = normalize_entity_name(n or "")
                if nn:
                    names.add(nn)
    log.info("Contractor/license name variants: %s", len(names))
    return names


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--zip",
        type=Path,
        default=ROOT / "data" / "raw" / "sunbiz" / "quarterly" / "cordata.zip",
    )
    p.add_argument("--batch-size", type=int, default=3000)
    p.add_argument("--start-member", default="")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not args.zip.exists():
        log.error("Missing %s", args.zip)
        return 1

    psycopg, _ = _require_psycopg()
    dsn = connect_dsn()
    now = datetime.now(timezone.utc)
    stats = {"read": 0, "matched_name": 0, "flushed": 0, "skipped_parse": 0}

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = 0")
            cur.execute("SET idle_in_transaction_session_timeout = 0")
        conn.commit()

        names = load_contractor_name_set(conn)
        if not names:
            log.error("No contractor names found")
            return 1

        batch_id = create_batch(
            conn,
            source_file=str(args.zip).replace("\\", "/") + "#name-filtered",
            row_count=None,
            checksum="name-filtered-quarterly",
        )
        log.info("batch %s", batch_id)

        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TEMP TABLE sunbiz_stage (
                  source_system TEXT, external_key TEXT, legal_name TEXT,
                  name_normalized TEXT, entity_type TEXT, status TEXT,
                  formation_date DATE, fei_number TEXT, principal_address TEXT,
                  city TEXT, state TEXT, postal_code TEXT,
                  registered_agent_name TEXT, officers JSONB, raw_payload JSONB
                ) ON COMMIT PRESERVE ROWS
                """
            )
            conn.commit()

        buffer: list = []

        def flush() -> None:
            nonlocal buffer
            if not buffer:
                return
            n = len(buffer)
            with conn.cursor() as c2:
                c2.execute("SET statement_timeout = 0")
                c2.execute("TRUNCATE sunbiz_stage")
                with c2.copy(
                    """
                    COPY sunbiz_stage (
                      source_system, external_key, legal_name, name_normalized,
                      entity_type, status, formation_date, fei_number,
                      principal_address, city, state, postal_code,
                      registered_agent_name, officers, raw_payload
                    ) FROM STDIN
                    """
                ) as copy:
                    for t in buffer:
                        copy.write_row(t)
                c2.execute(
                    """
                    INSERT INTO entities (
                      source_system, external_key, legal_name, name_normalized, entity_type,
                      status, formation_date, fei_number, principal_address, city, state,
                      postal_code, registered_agent_name, officers, raw_payload,
                      ingest_batch_id, last_verified_at, updated_at
                    )
                    SELECT
                      source_system, external_key, legal_name, name_normalized, entity_type,
                      status, formation_date, fei_number, principal_address, city, state,
                      postal_code, registered_agent_name, officers, raw_payload,
                      %s, %s, %s
                    FROM sunbiz_stage
                    ON CONFLICT (source_system, external_key) DO UPDATE SET
                      legal_name = EXCLUDED.legal_name,
                      name_normalized = EXCLUDED.name_normalized,
                      entity_type = EXCLUDED.entity_type,
                      status = EXCLUDED.status,
                      formation_date = EXCLUDED.formation_date,
                      fei_number = EXCLUDED.fei_number,
                      principal_address = EXCLUDED.principal_address,
                      city = EXCLUDED.city,
                      state = EXCLUDED.state,
                      postal_code = EXCLUDED.postal_code,
                      registered_agent_name = EXCLUDED.registered_agent_name,
                      officers = EXCLUDED.officers,
                      raw_payload = EXCLUDED.raw_payload,
                      ingest_batch_id = EXCLUDED.ingest_batch_id,
                      last_verified_at = EXCLUDED.last_verified_at,
                      updated_at = EXCLUDED.updated_at
                    """,
                    (batch_id, now, now),
                )
            conn.commit()
            stats["flushed"] += n
            log.info(
                "flushed=%s matched_so_far=%s read=%s",
                stats["flushed"],
                stats["matched_name"],
                stats["read"],
            )
            buffer = []

        with zipfile.ZipFile(args.zip, "r") as zf:
            members = sorted(n for n in zf.namelist() if not n.endswith("/"))
            if args.start_member:
                members = [m for m in members if m >= args.start_member]
            for member in members:
                log.info("scanning %s", member)
                with zf.open(member, "r") as raw:
                    text = io.TextIOWrapper(raw, encoding="latin-1", errors="replace")
                    for line in text:
                        stats["read"] += 1
                        if stats["read"] % 500_000 == 0:
                            log.info(
                                "scan progress read=%s matched=%s",
                                stats["read"],
                                stats["matched_name"],
                            )
                        parsed = parse_corporate_line(line)
                        if not parsed:
                            stats["skipped_parse"] = stats.get("skipped_parse", 0) + 1
                            continue
                        nn = parsed.get("name_normalized") or normalize_entity_name(
                            parsed["legal_name"]
                        )
                        if nn not in names:
                            continue
                        stats["matched_name"] += 1
                        buffer.append(row_to_tuple(parsed))
                        if len(buffer) >= args.batch_size:
                            flush()
                flush()
                log.info(
                    "member %s done matched_total=%s", member, stats["matched_name"]
                )

        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM entities WHERE source_system = %s",
                (SOURCE_SYSTEM,),
            )
            db_total = cur.fetchone()[0]
        log.info("COMPLETE %s db_fl_sunbiz=%s", stats, db_total)
        print(json.dumps({**stats, "db_fl_sunbiz": db_total}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
