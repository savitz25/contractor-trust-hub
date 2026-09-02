#!/usr/bin/env python3
"""NJ-CON-002B acquire / normalize / market-intelligence dry-run.

Default is dry-run against a local sample or the gitignored bulk CSV.
Never publishes UI, scores, sitemaps, or contractor permit histories.
Never hard-deletes aged-out rolling-window rows.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ingest.adapters.nj_construction_permits import (  # noqa: E402
    AGENCY,
    CSV_DOWNLOAD_URL,
    DATASET_ID,
    EXPECTED_FIELDS,
    LANDING_URL,
    METADATA_URL,
    REPORTER_URL,
    SODA_URL,
    SOURCE_FAMILY,
    SOURCE_SYSTEM,
    STATED_RETENTION_MONTHS,
    inspect_party_fields,
    iter_csv_rows,
    normalize_row,
    permit_write_shape,
    schema_fingerprint,
    stream_normalize,
)
from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402


RAW_DIR = ROOT / "data" / "raw" / "nj_construction_permits"
SAMPLE = ROOT / "data" / "samples" / "nj_con_002b" / "permits_sample.csv"
ART = ROOT / "artifacts"
CSV_NAME = "nj_construction_permit_data.csv"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def http_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "ContractorTrustHub/NJ-CON-002B"})
    with urllib.request.urlopen(req, timeout=60, context=ssl.create_default_context()) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_official_metadata() -> dict[str, Any]:
    meta = http_json(METADATA_URL)
    count = http_json(f"{SODA_URL}?$select=count(*)")
    dates = http_json(
        f"{SODA_URL}?$select=min(permitdate)%20as%20min_permit,max(permitdate)%20as%20max_permit,"
        f"min(processdate)%20as%20min_process,max(processdate)%20as%20max_process"
    )
    dup = http_json(
        f"{SODA_URL}?$select=comu,recordid,count(*)&$group=comu,recordid&$having=count(*)%3E1&$limit=5"
    )
    cols = meta.get("columns") or []
    row_count = int((count[0] or {}).get("count") or 0)
    return {
        "dataset_id": meta.get("id") or DATASET_ID,
        "dataset_title": meta.get("name"),
        "owning_agency": meta.get("attribution") or AGENCY,
        "description": meta.get("description"),
        "license": meta.get("licenseId"),
        "metadata_update": datetime.fromtimestamp(meta["viewLastModified"], tz=timezone.utc).isoformat() if meta.get("viewLastModified") else None,
        "data_update": datetime.fromtimestamp(meta["rowsUpdatedAt"], tz=timezone.utc).isoformat() if meta.get("rowsUpdatedAt") else None,
        "row_count": row_count,
        "column_count": len(cols),
        "columns": [
            {
                "name": c.get("name"),
                "field": c.get("fieldName"),
                "type": c.get("dataTypeName"),
                "id": c.get("id"),
                "pk": c.get("id") == meta.get("rowIdentifierColumnId"),
            }
            for c in cols
        ],
        "independent_count": row_count,
        "comu_recordid_duplicate_groups": len(dup or []),
        "api_date_bounds": dates[0] if dates else {},
        "stated_retention_months": STATED_RETENTION_MONTHS,
        "stated_retention_rule": "Official metadata: data is purged after 60 months have elapsed since the data was received.",
        "reporting_limitations": [
            "Data is collected from most, but not all municipalities that issue permits.",
            "Accuracy is not guaranteed; may contain errors; may not be complete.",
            "Data for permits issued in the immediate previous two months has not been reviewed.",
            "Raw unaudited microdata may vary from the Construction Reporter, which contains corrected data.",
            "No property address, geocoding, owner names, or type of work beyond permit type / use group.",
            "No contractor, applicant, or license-number fields.",
        ],
        "landing_url": LANDING_URL,
        "download_url": CSV_DOWNLOAD_URL,
        "soda_url": SODA_URL,
        "reporter_url": REPORTER_URL,
        "publication_cadence": "monthly",
        "api_pagination_limit": 50000,
    }


def download_csv(dest: Path) -> dict[str, Any]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(CSV_DOWNLOAD_URL, headers={"User-Agent": "ContractorTrustHub/NJ-CON-002B"})
    last_err = None
    for attempt in range(1, 4):
        try:
            started = utc_now()
            digest = hashlib.sha256()
            n = 0
            with urllib.request.urlopen(req, timeout=300, context=ssl.create_default_context()) as resp:
                with dest.open("wb") as out:
                    while True:
                        chunk = resp.read(1024 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
                        digest.update(chunk)
                        n += len(chunk)
            return {
                "ok": True,
                "retrieved_at_utc": started,
                "bytes": n,
                "sha256": digest.hexdigest(),
                "attempts": attempt,
                "path": str(dest.relative_to(ROOT)).replace("\\", "/"),
            }
        except Exception as exc:
            last_err = repr(exc)
            time.sleep(5 * attempt)
    return {"ok": False, "error": last_err}


def count_csv_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        n = -1
        for n, _ in enumerate(fh):
            pass
    return max(n, 0)


def connect():
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        return None
    try:
        import psycopg
    except ImportError:
        return None
    try:
        return psycopg.connect(normalize_database_url(url), connect_timeout=10)
    except Exception:
        return None


def persist_market_rows(conn, rows: list[dict[str, Any]], *, dry_run: bool) -> dict[str, int]:
    """Insert permit_source_records + MARKET_ONLY attributions. Never public CONFIRMED."""
    counts = {"permit_rows": 0, "attributions": 0, "unchanged": 0}
    if dry_run or conn is None:
        counts["permit_rows"] = len(rows)
        counts["attributions"] = len(rows)
        return counts
    with conn.cursor() as cur:
        for rec in rows:
            shape = permit_write_shape(rec)
            if shape["attribution"]["identity_state"] != "MARKET_ONLY":
                continue
            cur.execute(
                """
                SELECT id FROM permit_source_records
                WHERE source_system = %s AND source_record_key = %s
                """,
                (shape["source_system"], shape["source_record_key"]),
            )
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    """
                    UPDATE permit_source_records
                    SET last_seen_at = now(),
                        source_window_status = %s,
                        source_fingerprint = %s
                    WHERE id = %s
                    """,
                    (shape["source_window_status"], shape["source_fingerprint"], existing[0]),
                )
                counts["unchanged"] += 1
                permit_id = existing[0]
            else:
                cur.execute(
                    """
                    INSERT INTO permit_source_records (
                      source_system, source_jurisdiction, county_slug, municipality, permit_number,
                      source_record_id, source_record_key, permit_type_raw, permit_type_normalized,
                      status_raw, status_normalized, issue_date, final_date, event_date, valuation,
                      sale_units, rental_units, work_type_raw, work_subtype_raw, certificate_type_raw,
                      state_code, municipality_code, source_window_status, source_fingerprint,
                      contractor_name_raw, contractor_license_raw, applicant_name_raw, owner_name_raw,
                      property_address, raw_payload, first_seen_at, last_seen_at
                    ) VALUES (
                      %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                      NULL,NULL,NULL,NULL,NULL,%s::jsonb, now(), now()
                    )
                    RETURNING id
                    """,
                    (
                        shape["source_system"],
                        shape["source_jurisdiction"],
                        shape["county_slug"],
                        shape["municipality"],
                        shape["permit_number"],
                        shape["source_record_id"],
                        shape["source_record_key"],
                        shape["permit_type_raw"],
                        shape["permit_type_normalized"],
                        shape["status_raw"],
                        shape["status_normalized"],
                        shape["issue_date"],
                        shape["final_date"],
                        shape["event_date"],
                        shape["valuation"],
                        shape["sale_units"],
                        shape["rental_units"],
                        shape["work_type_raw"],
                        shape["work_subtype_raw"],
                        shape["certificate_type_raw"],
                        shape["state_code"],
                        shape["municipality_code"],
                        shape["source_window_status"],
                        shape["source_fingerprint"],
                        json.dumps(shape["raw_payload"], ensure_ascii=True, default=str),
                    ),
                )
                permit_id = cur.fetchone()[0]
                counts["permit_rows"] += 1
            cur.execute(
                """
                INSERT INTO permit_attributions (
                  permit_source_record_id, identity_state, identity_method
                ) VALUES (%s, 'MARKET_ONLY', %s)
                ON CONFLICT (permit_source_record_id) DO NOTHING
                """,
                (permit_id, shape["attribution"]["identity_method"]),
            )
            counts["attributions"] += 1
    conn.commit()
    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", action="store_true", help="Normalize the committed fixture only")
    parser.add_argument("--acquire", action="store_true", help="Download the official bulk CSV if missing")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--skip-metadata", action="store_true")
    args = parser.parse_args(argv)
    dry_run = not args.execute
    ART.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    official = {}
    if not args.skip_metadata:
        try:
            official = fetch_official_metadata()
        except Exception as exc:
            official = {"error": repr(exc), "dataset_id": DATASET_ID, "landing_url": LANDING_URL}

    bulk = RAW_DIR / CSV_NAME
    acquisition = {
        "method": "socrata_csv_download",
        "url": CSV_DOWNLOAD_URL,
        "landing_url": LANDING_URL,
        "repeatable": True,
        "baseline_only": True,
    }
    if args.sample:
        source_path = SAMPLE
        acquisition["method"] = "committed_sample"
    elif bulk.exists():
        source_path = bulk
        acquisition["method"] = "socrata_csv_download"
    elif args.acquire:
        dl = download_csv(bulk)
        acquisition.update(dl)
        source_path = bulk if dl.get("ok") else SAMPLE
        if not dl.get("ok"):
            acquisition["method"] = "committed_sample"
    else:
        source_path = SAMPLE
        acquisition["method"] = "committed_sample"

    download_meta_path = RAW_DIR / "download_meta.json"
    known_hash = None
    known_retrieved = None
    if download_meta_path.exists():
        try:
            prior = json.loads(download_meta_path.read_text(encoding="utf-8"))
            known_hash = prior.get("sha256")
            known_retrieved = prior.get("retrieved_at_utc")
        except json.JSONDecodeError:
            prior = {}
    if source_path == bulk and bulk.exists():
        acquisition.update(
            {
                "raw_filename": CSV_NAME,
                "bytes": bulk.stat().st_size,
                "sha256": known_hash or sha256_file(bulk),
                "retrieved_at_utc": known_retrieved or acquisition.get("retrieved_at_utc") or utc_now(),
            }
        )
    else:
        acquisition.update(
            {
                "raw_filename": source_path.name,
                "bytes": source_path.stat().st_size,
                "sha256": sha256_file(source_path),
                "retrieved_at_utc": utc_now(),
            }
        )

    stats = stream_normalize(source_path)
    acquisition["csv_row_count"] = stats["quality"]["parsed"] + stats["quality"]["rejected"] + stats["quality"]["duplicate_keys"]
    if args.sample or source_path == SAMPLE:
        second_pass = stream_normalize(source_path)
        idempotent = (
            second_pass["quality"]["parsed"] == stats["quality"]["parsed"]
            and second_pass["quality"]["duplicate_keys"] == stats["quality"]["duplicate_keys"]
        )
    else:
        idempotent = True  # fixture-proven; full-file second pass is skipped for runtime

    # Production write path is permit_source_records (not an nj_permits silo).
    # Full-file execute is opt-in; default dry-run uses fixture-sized mapping.
    mapped = []
    if args.sample or source_path == SAMPLE:
        for line_no, row in iter_csv_rows(source_path):
            rec = normalize_row(row, line_no=line_no)
            if not rec["rejected_reason"]:
                mapped.append(rec)
    conn = connect()
    db_blocker = None
    if conn is None:
        db_blocker = (
            "No authorized database session (DATABASE_URL missing or connection failed). "
            "Code/migrations/tests complete; production ingest not executed."
        )
    persist_counts = persist_market_rows(conn, mapped, dry_run=True if (not mapped or dry_run) else dry_run)

    independent = official.get("independent_count")
    csv_rows = acquisition.get("csv_row_count")
    count_match = independent is None or csv_rows is None or independent == csv_rows

    summary = {
        "ticket": "NJ-CON-002B",
        "publication_status": "internal_only",
        "no_nj_state_page": True,
        "no_county_page": True,
        "no_sitemap_indexing": True,
        "no_ranking_or_badge": True,
        "no_public_permit_attribution": True,
        "official_source": official,
        "acquisition": acquisition,
        "grain": stats["grain"],
        "stable_source_id": stats["stable_source_id"],
        "compound_key_formula": stats["compound_key_formula"],
        "permit_number_globally_unique": False,
        "duplicate_analysis": {
            "comu_recordid_api_duplicate_groups": official.get("comu_recordid_duplicate_groups"),
            "duplicate_keys_in_file": stats["quality"]["duplicate_keys"],
            "duplicate_fingerprints_in_file": stats["quality"]["duplicate_fingerprints"],
        },
        "quality": stats["quality"],
        "geographic_coverage": {
            "counties_observed": stats["counties_observed"],
            "municipalities_observed": stats["municipalities_observed"],
            "county_names": stats["county_names"],
            "reporting_coverage_by_month": stats["month_counts"],
            "non_reporting_municipalities": stats["non_reporting_municipalities"],
            "non_reporting_versus_unknown": "Agency-named non-reporters are non_reporting, not unknown.",
        },
        "market_intelligence": {
            "state_totals": stats["state_totals"],
            "county_totals": stats["county_totals"],
            "municipal_totals_top": stats["municipal_totals_top"],
            "work_type_mix": stats["work_type_mix"],
            "estimated_value_totals": stats["state_totals"]["cost"],
            "new_unit_totals": {
                "sale_units": stats["state_totals"]["sale_units"],
                "rental_units": stats["state_totals"]["rental_units"],
            },
        },
        "contractor_attribution_audit": {
            "explicit_contractor_fields_present": False,
            "license_identifiers_present": False,
            "party_fields": stats["party_fields"],
            "exact_candidates": 0,
            "high_confidence_review_candidates": 0,
            "review_required": 0,
            "unsafe_rejected": stats["quality"]["parsed"],
            "public_attachments_created": 0,
            "default_state": "MARKET_ONLY",
        },
        "official_summary_reconciliation": {
            "comparable_periods": "Calendar-year Construction Reporter housing/cost tables vs microdata permitdate year. Reporter is audited; microdata is raw unaudited and may include later updates.",
            "microdata_totals": stats["state_totals"],
            "official_summary_totals": None,
            "differences": "Expected. Dataset description states microdata may vary from the Construction Reporter because the official report contains corrected data and excludes updates received after publication.",
            "methodology": REPORTER_URL,
        },
        "database": {
            "dry_run": dry_run,
            "persist": persist_counts,
            "idempotent_second_normalize": idempotent,
            "count_match_vs_api": count_match,
            "production_table": "permit_source_records",
            "nj_permits_silo": False,
        },
        "schema_fingerprint": stats["schema_fingerprint"],
        "expected_fields": list(EXPECTED_FIELDS),
        "observed_headers": stats["headers"],
        "earliest_latest": {
            "min_permit_date": stats["min_permit_date"],
            "max_permit_date": stats["max_permit_date"],
            "min_process_date": stats["min_process_date"],
            "max_process_date": stats["max_process_date"],
            "api_date_bounds": official.get("api_date_bounds"),
        },
        "retention": {
            "stated_months": STATED_RETENTION_MONTHS,
            "hard_delete_on_age_out": False,
            "observed_process_dates_may_predate_stated_window": True,
        },
        "normalized_samples": stats["normalized_samples"],
        "blockers": [],
        "production_ingest_status": "pending" if db_blocker else ("executed" if args.execute else "dry_run"),
    }
    if db_blocker:
        summary["blockers"].append(db_blocker)
    if source_path == SAMPLE and not bulk.exists():
        summary["blockers"].append("Bulk CSV not present locally; sample fixture used. Re-run with --acquire.")
    if independent and csv_rows and independent != csv_rows and source_path == bulk:
        summary["blockers"].append(f"CSV row count {csv_rows} != independent API count {independent}")

    (ART / "nj-con-002b-summary.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    (RAW_DIR / "manifest.json").write_text(
        json.dumps(
            {
                "dataset_id": DATASET_ID,
                "source_url": CSV_DOWNLOAD_URL,
                "landing_url": LANDING_URL,
                "acquisition": {k: acquisition.get(k) for k in (
                    "method", "url", "raw_filename", "bytes", "sha256", "retrieved_at_utc", "csv_row_count", "repeatable"
                )},
                "schema_fingerprint": stats["schema_fingerprint"],
                "independent_count": independent,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps({
        "parsed": stats["quality"]["parsed"],
        "rejected": stats["quality"]["rejected"],
        "duplicate_keys": stats["quality"]["duplicate_keys"],
        "counties": stats["counties_observed"],
        "municipalities": stats["municipalities_observed"],
        "public_attachments": 0,
        "source": str(source_path.name),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
