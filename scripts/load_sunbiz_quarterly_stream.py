#!/usr/bin/env python3
"""
Stream quarterly cordata.zip → Postgres without re-reading a 24GB staging CSV.

Processes each cordataN member, bulk COPY in chunks, ON CONFLICT DO NOTHING
(resume-friendly). High volume / long-running; set statement_timeout=0.
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
from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402
from ingest.normalize import fei_digits, normalize_entity_name  # noqa: E402
from scripts.load_sunbiz_to_postgres import (  # noqa: E402
    SOURCE_SYSTEM,
    _require_psycopg,
    connect_dsn,
    create_batch,
    parse_date,
)

log = logging.getLogger("load_sunbiz_stream")


def row_to_tuple(parsed: dict) -> tuple:
    officers = json.loads(parsed["officers_json"] or "[]")
    if not isinstance(officers, list):
        officers = []
    name_norm = parsed.get("name_normalized") or normalize_entity_name(parsed["legal_name"])
    city = parsed.get("city") or parsed.get("mail_city") or ""
    state = (parsed.get("state") or parsed.get("mail_state") or "FL")[:2].upper() or "FL"
    postal = parsed.get("postal_code") or parsed.get("mail_postal_code") or ""
    addr = parsed.get("principal_address") or ""
    if parsed.get("principal_address_2"):
        addr = f"{addr} {parsed['principal_address_2']}".strip()
    payload = {
        "document_number": parsed["external_key"],
        "entity_type_label": parsed.get("entity_type_label"),
        "name_normalized": name_norm,
        "status_raw": parsed.get("status_raw"),
        "last_transaction_date": parsed.get("last_transaction_date"),
    }
    return (
        SOURCE_SYSTEM,
        parsed["external_key"],
        parsed["legal_name"],
        name_norm,
        parsed.get("entity_type") or None,
        (parsed.get("status") or "").lower() or None,
        parse_date(parsed.get("formation_date")),
        fei_digits(parsed.get("fei_number")) or None,
        addr or None,
        city or None,
        state,
        postal or None,
        parsed.get("registered_agent_name") or None,
        json.dumps(officers, ensure_ascii=False),
        json.dumps(payload, ensure_ascii=False),
    )


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--zip",
        type=Path,
        default=ROOT / "data" / "raw" / "sunbiz" / "quarterly" / "cordata.zip",
    )
    p.add_argument("--batch-size", type=int, default=2500)
    p.add_argument("--active-only", action="store_true")
    p.add_argument(
        "--start-member",
        default="",
        help="Skip zip members before this name (e.g. cordata3.txt) for resume",
    )
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not args.zip.exists():
        log.error("Missing %s", args.zip)
        return 1

    psycopg, _Jsonb = _require_psycopg()
    dsn = connect_dsn()
    now = datetime.now(timezone.utc)
    total_upserted = 0
    total_read = 0

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SET statement_timeout = 0")
            cur.execute("SET idle_in_transaction_session_timeout = 0")
            conn.commit()

        batch_id = create_batch(
            conn,
            source_file=str(args.zip).replace("\\", "/"),
            row_count=None,
            checksum="stream-quarterly",
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
            nonlocal buffer, total_upserted
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
            total_upserted += n
            log.info("progress processed_batches_rows=%s", total_upserted)
            buffer = []

        with zipfile.ZipFile(args.zip, "r") as zf:
            members = sorted(n for n in zf.namelist() if not n.endswith("/"))
            if args.start_member:
                members = [m for m in members if m >= args.start_member]
                log.info("Resuming from member filter >= %s → %s", args.start_member, members)
            for member in members:
                log.info("member %s", member)
                member_rows = 0
                with zf.open(member, "r") as raw:
                    text = io.TextIOWrapper(raw, encoding="latin-1", errors="replace")
                    for line in text:
                        total_read += 1
                        parsed = parse_corporate_line(line)
                        if not parsed:
                            continue
                        if args.active_only and parsed.get("status") != "active":
                            continue
                        buffer.append(row_to_tuple(parsed))
                        member_rows += 1
                        if len(buffer) >= args.batch_size:
                            flush()
                log.info("member %s rows=%s", member, member_rows)
                flush()

        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM entities WHERE source_system = %s",
                (SOURCE_SYSTEM,),
            )
            db_total = cur.fetchone()[0]
        log.info("done read=%s flushed=%s db_fl_sunbiz=%s", total_read, total_upserted, db_total)
        print(
            json.dumps(
                {
                    "rows_read": total_read,
                    "rows_flushed": total_upserted,
                    "db_fl_sunbiz": db_total,
                }
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
