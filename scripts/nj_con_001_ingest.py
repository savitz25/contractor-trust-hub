#!/usr/bin/env python3
"""NJ-CON-001 acquisition / normalize / identity / optional Postgres ingest.

Modes: official-download | local-input
Flags: --dry-run (default) | --execute
Never publishes UI, scores, or sitemaps. Never mints contractors from exclusion rows.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ingest.adapters.nj_public_works import (  # noqa: E402
    FORBIDDEN_PUBLIC_LABELS,
    OFFICIAL_DOWNLOADS,
    POWER_BI_BLOCKED,
    PUBLIC_LABELS,
    SOURCE_FAMILIES,
    load_source,
    schema_fingerprint,
    sha256_file,
    utc_now,
)
from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402
from ingest.nj_identity_match import (  # noqa: E402
    apply_matches,
    build_license_index,
    load_license_csv,
)

RAW_DIR = ROOT / "data" / "raw" / "nj_public_works"
STAGING_DIR = ROOT / "data" / "staging" / "nj_public_works"
ARTIFACT_DIR = ROOT / "artifacts"
SAMPLE_LICENSES = ROOT / "data" / "samples" / "nj_dca_hic_sample.csv"

AS_OF = {
    "NJ_WALL": "2026-08-05",
    "NJ_WAGE_VIOLATION_WATCHLIST": "2026-03-20",
    "NJ_TREASURY_CONSTRUCTION_DEBARMENT": "2025-10-15",
    "NJ_TREASURY_VENDOR_DEBARMENT": "2026-02-13",
}


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "ContractorTrustHub/NJ-CON-001"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        dest.write_bytes(resp.read())


def acquire(mode: str, raw_dir: Path) -> dict[str, Any]:
    acquisition: dict[str, Any] = {}
    raw_dir.mkdir(parents=True, exist_ok=True)
    for family, meta in OFFICIAL_DOWNLOADS.items():
        dest = raw_dir / meta["filename"]
        if mode == "official-download" or not dest.exists():
            if mode == "official-download":
                _download(meta["url"], dest)
        if not dest.exists():
            acquisition[family] = {"status": "source_not_acquired", "barrier": "local file missing"}
            continue
        digest = sha256_file(dest)
        acquisition[family] = {
            "status": "acquired",
            "agency": meta["agency"],
            "url": meta["url"],
            "page": meta["page"],
            "access_method": "official public download",
            "local_raw_path": str(dest.relative_to(ROOT)).replace("\\", "/"),
            "sha256": digest,
            "bytes": dest.stat().st_size,
            "source_as_of": AS_OF.get(family),
            "retrieved_at": utc_now(),
            "historical_or_current": "current_snapshot",
            "repeatable": True,
            "barrier": None,
        }
    for family, meta in POWER_BI_BLOCKED.items():
        local_csv = raw_dir / f"{family.lower()}.csv"
        if local_csv.exists():
            acquisition[family] = {
                "status": "acquired",
                "agency": meta["agency"],
                "url": meta["page"],
                "access_method": "local-input CSV (official Power BI has no deterministic export)",
                "local_raw_path": str(local_csv.relative_to(ROOT)).replace("\\", "/"),
                "sha256": sha256_file(local_csv),
                "bytes": local_csv.stat().st_size,
                "source_as_of": None,
                "retrieved_at": utc_now(),
                "historical_or_current": "unknown",
                "repeatable": False,
                "barrier": meta["barrier"],
            }
        else:
            acquisition[family] = {
                "status": "source_not_acquired",
                "agency": meta["agency"],
                "url": meta["page"],
                "access_method": "none — Power BI interactive view only",
                "local_raw_path": None,
                "sha256": None,
                "source_as_of": None,
                "retrieved_at": utc_now(),
                "historical_or_current": "current_interactive_list",
                "repeatable": False,
                "barrier": meta["barrier"],
            }
    return acquisition


def overlap_status(attached: int) -> str:
    if attached:
        return "current_source_record_found"
    return "no_attached_record_found_in_this_source_snapshot"


def write_ledger(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=True, default=str) + "\n")


def connect():
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        return None
    url = normalize_database_url(url)
    try:
        import psycopg
    except ImportError:
        return None
    try:
        return psycopg.connect(url, connect_timeout=10)
    except Exception:
        return None


def load_licenses_from_db(conn) -> list:
    from ingest.nj_identity_match import LicenseCandidate

    rows = []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT contractor_id::text, external_key, occupation_code, COALESCE(license_number,''),
                   licensee_name_raw, COALESCE(address_line_1,''), COALESCE(city,''),
                   COALESCE(postal_code,''), COALESCE(state,'NJ')
            FROM licenses
            WHERE source_system = 'nj_dca'
            """
        )
        for rec in cur.fetchall():
            rows.append(
                LicenseCandidate(
                    contractor_id=rec[0],
                    external_key=rec[1],
                    occupation_code=rec[2],
                    license_number=rec[3],
                    name=rec[4],
                    address=rec[5],
                    city=rec[6],
                    postal=rec[7],
                    state=rec[8] or "NJ",
                )
            )
    return rows


def execute_postgres(conn, family: str, acquisition: dict[str, Any], parsed: list[dict[str, Any]], dry_run: bool) -> dict[str, int]:
    counts = {"inserted": 0, "updated": 0, "unchanged": 0}
    if dry_run or conn is None:
        counts["inserted"] = len(parsed)
        return counts
    acq = acquisition[family]
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ingest_batches (source_system, source_dataset, source_url, source_file, extracted_at, row_count, checksum_sha256, notes)
            VALUES (%s,%s,%s,%s, now(), %s, %s, %s)
            RETURNING id
            """,
            (
                "nj_public_works",
                family,
                acq.get("url"),
                acq.get("local_raw_path"),
                len(parsed),
                acq.get("sha256"),
                "NJ-CON-001 baseline snapshot",
            ),
        )
        batch_id = cur.fetchone()[0]
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
                acq.get("agency"),
                acq.get("url") or acq.get("page"),
                acq.get("source_as_of"),
                acq.get("sha256"),
                len(parsed),
                acq.get("schema_fingerprint") or "na",
                batch_id,
                acq.get("barrier"),
            ),
        )
        snapshot_id = cur.fetchone()[0]
        for obs in parsed:
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
                    obs["source_record_id"],
                    obs["source_observation_key"],
                    obs["row_fingerprint_sha256"],
                    obs.get("contractor_id"),
                    obs.get("official_business_name"),
                    obs.get("individual_name"),
                    obs.get("address_line_1"),
                    obs.get("city"),
                    obs.get("state"),
                    obs.get("postal_code"),
                    obs.get("county"),
                    obs.get("certificate_or_vendor_id"),
                    obs.get("registration_status"),
                    obs.get("effective_date"),
                    obs.get("expiration_date"),
                    obs.get("action"),
                    obs.get("reason_code"),
                    obs.get("reason_text"),
                    obs.get("debarring_department"),
                    obs.get("debarring_agency"),
                    obs.get("permanent_flag"),
                    obs.get("source_publication_date"),
                    obs.get("match_method"),
                    obs.get("match_confidence"),
                    json.dumps(obs.get("raw_payload") or {}, ensure_ascii=True),
                ),
            )
            counts["inserted" if cur.rowcount else "unchanged"] += 1
            cur.execute(
                "SELECT id FROM official_source_observations WHERE source_family = %s AND source_observation_key = %s",
                (family, obs["source_observation_key"]),
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
                    obs.get("source_record_locator") or obs["source_observation_key"],
                    acq.get("local_raw_path"),
                ),
            )
    conn.commit()
    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["local-input", "official-download"], default="local-input")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--raw-dir", default=str(RAW_DIR))
    parser.add_argument("--licenses-csv", default="")
    parser.add_argument("--out-dir", default=str(STAGING_DIR))
    args = parser.parse_args(argv)
    dry_run = not args.execute
    raw_dir = Path(args.raw_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    acquisition = acquire(args.mode, raw_dir)
    license_path = Path(args.licenses_csv) if args.licenses_csv else SAMPLE_LICENSES
    licenses = load_license_csv(license_path) if license_path.exists() else []
    conn = connect()
    db_blocker = None
    if conn is None:
        db_blocker = "No authorized database session (DATABASE_URL missing or connection failed). Code/migrations/tests complete; production ingest not executed."
    elif not dry_run:
        try:
            licenses = load_licenses_from_db(conn) or licenses
        except Exception as exc:
            db_blocker = f"Database session present but NJ license read failed: {type(exc).__name__}"
            conn = None
    index = build_license_index(licenses)

    family_results: dict[str, Any] = {}
    all_obs: list[dict[str, Any]] = []
    for family in SOURCE_FAMILIES:
        acq = acquisition.get(family) or {"status": "source_not_acquired"}
        if acq.get("status") != "acquired":
            family_results[family] = {
                "rows": 0,
                "parsed": 0,
                "rejected": 0,
                "inserted": 0,
                "updated": 0,
                "unchanged": 0,
                "status": "source_not_acquired",
                "barrier": acq.get("barrier"),
            }
            continue
        path = ROOT / acq["local_raw_path"]
        parsed, rejected = load_source(path, family)
        acq["schema_fingerprint"] = schema_fingerprint(sorted({k for row in parsed for k in (row.get("raw_payload") or {})}))
        acq["parsed_rows"] = len(parsed)
        acq["rejected_rows"] = len(rejected)
        ledgers = apply_matches(parsed, index)
        db_counts = execute_postgres(conn, family, acquisition, parsed, dry_run=dry_run)
        fps = [o["row_fingerprint_sha256"] for o in parsed]
        family_results[family] = {
            "rows": acq.get("parsed_rows"),
            "parsed": len(parsed),
            "rejected": len(rejected),
            "inserted": db_counts["inserted"] if not dry_run else 0,
            "updated": db_counts["updated"],
            "unchanged": db_counts["unchanged"] if not dry_run else len(parsed),
            "dry_run_would_insert": len(parsed),
            "distinct_source_ids": len(set(fps)),
            "duplicate_fingerprints": len(fps) - len(set(fps)),
            "missing_key_dates": sum(1 for o in parsed if not o.get("effective_date") and not o.get("source_publication_date")),
            "missing_addresses": sum(1 for o in parsed if not o.get("address_line_1")),
            "missing_identifiers": sum(1 for o in parsed if not o.get("certificate_or_vendor_id")),
            "exact": len(ledgers["exact"]),
            "high_confidence": len(ledgers["high_confidence"]),
            "review_required": len(ledgers["review_required"]),
            "conflicts": len(ledgers["conflict"]),
            "unresolved": len(ledgers["unresolved"]),
            "public_label": PUBLIC_LABELS[family],
        }
        for kind, rows in ledgers.items():
            write_ledger(out_dir / f"{family.lower()}_{kind}.jsonl", rows)
        write_ledger(out_dir / f"{family.lower()}_rejected.jsonl", rejected)
        write_ledger(out_dir / f"{family.lower()}_normalized.jsonl", parsed)
        all_obs.extend(parsed)

    overlap = []
    by_family = defaultdict(list)
    for obs in all_obs:
        by_family[obs["source_family"]].append(obs)
    for lic in licenses:
        row = {
            "external_key": lic.external_key,
            "occupation_code": lic.occupation_code,
            "name": lic.name,
            "disclaimer": "No attached record found in this source snapshot is not a clean, cleared, safe, approved, trusted, or vetted finding.",
        }
        for family in SOURCE_FAMILIES:
            attached = [
                o
                for o in by_family.get(family, [])
                if o.get("contractor_id") and o.get("contractor_id") == lic.contractor_id
            ]
            if not attached and lic.external_key:
                attached = [
                    o
                    for o in by_family.get(family, [])
                    if o.get("match_method") in {"exact", "high_confidence"}
                    and o.get("official_business_name")
                    and o["official_business_name"].upper() == (lic.name or "").upper()
                    and o.get("match_confidence") in {"exact", "high_confidence"}
                ]
            label = overlap_status(len(attached))
            if family in POWER_BI_BLOCKED and acquisition.get(family, {}).get("status") != "acquired":
                label = "source_not_acquired"
            row[family] = label
        overlap.append(row)

    overlap_path = out_dir / "contractor_source_overlap.csv"
    if overlap:
        fields = ["external_key", "occupation_code", "name", *SOURCE_FAMILIES, "disclaimer"]
        with overlap_path.open("w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=fields)
            w.writeheader()
            w.writerows(overlap)

    summary = {
        "ticket": "NJ-CON-001",
        "retrieved_at": utc_now(),
        "mode": args.mode,
        "dry_run": dry_run,
        "forbidden_public_labels": list(FORBIDDEN_PUBLIC_LABELS),
        "acquisition": acquisition,
        "family_results": family_results,
        "license_index_size": index.size,
        "database_blocker": db_blocker,
        "overlap_path": str(overlap_path.relative_to(ROOT)).replace("\\", "/") if overlap else None,
        "no_clean_record_disclaimer": "Absence from a current list does not prove a clean history. No attached record found in this source snapshot is not clean, cleared, safe, approved, trusted, or vetted.",
    }
    (out_dir / "nj_con_001_summary.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    (ARTIFACT_DIR / "nj-con-001-summary.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    print(json.dumps({"dry_run": dry_run, "families": {k: v.get("parsed") for k, v in family_results.items()}, "db_blocker": db_blocker}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
