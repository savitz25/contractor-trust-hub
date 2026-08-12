#!/usr/bin/env python3
"""Load a shard of the Sunbiz staging CSV (hash(external_key) % n == shard)."""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Reuse loader internals
from scripts.load_sunbiz_to_postgres import (  # type: ignore
    SOURCE_SYSTEM,
    _require_psycopg,
    _transform_row,
    connect_dsn,
    create_batch,
    file_sha256,
    iter_csv,
)
import logging
from datetime import datetime, timezone
import json

log = logging.getLogger("load_sunbiz_shard")


def shard_of(key: str, n: int) -> int:
    h = hashlib.md5(key.encode("utf-8")).hexdigest()
    return int(h[:8], 16) % n


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--staging-dir", type=Path, required=True)
    p.add_argument("--shard", type=int, required=True)
    p.add_argument("--shards", type=int, default=4)
    p.add_argument("--batch-size", type=int, default=3000)
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    path = args.staging_dir / "entities_normalized.csv"
    psycopg, Jsonb = _require_psycopg()
    dsn = connect_dsn()

    now = datetime.now(timezone.utc)
    copy_chunk = args.batch_size
    stats = {"rows_read": 0, "upserted": 0, "skipped": 0}

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = 0")
            cur.execute("SET idle_in_transaction_session_timeout = 0")
            conn.commit()

        checksum = file_sha256(path) if path.stat().st_size < 5_000_000_000 else "skipped-large"
        batch_id = create_batch(
            conn,
            source_file=f"{path}#shard{args.shard}/{args.shards}",
            row_count=None,
            checksum=str(checksum)[:64],
        )
        log.info("shard %s/%s batch %s", args.shard, args.shards, batch_id)

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
                    ON CONFLICT (source_system, external_key) DO NOTHING
                    """,
                    (batch_id, now, now),
                )
            conn.commit()
            stats["upserted"] += n
            log.info("shard %s progress %s", args.shard, stats["upserted"])
            buffer = []

        for row in iter_csv(path):
            stats["rows_read"] += 1
            result = _transform_row(row, active_only=False)
            if result is None:
                stats["skipped"] += 1
                continue
            kind, tup = result
            if kind != "ok":
                continue
            if shard_of(tup[1], args.shards) != args.shard:
                continue
            buffer.append(tup)
            if len(buffer) >= copy_chunk:
                flush()
        flush()

    log.info("shard %s done %s", args.shard, stats)
    print(json.dumps({"shard": args.shard, **stats}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
