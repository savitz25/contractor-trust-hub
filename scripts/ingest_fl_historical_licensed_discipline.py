#!/usr/bin/env python3
"""Controlled FL licensed-discipline historical ingestion executor.

Default mode is a production read-only execution review. The --execute path is
hard-bound to the approved four-file delta and uses one insert-only transaction.
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
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.adapters.fl_dbpr import _parse_date
from ingest.env import load_dotenv_files, normalize_database_url
from ingest.regulatory.fl_dbpr_identity import FloridaDbprCredentialResolver, LicenseCredential
from ingest.regulatory.source_observation import (
    FL_DISCIPLINE_FIELDS, LOGICAL_MATTER_ALGORITHM, SOURCE_OBSERVATION_ALGORITHM,
    canonical_source_row, logical_matter_detail_key_v1, row_fingerprint_sha256,
    source_observation_key_v2,
)
from scripts import backfill_fl_regulatory_source_provenance as legacy

SOURCE_SYSTEM = "fl_dbpr"
SOURCE_DATASET = "contractor_disc_lic"
MANIFEST_VERSION = "cth-fl-state-002-historical-ingestion-v1"
TASK_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "contractortrusthub:cth-fl-state-002")
FILES = {
    "2021-22": {"code":"2122","rows":1109,"sha256":"ab67307147fb2007b4751900d105773d7cf2cee83dece8b9ac6dca42096500d0"},
    "2022-23": {"code":"2223","rows":1534,"sha256":"cd733ddce04de63d76c5f123b1004990ddfd03f2260f32ccf9e26bd817c81884"},
    "2023-24": {"code":"2324","rows":1878,"sha256":"90a561929f6bf2821900ab0cb1b54177bcff43bd4f8b411fe608a9928b641de4"},
    "2024-25": {"code":"2425","rows":1541,"sha256":"189b0043984b25876bdbf6c814b5c6539db9374e3cd01e5c8e94e7777442c7ef"},
    "2025-26": {"code":"2526","rows":395,"sha256":"1cecf33f0b5a5e329527dd2df723cb3ec658e60027d81805c765b639a55155f7"},
}
EXPECTED_NEW_BY_YEAR = {"2021-22":1109,"2022-23":1534,"2023-24":1878,"2024-25":0,"2025-26":395}
EXPECTED_RESOLUTION = {"EXACT":1213,"DETERMINISTIC":175,"REVIEW_REQUIRED":1035,"UNRESOLVED":2493}
LEGACY_BATCH_ID = "73590ef9-518e-4bf0-9e40-5a60a569bbe2"


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode()


def digest(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value)).hexdigest()


def source_filename(year: str) -> str:
    return f"contractor_disc_lic_{FILES[year]['code']}.csv"


def source_url(year: str) -> str:
    return f"https://www2.myfloridalicense.com/pro/cilb/reports/{source_filename(year)}"


def observation_key(row: dict[str, str]) -> str:
    return source_observation_key_v2(source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET, row=row)


def logical_key(row: dict[str, str]) -> str:
    return logical_matter_detail_key_v1(source_system=SOURCE_SYSTEM, source_dataset=SOURCE_DATASET, row=row)


def load_sources(raw_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    inventory, rows = [], []
    expected_header = list(FL_DISCIPLINE_FIELDS)
    schema_fingerprint = digest(expected_header)
    for year, spec in FILES.items():
        path = raw_dir / source_filename(year)
        data = path.read_bytes()
        checksum = hashlib.sha256(data).hexdigest()
        if checksum != spec["sha256"]: raise RuntimeError(f"SOURCE_DRIFT {year} checksum {checksum}")
        with path.open("r", encoding="utf-8-sig", errors="strict", newline="") as handle:
            reader = csv.DictReader(handle)
            header = list(reader.fieldnames or [])
            if header != expected_header: raise RuntimeError(f"SOURCE_DRIFT {year} schema")
            file_rows = []
            for locator, raw in enumerate(reader, start=1):
                if None in raw or set(raw) != set(expected_header): raise RuntimeError(f"SOURCE_DRIFT malformed {year}:{locator}")
                payload = {field:"" if raw[field] is None else str(raw[field]).replace("\r\n","\n").replace("\r","\n") for field in expected_header}
                file_rows.append({"fiscal_year":year,"source_record_locator":f"csv-record:{locator}","payload":payload})
        if len(file_rows) != spec["rows"]: raise RuntimeError(f"SOURCE_DRIFT {year} rows")
        downloaded_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        inventory.append({"fiscal_year":year,"official_url":source_url(year),"filename":path.name,"http_status":200,"byte_size":len(data),"downloaded_at":downloaded_at,"sha256":checksum,"rows":len(file_rows),"schema_columns":17,"schema_fingerprint":schema_fingerprint})
        rows.extend(file_rows)
    if len(rows) != 6457: raise RuntimeError("SOURCE_DRIFT total")
    return inventory, rows


def fetch_licenses(cur) -> list[LicenseCredential]:
    cur.execute("""SELECT id,external_key,occupation_code,license_number,source_board,contractor_id
      FROM licenses WHERE source_system='fl_dbpr' ORDER BY id""")
    return [LicenseCredential(str(r[0]),r[1],r[2],r[3],r[4],str(r[5]) if r[5] else None) for r in cur.fetchall()]


def stable_id(kind: str, identity: str) -> str:
    return str(uuid.uuid5(TASK_NAMESPACE, f"{kind}:{identity}"))


def build_manifest(rows: list[dict[str, Any]], existing_keys: set[str], existing_logical: set[str], resolver: FloridaDbprCredentialResolver, inventory: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    source_keys = [observation_key(item["payload"]) for item in rows]
    duplicates = len(source_keys)-len(set(source_keys))
    if duplicates: raise RuntimeError(f"DELTA_DRIFT duplicate source observations {duplicates}")
    existing, new, revisions = [], [], []
    inventory_by_year = {item["fiscal_year"]:item for item in inventory}
    batch_ids = {year:stable_id("batch", f"{year}:{FILES[year]['sha256']}") for year in FILES if year != "2024-25"}
    resolution_total: Counter[str] = Counter()
    resolution_by_year: dict[str,Counter[str]] = {year:Counter() for year in FILES}
    for item, key in zip(rows, source_keys):
        if key in existing_keys:
            existing.append(item); continue
        if logical_key(item["payload"]) in existing_logical:
            revisions.append(item); continue
        resolution = resolver.resolve(source_dataset=SOURCE_DATASET,license_type=item["payload"]["License Type"],license_number=item["payload"]["License Nbr"])
        resolution_total[resolution.identity_state] += 1
        resolution_by_year[item["fiscal_year"]][resolution.identity_state] += 1
        action_id = stable_id("action", key); observation_id = stable_id("observation", key)
        occurrence_id = stable_id("occurrence", f"{key}:{item['fiscal_year']}:{item['source_record_locator']}:{FILES[item['fiscal_year']]['sha256']}")
        new.append({
          "fiscal_year":item["fiscal_year"],"source_file_checksum":FILES[item["fiscal_year"]]["sha256"],"source_record_locator":item["source_record_locator"],
          "source_observation_key":key,"row_fingerprint_sha256":row_fingerprint_sha256(item["payload"]),"logical_matter_detail_key":logical_key(item["payload"]),
          "identity_state":resolution.identity_state,"identity_method":resolution.identity_method,"resolver_version":resolution.resolver_version,
          "proposed_license_id":resolution.proposed_license_id,"proposed_license_external_key":resolution.resolved_external_key,
          "review_reason_code":resolution.reason if resolution.identity_state in {"REVIEW_REQUIRED","UNRESOLVED"} else None,
          "discipline_action_id":action_id,"observation_id":observation_id,"occurrence_id":occurrence_id,"ingest_batch_id":batch_ids[item["fiscal_year"]],
        })
    new.sort(key=lambda x:(x["fiscal_year"],x["source_record_locator"],x["source_observation_key"]))
    per_year_new = Counter(item["fiscal_year"] for item in new)
    if dict(per_year_new) != {k:v for k,v in EXPECTED_NEW_BY_YEAR.items() if v}: raise RuntimeError(f"DELTA_DRIFT years {per_year_new}")
    if len(existing)!=1541 or len(new)!=4916 or revisions: raise RuntimeError(f"DELTA_DRIFT existing={len(existing)} new={len(new)} revisions={len(revisions)}")
    if dict(resolution_total)!=EXPECTED_RESOLUTION: raise RuntimeError(f"IDENTITY_DRIFT {resolution_total}")
    batches = [{"fiscal_year":year,"ingest_batch_id":batch_ids[year],"source_system":SOURCE_SYSTEM,"source_dataset":SOURCE_DATASET,"source_url":source_url(year),"source_file":source_filename(year),"row_count":FILES[year]["rows"],"checksum_sha256":FILES[year]["sha256"],"downloaded_at":inventory_by_year[year]["downloaded_at"]} for year in batch_ids]
    core = {"manifest_version":MANIFEST_VERSION,"source_system":SOURCE_SYSTEM,"source_dataset":SOURCE_DATASET,"source_files":inventory,"batches":batches,"entries":new}
    manifest_fp = digest(core)
    manifest = core | {"entry_count":len(new),"manifest_fingerprint":manifest_fp}
    analysis = {"existing_exact":len(existing),"new_exact":len(new),"revision_candidates":len(revisions),"duplicate_source_observations":duplicates,"other_review_required":0,"v2_collisions":duplicates,"resolver_total":dict(resolution_total),"resolver_by_year":{year:dict(resolution_by_year[year]) for year in FILES},"new_by_year":dict(EXPECTED_NEW_BY_YEAR)}
    return manifest, analysis


def validate_manifest_ids(cur, manifest: dict[str, Any]) -> dict[str, int]:
    entries=manifest["entries"]; batches=manifest["batches"]
    id_sets={"action":{x["discipline_action_id"] for x in entries},"observation":{x["observation_id"] for x in entries},"occurrence":{x["occurrence_id"] for x in entries},"batch":{x["ingest_batch_id"] for x in batches}}
    if [len(id_sets[k]) for k in ("action","observation","occurrence","batch")] != [4916,4916,4916,4]: raise RuntimeError("MANIFEST_COLLISION internal UUID")
    checks={"action":"discipline_actions","observation":"regulatory_source_observations","occurrence":"regulatory_source_occurrences","batch":"ingest_batches"}; collisions={}
    for kind,table in checks.items():
        cur.execute(f"SELECT count(*)::int FROM {table} WHERE id=ANY(%s::uuid[])",(list(id_sets[kind]),)); collisions[kind]=cur.fetchone()[0]
    cur.execute("SELECT count(*)::int FROM discipline_actions WHERE source_system=%s AND external_key=ANY(%s)",(SOURCE_SYSTEM,[x["source_observation_key"] for x in entries])); collisions["external_key"]=cur.fetchone()[0]
    if any(collisions.values()): raise RuntimeError(f"MANIFEST_COLLISION production {collisions}")
    return collisions


def validate_license_targets(manifest: dict[str, Any], licenses: list[LicenseCredential]) -> dict[str, int]:
    inventory = {item.id: item.external_key for item in licenses}
    safe = 0
    fail_closed = 0
    for item in manifest["entries"]:
        if item["identity_state"] in {"EXACT", "DETERMINISTIC"}:
            if not item["proposed_license_id"] or inventory.get(item["proposed_license_id"]) != item["proposed_license_external_key"]:
                raise RuntimeError("IDENTITY_DRIFT proposed target mismatch")
            safe += 1
        else:
            if item["proposed_license_id"] is not None or item["proposed_license_external_key"] is not None:
                raise RuntimeError("IDENTITY_DRIFT fail-closed row has target")
            fail_closed += 1
    if (safe, fail_closed) != (1388, 3528):
        raise RuntimeError(f"IDENTITY_DRIFT target partition {(safe, fail_closed)}")
    return {"safe_targets_valid": safe, "fail_closed_without_target": fail_closed}


def current_relationship_rows(cur, predicate: str) -> list[tuple[Any,...]]:
    cur.execute(f"SELECT id,source_system,license_id,contractor_id FROM discipline_actions WHERE {predicate}")
    return cur.fetchall()


def predicted_fingerprints(cur, manifest: dict[str, Any]) -> dict[str,str]:
    new_relationships=[(x["discipline_action_id"],SOURCE_SYSTEM,x["proposed_license_id"],None) for x in manifest["entries"]]
    whole=current_relationship_rows(cur,"TRUE")+new_relationships
    florida=current_relationship_rows(cur,"source_system='fl_dbpr'")+new_relationships
    arizona=current_relationship_rows(cur,"source_system='az_roc'")
    nj=current_relationship_rows(cur,"source_system='nj_enforcement'")
    cur.execute("""SELECT id,identity_state,identity_method,resolved_license_external_key,publication_state,correction_hold,retraction_hold,license_id,contractor_id FROM discipline_actions WHERE source_system='fl_dbpr'""")
    safety=cur.fetchall()+[(x["discipline_action_id"],x["identity_state"],x["identity_method"],x["proposed_license_external_key"],"INTERNAL",False,False,x["proposed_license_id"],None) for x in manifest["entries"]]
    def fp(rows): return legacy.relationship_digest(sorted(rows,key=lambda r:str(r[0])))
    return {"whole":fp(whole),"florida":fp(florida),"arizona":fp(arizona),"new_jersey":fp(nj),"florida_safety":fp(safety),"new_actions":digest(sorted(new_relationships,key=lambda r:r[0])),"provenance":digest([(x["discipline_action_id"],x["observation_id"],x["occurrence_id"],x["source_observation_key"]) for x in manifest["entries"]]),"batches":digest(manifest["batches"])}


def reverse_manifest(manifest: dict[str,Any]) -> dict[str,Any]:
    core={"execution_manifest_fingerprint":manifest["manifest_fingerprint"],"source_checksums":{x["fiscal_year"]:x["sha256"] for x in manifest["source_files"]},"batch_ids":[x["ingest_batch_id"] for x in manifest["batches"]],"discipline_action_ids":[x["discipline_action_id"] for x in manifest["entries"]],"observation_ids":[x["observation_id"] for x in manifest["entries"]],"occurrence_ids":[x["occurrence_id"] for x in manifest["entries"]]}
    return core|{"reverse_manifest_fingerprint":digest(core),"rollback_order":["occurrences","observations","discipline_actions","ingest_batches"],"automatic_rollback_authorized":False}


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(value,indent=2,sort_keys=True,default=str)+"\n",encoding="utf-8")


def normalized_action(payload: dict[str,str]) -> dict[str,Any]:
    row=canonical_source_row(payload)
    return {"complaint_number":row["Complaint Nbr"] or None,"license_type":row["License Type"] or None,"license_number_raw":row["License Nbr"] or None,"respondent_name":row["Respondent Name"],"classification":row["Classification"] or None,"entered_date":_parse_date(row["Entered Date"]) or None,"disposition":row["Disposition"] or None,"disposition_date":_parse_date(row["Disposition Date"]) or None,"discipline_description":row["Discipline Date - Description"] or None,"violation_code":row["Violation Code"] or None,"address_line_1":row["Address Line 1"] or None,"city":row["City"] or None,"state":row["State"][:2].upper() or None,"postal_code":row["ZIP Code"] or None,"county_name":row["County"] or None}


def execute(cur, manifest: dict[str,Any], source_by_key: dict[str,dict[str,str]], expected_post: dict[str,Any], Jsonb) -> None:
    now=datetime.now(timezone.utc)
    batch_params=[]
    for batch in manifest["batches"]:
        batch_params.append((batch["ingest_batch_id"],SOURCE_SYSTEM,SOURCE_DATASET,batch["source_url"],batch["source_file"],batch["downloaded_at"],batch["row_count"],batch["checksum_sha256"],f"CTH-FL-STATE-002 controlled historical licensed-discipline ingestion {batch['fiscal_year']}"))
    cur.executemany("""INSERT INTO ingest_batches(id,source_system,source_dataset,source_url,source_file,extracted_at,row_count,checksum_sha256,notes) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""",batch_params)
    if cur.rowcount != 4: raise RuntimeError("batch insert count")
    action_params=[]; observation_params=[]; occurrence_params=[]
    for item in manifest["entries"]:
        payload=source_by_key[item["source_observation_key"]]; action=normalized_action(payload)
        evidence={"expected_external_key":item["proposed_license_external_key"],"reason":item["review_reason_code"],"source_observation_key":item["source_observation_key"]}
        observed_at=next(x["downloaded_at"] for x in manifest["batches"] if x["ingest_batch_id"]==item["ingest_batch_id"])
        action_params.append((item["discipline_action_id"],item["proposed_license_id"],SOURCE_SYSTEM,SOURCE_DATASET,item["source_observation_key"],action["complaint_number"],action["license_type"],action["license_number_raw"],action["respondent_name"],action["classification"],action["entered_date"],action["disposition"],action["disposition_date"],action["discipline_description"],action["violation_code"],action["address_line_1"],action["city"],action["state"],action["postal_code"],action["county_name"],Jsonb(payload),item["ingest_batch_id"],now,item["identity_state"],item["identity_method"],item["resolver_version"],item["proposed_license_external_key"],Jsonb(evidence),now,item["review_reason_code"]))
        observation_params.append((item["observation_id"],item["discipline_action_id"],SOURCE_SYSTEM,SOURCE_DATASET,item["source_observation_key"],SOURCE_OBSERVATION_ALGORITHM,item["logical_matter_detail_key"],LOGICAL_MATTER_ALGORITHM,item["row_fingerprint_sha256"],Jsonb(payload),observed_at))
        occurrence_params.append((item["occurrence_id"],item["observation_id"],item["ingest_batch_id"],item["fiscal_year"],item["source_file_checksum"],item["source_record_locator"],source_filename(item["fiscal_year"]),source_url(item["fiscal_year"]),observed_at))
    cur.executemany("""INSERT INTO discipline_actions(id,contractor_id,license_id,source_system,source_dataset,external_key,complaint_number,license_type,license_number_raw,respondent_name,classification,entered_date,disposition,disposition_date,discipline_description,violation_code,address_line_1,city,state,postal_code,county_name,raw_payload,ingest_batch_id,last_verified_at,identity_state,identity_method,resolver_version,resolved_license_external_key,identity_evidence,identity_evaluated_at,review_reason,publication_state,publication_evidence,publication_evaluated_at,withheld_reason,correction_hold,retraction_hold)
      VALUES(%s,NULL,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'INTERNAL',NULL,NULL,NULL,FALSE,FALSE)""",action_params)
    if cur.rowcount != 4916: raise RuntimeError("discipline insert count")
    cur.executemany("""INSERT INTO regulatory_source_observations(id,discipline_action_id,source_system,source_dataset,source_observation_key,source_observation_algorithm,logical_matter_detail_key,logical_matter_algorithm,row_fingerprint_sha256,source_payload,revision_state,first_observed_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'CURRENT',%s)""",observation_params)
    if cur.rowcount != 4916: raise RuntimeError("observation insert count")
    cur.executemany("""INSERT INTO regulatory_source_occurrences(id,source_observation_id,ingest_batch_id,fiscal_year,source_file_checksum_sha256,source_record_locator,source_file,source_url,observed_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""",occurrence_params)
    if cur.rowcount != 4916: raise RuntimeError("occurrence insert count")


def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("--raw-dir",type=Path,required=True); parser.add_argument("--manifest-output",type=Path,required=True); parser.add_argument("--manifest-input",type=Path); parser.add_argument("--reverse-output",type=Path,required=True); parser.add_argument("--review-output",type=Path,required=True); parser.add_argument("--execute",action="store_true"); parser.add_argument("--expected-manifest-fingerprint"); parser.add_argument("--expected-source-checksums"); parser.add_argument("--expected-new-row-count",type=int); parser.add_argument("--expected-current-observation-count",type=int); parser.add_argument("--expected-current-discipline-count",type=int); parser.add_argument("--expected-resolver-partition")
    args=parser.parse_args(); inventory,source_rows=load_sources(args.raw_dir); load_dotenv_files(ROOT/".env.local",ROOT/".env")
    import psycopg
    from psycopg.types.json import Jsonb
    url=normalize_database_url(os.environ.get("DATABASE_URL",""));
    with psycopg.connect(url,autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"); cur.execute("SET LOCAL statement_timeout='30s'")
            baseline=legacy.counts(cur); legacy.assert_existing_state(baseline,post=True); current_fp=legacy.database_snapshot(cur); legacy.assert_canonical_fingerprints(current_fp); provenance=legacy.verify_provenance(cur,[],LEGACY_BATCH_ID)
            cur.execute("SELECT source_observation_key,logical_matter_detail_key FROM regulatory_source_observations WHERE source_system=%s AND source_dataset=%s",(SOURCE_SYSTEM,SOURCE_DATASET)); pairs=cur.fetchall(); existing_keys={x[0] for x in pairs}; existing_logical={x[1] for x in pairs}
            licenses=fetch_licenses(cur); resolver=FloridaDbprCredentialResolver(licenses); generated_manifest,analysis_one=build_manifest(source_rows,existing_keys,existing_logical,resolver,inventory); manifest_two,analysis_two=build_manifest(list(source_rows),set(existing_keys),set(existing_logical),resolver,list(inventory))
            if generated_manifest["manifest_fingerprint"]!=manifest_two["manifest_fingerprint"] or analysis_one!=analysis_two: raise RuntimeError("manifest nondeterminism")
            manifest_one=generated_manifest
            if args.execute:
                if not args.manifest_input: raise RuntimeError("execute requires --manifest-input")
                approved=json.loads(args.manifest_input.read_text(encoding="utf-8"))
                approved_core={key:approved[key] for key in ("manifest_version","source_system","source_dataset","source_files","batches","entries")}
                if digest(approved_core)!=approved.get("manifest_fingerprint"): raise RuntimeError("approved manifest fingerprint invalid")
                if approved["entries"]!=generated_manifest["entries"]: raise RuntimeError("fresh source/resolver entries drift from approved manifest")
                generated_batches=[{key:item[key] for key in ("fiscal_year","ingest_batch_id","source_system","source_dataset","source_url","source_file","row_count","checksum_sha256")} for item in generated_manifest["batches"]]
                approved_batches=[{key:item[key] for key in ("fiscal_year","ingest_batch_id","source_system","source_dataset","source_url","source_file","row_count","checksum_sha256")} for item in approved["batches"]]
                if approved_batches!=generated_batches: raise RuntimeError("fresh batch identity/checksum drift from approved manifest")
                manifest_one=approved
            collisions=validate_manifest_ids(cur,manifest_one); target_validation=validate_license_targets(manifest_one,licenses); predicted=predicted_fingerprints(cur,manifest_one); conn.rollback()
    reverse=reverse_manifest(manifest_one); write_json(args.manifest_output,manifest_one); write_json(args.reverse_output,reverse)
    predicted_counts={"whole_discipline_actions":8050,"florida_discipline_actions":6457,"observations":6457,"occurrences":6457,"ingest_batches":51,"identity":{"EXACT":1736,"DETERMINISTIC":236,"REVIEW_REQUIRED":1411,"UNRESOLVED":3074},"license_linked":2375,"contractor_linked":0,"neither":4082,"correction_hold":{"true":403,"false":6054},"retraction_hold":{"true":0,"false":6457},"publication":{"INTERNAL":6457,"PUBLIC_ELIGIBLE":0}}
    review={"task":"CTH-FL-STATE-002-EXEC-REVIEW","main_sha":subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip(),"generated_at":datetime.now(timezone.utc).isoformat(),"production_transaction":{"read_only":True,"isolation":"repeatable read","statement_timeout":"30s","mutations":0},"source_files":inventory,"production_baseline":baseline,"existing_provenance":provenance,"delta":analysis_one,"manifest":{"entries":4916,"fingerprint":manifest_one["manifest_fingerprint"],"independent_generation_match":True,"batch_ids":{x["fiscal_year"]:x["ingest_batch_id"] for x in manifest_one["batches"]}},"reverse_manifest":{"fingerprint":reverse["reverse_manifest_fingerprint"],"automatic_rollback_authorized":False},"collision_checks":collisions,"license_target_validation":target_validation,"predicted_post_counts":predicted_counts,"current_fingerprints":current_fp,"predicted_post_fingerprints":predicted,"transaction_design":{"mode":"one explicit insert-only transaction","isolation":"repeatable read","lock_timeout":"5s","statement_timeout":"180s","periodic_commits":False,"insert_phases":["ingest_batches","discipline_actions","regulatory_source_observations","regulatory_source_occurrences"],"execution_method":"pipelined executemany with exact rowcount assertions","expected_inserts":{"ingest_batches":4,"discipline_actions":4916,"observations":4916,"occurrences":4916,"total":14752}},"publication":{"gate":"ABSENT_OFF","predicted_public_eligible":0,"contractor_id_mutations":0},"scope":{"production_mutations":0,"historical_ingestion":0,"ula":0,"recovery_fund":0,"google_calls":0,"county_work":0}}
    write_json(args.review_output,review)
    if not args.execute:
        print(json.dumps({"source_files":inventory,"baseline":baseline,"delta":analysis_one,"manifest":review["manifest"],"reverse_manifest":review["reverse_manifest"],"predicted_post_counts":predicted_counts,"predicted_post_fingerprints":predicted,"collisions":collisions,"production_mutations":0},indent=2,sort_keys=True)); return 0
    required={"fingerprint":args.expected_manifest_fingerprint==manifest_one["manifest_fingerprint"],"checksums":json.loads(args.expected_source_checksums or "{}") == {y:x["sha256"] for y,x in FILES.items()},"new_rows":args.expected_new_row_count==4916,"current_observations":args.expected_current_observation_count==1541,"current_discipline":args.expected_current_discipline_count==1541,"resolver":json.loads(args.expected_resolver_partition or "{}") == EXPECTED_RESOLUTION}
    if not all(required.values()): raise SystemExit(f"execution gates failed {required}")
    source_by_key={observation_key(x["payload"]):x["payload"] for x in source_rows if observation_key(x["payload"]) not in existing_keys}
    with psycopg.connect(url,autocommit=False) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ"); cur.execute("SET LOCAL lock_timeout='5s'"); cur.execute("SET LOCAL statement_timeout='180s'")
                cur.execute("SELECT id FROM discipline_actions WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_lic' ORDER BY id FOR KEY SHARE");
                if len(cur.fetchall())!=1541: raise RuntimeError("legacy baseline drift")
                cur.execute("SELECT id,external_key FROM licenses WHERE id=ANY(%s::uuid[]) ORDER BY id FOR KEY SHARE",([x["proposed_license_id"] for x in manifest_one["entries"] if x["proposed_license_id"]],)); locked_targets={str(x[0]):x[1] for x in cur.fetchall()}
                expected_targets={x["proposed_license_id"]:x["proposed_license_external_key"] for x in manifest_one["entries"] if x["proposed_license_id"]}
                if locked_targets!=expected_targets: raise RuntimeError("license inventory drift")
                validate_manifest_ids(cur,manifest_one); execute(cur,manifest_one,source_by_key,predicted_counts,Jsonb)
                post=legacy.counts(cur); post_fp=legacy.database_snapshot(cur)
                if post["discipline_total"]!=8050 or post["florida_total"]!=6457 or post["observations"]!=6457 or post["occurrences"]!=6457: raise RuntimeError("pre-commit count invariant")
                if any(post_fp[key] != predicted[key] for key in ("whole","florida","arizona","new_jersey","florida_safety")): raise RuntimeError("pre-commit fingerprint invariant")
            conn.commit()
        except Exception: conn.rollback(); raise
    return 0


if __name__=="__main__": raise SystemExit(main())
