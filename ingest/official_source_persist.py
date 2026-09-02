"""Reusable official_source_* persistence (snapshots, observations, occurrences).

Specialty credentials and regulatory events share these tables and stay
semantically distinct via source_family + evidence_class. contractor_id is
nullable. public_eligibility_status defaults to internal_only. Unacquired
sources never mint zero-valued observations.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from ingest.adapters.nj_public_works import SOURCE_COVERAGE_NOT_ACQUIRED


def coverage_placeholder_hash(family: str, url: str | None) -> str:
    blob = f"SOURCE_NOT_ACQUIRED|{family}|{url or ''}"
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def observation_write_shape(obs: dict[str, Any]) -> dict[str, Any]:
    """Production column mapping for one official_source_observations row."""
    return {
        "source_family": obs["source_family"],
        "source_record_id": obs["source_record_id"],
        "source_observation_key": obs["source_observation_key"],
        "row_fingerprint_sha256": obs["row_fingerprint_sha256"],
        "contractor_id": obs.get("contractor_id"),
        "official_business_name": obs.get("official_business_name"),
        "individual_name": obs.get("individual_name"),
        "address_line_1": obs.get("address_line_1"),
        "city": obs.get("city"),
        "state": obs.get("state"),
        "postal_code": obs.get("postal_code"),
        "county": obs.get("county"),
        "certificate_or_vendor_id": obs.get("certificate_or_vendor_id"),
        "registration_status": obs.get("registration_status"),
        "effective_date": obs.get("effective_date"),
        "expiration_date": obs.get("expiration_date"),
        "action": obs.get("action"),
        "reason_code": obs.get("reason_code"),
        "reason_text": obs.get("reason_text"),
        "debarring_department": obs.get("debarring_department"),
        "debarring_agency": obs.get("debarring_agency"),
        "permanent_flag": obs.get("permanent_flag"),
        "source_publication_date": obs.get("source_publication_date"),
        "match_method": obs.get("match_method") or "unresolved",
        "match_confidence": obs.get("match_confidence") or "unresolved",
        "public_eligibility_status": obs.get("public_eligibility_status") or "internal_only",
        "currency": obs.get("currency") or "current_snapshot",
        "evidence_class": obs.get("evidence_class"),
        "raw_payload": obs.get("raw_payload") or {},
        "source_record_locator": obs.get("source_record_locator"),
    }


def _has_column(cur, table: str, column: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
        """,
        (table, column),
    )
    return cur.fetchone() is not None


def persist_official_source(
    conn,
    family: str,
    acquisition: dict[str, Any],
    parsed: list[dict[str, Any]],
    *,
    dry_run: bool,
    source_system: str,
    notes: str,
    source_coverage: str | None = None,
) -> dict[str, int]:
    """Insert one snapshot and its observations/occurrences. Idempotent on keys.

    SOURCE_NOT_ACQUIRED with an empty parsed list writes a coverage snapshot
    only (row_count NULL). It never inserts observation rows.
    """
    counts = {"inserted": 0, "updated": 0, "unchanged": 0, "snapshots": 0, "occurrences": 0}
    if dry_run or conn is None:
        if source_coverage == SOURCE_COVERAGE_NOT_ACQUIRED and not parsed:
            counts["snapshots"] = 1
            return counts
        counts["inserted"] = len(parsed)
        counts["snapshots"] = 1 if (parsed or source_coverage) else 0
        return counts

    acq = acquisition.get(family) or acquisition
    coverage = source_coverage or acq.get("source_coverage")
    digest = acq.get("sha256") or coverage_placeholder_hash(family, acq.get("url") or acq.get("page"))
    row_count = None if (coverage == SOURCE_COVERAGE_NOT_ACQUIRED and not parsed) else len(parsed)
    if coverage == SOURCE_COVERAGE_NOT_ACQUIRED and not parsed:
        # Explicit coverage record; never a zero-observation "complete" scan.
        pass
    elif not parsed:
        return counts

    with conn.cursor() as cur:
        has_coverage = _has_column(cur, "official_source_snapshots", "source_coverage")
        has_evidence = _has_column(cur, "official_source_observations", "evidence_class")
        cur.execute(
            """
            INSERT INTO ingest_batches (source_system, source_dataset, source_url, source_file, extracted_at, row_count, checksum_sha256, notes)
            VALUES (%s,%s,%s,%s, now(), %s, %s, %s)
            RETURNING id
            """,
            (
                source_system,
                family,
                acq.get("url") or acq.get("page"),
                acq.get("local_raw_path"),
                row_count,
                digest,
                notes,
            ),
        )
        batch_id = cur.fetchone()[0]
        if has_coverage:
            cur.execute(
                """
                INSERT INTO official_source_snapshots (
                  source_family, agency, official_url, retrieved_at, source_as_of, source_hash_sha256,
                  row_count, schema_fingerprint, jurisdiction, is_baseline, is_current_only,
                  ingest_batch_id, notes, source_coverage
                ) VALUES (%s,%s,%s, now(), %s, %s, %s, %s, 'NJ', TRUE, TRUE, %s, %s, %s)
                ON CONFLICT (source_family, source_hash_sha256) DO UPDATE SET
                  row_count = EXCLUDED.row_count,
                  source_coverage = COALESCE(EXCLUDED.source_coverage, official_source_snapshots.source_coverage),
                  notes = EXCLUDED.notes
                RETURNING id
                """,
                (
                    family,
                    acq.get("agency") or "unknown",
                    acq.get("url") or acq.get("page") or "https://www.nj.gov/",
                    acq.get("source_as_of"),
                    digest,
                    row_count,
                    acq.get("schema_fingerprint") or "na",
                    batch_id,
                    acq.get("barrier") or notes,
                    coverage,
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO official_source_snapshots (
                  source_family, agency, official_url, retrieved_at, source_as_of, source_hash_sha256,
                  row_count, schema_fingerprint, jurisdiction, is_baseline, is_current_only, ingest_batch_id, notes
                ) VALUES (%s,%s,%s, now(), %s, %s, %s, %s, 'NJ', TRUE, TRUE, %s, %s)
                ON CONFLICT (source_family, source_hash_sha256) DO UPDATE SET row_count = EXCLUDED.row_count
                RETURNING id
                """,
                (
                    family,
                    acq.get("agency") or "unknown",
                    acq.get("url") or acq.get("page") or "https://www.nj.gov/",
                    acq.get("source_as_of"),
                    digest,
                    row_count,
                    acq.get("schema_fingerprint") or "na",
                    batch_id,
                    acq.get("barrier") or notes,
                ),
            )
        snapshot_id = cur.fetchone()[0]
        counts["snapshots"] = 1
        if coverage == SOURCE_COVERAGE_NOT_ACQUIRED and not parsed:
            conn.commit()
            return counts
        for obs in parsed:
            shape = observation_write_shape(obs)
            if has_evidence:
                cur.execute(
                    """
                    INSERT INTO official_source_observations (
                      snapshot_id, ingest_batch_id, source_family, source_record_id, source_observation_key,
                      row_fingerprint_sha256, contractor_id, official_business_name, individual_name,
                      address_line_1, city, state, postal_code, county, certificate_or_vendor_id,
                      registration_status, effective_date, expiration_date, action, reason_code, reason_text,
                      debarring_department, debarring_agency, permanent_flag, source_publication_date,
                      match_method, match_confidence, public_eligibility_status, currency, raw_payload,
                      evidence_class
                    ) VALUES (
                      %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'internal_only','current_snapshot',%s::jsonb,%s
                    )
                    ON CONFLICT (source_family, source_observation_key) DO NOTHING
                    """,
                    (
                        snapshot_id,
                        batch_id,
                        family,
                        shape["source_record_id"],
                        shape["source_observation_key"],
                        shape["row_fingerprint_sha256"],
                        shape["contractor_id"],
                        shape["official_business_name"],
                        shape["individual_name"],
                        shape["address_line_1"],
                        shape["city"],
                        shape["state"],
                        shape["postal_code"],
                        shape["county"],
                        shape["certificate_or_vendor_id"],
                        shape["registration_status"],
                        shape["effective_date"],
                        shape["expiration_date"],
                        shape["action"],
                        shape["reason_code"],
                        shape["reason_text"],
                        shape["debarring_department"],
                        shape["debarring_agency"],
                        shape["permanent_flag"],
                        shape["source_publication_date"],
                        shape["match_method"],
                        shape["match_confidence"],
                        json.dumps(shape["raw_payload"], ensure_ascii=True, default=str),
                        shape["evidence_class"],
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO official_source_observations (
                      snapshot_id, ingest_batch_id, source_family, source_record_id, source_observation_key,
                      row_fingerprint_sha256, contractor_id, official_business_name, individual_name,
                      address_line_1, city, state, postal_code, county, certificate_or_vendor_id,
                      registration_status, effective_date, expiration_date, action, reason_code, reason_text,
                      debarring_department, debarring_agency, permanent_flag, source_publication_date,
                      match_method, match_confidence, public_eligibility_status, currency, raw_payload
                    ) VALUES (
                      %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'internal_only','current_snapshot',%s::jsonb
                    )
                    ON CONFLICT (source_family, source_observation_key) DO NOTHING
                    """,
                    (
                        snapshot_id,
                        batch_id,
                        family,
                        shape["source_record_id"],
                        shape["source_observation_key"],
                        shape["row_fingerprint_sha256"],
                        shape["contractor_id"],
                        shape["official_business_name"],
                        shape["individual_name"],
                        shape["address_line_1"],
                        shape["city"],
                        shape["state"],
                        shape["postal_code"],
                        shape["county"],
                        shape["certificate_or_vendor_id"],
                        shape["registration_status"],
                        shape["effective_date"],
                        shape["expiration_date"],
                        shape["action"],
                        shape["reason_code"],
                        shape["reason_text"],
                        shape["debarring_department"],
                        shape["debarring_agency"],
                        shape["permanent_flag"],
                        shape["source_publication_date"],
                        shape["match_method"],
                        shape["match_confidence"],
                        json.dumps(shape["raw_payload"], ensure_ascii=True, default=str),
                    ),
                )
            counts["inserted" if cur.rowcount else "unchanged"] += 1
            cur.execute(
                "SELECT id FROM official_source_observations WHERE source_family = %s AND source_observation_key = %s",
                (family, shape["source_observation_key"]),
            )
            obs_id = cur.fetchone()[0]
            cur.execute(
                """
                INSERT INTO official_source_occurrences (
                  observation_id, snapshot_id, ingest_batch_id, source_record_locator, source_file
                ) VALUES (%s,%s,%s,%s,%s)
                ON CONFLICT (observation_id, snapshot_id, source_record_locator) DO NOTHING
                """,
                (
                    obs_id,
                    snapshot_id,
                    batch_id,
                    shape.get("source_record_locator") or shape["source_observation_key"],
                    acq.get("local_raw_path"),
                ),
            )
            if cur.rowcount:
                counts["occurrences"] += 1
    conn.commit()
    return counts
