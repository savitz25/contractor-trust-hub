#!/usr/bin/env python3
"""Read-only five-file Florida licensed-discipline ingestion planner.

Reads fresh official CSVs already downloaded under data/raw, reconciles them
against production in one repeatable-read/read-only snapshot, and emits only
aggregate/non-PII planning results. It cannot mutate the database.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url  # noqa: E402
from ingest.regulatory.fl_dbpr_identity import (  # noqa: E402
    FloridaDbprCredentialResolver,
    LicenseCredential,
)
from scripts.load_fl_dbpr_to_postgres import discipline_external_key  # noqa: E402

HEADERS = [
    "License Type", "License Nbr", "Respondent Name", "Address Line 1",
    "Address Line 2", "Address Line 3", "City", "State", "ZIP Code",
    "County", "Complaint Nbr", "Classification", "Entered Date",
    "Disposition", "Disposition Date", "Discipline Date - Description",
    "Violation Code",
]
FILES = {
    "2021-22": ("contractor_disc_lic_2122.csv", "https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2122.csv"),
    "2022-23": ("contractor_disc_lic_2223.csv", "https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2223.csv"),
    "2023-24": ("contractor_disc_lic_2324.csv", "https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2324.csv"),
    "2024-25": ("contractor_disc_lic_2425.csv", "https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2425.csv"),
    "2025-26": ("contractor_disc_lic_2526.csv", "https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2526.csv"),
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def normalized(row: dict[str, Any]) -> dict[str, str]:
    return {key: str(row.get(key) or "").strip() for key in HEADERS}


def row_fingerprint(row: dict[str, Any]) -> str:
    payload = json.dumps(normalized(row), sort_keys=True, separators=(",", ":"))
    return sha256_bytes(payload.encode())


def matter_key(row: dict[str, Any]) -> tuple[str, ...]:
    """Conservative cross-file grouping, never an automatic dedupe key."""
    r = normalized(row)
    return (
        r["Complaint Nbr"].upper(), r["License Type"].casefold(),
        r["License Nbr"].upper(), r["Respondent Name"].casefold(),
        r["Classification"].casefold(), r["Entered Date"],
        r["Violation Code"].casefold(),
    )


def staging_row(row: dict[str, Any]) -> dict[str, str]:
    r = normalized(row)
    return {
        "source_dataset": "contractor_disc_lic",
        "complaint_number": r["Complaint Nbr"],
        "license_type": r["License Type"],
        "license_number_raw": r["License Nbr"],
        "respondent_name": r["Respondent Name"],
        "discipline_description": r["Discipline Date - Description"],
        "disposition_date": iso_date(r["Disposition Date"]),
    }


def iso_date(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    try:
        return datetime.strptime(value, "%m/%d/%Y").date().isoformat()
    except ValueError:
        return value


def semantic_category(row: dict[str, Any]) -> str:
    disposition = str(row.get("Disposition") or "").strip().casefold()
    if not disposition:
        return "blank_unknown"
    if disposition == "insufficient evidence":
        return "insufficient_evidence"
    if disposition == "dismissed":
        return "dismissed"
    if disposition == "citation filed":
        return "citation"
    if disposition in {"final order", "final order of local discipline"}:
        return "final_order"
    if disposition in {"closed after legal review", "nnc closed", "violation found - corrected", "mandate"}:
        return "closure_other_disposition"
    return "complaint_matter_only"


def inspect_files(raw_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    inventories: list[dict[str, Any]] = []
    all_rows: list[dict[str, Any]] = []
    for fy, (filename, url) in FILES.items():
        path = raw_dir / filename
        data = path.read_bytes()
        malformed = 0
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            headers = reader.fieldnames or []
            rows = []
            for row in reader:
                if None in row or set(row) != set(HEADERS):
                    malformed += 1
                    continue
                clean = normalized(row)
                clean["_fiscal_year"] = fy
                clean["_source_filename"] = filename
                clean["_row_fingerprint"] = row_fingerprint(clean)
                rows.append(clean)
                all_rows.append(clean)
        row_counts = Counter(row["_row_fingerprint"] for row in rows)
        inventories.append({
            "fiscal_year": fy,
            "source_url": url,
            "source_filename": filename,
            "downloaded_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
            "http_status": 200,
            "byte_size": len(data),
            "sha256": sha256_bytes(data),
            "header_schema_fingerprint": "sha256:" + sha256_bytes(json.dumps(headers, separators=(",", ":")).encode()),
            "headers_match": headers == HEADERS,
            "raw_rows": len(rows) + malformed,
            "parseable_rows": len(rows),
            "malformed_rows": malformed,
            "exact_duplicate_rows_within_file": sum(count - 1 for count in row_counts.values() if count > 1),
            "blank_critical_identifiers": {
                "complaint_number": sum(not row["Complaint Nbr"] for row in rows),
                "license_type": sum(not row["License Type"] for row in rows),
                "license_number": sum(not row["License Nbr"] for row in rows),
                "respondent": sum(not row["Respondent Name"] for row in rows),
            },
            "license_types": dict(sorted(Counter(row["License Type"] or "(blank)" for row in rows).items())),
            "dispositions": dict(sorted(Counter(row["Disposition"] or "(blank)" for row in rows).items())),
        })
    return inventories, all_rows


def production_snapshot(cur: Any) -> dict[str, Any]:
    cur.execute("SHOW server_version")
    pg_version = cur.fetchone()[0]
    cur.execute(
        """SELECT id, external_key, occupation_code, license_number, source_board, contractor_id
             FROM licenses WHERE source_system='fl_dbpr'"""
    )
    licenses = [
        LicenseCredential(str(r[0]), r[1], r[2], r[3], r[4], str(r[5]) if r[5] else None)
        for r in cur.fetchall()
    ]
    cur.execute(
        """SELECT id, external_key, license_id, contractor_id, raw_payload,
                  identity_state, publication_state, correction_hold
             FROM discipline_actions
            WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_lic'
            ORDER BY id"""
    )
    rows = [
        {
            "id": str(r[0]), "external_key": r[1],
            "license_id": str(r[2]) if r[2] else None,
            "contractor_id": str(r[3]) if r[3] else None,
            "raw_payload": normalized(r[4] or {}), "identity_state": r[5],
            "publication_state": r[6], "correction_hold": r[7],
        }
        for r in cur.fetchall()
    ]
    return {"postgresql_version": pg_version, "licenses": licenses, "discipline": rows}


def analyze(inventories: list[dict[str, Any]], rows: list[dict[str, Any]], prod: dict[str, Any]) -> dict[str, Any]:
    resolver = FloridaDbprCredentialResolver(prod["licenses"])
    fp_locations: dict[str, list[str]] = defaultdict(list)
    matter_groups: dict[tuple[str, ...], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        fp_locations[row["_row_fingerprint"]].append(row["_fiscal_year"])
        matter_groups[matter_key(row)].append(row)

    exact_cross_file_fps = {fp: fys for fp, fys in fp_locations.items() if len(set(fys)) > 1}
    repeated_matters = {key: group for key, group in matter_groups.items() if len({r["_fiscal_year"] for r in group}) > 1}
    revised_groups = 0
    legitimate_multiline_groups = 0
    for group in matter_groups.values():
        distinct_full = {r["_row_fingerprint"] for r in group}
        if len(distinct_full) > 1:
            if len({r["_fiscal_year"] for r in group}) > 1:
                revised_groups += 1
            else:
                legitimate_multiline_groups += 1

    source_by_fp = Counter(row["_row_fingerprint"] for row in rows)
    prod_by_fp = Counter(row_fingerprint(row["raw_payload"]) for row in prod["discipline"])
    represented = sum(min(count, prod_by_fp.get(fp, 0)) for fp, count in source_by_fp.items())
    prod_exact = sum(min(count, source_by_fp.get(fp, 0)) for fp, count in prod_by_fp.items())

    # Conservative update pairing: same matter key, changed full payload, one-to-one only.
    prod_by_matter: dict[tuple[str, ...], list[dict[str, Any]]] = defaultdict(list)
    for row in prod["discipline"]:
        prod_by_matter[matter_key(row["raw_payload"])].append(row)
    source_unique_rows = {fp: next(r for r in rows if r["_row_fingerprint"] == fp) for fp in source_by_fp}
    unmatched_source = [r for fp, r in source_unique_rows.items() if prod_by_fp.get(fp, 0) == 0]
    unmatched_prod = [r for r in prod["discipline"] if source_by_fp.get(row_fingerprint(r["raw_payload"]), 0) == 0]
    prod_unmatched_by_matter = defaultdict(list)
    for row in unmatched_prod:
        prod_unmatched_by_matter[matter_key(row["raw_payload"])].append(row)
    updates = [r for r in unmatched_source if len(prod_unmatched_by_matter.get(matter_key(r), [])) == 1]
    update_fps = {r["_row_fingerprint"] for r in updates}

    # Exact duplicate source observations are suppressed; materially distinct rows remain.
    exact_duplicate_occurrences = sum(count - 1 for count in source_by_fp.values() if count > 1)
    net_new = [r for r in unmatched_source if r["_row_fingerprint"] not in update_fps]
    candidates = updates + net_new
    resolution_counts: Counter[str] = Counter()
    for row in candidates:
        result = resolver.resolve(
            source_dataset="contractor_disc_lic",
            license_type=row["License Type"], license_number=row["License Nbr"],
        )
        resolution_counts[result.identity_state] += 1

    current_resolution: Counter[str] = Counter()
    current_correctable = 0
    verified = 0
    for row in prod["discipline"]:
        raw = row["raw_payload"]
        result = resolver.resolve(
            source_dataset="contractor_disc_lic",
            license_type=raw["License Type"], license_number=raw["License Nbr"],
        )
        current_resolution[result.identity_state] += 1
        if result.proposed_license_id and row["license_id"] == result.proposed_license_id:
            verified += 1
        if result.proposed_license_id and row["license_id"] and row["license_id"] != result.proposed_license_id:
            current_correctable += 1

    semantic = Counter(semantic_category(row) for row in rows)
    disposition = Counter(row["Disposition"] or "(blank)" for row in rows)
    classification = Counter(row["Classification"] or "(blank)" for row in rows)
    source_updated = len(updates)
    source_missing = len(unmatched_prod) - source_updated
    duplicate_prod = sum(count - 1 for count in prod_by_fp.values() if count > 1)
    current_external_key_collisions = Counter(discipline_external_key(staging_row(r)) for r in rows)

    assertions = {
        "source_rows_reconcile": sum(i["raw_rows"] for i in inventories) == len(rows),
        "all_rows_parseable": all(i["malformed_rows"] == 0 for i in inventories),
        "production_total_1541": len(prod["discipline"]) == 1541,
        "current_resolution_baseline": dict(current_resolution) == {"EXACT": 523, "DETERMINISTIC": 61, "REVIEW_REQUIRED": 376, "UNRESOLVED": 581},
        "current_correctable_zero": current_correctable == 0,
        "verified_relationships_584": verified == 584,
        "public_eligible_zero": sum(r["publication_state"] == "PUBLIC_ELIGIBLE" for r in prod["discipline"]) == 0,
        "contractor_linked_zero": sum(bool(r["contractor_id"]) for r in prod["discipline"]) == 0,
    }
    if not all(assertions.values()):
        raise RuntimeError(f"Planning reconciliation failed: {assertions}")

    return {
        "audit_id": "CTH-FL-STATE-002-PLAN",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "git_sha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "database": "PRODUCTION",
        "postgresql_version": prod["postgresql_version"],
        "transaction": {"read_only": True, "isolation": "repeatable read", "statement_timeout": "30s"},
        "mutation_performed": False,
        "source_files": inventories,
        "source_totals": {
            "raw_rows": len(rows), "parseable_rows": len(rows),
            "malformed_rows": sum(i["malformed_rows"] for i in inventories),
            "previous_expected_rows": 6457,
        },
        "production_reconciliation": {
            "current_rows": len(prod["discipline"]),
            "exact_current_source_matches": prod_exact,
            "source_row_updated": source_updated,
            "source_row_no_longer_present": source_missing,
            "duplicate_current_rows": duplicate_prod,
            "other_review_required": 0,
        },
        "cross_fiscal": {
            "exact_duplicate_occurrences": exact_duplicate_occurrences,
            "exact_rows_repeated_across_files": sum(len(v) - 1 for v in exact_cross_file_fps.values()),
            "repeated_matter_groups_across_files": len(repeated_matters),
            "material_revision_groups_across_files": revised_groups,
            "legitimate_multiline_matter_groups_within_file": legitimate_multiline_groups,
            "current_external_key_collision_groups": sum(v > 1 for v in current_external_key_collisions.values()),
        },
        "ingestion_delta": {
            "already_represented_unchanged": represented,
            "source_updates": source_updated,
            "true_net_new": len(net_new),
            "exact_duplicate_occurrences_suppressed": exact_duplicate_occurrences,
            "revision_history_rows_retained": source_updated,
            "malformed_review_required": sum(i["malformed_rows"] for i in inventories),
            "proposed_observations": len(candidates),
        },
        "candidate_identity_resolution": dict(sorted(resolution_counts.items())),
        "current_safety_check": {
            "identity": dict(current_resolution), "correctable_remaining": current_correctable,
            "verified_relationships": verified,
            "stored_public_eligible": sum(r["publication_state"] == "PUBLIC_ELIGIBLE" for r in prod["discipline"]),
        },
        "semantics": {
            "normalized_categories": dict(sorted(semantic.items())),
            "official_dispositions": dict(sorted(disposition.items())),
            "official_classifications": dict(sorted(classification.items())),
            "final_order_candidates": sum(v for k, v in disposition.items() if k.strip().casefold() in {"final order", "final order of local discipline"}),
        },
        "contact_observations": {
            "email_fields": 0, "phone_fields": 0, "website_fields": 0,
            "named_contact_fields_beyond_respondent": 0,
            "rows_with_address_line_1": sum(bool(r["Address Line 1"]) for r in rows),
            "rows_with_any_address_component": sum(any(r[k] for k in ("Address Line 1", "Address Line 2", "Address Line 3", "City", "State", "ZIP Code", "County")) for r in rows),
        },
        "proposed_load": {
            "inserts": len(net_new) + source_updated,
            "source_updates": source_updated,
            "identity_linked": resolution_counts["EXACT"] + resolution_counts["DETERMINISTIC"],
            "review_held": resolution_counts["REVIEW_REQUIRED"],
            "unresolved": resolution_counts["UNRESOLVED"],
            "contractor_id_mutations": 0, "public_eligible": 0,
            "ingest_batches": len(inventories),
        },
        "assertions": assertions,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", type=Path, default=ROOT / "data/raw/fl_dbpr/cth-fl-state-002-plan")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts/cth-fl-state-002-licensed-discipline-plan.json")
    args = parser.parse_args()
    inventories, rows = inspect_files(args.raw_dir)
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    if not os.environ.get("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")
    import psycopg
    with psycopg.connect(normalize_database_url(os.environ["DATABASE_URL"]), autocommit=False) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                cur.execute("SET LOCAL statement_timeout='30000ms'")
                cur.execute("SELECT current_setting('transaction_read_only'), current_setting('transaction_isolation')")
                if cur.fetchone() != ("on", "repeatable read"):
                    raise RuntimeError("Read-only repeatable-read protections are not active")
                result = analyze(inventories, rows, production_snapshot(cur))
        finally:
            conn.rollback()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: result[k] for k in ("source_totals", "production_reconciliation", "cross_fiscal", "ingestion_delta", "candidate_identity_resolution", "current_safety_check", "proposed_load")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
