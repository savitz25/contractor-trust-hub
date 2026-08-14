#!/usr/bin/env python3
"""
Load staged Louisiana LSLBC contractor licenses into Postgres.

Idempotent upserts:
  - licenses on (source_system, external_key)
  - contractors on slug

Usage:
  python scripts/load_la_lslbc_to_postgres.py --staging-dir data/staging/la_lslbc
  python scripts/load_la_lslbc_to_postgres.py --staging-dir data/staging/la_lslbc --limit 1000
  python scripts/load_la_lslbc_to_postgres.py --init-schema --staging-dir data/staging/la_lslbc
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import os
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402

SOURCE_SYSTEM = "la_lslbc"
SOURCE_URL = "https://arlspublic.lslbc.louisiana.gov/Public/RequestRoster"

log = logging.getLogger("load_la_lslbc")


def _require_psycopg():
    try:
        import psycopg
        from psycopg.types.json import Jsonb
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "psycopg is required. Install with:\n"
            "  pip install 'psycopg[binary]>=3.1'\n"
            f"Original error: {exc}"
        ) from exc
    return psycopg, Jsonb


def connect_dsn() -> str:
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    timeout = os.environ.get("PGCONNECT_TIMEOUT", "15")
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if url:
        return normalize_database_url(url, connect_timeout=timeout)
    host = os.environ.get("PGHOST", "localhost")
    port = os.environ.get("PGPORT", "5432")
    db = os.environ.get("PGDATABASE", "contractor_trust_hub")
    user = os.environ.get("PGUSER", "postgres")
    password = os.environ.get("PGPASSWORD", "")
    parts = [
        f"host={host}",
        f"port={port}",
        f"dbname={db}",
        f"user={user}",
        f"connect_timeout={timeout}",
    ]
    if password:
        parts.append(f"password={password}")
    if host.endswith("supabase.co") or "supabase.com" in host:
        parts.append("sslmode=require")
    return " ".join(parts)


def parse_date(value: str | None) -> date | None:
    v = (value or "").strip()
    if not v:
        return None
    if "T" in v:
        v = v.split("T", 1)[0]
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            continue
    return None


def parse_json(value: str | None) -> dict[str, Any] | None:
    v = (value or "").strip()
    if not v:
        return None
    try:
        data = json.loads(v)
        return data if isinstance(data, dict) else {"_value": data}
    except json.JSONDecodeError:
        return {"_raw": v}


def slugify(*parts: str, max_len: int = 120) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", raw.lower()).strip("-")
    return (s or "unknown")[:max_len]


def iter_csv(path: Path) -> Iterator[dict[str, str]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield {k: (v or "").strip() if isinstance(v, str) else "" for k, v in row.items()}


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def apply_schema(conn, schema_path: Path) -> None:
    sql = schema_path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    log.info("Applied schema from %s", schema_path)


def create_batch(
    conn,
    *,
    source_dataset: str,
    source_file: str | None,
    source_url: str | None,
    row_count: int | None,
    checksum: str | None,
    notes: str | None,
) -> UUID:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ingest_batches (
              source_system, source_dataset, source_url, source_file,
              extracted_at, row_count, checksum_sha256, notes
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING id
            """,
            (
                SOURCE_SYSTEM,
                source_dataset,
                source_url,
                source_file,
                datetime.now(timezone.utc),
                row_count,
                checksum,
                notes,
            ),
        )
        batch_id = cur.fetchone()[0]
    conn.commit()
    return batch_id


def load_licenses(
    conn,
    path: Path,
    *,
    batch_id: UUID,
    limit: int | None,
    batch_size: int,
    Jsonb,
) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    stats = {
        "rows_read": 0,
        "contractors_upserted": 0,
        "licenses_upserted": 0,
        "skipped": 0,
    }

    contractor_sql = """
        INSERT INTO contractors (
          slug, display_name, legal_name, dba_name, home_state,
          primary_city, primary_county, is_thin_profile, updated_at
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, FALSE, %s
        )
        ON CONFLICT (slug) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          legal_name = EXCLUDED.legal_name,
          dba_name = EXCLUDED.dba_name,
          home_state = EXCLUDED.home_state,
          primary_city = EXCLUDED.primary_city,
          primary_county = EXCLUDED.primary_county,
          updated_at = EXCLUDED.updated_at
        RETURNING id
    """

    license_sql = """
        INSERT INTO licenses (
          contractor_id, source_system, source_board, external_key, occupation_code,
          occupation_description, license_number, class_code, licensee_name_raw, dba_name_raw,
          primary_status, secondary_status, status_normalized,
          original_licensure_date, effective_date, expiration_date,
          address_line_1, address_line_2, address_line_3, city, state, postal_code,
          county_code, county_name, board_number, raw_payload, ingest_batch_id,
          last_seen_at, last_verified_at, updated_at
        ) VALUES (
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s,
          %s, %s, %s,
          %s, %s, %s,
          %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s,
          %s, %s, %s
        )
        ON CONFLICT (source_system, external_key) DO UPDATE SET
          contractor_id = EXCLUDED.contractor_id,
          source_board = EXCLUDED.source_board,
          occupation_code = EXCLUDED.occupation_code,
          occupation_description = EXCLUDED.occupation_description,
          license_number = EXCLUDED.license_number,
          class_code = EXCLUDED.class_code,
          licensee_name_raw = EXCLUDED.licensee_name_raw,
          dba_name_raw = EXCLUDED.dba_name_raw,
          primary_status = EXCLUDED.primary_status,
          secondary_status = EXCLUDED.secondary_status,
          status_normalized = EXCLUDED.status_normalized,
          original_licensure_date = EXCLUDED.original_licensure_date,
          effective_date = EXCLUDED.effective_date,
          expiration_date = EXCLUDED.expiration_date,
          address_line_1 = EXCLUDED.address_line_1,
          address_line_2 = EXCLUDED.address_line_2,
          address_line_3 = EXCLUDED.address_line_3,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          postal_code = EXCLUDED.postal_code,
          county_code = EXCLUDED.county_code,
          county_name = EXCLUDED.county_name,
          board_number = EXCLUDED.board_number,
          raw_payload = EXCLUDED.raw_payload,
          ingest_batch_id = EXCLUDED.ingest_batch_id,
          last_seen_at = EXCLUDED.last_seen_at,
          last_verified_at = EXCLUDED.last_verified_at,
          updated_at = EXCLUDED.updated_at
    """

    with conn.cursor() as cur:
        for row in iter_csv(path):
            stats["rows_read"] += 1
            if limit is not None and stats["licenses_upserted"] >= limit:
                break

            external_key = (row.get("external_key") or "").strip()
            licensee_name = row.get("licensee_name_raw") or ""
            if not external_key or not licensee_name:
                stats["skipped"] += 1
                continue

            display = licensee_name
            slug = slugify(external_key, display)
            state = (row.get("state") or "LA")[:2].upper() or "LA"
            county = row.get("county_name") or row.get("county_code") or ""

            cur.execute(
                contractor_sql,
                (
                    slug,
                    display,
                    licensee_name,
                    row.get("dba_name_raw") or None,
                    "LA",
                    row.get("city") or None,
                    county or None,
                    now,
                ),
            )
            contractor_id = cur.fetchone()[0]
            stats["contractors_upserted"] += 1

            payload = parse_json(row.get("raw_payload_json"))
            cur.execute(
                license_sql,
                (
                    contractor_id,
                    row.get("source_system") or SOURCE_SYSTEM,
                    row.get("source_board") or "LSLBC",
                    external_key,
                    (row.get("occupation_code") or "").upper() or "CLC",
                    row.get("occupation_description") or None,
                    row.get("license_number") or None,
                    row.get("class_code") or None,
                    licensee_name,
                    row.get("dba_name_raw") or None,
                    row.get("primary_status") or None,
                    row.get("secondary_status") or None,
                    row.get("status_normalized") or None,
                    parse_date(row.get("original_licensure_date")),
                    parse_date(row.get("effective_date")),
                    parse_date(row.get("expiration_date")),
                    row.get("address_line_1") or None,
                    row.get("address_line_2") or None,
                    row.get("address_line_3") or None,
                    row.get("city") or None,
                    state,
                    row.get("postal_code") or None,
                    row.get("county_code") or None,
                    row.get("county_name") or None,
                    row.get("board_number") or "LSLBC",
                    Jsonb(payload) if payload is not None else None,
                    batch_id,
                    now,
                    now,
                    now,
                ),
            )
            stats["licenses_upserted"] += 1

            if stats["licenses_upserted"] % batch_size == 0:
                conn.commit()
                log.info("  licenses progress: %s", stats["licenses_upserted"])

    conn.commit()
    return stats


def print_db_summary(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM licenses WHERE source_system = %s", (SOURCE_SYSTEM,)
        )
        lic = cur.fetchone()[0]
        cur.execute(
            """
            SELECT COALESCE(occupation_description, occupation_code), COUNT(*)
            FROM licenses WHERE source_system = %s
            GROUP BY 1 ORDER BY 2 DESC LIMIT 12
            """,
            (SOURCE_SYSTEM,),
        )
        by_type = cur.fetchall()
        cur.execute(
            """
            SELECT COALESCE(status_normalized, '(null)'), COUNT(*)
            FROM licenses WHERE source_system = %s
            GROUP BY 1 ORDER BY 2 DESC
            """,
            (SOURCE_SYSTEM,),
        )
        by_status = cur.fetchall()
    log.info("DB la_lslbc licenses = %s", lic)
    log.info("DB by type:")
    for r in by_type:
        log.info("  %s: %s", r[0], r[1])
    log.info("DB by status:")
    for r in by_status:
        log.info("  %s: %s", r[0], r[1])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Load staged Louisiana LSLBC data into Postgres")
    parser.add_argument(
        "--staging-dir",
        type=Path,
        default=ROOT / "data" / "staging" / "la_lslbc",
    )
    parser.add_argument(
        "--schema",
        type=Path,
        default=ROOT / "schema" / "initial_schema.sql",
    )
    parser.add_argument("--init-schema", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    psycopg, Jsonb = _require_psycopg()
    lic_path = args.staging_dir / "licenses_normalized.csv"
    dsn = connect_dsn()
    log.info("Connecting to Postgres…")
    log.info("Staging dir: %s", args.staging_dir)

    summary: dict[str, Any] = {
        "staging_dir": str(args.staging_dir),
        "source_system": SOURCE_SYSTEM,
        "coverage_note": (
            "Louisiana LSLBC official public roster — Active commercial / residential / home improvement / mold. No trade classifications, qualifying parties, bond, insurance, or discipline on this export."
        ),
    }

    try:
        with psycopg.connect(dsn) as conn:
            if args.init_schema:
                apply_schema(conn, args.schema)

            if not lic_path.exists():
                log.error("Missing licenses file: %s", lic_path)
                log.error(
                    "Run: python scripts/download_la_lslbc.py && "
                    "python -m ingest.adapters.la_lslbc --input data/raw/la_lslbc/lslbc_contractor_roster.csv"
                )
                return 1

            checksum = file_sha256(lic_path)
            batch_id = create_batch(
                conn,
                source_dataset="lslbc_contractor_roster",
                source_file=str(lic_path).replace("\\", "/"),
                source_url=SOURCE_URL,
                row_count=None,
                checksum=checksum,
                notes=(
                    "load_la_lslbc_to_postgres — Louisiana LSLBC official public roster"
                ),
            )
            log.info("Loading licenses from %s (batch %s)", lic_path, batch_id)
            stats = load_licenses(
                conn,
                lic_path,
                batch_id=batch_id,
                limit=args.limit,
                batch_size=args.batch_size,
                Jsonb=Jsonb,
            )
            summary["licenses"] = stats
            log.info("Licenses done: %s", stats)
            print_db_summary(conn)
    except Exception as exc:
        # OperationalError and others
        if "psycopg" in type(exc).__module__ or "connect" in str(exc).lower():
            log.error("Could not connect or load: %s", exc)
            log.error("Set DATABASE_URL (Session pooler). See docs/LOAD_PATH.md")
            return 2
        raise

    out_path = args.staging_dir / "load_summary.json"
    try:
        args.staging_dir.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
        log.info("Wrote %s", out_path)
    except OSError as exc:
        log.warning("Could not write summary file: %s", exc)

    log.info("Louisiana LSLBC load complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
