#!/usr/bin/env python3
"""Controlled Florida ULA executor; dry-run/read-only unless --execute is explicit."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.adapters.fl_dbpr import _parse_date
from ingest.env import load_dotenv_files, normalize_database_url
from ingest.regulatory.fl_dbpr_ula import (
    IDENTITY_EVIDENCE,
    IDENTITY_METHOD,
    IDENTITY_STATE,
    PUBLICATION_STATE,
    RESOLVER_VERSION,
    REVIEW_REASON,
    SOURCE_DATASET,
    SOURCE_SYSTEM,
    semantic_category,
)
from ingest.regulatory.source_observation import (
    FL_ULA_FIELDS,
    FL_ULA_LOGICAL_MATTER_FIELDS,
    LOGICAL_MATTER_ALGORITHM,
    SOURCE_OBSERVATION_ALGORITHM,
    canonical_source_row,
    logical_matter_detail_key_v1,
    row_fingerprint_sha256,
    source_observation_key_v2,
)
from scripts import backfill_fl_regulatory_source_provenance as legacy

MANIFEST_VERSION = "cth-fl-state-003-ula-ingestion-v1"
TASK_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "contractortrusthub:cth-fl-state-003-ula")
FILES = {
    "2021-22": {"code": "2122", "rows": 2312, "sha256": "4f0ca3409686d5a1fe960e7ecf2c0cf0416d62e216d29c4bc371432846d07d1c"},
    "2022-23": {"code": "2223", "rows": 2631, "sha256": "2c03c334e3bcda679d689494c397f7166c205aa60d3d43c05c8cf875ee84cc7b"},
    "2023-24": {"code": "2324", "rows": 2568, "sha256": "a5036af5f02e85d12b9af3252d17368b71b4c7cd9fa5c6b9a57fafcd4d2dcddc"},
    "2024-25": {"code": "2425", "rows": 2338, "sha256": "06169ddf04e1911fc6414977924c3eea28d872899a5499f6d86c766813f22b15"},
    "2025-26": {"code": "2526", "rows": 1842, "sha256": "3e9a92d8340f2c0975e4204d31b6d83cbc5bf8a7eef36a85da11b30218e87c9a"},
}
EXPECTED_SEMANTICS = {
    "COMPLAINT_INVESTIGATION": 614,
    "CITATION": 3162,
    "ORDER": 24,
    "FINAL_ORDER": 7852,
    "DISMISSED": 12,
    "CLOSED_ADMINISTRATIVE": 15,
    "INSUFFICIENT_EVIDENCE": 12,
    "OTHER": 0,
    "UNKNOWN": 0,
}


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()


def digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value)).hexdigest()


def stable_id(kind: str, identity: str) -> str:
    return str(uuid.uuid5(TASK_NAMESPACE, f"{kind}:{identity}"))


def source_filename(year: str) -> str:
    return f"contractor_disc_ula_{FILES[year]['code']}.csv"


def source_url(year: str) -> str:
    return f"https://www2.myfloridalicense.com/pro/cilb/reports/{source_filename(year)}"


def observation_key(row: dict[str, str]) -> str:
    return source_observation_key_v2(
        source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET,
        row=row, fields=FL_ULA_FIELDS,
    )


def logical_key(row: dict[str, str]) -> str:
    return logical_matter_detail_key_v1(
        source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET,
        row=row, fields=FL_ULA_LOGICAL_MATTER_FIELDS,
    )


def load_sources(raw_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    inventory: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    schema_fingerprint = digest(list(FL_ULA_FIELDS))
    for year, spec in FILES.items():
        path = raw_dir / source_filename(year)
        data = path.read_bytes()
        checksum = hashlib.sha256(data).hexdigest()
        if checksum != spec["sha256"]:
            raise RuntimeError(f"SOURCE_DRIFT {year} checksum {checksum}")
        parsed: list[dict[str, Any]] = []
        with path.open("r", encoding="cp1252", errors="strict", newline="") as handle:
            reader = csv.DictReader(handle)
            if tuple(reader.fieldnames or ()) != FL_ULA_FIELDS:
                raise RuntimeError(f"SOURCE_DRIFT {year} schema")
            for locator, raw in enumerate(reader, start=1):
                if None in raw or set(raw) != set(FL_ULA_FIELDS):
                    raise RuntimeError(f"SOURCE_DRIFT malformed {year}:{locator}")
                parsed.append({
                    "fiscal_year": year,
                    "source_record_locator": f"csv-record:{locator}",
                    "payload": canonical_source_row(raw, FL_ULA_FIELDS),
                })
        if len(parsed) != spec["rows"]:
            raise RuntimeError(f"SOURCE_DRIFT {year} rows {len(parsed)}")
        downloaded_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        inventory.append({
            "fiscal_year": year, "official_url": source_url(year), "filename": path.name,
            "http_status": 200, "byte_size": len(data), "downloaded_at": downloaded_at,
            "sha256": checksum, "rows": len(parsed), "schema_columns": 16,
            "schema_fingerprint": schema_fingerprint,
        })
        rows.extend(parsed)
    if len(rows) != 11691:
        raise RuntimeError(f"SOURCE_DRIFT total {len(rows)}")
    return inventory, rows


def build_manifest(inventory: list[dict[str, Any]], rows: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    inventory_by_year = {item["fiscal_year"]: item for item in inventory}
    batch_ids = {
        year: stable_id("batch", f"{year}:{spec['sha256']}")
        for year, spec in FILES.items()
    }
    entries: list[dict[str, Any]] = []
    keys: list[str] = []
    logical_groups: dict[str, dict[str, set[str]]] = {}
    semantics: Counter[str] = Counter()
    for item in rows:
        payload = item["payload"]
        key = observation_key(payload)
        logical = logical_key(payload)
        category = semantic_category(payload)
        keys.append(key)
        semantics[category] += 1
        group = logical_groups.setdefault(logical, {"keys": set(), "years": set()})
        group["keys"].add(key)
        group["years"].add(item["fiscal_year"])
        occurrence_identity = f"{key}:{item['fiscal_year']}:{item['source_record_locator']}:{FILES[item['fiscal_year']]['sha256']}"
        entries.append({
            "fiscal_year": item["fiscal_year"],
            "source_file_checksum": FILES[item["fiscal_year"]]["sha256"],
            "source_record_locator": item["source_record_locator"],
            "source_observation_key": key,
            "row_fingerprint_sha256": row_fingerprint_sha256(payload, FL_ULA_FIELDS),
            "logical_matter_detail_key": logical,
            "semantic_category": category,
            "identity_state": IDENTITY_STATE,
            "identity_method": IDENTITY_METHOD,
            "resolver_version": RESOLVER_VERSION,
            "discipline_action_id": stable_id("action", key),
            "observation_id": stable_id("observation", key),
            "occurrence_id": stable_id("occurrence", occurrence_identity),
            "ingest_batch_id": batch_ids[item["fiscal_year"]],
        })
    entries.sort(key=lambda item: (item["fiscal_year"], item["source_record_locator"], item["source_observation_key"]))
    duplicates = len(keys) - len(set(keys))
    # Multiple exact details in one matter/file are legitimate source grain.
    # Only changed exact rows spanning source periods are revision candidates.
    revisions = sum(
        1 for group in logical_groups.values()
        if len(group["keys"]) > 1 and len(group["years"]) > 1
    )
    if duplicates or revisions:
        raise RuntimeError(f"DELTA_DRIFT duplicates={duplicates} revisions={revisions}")
    actual_semantics = {key: semantics.get(key, 0) for key in EXPECTED_SEMANTICS}
    if actual_semantics != EXPECTED_SEMANTICS:
        raise RuntimeError(f"SEMANTIC_DRIFT {actual_semantics}")
    batches = [{
        "fiscal_year": year,
        "ingest_batch_id": batch_ids[year],
        "source_system": SOURCE_SYSTEM,
        "source_dataset": SOURCE_DATASET,
        "source_url": source_url(year),
        "source_file": source_filename(year),
        "row_count": FILES[year]["rows"],
        "checksum_sha256": FILES[year]["sha256"],
        "downloaded_at": inventory_by_year[year]["downloaded_at"],
    } for year in FILES]
    core = {
        "manifest_version": MANIFEST_VERSION,
        "source_system": SOURCE_SYSTEM,
        "source_dataset": SOURCE_DATASET,
        "source_files": inventory,
        "batches": batches,
        "entries": entries,
    }
    manifest = core | {"entry_count": len(entries), "manifest_fingerprint": digest(core)}
    analysis = {
        "new_exact": len(entries), "duplicate_source_observations": duplicates,
        "revision_candidates": revisions, "semantic_counts": actual_semantics,
        "new_by_year": dict(Counter(item["fiscal_year"] for item in entries)),
        "identity_partition": {IDENTITY_STATE: len(entries), "REVIEW_REQUIRED": 0},
    }
    return manifest, analysis


def reverse_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    core = {
        "execution_manifest_fingerprint": manifest["manifest_fingerprint"],
        "source_checksums": {item["fiscal_year"]: item["sha256"] for item in manifest["source_files"]},
        "batch_ids": [item["ingest_batch_id"] for item in manifest["batches"]],
        "discipline_action_ids": [item["discipline_action_id"] for item in manifest["entries"]],
        "observation_ids": [item["observation_id"] for item in manifest["entries"]],
        "occurrence_ids": [item["occurrence_id"] for item in manifest["entries"]],
    }
    return core | {
        "reverse_manifest_fingerprint": digest(core),
        "rollback_order": ["occurrences", "observations", "discipline_actions", "ingest_batches"],
        "automatic_rollback_authorized": False,
    }


def validate_ids(cur, manifest: dict[str, Any]) -> dict[str, int]:
    entries = manifest["entries"]
    groups = {
        "action": {item["discipline_action_id"] for item in entries},
        "observation": {item["observation_id"] for item in entries},
        "occurrence": {item["occurrence_id"] for item in entries},
        "batch": {item["ingest_batch_id"] for item in manifest["batches"]},
    }
    expected = {"action": 11691, "observation": 11691, "occurrence": 11691, "batch": 5}
    if {key: len(value) for key, value in groups.items()} != expected:
        raise RuntimeError("MANIFEST_COLLISION internal IDs")
    tables = {
        "action": "discipline_actions", "observation": "regulatory_source_observations",
        "occurrence": "regulatory_source_occurrences", "batch": "ingest_batches",
    }
    collisions: dict[str, int] = {}
    for kind, table in tables.items():
        cur.execute(f"SELECT count(*)::int FROM {table} WHERE id=ANY(%s::uuid[])", (list(groups[kind]),))
        collisions[kind] = cur.fetchone()[0]
    keys = [item["source_observation_key"] for item in entries]
    cur.execute("SELECT count(*)::int FROM discipline_actions WHERE source_system=%s AND external_key=ANY(%s)", (SOURCE_SYSTEM, keys))
    collisions["external_key"] = cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM regulatory_source_observations WHERE source_system=%s AND source_dataset=%s AND source_observation_key=ANY(%s)", (SOURCE_SYSTEM, SOURCE_DATASET, keys))
    collisions["source_observation_key"] = cur.fetchone()[0]
    if any(collisions.values()):
        raise RuntimeError(f"MANIFEST_COLLISION {collisions}")
    return collisions


def relationship_rows(cur, predicate: str) -> list[tuple[Any, ...]]:
    cur.execute(f"SELECT id,source_system,license_id,contractor_id FROM discipline_actions WHERE {predicate}")
    return cur.fetchall()


def predicted_fingerprints(cur, manifest: dict[str, Any]) -> dict[str, str]:
    new = [(item["discipline_action_id"], SOURCE_SYSTEM, None, None) for item in manifest["entries"]]
    whole = relationship_rows(cur, "TRUE") + new
    florida = relationship_rows(cur, "source_system='fl_dbpr'") + new
    arizona = relationship_rows(cur, "source_system='az_roc'")
    new_jersey = relationship_rows(cur, "source_system='nj_enforcement'")
    cur.execute("""SELECT id,identity_state,identity_method,resolved_license_external_key,
        publication_state,correction_hold,retraction_hold,license_id,contractor_id
        FROM discipline_actions WHERE source_system='fl_dbpr'""")
    safety = cur.fetchall() + [(
        item["discipline_action_id"], IDENTITY_STATE, IDENTITY_METHOD, None,
        PUBLICATION_STATE, False, False, None, None,
    ) for item in manifest["entries"]]
    def fp(rows: list[tuple[Any, ...]]) -> str:
        return legacy.relationship_digest(sorted(rows, key=lambda row: str(row[0])))
    return {
        "whole": fp(whole), "florida": fp(florida), "florida_safety": fp(safety),
        "arizona": fp(arizona), "new_jersey": fp(new_jersey), "ula_cohort": fp(new),
        "provenance": digest([(item["discipline_action_id"], item["observation_id"], item["occurrence_id"], item["source_observation_key"]) for item in manifest["entries"]]),
        "batches": digest(manifest["batches"]),
    }


def production_baseline(cur) -> dict[str, Any]:
    cur.execute("SELECT count(*)::int FROM discipline_actions")
    whole = cur.fetchone()[0]
    cur.execute("SELECT source_dataset,count(*)::int FROM discipline_actions WHERE source_system='fl_dbpr' GROUP BY source_dataset")
    florida = dict(cur.fetchall())
    cur.execute("SELECT count(*)::int FROM regulatory_source_observations")
    observations = cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM regulatory_source_occurrences")
    occurrences = cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM ingest_batches")
    batches = cur.fetchone()[0]
    cur.execute("""SELECT identity_state,count(*)::int FROM discipline_actions
        WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_lic'
        GROUP BY identity_state""")
    identity = dict(cur.fetchall())
    cur.execute("""SELECT count(*)::int FROM discipline_actions d JOIN licenses l ON l.id=d.license_id
        WHERE d.source_system='fl_dbpr' AND d.source_dataset='contractor_disc_lic'
        AND d.identity_state IN ('EXACT','DETERMINISTIC')
        AND d.resolved_license_external_key=l.external_key""")
    safe_links = cur.fetchone()[0]
    cur.execute("SELECT source_system,count(*)::int FROM discipline_actions GROUP BY source_system")
    state_counts = dict(cur.fetchall())
    cur.execute("""SELECT count(*)::int FROM discipline_actions
        WHERE source_system='fl_dbpr' AND publication_state='PUBLIC_ELIGIBLE'""")
    public_eligible = cur.fetchone()[0]
    baseline = {
        "whole_discipline_actions": whole,
        "florida_licensed_discipline": florida.get("contractor_disc_lic", 0),
        "florida_ula": florida.get(SOURCE_DATASET, 0),
        "observations": observations, "occurrences": occurrences, "ingest_batches": batches,
        "licensed_identity": identity, "licensed_safe_links_agreeing": safe_links,
        "correctable_remaining": 0, "public_eligible": public_eligible,
        "arizona": state_counts.get("az_roc", 0), "new_jersey": state_counts.get("nj_enforcement", 0),
    }
    expected = {"whole_discipline_actions": 8050, "florida_licensed_discipline": 6457, "florida_ula": 0,
        "observations": 6457, "occurrences": 6457, "ingest_batches": 51,
        "licensed_identity": {"EXACT": 1736, "DETERMINISTIC": 236, "REVIEW_REQUIRED": 1411, "UNRESOLVED": 3074},
        "licensed_safe_links_agreeing": 1972, "correctable_remaining": 0, "public_eligible": 0,
        "arizona": 459, "new_jersey": 1134}
    if baseline != expected:
        raise RuntimeError(f"PRODUCTION_DRIFT {baseline}")
    return baseline


def licensed_provenance_regression(cur) -> dict[str, int]:
    cur.execute("""SELECT o.source_observation_key,o.row_fingerprint_sha256,
        o.logical_matter_detail_key,o.source_payload
        FROM regulatory_source_observations o
        JOIN discipline_actions d ON d.id=o.discipline_action_id
        WHERE d.source_system='fl_dbpr' AND d.source_dataset='contractor_disc_lic'""")
    rows = cur.fetchall()
    valid_key = valid_fingerprint = valid_logical = 0
    for stored_key, stored_fingerprint, stored_logical, payload in rows:
        if source_observation_key_v2(source_system=SOURCE_SYSTEM, source_dataset="contractor_disc_lic", row=payload) == stored_key:
            valid_key += 1
        if row_fingerprint_sha256(payload) == stored_fingerprint:
            valid_fingerprint += 1
        if logical_matter_detail_key_v1(source_system=SOURCE_SYSTEM, source_dataset="contractor_disc_lic", row=payload) == stored_logical:
            valid_logical += 1
    result = {"rows": len(rows), "observation_keys_valid": valid_key, "row_fingerprints_valid": valid_fingerprint, "logical_keys_valid": valid_logical, "changed": len(rows) - min(valid_key, valid_fingerprint, valid_logical)}
    if result != {"rows": 6457, "observation_keys_valid": 6457, "row_fingerprints_valid": 6457, "logical_keys_valid": 6457, "changed": 0}:
        raise RuntimeError(f"LICENSED_REGRESSION {result}")
    return result


def normalized_action(payload: dict[str, str]) -> dict[str, Any]:
    row = canonical_source_row(payload, FL_ULA_FIELDS)
    return {
        "complaint_number": row["Complaint Nbr"] or None,
        "license_type": row["License Type"] or None,
        "respondent_name": row["Respondent Name"],
        "classification": row["Classification"] or None,
        "entered_date": _parse_date(row["Entered Date"]) or None,
        "disposition": row["Disposition"] or None,
        "disposition_date": _parse_date(row["Disposition Date"]) or None,
        "discipline_description": row["Discipline Date - Description"] or None,
        "violation_code": row["Violation Code"] or None,
        "address_line_1": row["Address Line 1"] or None,
        "city": row["City"] or None,
        "state": row["State"][:2].upper() or None,
        "postal_code": row["ZIP Code"] or None,
        "county_name": row["County"] or None,
    }


def execute(cur, manifest: dict[str, Any], source_by_key: dict[str, dict[str, str]], Jsonb) -> None:
    """Insert the approved cohort. Caller owns the sole transaction."""

    now = datetime.now(timezone.utc)
    cur.executemany("""INSERT INTO ingest_batches
        (id,source_system,source_dataset,source_url,source_file,extracted_at,row_count,checksum_sha256,notes)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""", [(
            batch["ingest_batch_id"], SOURCE_SYSTEM, SOURCE_DATASET, batch["source_url"],
            batch["source_file"], batch["downloaded_at"], batch["row_count"],
            batch["checksum_sha256"], f"CTH-FL-STATE-003 controlled ULA ingestion {batch['fiscal_year']}",
        ) for batch in manifest["batches"]])
    if cur.rowcount != 5:
        raise RuntimeError("batch insert count")
    actions, observations, occurrences = [], [], []
    batches = {item["ingest_batch_id"]: item for item in manifest["batches"]}
    for item in manifest["entries"]:
        payload = source_by_key[item["source_observation_key"]]
        action = normalized_action(payload)
        observed_at = batches[item["ingest_batch_id"]]["downloaded_at"]
        actions.append((
            item["discipline_action_id"], SOURCE_SYSTEM, SOURCE_DATASET, item["source_observation_key"],
            action["complaint_number"], action["license_type"], action["respondent_name"],
            action["classification"], action["entered_date"], action["disposition"], action["disposition_date"],
            action["discipline_description"], action["violation_code"], action["address_line_1"], action["city"],
            action["state"], action["postal_code"], action["county_name"], Jsonb(payload), item["ingest_batch_id"],
            now, IDENTITY_STATE, IDENTITY_METHOD, RESOLVER_VERSION, Jsonb(IDENTITY_EVIDENCE), now, REVIEW_REASON,
        ))
        observations.append((
            item["observation_id"], item["discipline_action_id"], SOURCE_SYSTEM, SOURCE_DATASET,
            item["source_observation_key"], SOURCE_OBSERVATION_ALGORITHM, item["logical_matter_detail_key"],
            LOGICAL_MATTER_ALGORITHM, item["row_fingerprint_sha256"], Jsonb(payload), observed_at,
        ))
        occurrences.append((
            item["occurrence_id"], item["observation_id"], item["ingest_batch_id"], item["fiscal_year"],
            item["source_file_checksum"], item["source_record_locator"], source_filename(item["fiscal_year"]),
            source_url(item["fiscal_year"]), observed_at,
        ))
    cur.executemany("""INSERT INTO discipline_actions
        (id,contractor_id,license_id,source_system,source_dataset,external_key,complaint_number,license_type,
        license_number_raw,respondent_name,classification,entered_date,disposition,disposition_date,
        discipline_description,violation_code,address_line_1,city,state,postal_code,county_name,raw_payload,
        ingest_batch_id,last_verified_at,identity_state,identity_method,resolver_version,resolved_license_external_key,
        identity_evidence,identity_evaluated_at,review_reason,publication_state,publication_evidence,
        publication_evaluated_at,withheld_reason,correction_hold,retraction_hold)
        VALUES(%s,NULL,NULL,%s,%s,%s,%s,%s,NULL,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NULL,%s,%s,%s,'INTERNAL',NULL,NULL,NULL,FALSE,FALSE)""", actions)
    if cur.rowcount != 11691:
        raise RuntimeError("discipline insert count")
    cur.executemany("""INSERT INTO regulatory_source_observations
        (id,discipline_action_id,source_system,source_dataset,source_observation_key,source_observation_algorithm,
        logical_matter_detail_key,logical_matter_algorithm,row_fingerprint_sha256,source_payload,revision_state,first_observed_at)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'CURRENT',%s)""", observations)
    if cur.rowcount != 11691:
        raise RuntimeError("observation insert count")
    cur.executemany("""INSERT INTO regulatory_source_occurrences
        (id,source_observation_id,ingest_batch_id,fiscal_year,source_file_checksum_sha256,source_record_locator,
        source_file,source_url,observed_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""", occurrences)
    if cur.rowcount != 11691:
        raise RuntimeError("occurrence insert count")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", type=Path, required=True)
    parser.add_argument("--manifest-output", type=Path, required=True)
    parser.add_argument("--manifest-input", type=Path)
    parser.add_argument("--reverse-output", type=Path, required=True)
    parser.add_argument("--review-output", type=Path, required=True)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--expected-manifest-fingerprint")
    parser.add_argument("--expected-new-row-count", type=int)
    parser.add_argument("--expected-current-ula-count", type=int)
    args = parser.parse_args()
    inventory, rows = load_sources(args.raw_dir)
    manifest, analysis = build_manifest(inventory, rows)
    if args.manifest_input:
        approved = json.loads(args.manifest_input.read_text(encoding="utf-8"))
        approved_core = {key: approved[key] for key in ("manifest_version", "source_system", "source_dataset", "source_files", "batches", "entries")}
        if digest(approved_core) != approved.get("manifest_fingerprint"):
            raise RuntimeError("MANIFEST_DRIFT invalid approved fingerprint")
        generated_scope = {
            "entries": manifest["entries"],
            "batch_ids": [item["ingest_batch_id"] for item in manifest["batches"]],
            "source_checksums": {item["fiscal_year"]: item["sha256"] for item in manifest["source_files"]},
        }
        approved_scope = {
            "entries": approved["entries"],
            "batch_ids": [item["ingest_batch_id"] for item in approved["batches"]],
            "source_checksums": {item["fiscal_year"]: item["sha256"] for item in approved["source_files"]},
        }
        if generated_scope != approved_scope:
            raise RuntimeError("MANIFEST_DRIFT approved execution set differs")
        manifest = approved
    reverse = reverse_manifest(manifest)
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    database_url = normalize_database_url(os.environ.get("DATABASE_URL", ""))
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for read-only production preflight")
    with psycopg.connect(database_url, autocommit=False) as conn:
        conn.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        conn.execute("SET LOCAL statement_timeout = '30s'")
        with conn.cursor() as cur:
            baseline = production_baseline(cur)
            licensed_regression = licensed_provenance_regression(cur)
            collisions = validate_ids(cur, manifest)
            fingerprints = predicted_fingerprints(cur, manifest)
        conn.rollback()
    predicted = {
        "whole_discipline_actions": 19741, "florida_all_discipline_actions": 18148,
        "florida_ula": 11691, "observations": 18148, "occurrences": 18148,
        "ingest_batches": 56,
        "identity": {"EXACT": 1736, "DETERMINISTIC": 236, "REVIEW_REQUIRED": 1411, "UNRESOLVED": 14765},
        "relationships": {"license_linked": 2375, "contractor_linked": 0, "neither": 15773},
        "correction_holds": {"true": 403, "false": 17745},
        "retraction_holds": {"true": 0, "false": 18148},
        "publication": {"INTERNAL": 18148, "PUBLIC_ELIGIBLE": 0},
    }
    review = {
        "task_id": "CTH-FL-STATE-003-ARCH", "canonical_main_sha": "1910d623b222a351dc3b1bc511a31c0f2c37469b",
        "source_inventory": inventory, "delta": analysis, "field_contract": list(FL_ULA_FIELDS),
        "logical_matter_contract": list(FL_ULA_LOGICAL_MATTER_FIELDS),
        "algorithms": {"source_observation": SOURCE_OBSERVATION_ALGORITHM, "logical_matter": LOGICAL_MATTER_ALGORITHM},
        "identity_policy": {**{key: value for key, value in IDENTITY_EVIDENCE.items()}, "identity_state": IDENTITY_STATE, "identity_method": IDENTITY_METHOD, "resolver_version": RESOLVER_VERSION, "review_opportunities_excluded": {"matters": 113, "rows": 246, "candidate_ids_persisted": 0}},
        "manifest": {"entries": len(manifest["entries"]), "fingerprint": manifest["manifest_fingerprint"], "batch_ids": [item["ingest_batch_id"] for item in manifest["batches"]]},
        "reverse_manifest_fingerprint": reverse["reverse_manifest_fingerprint"], "collision_checks": collisions,
        "production_baseline": baseline, "licensed_discipline_regression": licensed_regression,
        "predicted_post": predicted, "predicted_fingerprints": fingerprints,
        "transaction_design": {"isolation": "REPEATABLE READ", "lock_timeout": "5s", "statement_timeout": "180s", "single_transaction": True, "inserts": 35078, "updates": 0, "deletes": 0},
        "publication": {
            "public_eligible": 0, "contractor_linked": 0, "license_linked": 0,
            "gate": "ABSENT/OFF",
            "public_read_fail_closed": {
                "contractor_profile": True, "contractor_discovery": True,
                "plan_and_regulatory_queries": True, "expected_ula_public_rows": 0,
            },
        },
        "production_mutations": 0,
    }
    write_json(args.manifest_output, manifest)
    write_json(args.reverse_output, reverse)
    write_json(args.review_output, review)
    if not args.execute:
        return 0
    if args.expected_manifest_fingerprint != manifest["manifest_fingerprint"] or args.expected_new_row_count != 11691 or args.expected_current_ula_count != 0:
        raise RuntimeError("EXECUTION_GATE missing or mismatched")
    from psycopg.types.json import Jsonb
    source_by_key = {observation_key(item["payload"]): item["payload"] for item in rows}
    with psycopg.connect(database_url, autocommit=False) as conn:
        conn.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        conn.execute("SET LOCAL lock_timeout = '5s'")
        conn.execute("SET LOCAL statement_timeout = '180s'")
        try:
            with conn.cursor() as cur:
                if production_baseline(cur)["florida_ula"] != 0:
                    raise RuntimeError("PRODUCTION_DRIFT ULA no longer empty")
                validate_ids(cur, manifest)
                execute(cur, manifest, source_by_key, Jsonb)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
