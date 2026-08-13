#!/usr/bin/env python3
"""
Load staged New Jersey DCA / HIC registrations into Postgres.

Idempotent upserts on licenses (source_system, external_key) and contractor shells by slug.

Usage:
  python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca
  python scripts/load_nj_dca_to_postgres.py --staging-dir data/staging/nj_dca --limit 100
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

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402

SOURCE_SYSTEM = "nj_dca"
SOURCE_URL = "https://www.njconsumeraffairs.gov/"

log = logging.getLogger("load_nj_dca")


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


def load_manifest(staging: Path) -> dict[str, Any]:
    p = staging / "batch_manifest.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {
        "source_system": SOURCE_SYSTEM,
        "source_dataset": "contractor_hic_registration",
        "source_url": SOURCE_URL,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "notes": "NJ DCA load without manifest",
    }


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--staging-dir", type=Path, default=ROOT / "data/staging/nj_dca")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    lic_path = args.staging_dir / "licenses_normalized.csv"
    if not lic_path.exists():
        log.error("Missing %s — run: python -m ingest.adapters.nj_dca --input ...", lic_path)
        return 1

    psycopg, Jsonb = _require_psycopg()
    manifest = load_manifest(args.staging_dir)
    dsn = connect_dsn()

    rows = list(iter_csv(lic_path))
    if args.limit:
        rows = rows[: args.limit]

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ingest_batches (
                  source_system, source_dataset, source_url, source_file,
                  extracted_at, row_count, checksum_sha256, notes
                ) VALUES (%s,%s,%s,%s,COALESCE(%s::timestamptz, now()),%s,%s,%s)
                RETURNING id
                """,
                (
                    SOURCE_SYSTEM,
                    manifest.get("source_dataset") or "contractor_hic_registration",
                    manifest.get("source_url") or SOURCE_URL,
                    str(lic_path),
                    manifest.get("extracted_at"),
                    len(rows),
                    manifest.get("checksum_sha256") or file_sha256(lic_path),
                    manifest.get("notes") or "NJ Stage 7 pilot load",
                ),
            )
            batch_id = cur.fetchone()[0]
            log.info("ingest_batch %s", batch_id)

            n = 0
            slug_to_id: dict[str, Any] = {}
            for r in rows:
                external_key = (r.get("external_key") or "").strip()
                if not external_key:
                    continue
                raw = parse_json(r.get("raw_payload_json")) or {}
                display = (
                    (raw.get("business_name") or "").strip()
                    or (r.get("licensee_name_raw") or "").strip()
                    or external_key
                )
                legal = display
                dba = (r.get("dba_name_raw") or raw.get("owner_name") or "").strip() or None
                slug = slugify("nj", external_key, display)
                home_state = (r.get("state") or "NJ")[:2].upper()
                city = r.get("city") or None
                county = r.get("county_name") or None
                search_blob = (r.get("licensee_name_raw") or display).strip()

                cur.execute(
                    """
                    INSERT INTO contractors (
                      slug, display_name, legal_name, dba_name, home_state,
                      primary_city, primary_county, is_thin_profile, updated_at
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,false,now())
                    ON CONFLICT (slug) DO UPDATE SET
                      display_name = EXCLUDED.display_name,
                      legal_name = COALESCE(EXCLUDED.legal_name, contractors.legal_name),
                      dba_name = COALESCE(EXCLUDED.dba_name, contractors.dba_name),
                      home_state = EXCLUDED.home_state,
                      primary_city = COALESCE(EXCLUDED.primary_city, contractors.primary_city),
                      primary_county = COALESCE(EXCLUDED.primary_county, contractors.primary_county),
                      updated_at = now()
                    RETURNING id
                    """,
                    (
                        slug,
                        display,
                        legal,
                        dba,
                        home_state,
                        city,
                        county,
                    ),
                )
                contractor_id = cur.fetchone()[0]
                slug_to_id[slug] = contractor_id

                cur.execute(
                    """
                    INSERT INTO licenses (
                      contractor_id, source_system, source_board, external_key,
                      occupation_code, occupation_description, license_number, class_code,
                      licensee_name_raw, dba_name_raw, primary_status, secondary_status,
                      status_normalized, expiration_date, address_line_1, address_line_2,
                      city, state, postal_code, county_name, board_number, raw_payload,
                      ingest_batch_id, last_seen_at, last_verified_at, updated_at
                    ) VALUES (
                      %s,%s,%s,%s,
                      %s,%s,%s,%s,
                      %s,%s,%s,%s,
                      %s,%s,%s,%s,
                      %s,%s,%s,%s,%s,%s,
                      %s,now(),now(),now()
                    )
                    ON CONFLICT (source_system, external_key) DO UPDATE SET
                      contractor_id = EXCLUDED.contractor_id,
                      occupation_code = EXCLUDED.occupation_code,
                      occupation_description = EXCLUDED.occupation_description,
                      status_normalized = EXCLUDED.status_normalized,
                      primary_status = EXCLUDED.primary_status,
                      licensee_name_raw = EXCLUDED.licensee_name_raw,
                      dba_name_raw = EXCLUDED.dba_name_raw,
                      expiration_date = EXCLUDED.expiration_date,
                      city = EXCLUDED.city,
                      county_name = EXCLUDED.county_name,
                      raw_payload = EXCLUDED.raw_payload,
                      ingest_batch_id = EXCLUDED.ingest_batch_id,
                      last_seen_at = now(),
                      last_verified_at = now(),
                      updated_at = now()
                    """,
                    (
                        contractor_id,
                        SOURCE_SYSTEM,
                        r.get("source_board") or "NJ_DCA",
                        external_key,
                        r.get("occupation_code") or "HIC",
                        r.get("occupation_description") or "Home Improvement Contractor",
                        r.get("license_number") or None,
                        r.get("class_code") or None,
                        search_blob,
                        r.get("dba_name_raw") or None,
                        r.get("primary_status") or None,
                        r.get("secondary_status") or None,
                        r.get("status_normalized") or "unknown",
                        parse_date(r.get("expiration_date")),
                        r.get("address_line_1") or None,
                        r.get("address_line_2") or None,
                        city,
                        home_state,
                        r.get("postal_code") or None,
                        county,
                        r.get("board_number") or "NJ_DCA",
                        Jsonb(raw or {}),
                        batch_id,
                    ),
                )
                n += 1

            # High-confidence entities
            ent_path = args.staging_dir / "entities_normalized.csv"
            ent_n = 0
            if ent_path.exists():
                for e in iter_csv(ent_path):
                    cslug = (e.get("contractor_slug") or "").strip()
                    cid = slug_to_id.get(cslug)
                    if not cid:
                        continue
                    ekey = (e.get("external_key") or "").strip()
                    ename = (e.get("legal_name") or "").strip()
                    if not ekey or not ename:
                        continue
                    officers = parse_json(e.get("officers_json"))
                    if isinstance(officers, dict):
                        officers = [officers]
                    if not isinstance(officers, list):
                        officers = []
                    conf = float(e.get("confidence") or "0.95")
                    cur.execute(
                        """
                        INSERT INTO entities (
                          source_system, external_key, legal_name, name_normalized,
                          entity_type, status, formation_date, principal_address,
                          city, state, postal_code, county_name, registered_agent_name,
                          officers, raw_payload, ingest_batch_id, last_verified_at, updated_at
                        ) VALUES (
                          %s,%s,%s,%s,
                          %s,%s,%s,%s,
                          %s,%s,%s,%s,%s,
                          %s,%s,%s,now(),now()
                        )
                        ON CONFLICT (source_system, external_key) DO UPDATE SET
                          legal_name = EXCLUDED.legal_name,
                          status = EXCLUDED.status,
                          formation_date = EXCLUDED.formation_date,
                          officers = EXCLUDED.officers,
                          last_verified_at = now(),
                          updated_at = now()
                        RETURNING id
                        """,
                        (
                            e.get("source_system") or "nj_sos",
                            ekey,
                            ename,
                            e.get("name_normalized") or ename.upper(),
                            e.get("entity_type") or "business",
                            e.get("status") or None,
                            parse_date(e.get("formation_date")),
                            e.get("principal_address") or None,
                            e.get("city") or None,
                            (e.get("state") or "NJ")[:2],
                            e.get("postal_code") or None,
                            e.get("county_name") or None,
                            e.get("registered_agent_name") or None,
                            Jsonb(officers),
                            Jsonb({"match_method": e.get("match_method")}),
                            batch_id,
                        ),
                    )
                    entity_id = cur.fetchone()[0]
                    cur.execute(
                        """
                        INSERT INTO contractor_entities (
                          contractor_id, entity_id, role, confidence, match_method, evidence, linked_at
                        ) VALUES (%s,%s,%s,%s,%s,%s,now())
                        ON CONFLICT (contractor_id, entity_id, role) DO UPDATE SET
                          confidence = EXCLUDED.confidence,
                          match_method = EXCLUDED.match_method,
                          evidence = EXCLUDED.evidence
                        """,
                        (
                            cid,
                            entity_id,
                            e.get("role") or "linked",
                            conf,
                            e.get("match_method") or "exact_registration_entity_key",
                            Jsonb({"source": "nj_stage8a"}),
                        ),
                    )
                    ent_n += 1

            # Enforcement / public actions → discipline_actions
            enf_path = args.staging_dir / "enforcement_normalized.csv"
            enf_n = 0
            if enf_path.exists():
                for d in iter_csv(enf_path):
                    cslug = (d.get("contractor_slug") or "").strip()
                    cid = slug_to_id.get(cslug)
                    if not cid:
                        continue
                    dkey = (d.get("external_key") or "").strip()
                    if not dkey:
                        continue
                    cur.execute(
                        """
                        INSERT INTO discipline_actions (
                          contractor_id, source_system, source_dataset, external_key,
                          complaint_number, license_type, license_number_raw, respondent_name,
                          classification, entered_date, disposition, disposition_date,
                          discipline_description, violation_code, city, state, postal_code,
                          county_name, raw_payload, ingest_batch_id, last_verified_at, updated_at
                        ) VALUES (
                          %s,%s,%s,%s,
                          %s,%s,%s,%s,
                          %s,%s,%s,%s,
                          %s,%s,%s,%s,%s,
                          %s,%s,%s,now(),now()
                        )
                        ON CONFLICT (source_system, external_key) DO UPDATE SET
                          contractor_id = EXCLUDED.contractor_id,
                          disposition = EXCLUDED.disposition,
                          disposition_date = EXCLUDED.disposition_date,
                          discipline_description = EXCLUDED.discipline_description,
                          last_verified_at = now(),
                          updated_at = now()
                        """,
                        (
                            cid,
                            d.get("source_system") or "nj_enforcement",
                            d.get("source_dataset") or "public_actions",
                            dkey,
                            d.get("complaint_number") or None,
                            d.get("license_type") or None,
                            d.get("license_number_raw") or None,
                            d.get("respondent_name") or "Unknown",
                            d.get("classification") or None,
                            parse_date(d.get("entered_date")),
                            d.get("disposition") or None,
                            parse_date(d.get("disposition_date")),
                            d.get("discipline_description") or None,
                            d.get("violation_code") or None,
                            d.get("city") or None,
                            (d.get("state") or "NJ")[:2],
                            d.get("postal_code") or None,
                            d.get("county_name") or None,
                            Jsonb(parse_json(d.get("raw_payload_json")) or {}),
                            batch_id,
                        ),
                    )
                    enf_n += 1

            conn.commit()
            log.info("Upserted %s NJ licenses, %s entities, %s enforcement rows", n, ent_n, enf_n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
