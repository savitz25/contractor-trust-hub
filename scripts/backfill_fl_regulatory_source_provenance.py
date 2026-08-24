#!/usr/bin/env python3
"""Controlled legacy FL DBPR source-provenance backfill.

Default mode is read-only. Production writes require --execute plus exact source,
mapping, and row-count gates. This tool only inserts one ingest batch and linked
source observation/occurrence rows; it has no discipline UPDATE path.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import subprocess
import sys
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url
from ingest.regulatory.source_observation import (
    FL_DISCIPLINE_FIELDS,
    LOGICAL_MATTER_ALGORITHM,
    SOURCE_OBSERVATION_ALGORITHM,
    canonical_source_row,
    logical_matter_detail_key_v1,
    row_fingerprint_sha256,
    source_observation_key_v2,
)

SOURCE_SYSTEM = "fl_dbpr"
SOURCE_DATASET = "contractor_disc_lic"
SOURCE_URL = "https://www2.myfloridalicense.com/pro/cilb/reports/contractor_disc_lic_2425.csv"
SOURCE_FILE = "contractor_disc_lic_2425.csv"
EXPECTED_FISCAL_YEAR = "2024-25"
CANONICAL_SOURCE_SHA256 = "189b0043984b25876bdbf6c814b5c6539db9374e3cd01e5c8e94e7777442c7ef"
CANONICAL_ROW_COUNT = 1541
EXPECTED_FINGERPRINTS = {
    "whole": "sha256:5f5af54a2384cfcf228a742751650df543f2dc25a217c92b2af1950046b2b6c3",
    "florida": "sha256:d2fb06f2f7d16a94f2981057b2a7f29a89e94c7cb9d7cc7c9cb0fea1783eab4c",
    "arizona": "sha256:d5c456b2d6d60accef4f892ce2b95b1b23ca6a792cea0d8f0e2ee92f2bf8f6c3",
    "new_jersey": "sha256:6aae90e88c656e664717442a32009e7010b71c378838690651242de3e37f43c3",
    "florida_safety": "sha256:c96193c37fd8a9759f3574122e4a451590e27ff59514d0b9f8352a7b9e213199",
}


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()


def fingerprint(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value)).hexdigest()


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_source(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", errors="strict", newline="") as handle:
        reader = csv.DictReader(handle)
        header = list(reader.fieldnames or [])
        if header != list(FL_DISCIPLINE_FIELDS):
            raise RuntimeError(f"17-column source schema drift: {header}")
        # Preserve the regulator-published field values losslessly in JSONB.
        # Hash/key functions independently apply the approved narrow parsing
        # canonicalization (including outer trim) used by the legacy adapter.
        rows = [
            {
                field: "" if row.get(field) is None else str(row[field]).replace("\r\n", "\n").replace("\r", "\n")
                for field in FL_DISCIPLINE_FIELDS
            }
            for row in reader
        ]
    if len(rows) != CANONICAL_ROW_COUNT:
        raise RuntimeError(f"source row count drift: {len(rows)}")
    return header, rows


def observation_key(row: dict[str, str]) -> str:
    return source_observation_key_v2(source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET, row=row)


def logical_key(row: dict[str, str]) -> str:
    return logical_matter_detail_key_v1(source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET, row=row)


def relationship_digest(rows: list[tuple[Any, ...]]) -> str:
    serial = [["" if value is None else str(value) for value in row] for row in rows]
    return fingerprint(serial)


def database_snapshot(cur) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for label, predicate in (
        ("whole", "TRUE"),
        ("florida", "source_system='fl_dbpr'"),
        ("arizona", "source_system='az_roc'"),
        ("new_jersey", "source_system='nj_enforcement'"),
    ):
        cur.execute(f"SELECT id, source_system, license_id, contractor_id FROM discipline_actions WHERE {predicate} ORDER BY id")
        result[label] = relationship_digest(cur.fetchall())
    cur.execute("""SELECT id, identity_state, identity_method, resolved_license_external_key,
      publication_state, correction_hold, retraction_hold, license_id, contractor_id
      FROM discipline_actions WHERE source_system='fl_dbpr' ORDER BY id""")
    result["florida_safety"] = relationship_digest(cur.fetchall())
    cur.execute("""SELECT id, external_key, ingest_batch_id, license_id, contractor_id,
      identity_state, identity_method, resolver_version, resolved_license_external_key,
      identity_evidence, identity_evaluated_at, review_reason, publication_state,
      publication_evidence, publication_evaluated_at, withheld_reason, correction_hold, retraction_hold
      FROM discipline_actions ORDER BY id""")
    result["discipline_control"] = relationship_digest(cur.fetchall())
    return result


def assert_canonical_fingerprints(snapshot: dict[str, str]) -> None:
    mismatches = {key: (EXPECTED_FINGERPRINTS[key], snapshot.get(key)) for key in EXPECTED_FINGERPRINTS if snapshot.get(key) != EXPECTED_FINGERPRINTS[key]}
    if mismatches:
        raise RuntimeError(f"PRODUCTION_DRIFT {mismatches}")


def fetch_actions(cur, *, lock: bool = False) -> list[dict[str, Any]]:
    suffix = " FOR UPDATE OF da" if lock else ""
    cur.execute("""
      SELECT da.id, da.raw_payload, da.ingest_batch_id, ib.extracted_at,
             da.created_at, da.license_id, da.contractor_id, da.external_key
      FROM discipline_actions da
      LEFT JOIN ingest_batches ib ON ib.id=da.ingest_batch_id
      WHERE da.source_system='fl_dbpr' AND da.source_dataset='contractor_disc_lic'
      ORDER BY da.id
    """ + suffix)
    keys = ("id", "raw_payload", "ingest_batch_id", "batch_extracted_at", "created_at", "license_id", "contractor_id", "external_key")
    return [dict(zip(keys, row)) for row in cur.fetchall()]


def build_mapping(source_rows: list[dict[str, str]], actions: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    sources_by_fp: dict[str, list[tuple[int, dict[str, str]]]] = defaultdict(list)
    for index, row in enumerate(source_rows, start=1):
        sources_by_fp[row_fingerprint_sha256(row)].append((index, row))
    actions_by_fp: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for action in actions:
        actions_by_fp[row_fingerprint_sha256(action["raw_payload"])].append(action)
    mappings: list[dict[str, Any]] = []
    ambiguous = orphan_source = orphan_action = 0
    for fp in sorted(set(sources_by_fp) | set(actions_by_fp)):
        source_candidates = sources_by_fp.get(fp, [])
        action_candidates = actions_by_fp.get(fp, [])
        if len(source_candidates) != 1 or len(action_candidates) != 1:
            if not source_candidates: orphan_action += len(action_candidates)
            elif not action_candidates: orphan_source += len(source_candidates)
            else: ambiguous += max(len(source_candidates), len(action_candidates))
            continue
        locator_number, row = source_candidates[0]
        action = action_candidates[0]
        first_observed = action["batch_extracted_at"] or action["created_at"]
        first_source = "legacy_ingest_batch.extracted_at" if action["batch_extracted_at"] else "discipline_actions.created_at"
        mappings.append({
            "discipline_action_id": str(action["id"]),
            "source_observation_key": observation_key(row),
            "row_fingerprint_sha256": fp,
            "logical_matter_detail_key": logical_key(row),
            "source_record_locator": f"csv-record:{locator_number}",
            "first_observed_at": first_observed,
            "first_observed_source": first_source,
            "source_payload": row,
            "expected_license_id": str(action["license_id"]) if action["license_id"] else None,
            "expected_contractor_id": str(action["contractor_id"]) if action["contractor_id"] else None,
            "expected_external_key": action["external_key"],
            "expected_ingest_batch_id": str(action["ingest_batch_id"]) if action["ingest_batch_id"] else None,
        })
    mappings.sort(key=lambda item: item["discipline_action_id"])
    keys = [item["source_observation_key"] for item in mappings]
    stats = {
        "mapped": len(mappings), "ambiguous": ambiguous,
        "orphan_source": orphan_source, "orphan_actions": orphan_action,
        "duplicate_source_rows": sum(len(items)-1 for items in sources_by_fp.values()),
        "duplicate_observation_keys": len(keys)-len(set(keys)),
    }
    return mappings, stats


def public_mapping(mappings: list[dict[str, Any]]) -> list[dict[str, str]]:
    allowed = ("discipline_action_id", "source_observation_key", "row_fingerprint_sha256", "logical_matter_detail_key", "source_record_locator")
    return [{key: item[key] for key in allowed} for item in mappings]


def mapping_fingerprint(mappings: list[dict[str, Any]]) -> str:
    return fingerprint(public_mapping(mappings))


def assert_mapping(stats: dict[str, int], mappings: list[dict[str, Any]]) -> None:
    if stats != {"mapped":1541,"ambiguous":0,"orphan_source":0,"orphan_actions":0,"duplicate_source_rows":0,"duplicate_observation_keys":0}:
        raise RuntimeError(f"MAPPING_DRIFT {stats}")
    if len({item["source_record_locator"] for item in mappings}) != 1541:
        raise RuntimeError("source locator collision")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")


def counts(cur) -> dict[str, Any]:
    cur.execute("SELECT count(*)::int FROM discipline_actions")
    discipline_total = cur.fetchone()[0]
    cur.execute("""SELECT count(*)::int, count(*) FILTER (WHERE license_id IS NOT NULL)::int,
      count(*) FILTER (WHERE contractor_id IS NOT NULL)::int,
      count(*) FILTER (WHERE license_id IS NULL AND contractor_id IS NULL)::int
      FROM discipline_actions WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_lic'""")
    fl_total, linked, contractors, neither = cur.fetchone()
    cur.execute("SELECT identity_state, count(*)::int FROM discipline_actions WHERE source_system='fl_dbpr' GROUP BY 1")
    identity = dict(cur.fetchall())
    cur.execute("SELECT publication_state, count(*)::int FROM discipline_actions WHERE source_system='fl_dbpr' GROUP BY 1")
    publication = dict(cur.fetchall())
    cur.execute("SELECT correction_hold, count(*)::int FROM discipline_actions WHERE source_system='fl_dbpr' GROUP BY 1")
    correction = {str(k).lower(): v for k,v in cur.fetchall()}
    cur.execute("SELECT retraction_hold, count(*)::int FROM discipline_actions WHERE source_system='fl_dbpr' GROUP BY 1")
    retraction = {str(k).lower(): v for k,v in cur.fetchall()}
    cur.execute("SELECT count(*)::int FROM ingest_batches")
    batches = cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM regulatory_source_observations")
    observations = cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM regulatory_source_occurrences")
    occurrences = cur.fetchone()[0]
    return {"discipline_total":discipline_total,"florida_total":fl_total,"license_linked":linked,"contractor_linked":contractors,"neither":neither,"identity":identity,"publication":publication,"correction_holds":correction,"retraction_holds":retraction,"ingest_batches":batches,"observations":observations,"occurrences":occurrences}


def assert_existing_state(value: dict[str, Any], *, post: bool) -> None:
    expected_provenance = 1541 if post else 0
    if value["discipline_total"] != 3134 or value["florida_total"] != 1541 or value["license_linked"] != 987 or value["contractor_linked"] != 0 or value["neither"] != 554: raise RuntimeError("discipline population drift")
    if value["identity"] != {"EXACT":523,"DETERMINISTIC":61,"REVIEW_REQUIRED":376,"UNRESOLVED":581}: raise RuntimeError("identity drift")
    if value["publication"] != {"INTERNAL":1541} or value["correction_holds"] != {"false":1138,"true":403} or value["retraction_holds"] != {"false":1541}: raise RuntimeError("safety drift")
    if value["observations"] != expected_provenance or value["occurrences"] != expected_provenance: raise RuntimeError("provenance state mismatch")


def verify_provenance(cur, mappings: list[dict[str, Any]], batch_id: str) -> dict[str, Any]:
    cur.execute("""SELECT count(*)::int, count(DISTINCT discipline_action_id)::int,
      count(*) FILTER (WHERE source_observation_algorithm=%s)::int,
      count(*) FILTER (WHERE logical_matter_algorithm=%s)::int,
      count(*) FILTER (WHERE revision_state='CURRENT')::int,
      count(*) FILTER (WHERE revision_state='REVISION_REVIEW_REQUIRED')::int,
      count(*) FILTER (WHERE revision_state='SUPERSEDED')::int
      FROM regulatory_source_observations WHERE source_system=%s AND source_dataset=%s""",
      (SOURCE_OBSERVATION_ALGORITHM, LOGICAL_MATTER_ALGORITHM, SOURCE_SYSTEM, SOURCE_DATASET))
    observation_total, distinct_actions, source_algo, logical_algo, current, review, superseded = cur.fetchone()
    cur.execute("""SELECT count(*)::int, count(DISTINCT source_observation_id)::int,
      count(DISTINCT source_record_locator)::int,
      count(*) FILTER (WHERE fiscal_year=%s)::int,
      count(*) FILTER (WHERE source_file_checksum_sha256=%s)::int
      FROM regulatory_source_occurrences WHERE ingest_batch_id=%s""", (EXPECTED_FISCAL_YEAR, CANONICAL_SOURCE_SHA256, batch_id))
    occurrence_total, distinct_occurrence_observations, locators, fiscal, checksum = cur.fetchone()
    cur.execute("""SELECT o.source_observation_key, o.row_fingerprint_sha256, o.source_payload
      FROM regulatory_source_observations o WHERE o.source_system=%s AND o.source_dataset=%s ORDER BY o.id""", (SOURCE_SYSTEM, SOURCE_DATASET))
    valid = 0
    for stored_key, stored_fp, payload in cur.fetchall():
        if row_fingerprint_sha256(payload) == stored_fp and observation_key(payload) == stored_key:
            valid += 1
    cur.execute("""SELECT count(*)::int FROM regulatory_source_observations o
      JOIN discipline_actions da ON da.id=o.discipline_action_id WHERE da.source_system <> 'fl_dbpr'""")
    non_fl = cur.fetchone()[0]
    cur.execute("""SELECT count(*)::int FROM regulatory_source_occurrences x
      JOIN regulatory_source_observations o ON o.id=x.source_observation_id
      JOIN discipline_actions da ON da.id=o.discipline_action_id WHERE da.source_system <> 'fl_dbpr'""")
    non_fl_occurrences = cur.fetchone()[0]
    result = {"observation_total":observation_total,"distinct_actions":distinct_actions,"source_algorithm":source_algo,"logical_algorithm":logical_algo,"CURRENT":current,"REVISION_REVIEW_REQUIRED":review,"SUPERSEDED":superseded,"occurrence_total":occurrence_total,"distinct_occurrence_observations":distinct_occurrence_observations,"unique_locators":locators,"fiscal_year":fiscal,"checksum":checksum,"payload_hash_valid":valid,"non_fl_observations":non_fl,"non_fl_occurrences":non_fl_occurrences}
    if result != {"observation_total":1541,"distinct_actions":1541,"source_algorithm":1541,"logical_algorithm":1541,"CURRENT":1541,"REVISION_REVIEW_REQUIRED":0,"SUPERSEDED":0,"occurrence_total":1541,"distinct_occurrence_observations":1541,"unique_locators":1541,"fiscal_year":1541,"checksum":1541,"payload_hash_valid":1541,"non_fl_observations":0,"non_fl_occurrences":0}: raise RuntimeError(f"PRE_COMMIT_INVARIANT {result}")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-file", type=Path, required=True)
    parser.add_argument("--downloaded-at", required=True)
    parser.add_argument("--expected-source-sha256", required=True)
    parser.add_argument("--expected-row-count", type=int, required=True)
    parser.add_argument("--expected-mapping-fingerprint")
    parser.add_argument("--mapping-output", type=Path, required=True)
    parser.add_argument("--reverse-output", type=Path)
    parser.add_argument("--verification-output", type=Path)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if args.expected_source_sha256 != CANONICAL_SOURCE_SHA256 or args.expected_row_count != CANONICAL_ROW_COUNT: raise SystemExit("explicit canonical source gates required")
    if file_sha256(args.source_file) != args.expected_source_sha256: raise SystemExit("SOURCE_DRIFT")
    header, source_rows = load_source(args.source_file)
    downloaded_at = datetime.fromisoformat(args.downloaded_at.replace("Z", "+00:00"))
    if downloaded_at.tzinfo is None: raise SystemExit("downloaded-at must be timezone aware")
    load_dotenv_files(ROOT / ".env.local", ROOT / ".env")
    import psycopg
    from psycopg.types.json import Jsonb
    url = normalize_database_url(os.environ.get("DATABASE_URL", ""))
    if not url: raise SystemExit("DATABASE_URL missing")
    with psycopg.connect(url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            cur.execute("SET LOCAL statement_timeout='30s'")
            before_counts = counts(cur); assert_existing_state(before_counts, post=False)
            before_fp = database_snapshot(cur); assert_canonical_fingerprints(before_fp)
            actions = fetch_actions(cur)
            mapping_one, stats_one = build_mapping(source_rows, actions)
            mapping_two, stats_two = build_mapping(list(source_rows), list(actions))
            assert_mapping(stats_one, mapping_one); assert_mapping(stats_two, mapping_two)
            mapping_fp = mapping_fingerprint(mapping_one)
            if mapping_fp != mapping_fingerprint(mapping_two): raise RuntimeError("MAPPING_DRIFT nondeterministic")
            conn.rollback()
    mapping_artifact = {"algorithm":SOURCE_OBSERVATION_ALGORITHM,"logical_algorithm":LOGICAL_MATTER_ALGORITHM,"source_checksum":CANONICAL_SOURCE_SHA256,"count":len(mapping_one),"mapping_fingerprint":mapping_fp,"mappings":public_mapping(mapping_one)}
    write_json(args.mapping_output, mapping_artifact)
    summary = {"mode":"DRY_RUN" if not args.execute else "EXECUTE","source":{"rows":len(source_rows),"checksum":CANONICAL_SOURCE_SHA256,"schema_columns":len(header),"schema_fingerprint":fingerprint(header),"downloaded_at":downloaded_at.isoformat()},"mapping":stats_one | {"fingerprint":mapping_fp},"before":before_counts,"fingerprints":before_fp}
    if not args.execute:
        print(json.dumps(summary, indent=2, sort_keys=True, default=str)); return 0
    if args.expected_mapping_fingerprint != mapping_fp: raise SystemExit("MAPPING_DRIFT expected fingerprint required")
    if not args.reverse_output or not args.verification_output: raise SystemExit("execute requires reverse and verification outputs")
    batch_id = str(uuid.uuid4())
    execution = [{"discipline_action_id":item["discipline_action_id"],"observation_id":str(uuid.uuid4()),"occurrence_id":str(uuid.uuid4())} for item in mapping_one]
    execution_fp = fingerprint({"batch_id":batch_id,"rows":execution})
    reverse_core = {"batch_id":batch_id,"mapping_fingerprint":mapping_fp,"execution_fingerprint":execution_fp,"source_checksum":CANONICAL_SOURCE_SHA256,"observation_ids":[x["observation_id"] for x in execution],"occurrence_ids":[x["occurrence_id"] for x in execution]}
    reverse_fp = fingerprint(reverse_core)
    write_json(args.reverse_output, reverse_core | {"reverse_manifest_fingerprint":reverse_fp,"rollback_order":["occurrences","observations","ingest_batch"],"automatic_rollback_authorized":False})
    execution_by_action = {item["discipline_action_id"]: item for item in execution}
    transaction_start = datetime.now(timezone.utc)
    with psycopg.connect(url, autocommit=False) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ")
                cur.execute("SET LOCAL lock_timeout='5s'")
                cur.execute("SET LOCAL statement_timeout='120s'")
                locked_actions = fetch_actions(cur, lock=True)
                if len(locked_actions) != 1541: raise RuntimeError("CONCURRENCY_MAPPING_DRIFT lock count")
                locked_mapping, locked_stats = build_mapping(source_rows, locked_actions)
                assert_mapping(locked_stats, locked_mapping)
                if mapping_fingerprint(locked_mapping) != mapping_fp: raise RuntimeError("CONCURRENCY_MAPPING_DRIFT fingerprint")
                live_counts = counts(cur); assert_existing_state(live_counts, post=False)
                live_fp = database_snapshot(cur)
                if live_fp != before_fp: raise RuntimeError("CONCURRENCY_MAPPING_DRIFT snapshot")
                cur.execute("""INSERT INTO ingest_batches (id,source_system,source_dataset,source_url,source_file,extracted_at,row_count,checksum_sha256,notes)
                  VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""", (batch_id,SOURCE_SYSTEM,SOURCE_DATASET,SOURCE_URL,SOURCE_FILE,downloaded_at,1541,CANONICAL_SOURCE_SHA256,"CTH-FL-STATE-002A legacy provenance backfill source-snapshot verification; not new adverse-evidence ingestion"))
                if cur.rowcount != 1: raise RuntimeError("batch insert count")
                legacy_batch_timestamp_count = 0
                created_fallback_count = 0
                for item in locked_mapping:
                    ids = execution_by_action[item["discipline_action_id"]]
                    if item["first_observed_source"].startswith("legacy_ingest_batch"): legacy_batch_timestamp_count += 1
                    else: created_fallback_count += 1
                    cur.execute("""INSERT INTO regulatory_source_observations
                      (id,discipline_action_id,source_system,source_dataset,source_observation_key,source_observation_algorithm,logical_matter_detail_key,logical_matter_algorithm,row_fingerprint_sha256,source_payload,revision_state,superseded_by_observation_id,first_observed_at)
                      VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'CURRENT',NULL,%s)""", (ids["observation_id"],item["discipline_action_id"],SOURCE_SYSTEM,SOURCE_DATASET,item["source_observation_key"],SOURCE_OBSERVATION_ALGORITHM,item["logical_matter_detail_key"],LOGICAL_MATTER_ALGORITHM,item["row_fingerprint_sha256"],Jsonb(item["source_payload"]),item["first_observed_at"]))
                    if cur.rowcount != 1: raise RuntimeError("observation insert count")
                    cur.execute("""INSERT INTO regulatory_source_occurrences
                      (id,source_observation_id,ingest_batch_id,fiscal_year,source_file_checksum_sha256,source_record_locator,source_file,source_url,observed_at)
                      VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""", (ids["occurrence_id"],ids["observation_id"],batch_id,EXPECTED_FISCAL_YEAR,CANONICAL_SOURCE_SHA256,item["source_record_locator"],SOURCE_FILE,SOURCE_URL,downloaded_at))
                    if cur.rowcount != 1: raise RuntimeError("occurrence insert count")
                provenance = verify_provenance(cur, locked_mapping, batch_id)
                after_counts_inside = counts(cur); assert_existing_state(after_counts_inside, post=True)
                if after_counts_inside["ingest_batches"] != before_counts["ingest_batches"] + 1: raise RuntimeError("ingest batch delta")
                after_fp_inside = database_snapshot(cur)
                if after_fp_inside != before_fp: raise RuntimeError("PRE_COMMIT_INVARIANT discipline fingerprint")
            conn.commit()
        except Exception:
            conn.rollback(); raise
    commit_timestamp = datetime.now(timezone.utc)
    with psycopg.connect(url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            cur.execute("SET LOCAL statement_timeout='30s'")
            after_counts = counts(cur); assert_existing_state(after_counts, post=True)
            if after_counts["ingest_batches"] != before_counts["ingest_batches"] + 1: raise RuntimeError("post ingest batch delta")
            after_fp = database_snapshot(cur)
            if after_fp != before_fp: raise RuntimeError("POST_COMMIT discipline fingerprint")
            post_provenance = verify_provenance(cur, mapping_one, batch_id)
            conn.rollback()
    verification = {
      "task":"CTH-FL-STATE-002A-BACKFILL-PROD","main_sha":subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip(),
      "source":summary["source"] | {"url":SOURCE_URL,"file":SOURCE_FILE},"mapping":summary["mapping"],
      "execution":{"transaction_started_utc":transaction_start.isoformat(),"transaction_committed_utc":commit_timestamp.isoformat(),"lock_timeout":"5s","statement_timeout":"120s","florida_actions_locked":1541,"batch_id":batch_id,"execution_fingerprint":execution_fp,"reverse_manifest_fingerprint":reverse_fp,"committed":True},
      "first_observed":{"legacy_ingest_batch_timestamp":legacy_batch_timestamp_count,"discipline_created_at_fallback":created_fallback_count},
      "before":before_counts,"after":after_counts,"provenance":post_provenance,
      "fingerprints":{"before":before_fp,"after":after_fp,"matches":{key:before_fp[key]==after_fp[key] for key in before_fp}},
      "mutations":{"ingest_batches":1,"observations":1541,"occurrences":1541,"discipline_actions":0,"license_id":0,"contractor_id":0,"identity":0,"holds":0,"publication":0,"non_fl":0,"historical_ingestion":0},
      "publication_gate":"ABSENT_OFF","site_health":{},"automatic_post_commit_rollback_authorized":False,
    }
    write_json(args.verification_output, verification)
    print(json.dumps(verification, indent=2, sort_keys=True, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
