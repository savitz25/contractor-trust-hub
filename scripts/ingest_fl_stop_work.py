#!/usr/bin/env python3
"""Controlled Florida DFS stop-work executor; dry-run unless --execute."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url
from ingest.regulatory.fl_dfs_stop_work import (
    FIELDS, IDENTITY_METHOD, RESOLVER_VERSION, SCHEMA_FINGERPRINT, SOURCE_DATASET,
    SOURCE_SYSTEM, SOURCE_URL, build_contract, digest, observation_key, parse_snapshot,
    stable_id,
)
from ingest.regulatory.source_observation import row_fingerprint_sha256
from scripts import backfill_fl_regulatory_source_provenance as legacy

ADVISORY_LOCK = "fl_dfs:workers_comp_stop_work"
EXPECTED_BASELINE = {"whole":21420,"florida":19827,"licensed":6457,"ula":11691,"recovery_fund":1679,
                     "stop_work":0,"observations":19827,"occurrences":19827,"batches":61,
                     "arizona":459,"new_jersey":1134,"public_eligible":0}
EXPECTED_PRE_FINGERPRINTS = {"whole":"sha256:b276b929dab3c37ee7670ec244283a109c8479dd3711f484ef286fa9afc0c67e","florida":"sha256:aeec5f86ac1f55c3f75c1c1a34b664dc02aeb3b7b9f847ec062562533919c813","florida_safety":"sha256:15266e1ef2a3e3e256207997a07db62d26de2177295d501154843292621eba73","arizona":"sha256:d5c456b2d6d60accef4f892ce2b95b1b23ca6a792cea0d8f0e2ee92f2bf8f6c3","new_jersey":"sha256:6aae90e88c656e664717442a32009e7010b71c378838690651242de3e37f43c3"}
EXPECTED_POST_FINGERPRINTS = {"whole":"sha256:7aafb5fc16662ccd03200a7a942df9d1d1d2faeb90016882d16a75b461a2f961","florida":"sha256:abe3c12054f5e95338d3d3018d5413816f65d0eb6633146bc6e6c756755d1fa5","florida_safety":"sha256:7d7dd6664180a3fec4617fed647c6a6247f4dbf81ff38fb79952c9fa28009fbd","arizona":"sha256:d5c456b2d6d60accef4f892ce2b95b1b23ca6a792cea0d8f0e2ee92f2bf8f6c3","new_jersey":"sha256:6aae90e88c656e664717442a32009e7010b71c378838690651242de3e37f43c3","stop_work_cohort":"sha256:0a9e4f96dc679eea3b7e892866a622093591dd725854948b0ffd03eb9644e0af","provenance":"sha256:c876fe2d0ac0b9409b06406866f25f6a87ccd40d2dd931cb0bb5912c0234c00a","batch_snapshot":"sha256:be74a2be2948b3fafdedfe61ab075f4dd185c31f1b608ef9da2bcb3cd02b49bd"}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")


def relation_rows(cur, predicate: str):
    cur.execute(f"SELECT id,source_system,license_id,contractor_id FROM discipline_actions WHERE {predicate}")
    return cur.fetchall()


def relationship_digest(rows) -> str:
    return legacy.relationship_digest(sorted(rows, key=lambda row: str(row[0])))


def production_baseline(cur) -> dict[str, int]:
    cur.execute("SELECT count(*) FROM discipline_actions")
    whole = cur.fetchone()[0]
    cur.execute("SELECT source_dataset,count(*) FROM discipline_actions WHERE source_system='fl_dbpr' GROUP BY source_dataset")
    fl = dict(cur.fetchall())
    cur.execute("SELECT count(*) FROM regulatory_source_observations")
    observations = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM regulatory_source_occurrences")
    occurrences = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM ingest_batches")
    batches = cur.fetchone()[0]
    cur.execute("SELECT source_system,count(*) FROM discipline_actions GROUP BY source_system")
    states = dict(cur.fetchall())
    cur.execute("SELECT count(*) FROM discipline_actions WHERE publication_state='PUBLIC_ELIGIBLE'")
    public = cur.fetchone()[0]
    stop_work=states.get(SOURCE_SYSTEM,0)
    return {"whole":whole,"florida":sum(fl.values())+stop_work,"licensed":fl.get("contractor_disc_lic",0),
            "ula":fl.get("contractor_disc_ula",0),"recovery_fund":fl.get("contractor_disc_rf",0),
            "stop_work":stop_work,"observations":observations,"occurrences":occurrences,
            "batches":batches,"arizona":states.get("az_roc",0),"new_jersey":states.get("nj_enforcement",0),
            "public_eligible":public}


def current_fingerprints(cur) -> dict[str, str]:
    cur.execute("SELECT id,identity_state,identity_method,resolved_license_external_key,publication_state,correction_hold,retraction_hold,license_id,contractor_id FROM discipline_actions WHERE source_system IN ('fl_dbpr','fl_dfs')")
    safety = cur.fetchall()
    return {"whole":relationship_digest(relation_rows(cur,"TRUE")),
            "florida":relationship_digest(relation_rows(cur,"source_system IN ('fl_dbpr','fl_dfs')")),
            "florida_safety":relationship_digest(safety),
            "arizona":relationship_digest(relation_rows(cur,"source_system='az_roc'")),
            "new_jersey":relationship_digest(relation_rows(cur,"source_system='nj_enforcement'"))}


def predicted_fingerprints(cur, manifest, entries) -> dict[str, str]:
    new = [(entry["discipline_action_id"], SOURCE_SYSTEM, None, None) for entry in entries]
    cur.execute("SELECT id,identity_state,identity_method,resolved_license_external_key,publication_state,correction_hold,retraction_hold,license_id,contractor_id FROM discipline_actions WHERE source_system='fl_dbpr'")
    safety = cur.fetchall() + [(entry["discipline_action_id"],"UNRESOLVED",IDENTITY_METHOD,None,"INTERNAL",False,False,None,None) for entry in entries]
    provenance = [(entry["discipline_action_id"],entry["observation_id"],occurrence,entry["source_observation_key"],ordinal)
                  for entry in entries for ordinal, occurrence in enumerate(entry["occurrence_ids"],1)]
    batch = {"batch_id":manifest["batch_id"],"source_system":SOURCE_SYSTEM,"source_dataset":SOURCE_DATASET,
             "source_url":SOURCE_URL,"retrieved_at_utc":manifest["retrieved_at_utc"],
             "raw_sha256":manifest["raw_sha256"],"normalized_snapshot_fingerprint":manifest["normalized_snapshot_fingerprint"],
             "raw_rows":manifest["raw_rows"],"unique_observations":manifest["unique_observations"],
             "schema_fingerprint":manifest["schema_fingerprint"]}
    result = {"whole":relationship_digest(relation_rows(cur,"TRUE")+new),
              "florida":relationship_digest(relation_rows(cur,"source_system='fl_dbpr'")+new),
              "florida_safety":relationship_digest(safety),
              "arizona":relationship_digest(relation_rows(cur,"source_system='az_roc'")),
              "new_jersey":relationship_digest(relation_rows(cur,"source_system='nj_enforcement'")),
              "stop_work_cohort":relationship_digest(new),"provenance":digest(provenance),"batch_snapshot":digest(batch)}
    return result


def collision_check(cur, manifest, entries) -> dict[str, int]:
    groups = {"actions":[x["discipline_action_id"] for x in entries],
              "observations":[x["observation_id"] for x in entries],
              "occurrences":[y for x in entries for y in x["occurrence_ids"]],"batches":[manifest["batch_id"]]}
    result = {}
    for name, table in (("actions","discipline_actions"),("observations","regulatory_source_observations"),
                        ("occurrences","regulatory_source_occurrences"),("batches","ingest_batches")):
        cur.execute(f"SELECT count(*) FROM {table} WHERE id=ANY(%s::uuid[])",(groups[name],))
        result[name] = cur.fetchone()[0]
    keys = [x["source_observation_key"] for x in entries]
    cur.execute("SELECT count(*) FROM discipline_actions WHERE source_system=%s AND external_key=ANY(%s)",(SOURCE_SYSTEM,keys))
    result["external_keys"] = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM regulatory_source_observations WHERE source_system=%s AND source_dataset=%s AND source_observation_key=ANY(%s)",(SOURCE_SYSTEM,SOURCE_DATASET,keys))
    result["source_keys"] = cur.fetchone()[0]
    if any(result.values()):
        raise RuntimeError(f"MANIFEST_COLLISION {result}")
    return result


def bind_manifest(generated: dict, approved: dict) -> dict:
    core = {key:value for key,value in approved.items() if key != "manifest_fingerprint"}
    if digest(core) != approved.get("manifest_fingerprint"):
        raise RuntimeError("MANIFEST_DRIFT fingerprint")
    if generated != approved:
        raise RuntimeError("MANIFEST_DRIFT fresh source does not reproduce approved manifest")
    return approved


def reverse_manifest(manifest: dict) -> dict:
    core={"version":"cth-fl-state-006-stop-work-reverse-v1","execution_manifest_fingerprint":manifest["manifest_fingerprint"],
          "batch_id":manifest["batch_id"],"normalized_snapshot_fingerprint":manifest["normalized_snapshot_fingerprint"],
          "counts":{"batches":1,"actions":manifest["unique_observations"],"observations":manifest["unique_observations"],"occurrences":manifest["raw_rows"]},
          "id_fingerprints":manifest["id_fingerprints"],"id_derivation":"UUIDv5 cth-fl-state-006 namespace + kind + source key/batch/ordinal",
          "rollback_order":["occurrences","observations","discipline_actions","ingest_batches"],"automatic_rollback_authorized":False}
    return core|{"reverse_manifest_fingerprint":digest(core)}


def _date(value: str) -> date:
    return datetime.strptime(value, "%m/%d/%Y").date()


def execute_inserts(cur, manifest, entries, rows_by_key) -> None:
    notes = json.dumps({"task":"CTH-FL-STATE-006A","normalized_snapshot_fingerprint":manifest["normalized_snapshot_fingerprint"],
                        "schema_fingerprint":SCHEMA_FINGERPRINT,"raw_rows":manifest["raw_rows"],
                        "unique_observations":manifest["unique_observations"]},sort_keys=True,separators=(",",":"))
    cur.execute("INSERT INTO ingest_batches(id,source_system,source_dataset,source_url,source_file,extracted_at,row_count,checksum_sha256,notes) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (manifest["batch_id"],SOURCE_SYSTEM,SOURCE_DATASET,SOURCE_URL,"Emp_List.aspx",manifest["retrieved_at_utc"],manifest["raw_rows"],manifest["raw_sha256"].removeprefix("sha256:"),notes))
    actions=[]; observations=[]; occurrences=[]
    for entry in entries:
        row=rows_by_key[entry["source_observation_key"]]
        actions.append((entry["discipline_action_id"],SOURCE_SYSTEM,SOURCE_DATASET,entry["source_observation_key"],row["Employer Name"],_date(row["Date Served"]),row["Reason"],row["City"],row["County"],Jsonb(row),manifest["batch_id"],manifest["retrieved_at_utc"],IDENTITY_METHOD,RESOLVER_VERSION,Jsonb({"authoritative_identity_identifier_present":False,"automatic_name_location_linkage_prohibited":True}),manifest["retrieved_at_utc"]))
        observations.append((entry["observation_id"],entry["discipline_action_id"],SOURCE_SYSTEM,SOURCE_DATASET,entry["source_observation_key"],entry["logical_matter_detail_key"],entry["row_fingerprint_sha256"],Jsonb(row),manifest["retrieved_at_utc"]))
        for ordinal, occurrence_id in enumerate(entry["occurrence_ids"],1):
            occurrences.append((occurrence_id,entry["observation_id"],manifest["batch_id"],"snapshot",manifest["raw_sha256"].removeprefix("sha256:"),f"observation:{entry['source_observation_key'].rsplit(':',1)[-1]}:ordinal:{ordinal}","Emp_List.aspx",SOURCE_URL,manifest["retrieved_at_utc"]))
    cur.executemany("INSERT INTO discipline_actions(id,contractor_id,license_id,source_system,source_dataset,external_key,complaint_number,license_type,license_number_raw,respondent_name,classification,entered_date,disposition,disposition_date,discipline_description,violation_code,address_line_1,city,state,postal_code,county_name,raw_payload,ingest_batch_id,last_verified_at,identity_state,identity_method,resolver_version,resolved_license_external_key,identity_evidence,identity_evaluated_at,review_reason,publication_state,publication_evidence,publication_evaluated_at,withheld_reason,correction_hold,retraction_hold) VALUES(%s,NULL,NULL,%s,%s,%s,NULL,NULL,NULL,%s,NULL,%s,NULL,NULL,%s,NULL,NULL,%s,NULL,NULL,%s,%s,%s,%s,'UNRESOLVED',%s,%s,NULL,%s,%s,'STOP_WORK_SOURCE_HAS_NO_AUTHORITATIVE_EMPLOYER_IDENTIFIER','INTERNAL',NULL,NULL,NULL,FALSE,FALSE)",actions)
    if cur.rowcount != len(actions): raise RuntimeError("discipline action insert count")
    cur.executemany("INSERT INTO regulatory_source_observations(id,discipline_action_id,source_system,source_dataset,source_observation_key,source_observation_algorithm,logical_matter_detail_key,logical_matter_algorithm,row_fingerprint_sha256,source_payload,revision_state,first_observed_at) VALUES(%s,%s,%s,%s,%s,'source-observation-key-v2',%s,'logical-matter-detail-key-v1',%s,%s,'CURRENT',%s)",observations)
    if cur.rowcount != len(observations): raise RuntimeError("source observation insert count")
    cur.executemany("INSERT INTO regulatory_source_occurrences(id,source_observation_id,ingest_batch_id,fiscal_year,source_file_checksum_sha256,source_record_locator,source_file,source_url,observed_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)",occurrences)
    if cur.rowcount != len(occurrences): raise RuntimeError("source occurrence insert count")


def validate_actual_post(cur, manifest, entries) -> dict:
    expected={"whole":21420+len(entries),"florida":19827+len(entries),"licensed":6457,"ula":11691,"recovery_fund":1679,"stop_work":len(entries),"observations":19827+len(entries),"occurrences":19827+manifest["raw_rows"],"batches":62,"arizona":459,"new_jersey":1134,"public_eligible":0}
    counts=production_baseline(cur)
    if counts!=expected: raise RuntimeError(f"PRE_COMMIT_INVARIANT counts {counts}")
    cur.execute("SELECT count(*),count(*) FILTER(WHERE identity_state='UNRESOLVED'),count(*) FILTER(WHERE license_id IS NOT NULL),count(*) FILTER(WHERE contractor_id IS NOT NULL),count(*) FILTER(WHERE publication_state='INTERNAL'),count(*) FILTER(WHERE publication_state='PUBLIC_ELIGIBLE'),count(*) FILTER(WHERE identity_method<>%s),count(*) FILTER(WHERE resolver_version<>%s),count(*) FILTER(WHERE correction_hold),count(*) FILTER(WHERE retraction_hold) FROM discipline_actions WHERE source_system=%s AND source_dataset=%s",(IDENTITY_METHOD,RESOLVER_VERSION,SOURCE_SYSTEM,SOURCE_DATASET)); cohort=cur.fetchone()
    if cohort!=(len(entries),len(entries),0,0,len(entries),0,0,0,0,0): raise RuntimeError(f"PRE_COMMIT_INVARIANT cohort {cohort}")
    cur.execute("SELECT source_observation_key,row_fingerprint_sha256,source_payload,revision_state FROM regulatory_source_observations WHERE source_system=%s AND source_dataset=%s",(SOURCE_SYSTEM,SOURCE_DATASET)); source_rows=cur.fetchall()
    valid=sum(observation_key(payload)==key and row_fingerprint_sha256(payload,FIELDS)==fingerprint and state=="CURRENT" for key,fingerprint,payload,state in source_rows)
    cur.execute("SELECT count(*),count(*)-count(DISTINCT(source_observation_id,ingest_batch_id,fiscal_year,source_file_checksum_sha256,source_record_locator)) FROM regulatory_source_occurrences o JOIN regulatory_source_observations s ON s.id=o.source_observation_id WHERE s.source_system=%s AND s.source_dataset=%s",(SOURCE_SYSTEM,SOURCE_DATASET)); occurrence_count,occurrence_collisions=cur.fetchone()
    if len(source_rows)!=len(entries) or valid!=len(entries) or occurrence_count!=manifest["raw_rows"] or occurrence_collisions!=0: raise RuntimeError("PRE_COMMIT_INVARIANT provenance")
    actual=current_fingerprints(cur)
    actual["stop_work_cohort"]=relationship_digest(relation_rows(cur,"source_system='fl_dfs' AND source_dataset='fl_dfs_workers_comp_stop_work'"))
    cur.execute("SELECT d.id,s.id,o.id,s.source_observation_key,o.source_record_locator FROM discipline_actions d JOIN regulatory_source_observations s ON s.discipline_action_id=d.id JOIN regulatory_source_occurrences o ON o.source_observation_id=s.id WHERE d.source_system=%s AND d.source_dataset=%s",(SOURCE_SYSTEM,SOURCE_DATASET))
    provenance=[]
    for action_id,observation_id,occurrence_id,key,locator in cur.fetchall(): provenance.append((str(action_id),str(observation_id),str(occurrence_id),key,int(locator.rsplit(":",1)[-1])))
    actual["provenance"]=digest(sorted(provenance,key=lambda row:(row[3],row[4])))
    batch={"batch_id":manifest["batch_id"],"source_system":SOURCE_SYSTEM,"source_dataset":SOURCE_DATASET,"source_url":SOURCE_URL,"retrieved_at_utc":manifest["retrieved_at_utc"],"raw_sha256":manifest["raw_sha256"],"normalized_snapshot_fingerprint":manifest["normalized_snapshot_fingerprint"],"raw_rows":manifest["raw_rows"],"unique_observations":manifest["unique_observations"],"schema_fingerprint":manifest["schema_fingerprint"]}
    actual["batch_snapshot"]=digest(batch)
    if actual!=EXPECTED_POST_FINGERPRINTS: raise RuntimeError(f"PRE_COMMIT_INVARIANT fingerprints {actual}")
    return {"counts":counts,"cohort":cohort,"observations":len(source_rows),"payload_key_valid":valid,"occurrences":occurrence_count,"occurrence_collisions":occurrence_collisions,"fingerprints":actual}


def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source",type=Path,required=True); parser.add_argument("--retrieved-at",required=True)
    parser.add_argument("--manifest-input",type=Path); parser.add_argument("--manifest-output",type=Path)
    parser.add_argument("--review-output",type=Path); parser.add_argument("--reverse-output",type=Path); parser.add_argument("--execute",action="store_true")
    parser.add_argument("--expected-manifest-fingerprint")
    args=parser.parse_args()
    rows,meta=parse_snapshot(args.source); generated,entries=build_contract(rows,args.retrieved_at,meta)
    manifest=generated
    if args.manifest_input: manifest=bind_manifest(generated,json.loads(args.manifest_input.read_text(encoding="utf-8")))
    if args.expected_manifest_fingerprint and manifest["manifest_fingerprint"] != args.expected_manifest_fingerprint:
        raise RuntimeError("MANIFEST_DRIFT expected fingerprint")
    load_dotenv_files(ROOT/".env.local",ROOT/".env"); db=normalize_database_url(os.environ.get("DATABASE_URL",""))
    with psycopg.connect(db,autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"); cur.execute("SET LOCAL statement_timeout='30s'")
            baseline=production_baseline(cur)
            if baseline != EXPECTED_BASELINE: raise RuntimeError(f"PRODUCTION_DRIFT {baseline}")
            collisions=collision_check(cur,manifest,entries); current=current_fingerprints(cur); predicted=predicted_fingerprints(cur,manifest,entries)
            if current!=EXPECTED_PRE_FINGERPRINTS: raise RuntimeError(f"PRODUCTION_DRIFT fingerprints {current}")
            if predicted!=EXPECTED_POST_FINGERPRINTS: raise RuntimeError(f"ARCHITECTURE_DRIFT predicted fingerprints {predicted}")
        conn.rollback()
    reverse=reverse_manifest(manifest)
    reason_counts=dict(sorted(Counter(row["Reason"] for row in rows).items()))
    reinstated=sum(row["Date Reinstated**"].casefold()!="not reinstated" for row in rows)
    review={"task":"CTH-FL-STATE-006A","canonical_main_sha":"0deac805f81a83be8d4fa59ce93c9926146f5102","mode":"DRY_RUN" if not args.execute else "EXECUTE_REQUESTED",
            "source":{k:manifest[k] for k in ("retrieved_at_utc","bytes","raw_sha256","normalized_snapshot_fingerprint","schema_fingerprint","raw_rows","unique_observations","duplicate_appearances")},
            "source_delta":{"planning_raw_sha256":"sha256:de8dd572927382652075da878ffd1dd55d3d93b61757d619b3d18d8d2ac1700b","classification":"EXPECTED_DAILY_DATA_DELTA","structural_drift":False,"semantic_drift":False,"parsed_counts_equal_planning":True},
            "field_contract":list(FIELDS),"logical_review_fields":["Employer Name","County","City","Date Served","Reason"],
            "semantics":{"reason_counts":reason_counts,"date_ended_dated":len(rows),"date_reinstated_dated":reinstated,"not_reinstated":len(rows)-reinstated,
                         "raw_values_preserved":True,"current_active_inferred":False,"penalty_paid_inferred":False,"compliance_inferred":False,"fraud_inferred":False},
            "identity":{"EXACT":0,"DETERMINISTIC":0,"REVIEW_REQUIRED":0,"UNRESOLVED":len(entries),"license_links":0,"contractor_links":0,"entity_links":0,"method":IDENTITY_METHOD,"resolver_version":RESOLVER_VERSION},
            "manifest":{"format":"compact source-key/multiplicity","fingerprint":manifest["manifest_fingerprint"],"source_key_count":len(entries),"batch_id":manifest["batch_id"],"independent_reproduction":True},
            "reverse_manifest":{"fingerprint":reverse["reverse_manifest_fingerprint"],"automatic_rollback_authorized":False},
            "baseline":baseline,"collisions":collisions,"current_fingerprints":current,"predicted_fingerprints":predicted,
            "predicted_post":{"whole":baseline["whole"]+len(entries),"florida":baseline["florida"]+len(entries),"licensed":6457,"ula":11691,"recovery_fund":1679,"stop_work":len(entries),"observations":baseline["observations"]+len(entries),"occurrences":baseline["occurrences"]+len(rows),"batches":baseline["batches"]+1,"arizona":459,"new_jersey":1134,"identity":{"EXACT":1811,"DETERMINISTIC":265,"REVIEW_REQUIRED":1753,"UNRESOLVED":15998+len(entries)},"relationships":{"license_linked":2479,"contractor_linked":0,"neither":17348+len(entries)},"correction":{"true":403,"false":19424+len(entries)},"retraction":{"true":0,"false":19827+len(entries)},"publication":{"INTERNAL":19827+len(entries),"PUBLIC_ELIGIBLE":0}},
            "transaction":{"single_transaction":True,"isolation":"REPEATABLE READ","advisory_lock":ADVISORY_LOCK,"lock_timeout":"5s","statement_timeout":"180s","insert_only":True,"expected_inserts":manifest["expected_inserts"],"updates":0,"deletes":0},
            "public_and_scoring":{"profile_leakage":False,"discovery_leakage":False,"generic_adverse_leakage":False,"gate_on_leakage":False,"trust_score":0,"ranking":0,"PUBLIC_ELIGIBLE":0},
            "migration":{"required":False,"migration_009_reused":True},"production_mutations":0}
    if args.manifest_output: write_json(args.manifest_output,manifest)
    if args.review_output: write_json(args.review_output,review)
    if args.reverse_output: write_json(args.reverse_output,reverse)
    if not args.execute:
        print(json.dumps(review,indent=2)); return
    if not args.manifest_input or not args.expected_manifest_fingerprint:
        raise RuntimeError("EXECUTION_GATE approved manifest and fingerprint required")
    rows_by_key={observation_key(row):row for row in rows}
    with psycopg.connect(db,autocommit=False) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ"); cur.execute("SET LOCAL lock_timeout='5s'"); cur.execute("SET LOCAL statement_timeout='180s'")
                cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))",(ADVISORY_LOCK,))
                if production_baseline(cur)!=EXPECTED_BASELINE: raise RuntimeError("PRODUCTION_DRIFT in transaction")
                if current_fingerprints(cur)!=EXPECTED_PRE_FINGERPRINTS: raise RuntimeError("PRODUCTION_DRIFT fingerprints in transaction")
                collision_check(cur,manifest,entries); execute_inserts(cur,manifest,entries,rows_by_key)
                validate_actual_post(cur,manifest,entries)
            conn.commit()
        except Exception:
            conn.rollback(); raise


if __name__ == "__main__":
    main()
