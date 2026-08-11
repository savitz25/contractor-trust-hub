#!/usr/bin/env python3
"""
Load staged Florida Sunbiz corporate entities into Postgres.

Idempotent upserts on (source_system, external_key) where source_system=fl_sunbiz
and external_key = document number.

Usage:
  python scripts/load_sunbiz_to_postgres.py --init-schema
  python scripts/load_sunbiz_to_postgres.py --staging-dir data/staging/fl_sunbiz
  python scripts/load_sunbiz_to_postgres.py --limit 5000
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402
from ingest.normalize import fei_digits, normalize_entity_name, zip5  # noqa: E402

SOURCE_SYSTEM = "fl_sunbiz"
SOURCE_URL = "https://dos.fl.gov/sunbiz/other-services/data-downloads/"
log = logging.getLogger("load_sunbiz")


def _require_psycopg():
    try:
        import psycopg
        from psycopg.types.json import Jsonb
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "psycopg is required. pip install 'psycopg[binary]>=3.1'\n" f"{exc}"
        ) from exc
    return psycopg, Jsonb


def connect_dsn() -> str:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    timeout = os.environ.get("PGCONNECT_TIMEOUT", "20")
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set (.env.local)")
    return normalize_database_url(url, connect_timeout=timeout)


def parse_date(value: str | None) -> date | None:
    v = (value or "").strip()
    if not v:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m%d%Y", "%Y%m%d"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            continue
    return None


def parse_json(value: str | None) -> Any:
    v = (value or "").strip()
    if not v:
        return None
    try:
        return json.loads(v)
    except json.JSONDecodeError:
        return {"_raw": v}


def iter_csv(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.DictReader(f):
            yield {k: (v or "").strip() if isinstance(v, str) else "" for k, v in row.items()}


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def apply_migrations(conn) -> None:
    """
    Greenfield: full initial_schema.sql then additive migration.
    Live DB (entities already present): additive migration only — CREATE TABLE IF NOT
    EXISTS would leave old columns missing while new CREATE INDEX statements fail.
    """
    initial = ROOT / "schema" / "initial_schema.sql"
    mig = ROOT / "schema" / "migrations" / "001_sunbiz_linker.sql"
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.entities')")
        has_entities = cur.fetchone()[0] is not None
        if not has_entities and initial.exists():
            log.info("Applying %s (greenfield)", initial.name)
            cur.execute(initial.read_text(encoding="utf-8"))
        if mig.exists():
            log.info("Applying %s", mig.name)
            cur.execute(mig.read_text(encoding="utf-8"))
    conn.commit()


def create_batch(conn, *, source_file: str, row_count: int | None, checksum: str) -> UUID:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ingest_batches (
              source_system, source_dataset, source_url, source_file,
              extracted_at, row_count, checksum_sha256, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                SOURCE_SYSTEM,
                "corporate_entities",
                SOURCE_URL,
                source_file,
                datetime.now(timezone.utc),
                row_count,
                checksum,
                "load_sunbiz_to_postgres",
            ),
        )
        batch_id = cur.fetchone()[0]
    conn.commit()
    return batch_id


def load_entities(
    conn,
    path: Path,
    *,
    batch_id: UUID,
    limit: int | None,
    batch_size: int,
    Jsonb,
    active_only: bool,
) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    stats = {"rows_read": 0, "upserted": 0, "skipped": 0, "active_only_skipped": 0}

    sql = """
        INSERT INTO entities (
          source_system, external_key, legal_name, name_normalized, entity_type,
          status, formation_date, fei_number, principal_address, city, state,
          postal_code, registered_agent_name, officers, raw_payload,
          ingest_batch_id, last_verified_at, updated_at
        ) VALUES (
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s
        )
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
    """

    with conn.cursor() as cur:
        for row in iter_csv(path):
            stats["rows_read"] += 1
            if limit is not None and stats["upserted"] >= limit:
                break

            external_key = row.get("external_key", "").strip().upper()
            legal_name = row.get("legal_name", "").strip()
            if not external_key or not legal_name:
                stats["skipped"] += 1
                continue

            status = (row.get("status") or "").strip().lower()
            if active_only and status and status != "active":
                stats["active_only_skipped"] += 1
                continue

            officers = parse_json(row.get("officers_json"))
            if not isinstance(officers, list):
                officers = []

            payload = parse_json(row.get("raw_payload_json"))
            if not isinstance(payload, dict):
                payload = {"_raw": row.get("raw_payload_json")}

            # Enrich payload with staging fields useful for linker evidence
            payload = {
                **payload,
                "entity_type_label": row.get("entity_type_label"),
                "name_normalized": row.get("name_normalized")
                or normalize_entity_name(legal_name),
                "registered_agent_name": row.get("registered_agent_name"),
                "mail_city": row.get("mail_city"),
                "mail_postal_code": row.get("mail_postal_code"),
            }

            name_norm = row.get("name_normalized") or normalize_entity_name(legal_name)
            # Prefer principal city/state; fall back to mail
            city = row.get("city") or row.get("mail_city") or ""
            state = (row.get("state") or row.get("mail_state") or "FL")[:2].upper() or "FL"
            postal = row.get("postal_code") or row.get("mail_postal_code") or ""
            addr = row.get("principal_address") or ""
            if row.get("principal_address_2"):
                addr = f"{addr} {row['principal_address_2']}".strip()

            fei = fei_digits(row.get("fei_number"))

            cur.execute(
                sql,
                (
                    row.get("source_system") or SOURCE_SYSTEM,
                    external_key,
                    legal_name,
                    name_norm,
                    row.get("entity_type") or None,
                    status or None,
                    parse_date(row.get("formation_date")),
                    fei or None,
                    addr or None,
                    city or None,
                    state,
                    postal or None,
                    row.get("registered_agent_name") or None,
                    Jsonb(officers),
                    Jsonb(payload),
                    batch_id,
                    now,
                    now,
                ),
            )
            stats["upserted"] += 1
            if stats["upserted"] % batch_size == 0:
                conn.commit()
                log.info("  sunbiz entities progress: %s", stats["upserted"])

    conn.commit()
    return stats


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Load staged Sunbiz entities into Postgres")
    p.add_argument(
        "--staging-dir",
        type=Path,
        default=ROOT / "data" / "staging" / "fl_sunbiz",
    )
    p.add_argument("--init-schema", action="store_true")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--batch-size", type=int, default=500)
    p.add_argument("--active-only", action="store_true")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    entities_path = args.staging_dir / "entities_normalized.csv"
    if not entities_path.exists():
        log.error("Missing %s — run ingest/adapters/fl_sunbiz.py first", entities_path)
        return 1

    psycopg, Jsonb = _require_psycopg()
    dsn = connect_dsn()
    log.info("Connecting…")
    log.info("Staging: %s", entities_path)

    summary: dict[str, Any] = {"staging": str(entities_path)}

    with psycopg.connect(dsn) as conn:
        if args.init_schema:
            apply_migrations(conn)

        checksum = file_sha256(entities_path)
        batch_id = create_batch(
            conn,
            source_file=str(entities_path).replace("\\", "/"),
            row_count=None,
            checksum=checksum,
        )
        log.info("Batch %s", batch_id)
        stats = load_entities(
            conn,
            entities_path,
            batch_id=batch_id,
            limit=args.limit,
            batch_size=args.batch_size,
            Jsonb=Jsonb,
            active_only=args.active_only,
        )
        summary["entities"] = stats
        log.info("Entities load: %s", stats)

        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM entities WHERE source_system = %s",
                (SOURCE_SYSTEM,),
            )
            total = cur.fetchone()[0]
            cur.execute(
                """
                SELECT status, COUNT(*) FROM entities
                WHERE source_system = %s GROUP BY 1 ORDER BY 2 DESC
                """,
                (SOURCE_SYSTEM,),
            )
            by_status = cur.fetchall()
        log.info("DB fl_sunbiz entities total=%s by_status=%s", total, by_status)
        summary["db_total_fl_sunbiz"] = total
        summary["db_by_status"] = by_status

    out = args.staging_dir / "load_summary.json"
    try:
        out.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
        log.info("Wrote %s", out)
    except OSError as exc:
        log.warning("Could not write summary: %s", exc)

    log.info("Load complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
