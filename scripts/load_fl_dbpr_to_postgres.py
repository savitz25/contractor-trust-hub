#!/usr/bin/env python3
"""
Load staged Florida DBPR adapter outputs into Postgres.

Idempotent upserts (safe to re-run):
  - licenses on (source_system, external_key)
  - entities (QB) on (source_system, external_key)
  - discipline_actions on (source_system, external_key)
  - contractors on slug

Connection (first match wins):
  DATABASE_URL
  or PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD

Usage:
  python scripts/load_fl_dbpr_to_postgres.py --init-schema
  python scripts/load_fl_dbpr_to_postgres.py --staging-dir data/staging/fl_dbpr
  python scripts/load_fl_dbpr_to_postgres.py --staging-dir data/staging/fl_dbpr_full

Requires: psycopg[binary]>=3.1  (see ingest/requirements.txt)
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
from ingest.regulatory.fl_dbpr_identity import (  # noqa: E402
    FloridaDbprCredentialResolver,
    LicenseCredential,
)
from ingest.regulatory.source_observation import (  # noqa: E402
    LOGICAL_MATTER_ALGORITHM,
    SOURCE_OBSERVATION_ALGORITHM,
    logical_matter_detail_key_v1,
    row_fingerprint_sha256,
    source_observation_key_v2,
)
from ingest.monitoring import insert_change_event, material_license_changes  # noqa: E402

SOURCE_SYSTEM = "fl_dbpr"
SOURCE_URL_LICENSEES = (
    "https://www2.myfloridalicense.com/sto/file_download/extracts//CONSTRUCTIONLICENSE_1.csv"
)

log = logging.getLogger("load_fl_dbpr")


def _require_psycopg():
    try:
        import psycopg
        from psycopg.rows import dict_row
        from psycopg.types.json import Jsonb
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "psycopg is required. Install with:\n"
            "  pip install 'psycopg[binary]>=3.1'\n"
            f"Original error: {exc}"
        ) from exc
    return psycopg, dict_row, Jsonb


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
    # libpq keyword DSN
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
    Jsonb,
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


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def discipline_external_key(row: dict[str, str]) -> str:
    material = "|".join(
        [
            row.get("source_dataset", ""),
            row.get("complaint_number", ""),
            row.get("license_number_raw", ""),
            row.get("respondent_name", ""),
            row.get("discipline_description", ""),
            row.get("disposition_date", ""),
        ]
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:32]


def load_licenses(
    conn,
    path: Path,
    *,
    batch_id: UUID,
    limit: int | None,
    batch_size: int,
    Jsonb,
) -> dict[str, int]:
    """One contractor shell per strong license (high confidence). Upsert licenses."""
    now = datetime.now(timezone.utc)
    stats = {
        "rows_read": 0,
        "contractors_upserted": 0,
        "licenses_upserted": 0,
        "skipped": 0,
        "monitoring_events": 0,
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
          license_number, class_code, licensee_name_raw, dba_name_raw,
          primary_status, secondary_status, status_normalized,
          original_licensure_date, effective_date, expiration_date,
          address_line_1, address_line_2, address_line_3, city, state, postal_code,
          county_code, county_name, board_number, raw_payload, ingest_batch_id,
          last_seen_at, last_verified_at, updated_at
        ) VALUES (
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s,
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

            external_key = row.get("external_key", "").upper()
            licensee_name = row.get("licensee_name_raw", "")
            if not external_key or not licensee_name:
                stats["skipped"] += 1
                continue

            display = row.get("dba_name_raw") or licensee_name
            slug = slugify(external_key, display)
            state = (row.get("state") or "FL")[:2].upper() or "FL"
            county = row.get("county_name") or row.get("county_code") or ""

            cur.execute(
                contractor_sql,
                (
                    slug,
                    display,
                    licensee_name,
                    row.get("dba_name_raw") or None,
                    state,
                    row.get("city") or None,
                    county or None,
                    now,
                ),
            )
            contractor_id = cur.fetchone()[0]
            stats["contractors_upserted"] += 1

            payload = parse_json(row.get("raw_payload_json"))
            cur.execute(
                """SELECT primary_status,secondary_status,status_normalized,expiration_date,
                          address_line_1,address_line_2,address_line_3,city,state,postal_code,
                          licensee_name_raw,dba_name_raw
                     FROM licenses WHERE source_system=%s AND external_key=%s""",
                (row.get("source_system") or SOURCE_SYSTEM, external_key),
            )
            prior_row = cur.fetchone()
            prior = dict(zip(
                ("primary_status","secondary_status","status_normalized","expiration_date",
                 "address_line_1","address_line_2","address_line_3","city","state","postal_code",
                 "licensee_name_raw","dba_name_raw"), prior_row
            )) if prior_row else None
            current = {
                "primary_status": row.get("primary_status") or None,
                "secondary_status": row.get("secondary_status") or None,
                "status_normalized": row.get("status_normalized") or None,
                "expiration_date": parse_date(row.get("expiration_date")),
                "address_line_1": row.get("address_line_1") or None,
                "address_line_2": row.get("address_line_2") or None,
                "address_line_3": row.get("address_line_3") or None,
                "city": row.get("city") or None,
                "state": state,
                "postal_code": row.get("postal_code") or None,
                "licensee_name_raw": licensee_name,
                "dba_name_raw": row.get("dba_name_raw") or None,
            }
            cur.execute(
                license_sql,
                (
                    contractor_id,
                    row.get("source_system") or SOURCE_SYSTEM,
                    row.get("source_board") or row.get("board_number") or None,
                    external_key,
                    (row.get("occupation_code") or "").upper(),
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
                    row.get("board_number") or None,
                    Jsonb(payload) if payload is not None else None,
                    batch_id,
                    now,
                    now,
                    now,
                ),
            )
            stats["licenses_upserted"] += 1
            # A first observation is baseline evidence, not a customer alert.
            # Existing records emit only normalized, consumer-visible differences.
            if prior is not None:
                for change_type, before_state, current_state in material_license_changes(prior, current):
                    if insert_change_event(
                        cur, contractor_id=contractor_id, source_system=SOURCE_SYSTEM,
                        source_dataset="construction_licensees", source_record_id=external_key,
                        change_type=change_type, prior_state=before_state,
                        current_state=current_state, ingest_batch_id=batch_id,
                        source_effective_at=(current["expiration_date"].isoformat()
                                             if change_type == "LICENSE_EXPIRATION_CHANGED" and current["expiration_date"] else None),
                        provenance={"ingest": "load_fl_dbpr_to_postgres", "batch_id": str(batch_id)},
                    ):
                        stats["monitoring_events"] += 1

            if stats["licenses_upserted"] % batch_size == 0:
                conn.commit()
                log.info("  licenses progress: %s", stats["licenses_upserted"])

    conn.commit()
    return stats


def load_qualifying_businesses(
    conn,
    path: Path,
    *,
    batch_id: UUID,
    limit: int | None,
    batch_size: int,
    Jsonb,
) -> dict[str, int]:
    """QB shells → entities (+ thin contractor link). No invented license numbers."""
    now = datetime.now(timezone.utc)
    stats = {
        "rows_read": 0,
        "entities_upserted": 0,
        "contractors_upserted": 0,
        "links_upserted": 0,
        "skipped": 0,
    }

    entity_sql = """
        INSERT INTO entities (
          source_system, external_key, legal_name, entity_type, status,
          principal_address, city, state, postal_code, county_name,
          raw_payload, ingest_batch_id, last_verified_at, updated_at
        ) VALUES (
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s
        )
        ON CONFLICT (source_system, external_key) DO UPDATE SET
          legal_name = EXCLUDED.legal_name,
          entity_type = EXCLUDED.entity_type,
          status = EXCLUDED.status,
          principal_address = EXCLUDED.principal_address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          postal_code = EXCLUDED.postal_code,
          county_name = EXCLUDED.county_name,
          raw_payload = EXCLUDED.raw_payload,
          ingest_batch_id = EXCLUDED.ingest_batch_id,
          last_verified_at = EXCLUDED.last_verified_at,
          updated_at = EXCLUDED.updated_at
        RETURNING id
    """

    contractor_sql = """
        INSERT INTO contractors (
          slug, display_name, legal_name, dba_name, home_state,
          primary_city, primary_county, is_thin_profile, updated_at
        ) VALUES (
          %s, %s, %s, %s, %s, %s, %s, TRUE, %s
        )
        ON CONFLICT (slug) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          legal_name = EXCLUDED.legal_name,
          dba_name = EXCLUDED.dba_name,
          home_state = EXCLUDED.home_state,
          primary_city = EXCLUDED.primary_city,
          primary_county = EXCLUDED.primary_county,
          is_thin_profile = TRUE,
          updated_at = EXCLUDED.updated_at
        RETURNING id
    """

    link_sql = """
        INSERT INTO contractor_entities (
          contractor_id, entity_id, role, confidence, evidence
        ) VALUES (%s, %s, 'qualifying_business', 1.000, %s)
        ON CONFLICT (contractor_id, entity_id, role) DO UPDATE SET
          confidence = EXCLUDED.confidence,
          evidence = EXCLUDED.evidence
    """

    with conn.cursor() as cur:
        for row in iter_csv(path):
            stats["rows_read"] += 1
            if limit is not None and stats["entities_upserted"] >= limit:
                break

            entity_key = row.get("entity_key", "")
            name = row.get("licensee_name_raw") or row.get("display_name") or ""
            if not entity_key or not name:
                stats["skipped"] += 1
                continue

            display = row.get("display_name") or name
            state = (row.get("state") or "FL")[:2].upper() or "FL"
            addr = row.get("address_line_1") or None
            payload = parse_json(row.get("raw_payload_json"))

            cur.execute(
                entity_sql,
                (
                    row.get("source_system") or SOURCE_SYSTEM,
                    entity_key,
                    name,
                    row.get("record_kind") or "qualifying_business",
                    row.get("status_normalized") or None,
                    addr,
                    row.get("city") or None,
                    state,
                    row.get("postal_code") or None,
                    row.get("county_name") or None,
                    Jsonb(payload) if payload is not None else None,
                    batch_id,
                    now,
                    now,
                ),
            )
            entity_id = cur.fetchone()[0]
            stats["entities_upserted"] += 1

            slug = slugify(entity_key, display)
            cur.execute(
                contractor_sql,
                (
                    slug,
                    display,
                    name,
                    row.get("dba_name_raw") or None,
                    state,
                    row.get("city") or None,
                    row.get("county_name") or row.get("county_code") or None,
                    now,
                ),
            )
            contractor_id = cur.fetchone()[0]
            stats["contractors_upserted"] += 1

            cur.execute(
                link_sql,
                (
                    contractor_id,
                    entity_id,
                    Jsonb(
                        {
                            "source_system": SOURCE_SYSTEM,
                            "entity_key": entity_key,
                            "note": "QB shell from DBPR extract; no board license number",
                        }
                    ),
                ),
            )
            stats["links_upserted"] += 1

            if stats["entities_upserted"] % batch_size == 0:
                conn.commit()
                log.info("  QB progress: %s", stats["entities_upserted"])

    conn.commit()
    return stats


def load_discipline(
    conn,
    path: Path,
    *,
    batch_id: UUID,
    limit: int | None,
    batch_size: int,
    fiscal_year: str,
    source_file_checksum: str,
    source_file: str,
    source_url: str,
    Jsonb,
) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    stats = {
        "rows_read": 0,
        "actions_upserted": 0,
        "license_links": 0,
        "observations_inserted": 0,
        "occurrences_inserted": 0,
        "exact_reobservations": 0,
        "revision_review_required": 0,
        "monitoring_events": 0,
        "skipped": 0,
    }

    # Preload the full credential inventory for the fail-closed resolver.
    license_inventory: list[LicenseCredential] = []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, external_key, occupation_code, license_number,
                   source_board, contractor_id
            FROM licenses
            WHERE source_system = %s
            """,
            (SOURCE_SYSTEM,),
        )
        for lid, ext, occupation, num, board, contractor in cur.fetchall():
            license_inventory.append(
                LicenseCredential(
                    id=str(lid), external_key=ext, occupation_code=occupation,
                    license_number=num, source_board=board,
                    contractor_id=str(contractor) if contractor else None,
                )
            )
    resolver = FloridaDbprCredentialResolver(license_inventory)
    contractor_by_license_id = {item.id: item.contractor_id for item in license_inventory}

    sql = """
        INSERT INTO discipline_actions (
          contractor_id, license_id, source_system, source_dataset, external_key,
          complaint_number, license_type, license_number_raw, respondent_name,
          classification, entered_date, disposition, disposition_date,
          discipline_description, violation_code, address_line_1, city, state,
          postal_code, county_name, raw_payload, ingest_batch_id,
          last_verified_at, updated_at, identity_state, identity_method,
          resolver_version, resolved_license_external_key, identity_evidence,
          identity_evaluated_at, review_reason, publication_state,
          correction_hold, retraction_hold
        ) VALUES (
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s,
          %s, %s, %s, %s, %s
        )
        ON CONFLICT (source_system, external_key) DO UPDATE SET
          contractor_id = NULL,
          license_id = EXCLUDED.license_id,
          complaint_number = EXCLUDED.complaint_number,
          license_type = EXCLUDED.license_type,
          license_number_raw = EXCLUDED.license_number_raw,
          respondent_name = EXCLUDED.respondent_name,
          classification = EXCLUDED.classification,
          entered_date = EXCLUDED.entered_date,
          disposition = EXCLUDED.disposition,
          disposition_date = EXCLUDED.disposition_date,
          discipline_description = EXCLUDED.discipline_description,
          violation_code = EXCLUDED.violation_code,
          address_line_1 = EXCLUDED.address_line_1,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          postal_code = EXCLUDED.postal_code,
          county_name = EXCLUDED.county_name,
          raw_payload = EXCLUDED.raw_payload,
          ingest_batch_id = EXCLUDED.ingest_batch_id,
          last_verified_at = EXCLUDED.last_verified_at,
          identity_state = EXCLUDED.identity_state,
          identity_method = EXCLUDED.identity_method,
          resolver_version = EXCLUDED.resolver_version,
          resolved_license_external_key = EXCLUDED.resolved_license_external_key,
          identity_evidence = EXCLUDED.identity_evidence,
          identity_evaluated_at = EXCLUDED.identity_evaluated_at,
          review_reason = EXCLUDED.review_reason,
          publication_state = 'INTERNAL',
          correction_hold = FALSE,
          retraction_hold = FALSE,
          updated_at = EXCLUDED.updated_at
        RETURNING id
    """

    observation_insert_sql = """
        INSERT INTO regulatory_source_observations (
          discipline_action_id, source_system, source_dataset,
          source_observation_key, source_observation_algorithm,
          logical_matter_detail_key, logical_matter_algorithm,
          row_fingerprint_sha256, source_payload, revision_state,
          first_observed_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (source_system, source_dataset, source_observation_key)
        DO NOTHING
        RETURNING id
    """
    occurrence_insert_sql = """
        INSERT INTO regulatory_source_occurrences (
          source_observation_id, ingest_batch_id, fiscal_year,
          source_file_checksum_sha256, source_record_locator,
          source_file, source_url, observed_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (
          source_observation_id, ingest_batch_id, fiscal_year,
          source_file_checksum_sha256, source_record_locator
        ) DO NOTHING
        RETURNING id
    """

    with conn.cursor() as cur:
        for row in iter_csv(path):
            stats["rows_read"] += 1
            if limit is not None and stats["rows_read"] > limit:
                break

            respondent = row.get("respondent_name", "")
            if not respondent:
                stats["skipped"] += 1
                continue

            raw_num = row.get("license_number_raw", "")
            resolution = resolver.resolve(
                source_dataset=row.get("source_dataset") or "contractor_disc_lic",
                license_type=row.get("license_type"),
                license_number=raw_num,
                respondent_name=respondent,
            )
            license_id = (
                UUID(resolution.proposed_license_id)
                if resolution.identity_state in {"EXACT", "DETERMINISTIC"}
                and resolution.proposed_license_id
                else None
            )
            # License linkage is not contractor linkage and never publishes a row.
            contractor_id = None

            payload = parse_json(row.get("raw_payload_json"))
            if payload is None:
                raise RuntimeError("Florida regulatory source payload is required")
            source_record_locator = row.get("source_record_locator")
            if not source_record_locator:
                raise RuntimeError("Florida regulatory source record locator is required")
            source_dataset = row.get("source_dataset") or "contractor_disc_lic"
            observation_key = source_observation_key_v2(
                source_system=SOURCE_SYSTEM, source_dataset=source_dataset, row=payload
            )
            logical_key = logical_matter_detail_key_v1(
                source_system=SOURCE_SYSTEM, source_dataset=source_dataset, row=payload
            )
            fingerprint = row_fingerprint_sha256(payload)
            ext = observation_key
            state = (row.get("state") or "")[:2].upper() or None

            # Exact source identity is idempotent. A new file/batch sighting is
            # retained as an occurrence without rewriting evidence.
            cur.execute(
                """SELECT id FROM regulatory_source_observations
                    WHERE source_system=%s AND source_dataset=%s
                      AND source_observation_key=%s""",
                (SOURCE_SYSTEM, source_dataset, observation_key),
            )
            exact_observation = cur.fetchone()
            if exact_observation:
                cur.execute(
                    occurrence_insert_sql,
                    (exact_observation[0], batch_id, fiscal_year, source_file_checksum,
                     source_record_locator, source_file, source_url, now),
                )
                stats["occurrences_inserted"] += int(cur.fetchone() is not None)
                stats["exact_reobservations"] += 1
                continue

            # A logical collision from a prior batch is only a revision review
            # candidate. It never overwrites evidence or creates a second event.
            cur.execute(
                """SELECT o.discipline_action_id
                     FROM regulatory_source_observations o
                    WHERE o.source_system=%s AND o.source_dataset=%s
                      AND o.logical_matter_detail_key=%s
                      AND NOT EXISTS (
                        SELECT 1 FROM regulatory_source_occurrences x
                         WHERE x.source_observation_id=o.id AND x.ingest_batch_id=%s
                      )
                    ORDER BY o.created_at, o.id LIMIT 1""",
                (SOURCE_SYSTEM, source_dataset, logical_key, batch_id),
            )
            prior_logical = cur.fetchone()
            if prior_logical:
                discipline_action_id = prior_logical[0]
                revision_state = "REVISION_REVIEW_REQUIRED"
                stats["revision_review_required"] += 1
            else:
                revision_state = "CURRENT"

            if not prior_logical:
                if license_id:
                    stats["license_links"] += 1
                cur.execute(
                    sql,
                    (
                    contractor_id,
                    license_id,
                    SOURCE_SYSTEM,
                    row.get("source_dataset") or "contractor_disc_lic",
                    ext,
                    row.get("complaint_number") or None,
                    row.get("license_type") or None,
                    raw_num or None,
                    respondent,
                    row.get("classification") or None,
                    parse_date(row.get("entered_date")),
                    row.get("disposition") or None,
                    parse_date(row.get("disposition_date")),
                    row.get("discipline_description") or None,
                    row.get("violation_code") or None,
                    row.get("address_line_1") or None,
                    row.get("city") or None,
                    state,
                    row.get("postal_code") or None,
                    row.get("county_name") or None,
                    Jsonb(payload),
                    batch_id,
                    now,
                    now,
                    resolution.identity_state,
                    resolution.identity_method,
                    resolution.resolver_version,
                    resolution.resolved_external_key,
                    Jsonb(
                        {
                            "expected_external_key": resolution.expected_external_key,
                            "candidate_count": resolution.candidate_count,
                            "reason": resolution.reason,
                        }
                    ),
                    now,
                    resolution.reason
                    if resolution.identity_state in {"REVIEW_REQUIRED", "UNRESOLVED"}
                    else None,
                    "INTERNAL",
                    False,
                    False,
                    ),
                )
                discipline_action_id = cur.fetchone()[0]
                stats["actions_upserted"] += 1

            cur.execute(
                observation_insert_sql,
                (discipline_action_id, SOURCE_SYSTEM, source_dataset, observation_key,
                 SOURCE_OBSERVATION_ALGORITHM, logical_key, LOGICAL_MATTER_ALGORITHM,
                 fingerprint, Jsonb(payload), revision_state, now),
            )
            observation_row = cur.fetchone()
            if not observation_row:
                raise RuntimeError("Source observation insert lost an identity race")
            observation_id = observation_row[0]
            stats["observations_inserted"] += 1
            cur.execute(
                occurrence_insert_sql,
                (observation_id, batch_id, fiscal_year, source_file_checksum,
                 source_record_locator, source_file, source_url, now),
            )
            if not cur.fetchone():
                raise RuntimeError("Source occurrence insert failed")
            stats["occurrences_inserted"] += 1

            # Only a new, exact source observation with deterministic credential
            # identity may generate a private discipline alert. Review-required
            # revisions remain internal and never notify automatically.
            monitoring_contractor_id = contractor_by_license_id.get(str(license_id)) if license_id else None
            if not prior_logical and monitoring_contractor_id:
                current_state = {
                    "complaint_number": row.get("complaint_number") or None,
                    "disposition": row.get("disposition") or None,
                    "disposition_date": row.get("disposition_date") or None,
                    "source_observation_key": observation_key,
                }
                if insert_change_event(
                    cur, contractor_id=monitoring_contractor_id, source_system=SOURCE_SYSTEM,
                    source_dataset=source_dataset, source_record_id=observation_key,
                    change_type="DISCIPLINE_ADDED", prior_state=None,
                    current_state=current_state, ingest_batch_id=batch_id,
                    source_effective_at=(parse_date(row.get("disposition_date")).isoformat()
                                         if parse_date(row.get("disposition_date")) else None),
                    provenance={"source_observation_key": observation_key,
                                "row_fingerprint_sha256": fingerprint,
                                "ingest_batch_id": str(batch_id)},
                ):
                    stats["monitoring_events"] += 1

            if stats["rows_read"] % batch_size == 0:
                conn.commit()
                log.info("  discipline progress: %s source rows", stats["rows_read"])

    conn.commit()
    return stats


def print_db_summary(conn) -> None:
    queries = [
        ("contractors", "SELECT COUNT(*) FROM contractors"),
        ("licenses", "SELECT COUNT(*) FROM licenses"),
        ("entities", "SELECT COUNT(*) FROM entities"),
        ("discipline_actions", "SELECT COUNT(*) FROM discipline_actions"),
        (
            "licenses_by_status",
            """
            SELECT COALESCE(status_normalized, '(null)'), COUNT(*)
            FROM licenses GROUP BY 1 ORDER BY 2 DESC
            """,
        ),
        (
            "top_counties",
            """
            SELECT COALESCE(NULLIF(county_name, ''), county_code, '(unknown)'), COUNT(*)
            FROM licenses
            WHERE state = 'FL'
            GROUP BY 1 ORDER BY 2 DESC LIMIT 10
            """,
        ),
    ]
    with conn.cursor() as cur:
        for label, sql in queries:
            cur.execute(sql)
            rows = cur.fetchall()
            if label.endswith("ies") or label in {
                "contractors",
                "licenses",
                "entities",
                "discipline_actions",
            }:
                log.info("DB %s = %s", label, rows[0][0] if rows else 0)
            else:
                log.info("DB %s:", label)
                for r in rows:
                    log.info("  %s: %s", r[0], r[1])


def resolve_staging(path: Path) -> dict[str, Path | None]:
    return {
        "licenses": path / "licenses_normalized.csv",
        "qb": path / "qualifying_businesses_normalized.csv",
        "discipline": path / "discipline_normalized.csv",
        "manifest": path / "batch_manifest.json",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Load staged FL DBPR data into Postgres")
    parser.add_argument(
        "--staging-dir",
        type=Path,
        default=ROOT / "data" / "staging" / "fl_dbpr",
        help="Directory with adapter outputs (default: data/staging/fl_dbpr)",
    )
    parser.add_argument(
        "--schema",
        type=Path,
        default=ROOT / "schema" / "initial_schema.sql",
    )
    parser.add_argument(
        "--init-schema",
        action="store_true",
        help="Apply schema/initial_schema.sql before load",
    )
    parser.add_argument("--skip-licenses", action="store_true")
    parser.add_argument("--skip-qb", action="store_true")
    parser.add_argument("--skip-discipline", action="store_true")
    parser.add_argument("--limit", type=int, default=None, help="Per-dataset row cap (testing)")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--discipline-fiscal-year")
    parser.add_argument("--discipline-source-file")
    parser.add_argument("--discipline-source-url")
    parser.add_argument("--discipline-source-checksum")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    psycopg, _dict_row, Jsonb = _require_psycopg()
    staging = resolve_staging(args.staging_dir)
    dsn = connect_dsn()
    log.info("Connecting to Postgres…")
    log.info("Staging dir: %s", args.staging_dir)

    summary: dict[str, Any] = {"staging_dir": str(args.staging_dir)}

    try:
        with psycopg.connect(dsn) as conn:
            if args.init_schema:
                apply_schema(conn, args.schema)

            # Licenses
            if not args.skip_licenses:
                lic_path = staging["licenses"]
                if not lic_path or not lic_path.exists():
                    log.warning("Missing licenses file: %s", lic_path)
                else:
                    checksum = file_sha256(lic_path)
                    batch_id = create_batch(
                        conn,
                        source_dataset="construction_licensees",
                        source_file=str(lic_path).replace("\\", "/"),
                        source_url=SOURCE_URL_LICENSEES,
                        row_count=None,
                        checksum=checksum,
                        notes="load_fl_dbpr_to_postgres licenses",
                        Jsonb=Jsonb,
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

            # QB
            if not args.skip_qb:
                qb_path = staging["qb"]
                if not qb_path or not qb_path.exists():
                    log.warning("Missing QB file: %s", qb_path)
                else:
                    # empty header-only file from sample path is fine
                    checksum = file_sha256(qb_path)
                    batch_id = create_batch(
                        conn,
                        source_dataset="qualifying_businesses",
                        source_file=str(qb_path).replace("\\", "/"),
                        source_url=SOURCE_URL_LICENSEES,
                        row_count=None,
                        checksum=checksum,
                        notes="load_fl_dbpr_to_postgres QB entities (no invented licenses)",
                        Jsonb=Jsonb,
                    )
                    log.info("Loading QB entities from %s (batch %s)", qb_path, batch_id)
                    stats = load_qualifying_businesses(
                        conn,
                        qb_path,
                        batch_id=batch_id,
                        limit=args.limit,
                        batch_size=args.batch_size,
                        Jsonb=Jsonb,
                    )
                    summary["qualifying_businesses"] = stats
                    log.info("QB done: %s", stats)

            # Discipline
            if not args.skip_discipline:
                disc_path = staging["discipline"]
                if not disc_path or not disc_path.exists():
                    log.warning("Missing discipline file: %s", disc_path)
                else:
                    if not all((args.discipline_fiscal_year, args.discipline_source_file,
                                args.discipline_source_url, args.discipline_source_checksum)):
                        raise RuntimeError(
                            "Discipline load requires --discipline-fiscal-year, "
                            "--discipline-source-file, --discipline-source-url, "
                            "and --discipline-source-checksum"
                        )
                    if not re.fullmatch(r"[0-9a-f]{64}", args.discipline_source_checksum):
                        raise RuntimeError("Discipline source checksum must be lowercase SHA-256")
                    batch_id = create_batch(
                        conn,
                        source_dataset="contractor_disc_lic",
                        source_file=args.discipline_source_file,
                        source_url=args.discipline_source_url,
                        row_count=None,
                        checksum=args.discipline_source_checksum,
                        notes=("load_fl_dbpr_to_postgres discipline; normalized staging="
                               + str(disc_path).replace("\\", "/")),
                        Jsonb=Jsonb,
                    )
                    log.info("Loading discipline from %s (batch %s)", disc_path, batch_id)
                    stats = load_discipline(
                        conn,
                        disc_path,
                        batch_id=batch_id,
                        limit=args.limit,
                        batch_size=args.batch_size,
                        fiscal_year=args.discipline_fiscal_year,
                        source_file_checksum=args.discipline_source_checksum,
                        source_file=args.discipline_source_file,
                        source_url=args.discipline_source_url,
                        Jsonb=Jsonb,
                    )
                    summary["discipline"] = stats
                    log.info("Discipline done: %s", stats)

            print_db_summary(conn)
    except psycopg.OperationalError as exc:
        log.error("Could not connect to Postgres: %s", exc)
        log.error(
            "Set DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD. "
            "See docs/LOAD_PATH.md"
        )
        return 2

    out_path = args.staging_dir / "load_summary.json"
    try:
        args.staging_dir.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
        log.info("Wrote %s", out_path)
    except OSError as exc:
        log.warning("Could not write summary file: %s", exc)

    log.info("Load complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
