#!/usr/bin/env python3
"""Controlled Florida Recovery Fund executor; read-only unless --execute."""

from __future__ import annotations

import argparse, csv, hashlib, json, os, sys, uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path: sys.path.insert(0, str(ROOT))

from ingest.adapters.fl_dbpr import _parse_date
from ingest.env import load_dotenv_files, normalize_database_url
from ingest.regulatory.fl_dbpr_identity import FloridaDbprCredentialResolver, LicenseCredential
from ingest.regulatory.fl_dbpr_recovery_fund import (
    CONTRACTOR_LINKING_ALLOWED, PUBLICATION_STATE, SCORING_IMPACT, SOURCE_DATASET,
    SOURCE_SYSTEM, semantic_assertions, semantic_categories,
)
from ingest.regulatory.source_observation import (
    FL_RECOVERY_FUND_FIELDS, FL_RECOVERY_FUND_LOGICAL_FIELDS,
    LOGICAL_MATTER_ALGORITHM, SOURCE_OBSERVATION_ALGORITHM, canonical_source_row,
    logical_matter_detail_key_v1, row_fingerprint_sha256, source_observation_key_v2,
)
from scripts import backfill_fl_regulatory_source_provenance as legacy
from scripts.ingest_fl_unlicensed_activity import commit_or_rollback, digest, write_json

MANIFEST_VERSION = "cth-fl-state-004-recovery-fund-v1"
TASK_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "contractortrusthub:cth-fl-state-004-recovery-fund")
DATASET_ADVISORY_LOCK = "fl_dbpr:contractor_disc_rf"
FILES = {
    "2021-22":{"code":"2122","rows":548,"sha256":"ab863b07b1af6893af9fb419a4992270d430bec96d400a28c41ecb46eda55182"},
    "2022-23":{"code":"2223","rows":256,"sha256":"c7a6e73bc819aa8940af09e1a1885873eecb336e3ccb2eef88c3ebce57e8b3cc"},
    "2023-24":{"code":"2324","rows":216,"sha256":"2594e81df06c21778edca9e7683ba329b29d3b282e79375f69e3906f69d28c01"},
    "2024-25":{"code":"2425","rows":647,"sha256":"fed3e761246c936ca87f2067367f30d64665b8914c9e71fd966008464b18b1fa"},
    "2025-26":{"code":"2526","rows":12,"sha256":"297b4e87309c23b9a313f995700d9117cfafbf7ffd719e7477ac1ac7778bc475"},
}
EXPECTED_IDENTITY = {"EXACT":75,"DETERMINISTIC":29,"REVIEW_REQUIRED":342,"UNRESOLVED":1233}
EXPECTED_CLAIM_STAGE = {"CLAIM_APPROVED":1671,"CLAIM_CLOSED":6,"UNKNOWN":2}
EXPECTED_DETAIL = {"REIMBURSEMENT_RECORDED":840,"LICENSE_SUSPENSION_RECORDED":837,"OTHER_DETAIL":2}
EXPECTED_PRE_FINGERPRINTS = {
    "whole":"sha256:5bee9a5963aadb8ab58c7d16e6e9c508e320eecc1fe0a17b14ece673df80c940",
    "florida":"sha256:3474cf0b86c6f9e816163244cdb1f9c86daa6479f7d703cea87b9dd4c02b7614",
    "florida_safety":"sha256:d1a721ab16a24ee862b85056867f9bb75cfa0e100ae67caeb71eed0a7940721f",
    "arizona":"sha256:d5c456b2d6d60accef4f892ce2b95b1b23ca6a792cea0d8f0e2ee92f2bf8f6c3",
    "new_jersey":"sha256:6aae90e88c656e664717442a32009e7010b71c378838690651242de3e37f43c3",
}
EXPECTED_POST_FINGERPRINTS = {
    "whole":"sha256:b276b929dab3c37ee7670ec244283a109c8479dd3711f484ef286fa9afc0c67e",
    "florida":"sha256:aeec5f86ac1f55c3f75c1c1a34b664dc02aeb3b7b9f847ec062562533919c813",
    "florida_safety":"sha256:15266e1ef2a3e3e256207997a07db62d26de2177295d501154843292621eba73",
    "arizona":"sha256:d5c456b2d6d60accef4f892ce2b95b1b23ca6a792cea0d8f0e2ee92f2bf8f6c3",
    "new_jersey":"sha256:6aae90e88c656e664717442a32009e7010b71c378838690651242de3e37f43c3",
    "recovery_fund_cohort":"sha256:b471e74ed85eb4ae681687c3ef4a9b484f5e8fda8c478b6850fa196c1eba1557",
    "provenance":"sha256:2dfc1c162a1e0d115ff86484d26c3da30db089d8745ebcfacec2f38685379596",
    "batches":"sha256:6949a6af5e099f294f4a1044c2f9be27c93071a918e6a63902e908831b600645",
}

def stable_id(kind: str, identity: str) -> str:
    return str(uuid.uuid5(TASK_NAMESPACE, f"{kind}:{identity}"))

def source_filename(year: str) -> str: return f"contractor_disc_rf_{FILES[year]['code']}.csv"
def source_url(year: str) -> str: return f"https://www2.myfloridalicense.com/pro/cilb/reports/{source_filename(year)}"

def observation_key(row):
    return source_observation_key_v2(source_system=SOURCE_SYSTEM,source_dataset=SOURCE_DATASET,row=row,fields=FL_RECOVERY_FUND_FIELDS)

def logical_key(row):
    return logical_matter_detail_key_v1(source_system=SOURCE_SYSTEM,source_dataset=SOURCE_DATASET,row=row,fields=FL_RECOVERY_FUND_LOGICAL_FIELDS)

def load_sources(raw_dir: Path):
    inventory,rows=[],[]; schema=digest(list(FL_RECOVERY_FUND_FIELDS))
    for year,spec in FILES.items():
        path=raw_dir/source_filename(year); data=path.read_bytes(); checksum=hashlib.sha256(data).hexdigest()
        if checksum!=spec['sha256']: raise RuntimeError(f"SOURCE_DRIFT {year} checksum {checksum}")
        parsed=[]
        with path.open('r',encoding='utf-8-sig',newline='') as handle:
            reader=csv.DictReader(handle)
            if tuple(reader.fieldnames or ())!=FL_RECOVERY_FUND_FIELDS: raise RuntimeError(f"SOURCE_DRIFT {year} schema")
            for locator,raw in enumerate(reader,1):
                if None in raw or set(raw)!=set(FL_RECOVERY_FUND_FIELDS): raise RuntimeError(f"SOURCE_DRIFT malformed {year}:{locator}")
                parsed.append({'fiscal_year':year,'source_record_locator':f'csv-record:{locator}','payload':canonical_source_row(raw,FL_RECOVERY_FUND_FIELDS)})
        if len(parsed)!=spec['rows']: raise RuntimeError(f"SOURCE_DRIFT {year} rows {len(parsed)}")
        inventory.append({'fiscal_year':year,'official_url':source_url(year),'filename':path.name,'http_status':200,'byte_size':len(data),'downloaded_at':datetime.fromtimestamp(path.stat().st_mtime,timezone.utc).isoformat(),'sha256':checksum,'rows':len(parsed),'schema_columns':17,'schema_fingerprint':schema})
        rows.extend(parsed)
    if len(rows)!=1679: raise RuntimeError(f"SOURCE_DRIFT total {len(rows)}")
    return inventory,rows

def load_resolver(cur):
    cur.execute("SELECT id,external_key,occupation_code,license_number,source_board,contractor_id FROM licenses WHERE source_system='fl_dbpr'")
    return FloridaDbprCredentialResolver(LicenseCredential(str(r[0]),r[1],r[2],r[3],r[4],str(r[5]) if r[5] else None) for r in cur.fetchall())

def build_manifest(inventory,rows,resolver):
    by_year={x['fiscal_year']:x for x in inventory}
    batch_ids={y:stable_id('batch',f"{y}:{s['sha256']}") for y,s in FILES.items()}
    entries=[]; keys=[]; logical_groups=defaultdict(lambda:{'keys':set(),'years':set()}); claims=Counter(); states=Counter(); stages=Counter(); details=Counter(); reasons=Counter(); target_ids=set(); unknown=Counter(); collision=0
    for item in rows:
        p=item['payload']; key=observation_key(p); logical=logical_key(p)
        resolution=resolver.resolve(source_dataset=SOURCE_DATASET,license_type=p['License Type'],license_number=p['License Nbr'])
        safe=resolution.identity_state in ('EXACT','DETERMINISTIC')
        if safe: target_ids.add(resolution.proposed_license_id)
        if resolution.identity_method=='unknown_license_type': unknown[p['License Type']]+=1
        if resolution.identity_method in ('identifier_type_conflict','multiple_typed_candidates','duplicate_external_key'): collision+=1
        cats=semantic_categories(p); claims[p['Claim Nbr']]+=1; states[resolution.identity_state]+=1; stages[cats['claim_stage']]+=1; details[cats['detail_type']]+=1; reasons[resolution.reason]+=1; keys.append(key)
        group=logical_groups[logical]; group['keys'].add(key); group['years'].add(item['fiscal_year'])
        occurrence_identity=f"{key}:{item['fiscal_year']}:{item['source_record_locator']}:{FILES[item['fiscal_year']]['sha256']}"
        entries.append({'fiscal_year':item['fiscal_year'],'source_file_checksum':FILES[item['fiscal_year']]['sha256'],'source_record_locator':item['source_record_locator'],'source_observation_key':key,'row_fingerprint_sha256':row_fingerprint_sha256(p,FL_RECOVERY_FUND_FIELDS),'logical_matter_detail_key':logical,'claim_semantic_category':cats['claim_stage'],'detail_semantic_category':cats['detail_type'],'identity_state':resolution.identity_state,'identity_method':resolution.identity_method,'resolver_version':resolution.resolver_version,'discipline_action_id':stable_id('action',key),'observation_id':stable_id('observation',key),'occurrence_id':stable_id('occurrence',occurrence_identity),'ingest_batch_id':batch_ids[item['fiscal_year']],'license_id':resolution.proposed_license_id if safe else None,'resolved_license_external_key':resolution.resolved_external_key if safe else None})
    entries.sort(key=lambda x:(x['fiscal_year'],x['source_record_locator'],x['source_observation_key']))
    duplicates=len(keys)-len(set(keys)); revisions=sum(len(g['keys'])>1 and len(g['years'])>1 for g in logical_groups.values())
    if duplicates or revisions or dict(states)!=EXPECTED_IDENTITY or dict(stages)!=EXPECTED_CLAIM_STAGE or dict(details)!=EXPECTED_DETAIL: raise RuntimeError(f"DELTA_DRIFT duplicates={duplicates} revisions={revisions} identity={states} stages={stages} details={details}")
    batches=[{'fiscal_year':y,'ingest_batch_id':batch_ids[y],'source_system':SOURCE_SYSTEM,'source_dataset':SOURCE_DATASET,'source_url':source_url(y),'source_file':source_filename(y),'row_count':FILES[y]['rows'],'checksum_sha256':FILES[y]['sha256'],'downloaded_at':by_year[y]['downloaded_at']} for y in FILES]
    core={'manifest_version':MANIFEST_VERSION,'source_system':SOURCE_SYSTEM,'source_dataset':SOURCE_DATASET,'source_files':inventory,'batches':batches,'entries':entries}
    manifest=core|{'entry_count':len(entries),'manifest_fingerprint':digest(core)}
    analysis={'new_exact':len(entries),'duplicate_source_observations':duplicates,'revision_candidates':revisions,'claim_grain':{'claims':len(claims),'single_line':sum(v==1 for v in claims.values()),'multi_line':sum(v>1 for v in claims.values()),'rows_in_multi_line':sum(v for v in claims.values() if v>1),'max_rows':max(claims.values())},'claim_stage_counts':dict(stages),'detail_type_counts':dict(details),'identity_partition':dict(states),'safe_license_rows':sum(x['license_id'] is not None for x in entries),'safe_unique_target_licenses':len(target_ids),'unknown_types':dict(unknown),'collision_exposure':collision,'resolution_reasons':dict(reasons),'new_by_year':dict(Counter(x['fiscal_year'] for x in entries))}
    return manifest,analysis

def reverse_manifest(manifest):
    core={'execution_manifest_fingerprint':manifest['manifest_fingerprint'],'source_checksums':{x['fiscal_year']:x['sha256'] for x in manifest['source_files']},'batch_ids':[x['ingest_batch_id'] for x in manifest['batches']],'discipline_action_ids':[x['discipline_action_id'] for x in manifest['entries']],'observation_ids':[x['observation_id'] for x in manifest['entries']],'occurrence_ids':[x['occurrence_id'] for x in manifest['entries']]}
    return core|{'reverse_manifest_fingerprint':digest(core),'rollback_order':['occurrences','observations','discipline_actions','ingest_batches'],'automatic_rollback_authorized':False}

def _without_downloaded_at(items):
    """Return execution scope metadata without local retrieval timestamps."""
    return [{k:v for k,v in item.items() if k!='downloaded_at'} for item in items]

def bind_approved_manifest(generated,approved):
    """Validate and bind an immutable approved execution contract.

    Fresh source bytes, schema, payload-derived entries, and resolver results must
    reproduce the approved scope.  A local filesystem mtime is audit metadata,
    however, and cannot redefine the approved provenance snapshot timestamp.
    """
    core={k:approved[k] for k in ('manifest_version','source_system','source_dataset','source_files','batches','entries')}
    if digest(core)!=approved.get('manifest_fingerprint'):
        raise RuntimeError('MANIFEST_DRIFT invalid approved fingerprint')
    generated_scope={
        'manifest_version':generated.get('manifest_version'),
        'source_system':generated.get('source_system'),
        'source_dataset':generated.get('source_dataset'),
        'entry_count':generated.get('entry_count'),
        'source_files':_without_downloaded_at(generated.get('source_files',[])),
        'batches':_without_downloaded_at(generated.get('batches',[])),
        'entries':generated.get('entries'),
    }
    approved_scope={
        'manifest_version':approved.get('manifest_version'),
        'source_system':approved.get('source_system'),
        'source_dataset':approved.get('source_dataset'),
        'entry_count':approved.get('entry_count'),
        'source_files':_without_downloaded_at(approved.get('source_files',[])),
        'batches':_without_downloaded_at(approved.get('batches',[])),
        'entries':approved.get('entries'),
    }
    if generated_scope!=approved_scope:
        raise RuntimeError('MANIFEST_DRIFT approved execution scope differs')
    return approved

def relationship_rows(cur,predicate):
    cur.execute(f"SELECT id,source_system,license_id,contractor_id FROM discipline_actions WHERE {predicate}"); return cur.fetchall()

def current_fingerprints(cur):
    groups={'whole':relationship_rows(cur,'TRUE'),'florida':relationship_rows(cur,"source_system='fl_dbpr'"),'arizona':relationship_rows(cur,"source_system='az_roc'"),'new_jersey':relationship_rows(cur,"source_system='nj_enforcement'")}
    cur.execute("SELECT id,identity_state,identity_method,resolved_license_external_key,publication_state,correction_hold,retraction_hold,license_id,contractor_id FROM discipline_actions WHERE source_system='fl_dbpr'"); groups['florida_safety']=cur.fetchall()
    return {k:legacy.relationship_digest(sorted(v,key=lambda r:str(r[0]))) for k,v in groups.items()}

def predicted_fingerprints(cur,manifest):
    new=[(x['discipline_action_id'],SOURCE_SYSTEM,x['license_id'],None) for x in manifest['entries']]
    cur.execute("SELECT id,identity_state,identity_method,resolved_license_external_key,publication_state,correction_hold,retraction_hold,license_id,contractor_id FROM discipline_actions WHERE source_system='fl_dbpr'"); safety=cur.fetchall()+[(x['discipline_action_id'],x['identity_state'],x['identity_method'],x['resolved_license_external_key'],PUBLICATION_STATE,False,False,x['license_id'],None) for x in manifest['entries']]
    fp=lambda rows:legacy.relationship_digest(sorted(rows,key=lambda r:str(r[0])))
    return {'whole':fp(relationship_rows(cur,'TRUE')+new),'florida':fp(relationship_rows(cur,"source_system='fl_dbpr'")+new),'florida_safety':fp(safety),'arizona':fp(relationship_rows(cur,"source_system='az_roc'")),'new_jersey':fp(relationship_rows(cur,"source_system='nj_enforcement'")),'recovery_fund_cohort':fp(new),'provenance':digest([(x['discipline_action_id'],x['observation_id'],x['occurrence_id'],x['source_observation_key']) for x in manifest['entries']]),'batches':digest(manifest['batches'])}

def production_baseline(cur):
    cur.execute("SELECT count(*) FROM discipline_actions"); whole=cur.fetchone()[0]
    cur.execute("SELECT source_dataset,count(*) FROM discipline_actions WHERE source_system='fl_dbpr' GROUP BY source_dataset"); fl=dict(cur.fetchall())
    cur.execute("SELECT count(*) FROM regulatory_source_observations"); obs=cur.fetchone()[0]; cur.execute("SELECT count(*) FROM regulatory_source_occurrences"); occ=cur.fetchone()[0]; cur.execute("SELECT count(*) FROM ingest_batches"); batches=cur.fetchone()[0]
    cur.execute("SELECT source_system,count(*) FROM discipline_actions GROUP BY source_system"); states=dict(cur.fetchall()); cur.execute("SELECT count(*) FROM discipline_actions WHERE publication_state='PUBLIC_ELIGIBLE'"); public=cur.fetchone()[0]
    actual={'whole':whole,'licensed':fl.get('contractor_disc_lic',0),'ula':fl.get('contractor_disc_ula',0),'recovery_fund':fl.get(SOURCE_DATASET,0),'florida_all':sum(fl.values()),'observations':obs,'occurrences':occ,'batches':batches,'arizona':states.get('az_roc',0),'new_jersey':states.get('nj_enforcement',0),'public_eligible':public}
    expected={'whole':19741,'licensed':6457,'ula':11691,'recovery_fund':0,'florida_all':18148,'observations':18148,'occurrences':18148,'batches':56,'arizona':459,'new_jersey':1134,'public_eligible':0}
    if actual!=expected: raise RuntimeError(f"PRODUCTION_DRIFT {actual}")
    return actual

def validate_ids(cur,manifest):
    groups={'action':{x['discipline_action_id'] for x in manifest['entries']},'observation':{x['observation_id'] for x in manifest['entries']},'occurrence':{x['occurrence_id'] for x in manifest['entries']},'batch':{x['ingest_batch_id'] for x in manifest['batches']}}
    if {k:len(v) for k,v in groups.items()}!={'action':1679,'observation':1679,'occurrence':1679,'batch':5}: raise RuntimeError('MANIFEST_COLLISION internal IDs')
    tables={'action':'discipline_actions','observation':'regulatory_source_observations','occurrence':'regulatory_source_occurrences','batch':'ingest_batches'}; result={}
    for k,t in tables.items(): cur.execute(f"SELECT count(*) FROM {t} WHERE id=ANY(%s::uuid[])",(list(groups[k]),)); result[k]=cur.fetchone()[0]
    keys=[x['source_observation_key'] for x in manifest['entries']]; cur.execute("SELECT count(*) FROM discipline_actions WHERE external_key=ANY(%s)",(keys,)); result['external_key']=cur.fetchone()[0]; cur.execute("SELECT count(*) FROM regulatory_source_observations WHERE source_observation_key=ANY(%s)",(keys,)); result['source_key']=cur.fetchone()[0]
    if any(result.values()): raise RuntimeError(f"MANIFEST_COLLISION {result}")
    return result

def validate_targets(cur,manifest,lock=False):
    targets={x['license_id']:x['resolved_license_external_key'] for x in manifest['entries'] if x['license_id']}
    sql="SELECT id,external_key FROM licenses WHERE id=ANY(%s::uuid[])"+(" FOR KEY SHARE" if lock else "")
    cur.execute(sql,(list(targets),)); actual={str(r[0]):r[1] for r in cur.fetchall()}
    if len(targets)!=49 or actual!=targets: raise RuntimeError(f"IDENTITY_DRIFT targets={len(targets)} actual={len(actual)}")
    return {'safe_rows':sum(x['license_id'] is not None for x in manifest['entries']),'unique_targets':len(actual),'locked':lock}

def post_counts(cur):
    cur.execute("SELECT count(*) FROM discipline_actions"); whole=cur.fetchone()[0]; cur.execute("SELECT source_dataset,count(*) FROM discipline_actions WHERE source_system='fl_dbpr' GROUP BY source_dataset"); fl=dict(cur.fetchall()); cur.execute("SELECT count(*) FROM regulatory_source_observations"); obs=cur.fetchone()[0]; cur.execute("SELECT count(*) FROM regulatory_source_occurrences"); occ=cur.fetchone()[0]; cur.execute("SELECT count(*) FROM ingest_batches"); batches=cur.fetchone()[0]; cur.execute("SELECT source_system,count(*) FROM discipline_actions GROUP BY source_system"); states=dict(cur.fetchall())
    cur.execute("SELECT identity_state,count(*) FROM discipline_actions WHERE source_system='fl_dbpr' GROUP BY identity_state"); identity=dict(cur.fetchall()); cur.execute("SELECT count(*) FILTER(WHERE license_id IS NOT NULL),count(*) FILTER(WHERE contractor_id IS NOT NULL),count(*) FILTER(WHERE license_id IS NULL AND contractor_id IS NULL),count(*) FILTER(WHERE correction_hold),count(*) FILTER(WHERE NOT correction_hold),count(*) FILTER(WHERE retraction_hold),count(*) FILTER(WHERE NOT retraction_hold),count(*) FILTER(WHERE publication_state='INTERNAL'),count(*) FILTER(WHERE publication_state='PUBLIC_ELIGIBLE') FROM discipline_actions WHERE source_system='fl_dbpr'"); r=cur.fetchone()
    return {'whole':whole,'licensed':fl.get('contractor_disc_lic',0),'ula':fl.get('contractor_disc_ula',0),'recovery_fund':fl.get(SOURCE_DATASET,0),'florida_all':sum(fl.values()),'observations':obs,'occurrences':occ,'batches':batches,'arizona':states.get('az_roc',0),'new_jersey':states.get('nj_enforcement',0),'identity':identity,'relationships':{'license_linked':r[0],'contractor_linked':r[1],'neither':r[2]},'correction':{'true':r[3],'false':r[4]},'retraction':{'true':r[5],'false':r[6]},'publication':{'INTERNAL':r[7],'PUBLIC_ELIGIBLE':r[8]}}

def cohort_invariants(cur):
    cur.execute("SELECT count(*),count(*) FILTER(WHERE identity_state='EXACT'),count(*) FILTER(WHERE identity_state='DETERMINISTIC'),count(*) FILTER(WHERE identity_state='REVIEW_REQUIRED'),count(*) FILTER(WHERE identity_state='UNRESOLVED'),count(*) FILTER(WHERE license_id IS NOT NULL),count(*) FILTER(WHERE contractor_id IS NOT NULL),count(*) FILTER(WHERE publication_state='INTERNAL'),count(*) FILTER(WHERE publication_state='PUBLIC_ELIGIBLE'),count(*) FILTER(WHERE correction_hold),count(*) FILTER(WHERE retraction_hold) FROM discipline_actions WHERE source_system=%s AND source_dataset=%s",(SOURCE_SYSTEM,SOURCE_DATASET)); r=cur.fetchone(); keys=('rows','EXACT','DETERMINISTIC','REVIEW_REQUIRED','UNRESOLVED','license_linked','contractor_linked','INTERNAL','PUBLIC_ELIGIBLE','correction_true','retraction_true'); return dict(zip(keys,r))

def provenance_invariants(cur):
    cur.execute("SELECT o.discipline_action_id,o.source_observation_key,o.row_fingerprint_sha256,o.source_payload,o.revision_state FROM regulatory_source_observations o JOIN discipline_actions d ON d.id=o.discipline_action_id WHERE d.source_system=%s AND d.source_dataset=%s",(SOURCE_SYSTEM,SOURCE_DATASET)); rows=cur.fetchall(); states=Counter(); actions=set(); valid_hash=valid_key=0
    for aid,key,fp,payload,state in rows: actions.add(str(aid)); states[state]+=1; valid_hash+=row_fingerprint_sha256(payload,FL_RECOVERY_FUND_FIELDS)==fp; valid_key+=observation_key(payload)==key
    cur.execute("SELECT count(*),count(DISTINCT o.id),count(*)-count(DISTINCT(o.source_observation_id,o.ingest_batch_id,o.fiscal_year,o.source_file_checksum_sha256,o.source_record_locator)) FROM regulatory_source_occurrences o JOIN regulatory_source_observations s ON s.id=o.source_observation_id JOIN discipline_actions d ON d.id=s.discipline_action_id WHERE d.source_system=%s AND d.source_dataset=%s",(SOURCE_SYSTEM,SOURCE_DATASET)); total,distinct,collisions=cur.fetchone(); cur.execute("SELECT o.fiscal_year,count(*) FROM regulatory_source_occurrences o JOIN regulatory_source_observations s ON s.id=o.source_observation_id JOIN discipline_actions d ON d.id=s.discipline_action_id WHERE d.source_system=%s AND d.source_dataset=%s GROUP BY o.fiscal_year",(SOURCE_SYSTEM,SOURCE_DATASET)); fiscal=dict(cur.fetchall())
    return {'observations':len(rows),'distinct_actions':len(actions),'CURRENT':states['CURRENT'],'REVISION_REVIEW_REQUIRED':states['REVISION_REVIEW_REQUIRED'],'SUPERSEDED':states['SUPERSEDED'],'payload_hash_valid':valid_hash,'source_key_valid':valid_key,'occurrences':total,'distinct_occurrences':distinct,'occurrence_collisions':collisions,'fiscal_years':fiscal}

def actual_post_fingerprints(cur,manifest):
    result=current_fingerprints(cur); cohort=relationship_rows(cur,"source_system='fl_dbpr' AND source_dataset='contractor_disc_rf'"); result['recovery_fund_cohort']=legacy.relationship_digest(sorted(cohort,key=lambda r:str(r[0]))); cur.execute("SELECT d.id,o.id,c.id,o.source_observation_key FROM discipline_actions d JOIN regulatory_source_observations o ON o.discipline_action_id=d.id JOIN regulatory_source_occurrences c ON c.source_observation_id=o.id WHERE d.source_system=%s AND d.source_dataset=%s",(SOURCE_SYSTEM,SOURCE_DATASET)); by_action={str(r[0]):tuple(str(v) for v in r) for r in cur.fetchall()}; result['provenance']=digest([by_action[x['discipline_action_id']] for x in manifest['entries']]); ids=[x['ingest_batch_id'] for x in manifest['batches']]; cur.execute("SELECT id,source_system,source_dataset,source_url,source_file,extracted_at,row_count,checksum_sha256 FROM ingest_batches WHERE id=ANY(%s::uuid[])",(ids,)); actual={str(r[0]):r for r in cur.fetchall()}; batches=[]
    for e in manifest['batches']:
        r=actual[e['ingest_batch_id']]; batches.append({'fiscal_year':e['fiscal_year'],'ingest_batch_id':str(r[0]),'source_system':r[1],'source_dataset':r[2],'source_url':r[3],'source_file':r[4],'row_count':r[6],'checksum_sha256':r[7],'downloaded_at':r[5].isoformat()})
    result['batches']=digest(batches); return result

def validate_post_commit_gate(cur,manifest):
    expected_counts={'whole':21420,'licensed':6457,'ula':11691,'recovery_fund':1679,'florida_all':19827,'observations':19827,'occurrences':19827,'batches':61,'arizona':459,'new_jersey':1134,'identity':{'EXACT':1811,'DETERMINISTIC':265,'REVIEW_REQUIRED':1753,'UNRESOLVED':15998},'relationships':{'license_linked':2479,'contractor_linked':0,'neither':17348},'correction':{'true':403,'false':19424},'retraction':{'true':0,'false':19827},'publication':{'INTERNAL':19827,'PUBLIC_ELIGIBLE':0}}
    counts=post_counts(cur); cohort=cohort_invariants(cur); provenance=provenance_invariants(cur); fps=actual_post_fingerprints(cur,manifest)
    if counts!=expected_counts: raise RuntimeError(f"PRE_COMMIT_INVARIANT counts {counts}")
    if cohort!={'rows':1679,'EXACT':75,'DETERMINISTIC':29,'REVIEW_REQUIRED':342,'UNRESOLVED':1233,'license_linked':104,'contractor_linked':0,'INTERNAL':1679,'PUBLIC_ELIGIBLE':0,'correction_true':0,'retraction_true':0}: raise RuntimeError(f"PRE_COMMIT_INVARIANT cohort {cohort}")
    expected_prov={'observations':1679,'distinct_actions':1679,'CURRENT':1679,'REVISION_REVIEW_REQUIRED':0,'SUPERSEDED':0,'payload_hash_valid':1679,'source_key_valid':1679,'occurrences':1679,'distinct_occurrences':1679,'occurrence_collisions':0,'fiscal_years':{'2021-22':548,'2022-23':256,'2023-24':216,'2024-25':647,'2025-26':12}}
    if provenance!=expected_prov: raise RuntimeError(f"PRE_COMMIT_INVARIANT provenance {provenance}")
    if fps!=EXPECTED_POST_FINGERPRINTS: raise RuntimeError(f"PRE_COMMIT_INVARIANT fingerprints {fps}")
    return {'counts':counts,'cohort':cohort,'provenance':provenance,'fingerprints':fps}

def normalized_action(payload):
    r=canonical_source_row(payload,FL_RECOVERY_FUND_FIELDS); return {'claim':r['Claim Nbr'] or None,'license_type':r['License Type'] or None,'license_number':r['License Nbr'] or None,'respondent':r['Respondent Name'],'classification':r['Classification'] or None,'entered':_parse_date(r['Entered Date']) or None,'disposition':r['Disposition'] or None,'disposition_date':_parse_date(r['Disposition Date']) or None,'description':r['Discipline Date - Description'] or None,'violation':r['Violation Code'] or None,'address':r['Address Line 1'] or None,'city':r['City'] or None,'state':r['State'][:2].upper() or None,'postal':r['ZIP Code'] or None,'county':r['County'] or None}

def execute(cur,manifest,source_by_key,Jsonb):
    now=datetime.now(timezone.utc); cur.executemany("INSERT INTO ingest_batches(id,source_system,source_dataset,source_url,source_file,extracted_at,row_count,checksum_sha256,notes) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)",[(b['ingest_batch_id'],SOURCE_SYSTEM,SOURCE_DATASET,b['source_url'],b['source_file'],b['downloaded_at'],b['row_count'],b['checksum_sha256'],f"CTH-FL-STATE-004 Recovery Fund {b['fiscal_year']}") for b in manifest['batches']]);
    if cur.rowcount!=5: raise RuntimeError('batch insert count')
    actions=[]; observations=[]; occurrences=[]; batches={b['ingest_batch_id']:b for b in manifest['batches']}
    for x in manifest['entries']:
        p=source_by_key[x['source_observation_key']]; a=normalized_action(p); observed=batches[x['ingest_batch_id']]['downloaded_at']; evidence={'source_credential_present':True,'contractor_linking_allowed':False,'resolver_method':x['identity_method']}
        actions.append((x['discipline_action_id'],x['license_id'],SOURCE_SYSTEM,SOURCE_DATASET,x['source_observation_key'],a['claim'],a['license_type'],a['license_number'],a['respondent'],a['classification'],a['entered'],a['disposition'],a['disposition_date'],a['description'],a['violation'],a['address'],a['city'],a['state'],a['postal'],a['county'],Jsonb(p),x['ingest_batch_id'],now,x['identity_state'],x['identity_method'],x['resolver_version'],x['resolved_license_external_key'],Jsonb(evidence),now,None if x['license_id'] else x['identity_method']))
        observations.append((x['observation_id'],x['discipline_action_id'],SOURCE_SYSTEM,SOURCE_DATASET,x['source_observation_key'],SOURCE_OBSERVATION_ALGORITHM,x['logical_matter_detail_key'],LOGICAL_MATTER_ALGORITHM,x['row_fingerprint_sha256'],Jsonb(p),observed)); occurrences.append((x['occurrence_id'],x['observation_id'],x['ingest_batch_id'],x['fiscal_year'],x['source_file_checksum'],x['source_record_locator'],source_filename(x['fiscal_year']),source_url(x['fiscal_year']),observed))
    cur.executemany("INSERT INTO discipline_actions(id,contractor_id,license_id,source_system,source_dataset,external_key,complaint_number,license_type,license_number_raw,respondent_name,classification,entered_date,disposition,disposition_date,discipline_description,violation_code,address_line_1,city,state,postal_code,county_name,raw_payload,ingest_batch_id,last_verified_at,identity_state,identity_method,resolver_version,resolved_license_external_key,identity_evidence,identity_evaluated_at,review_reason,publication_state,publication_evidence,publication_evaluated_at,withheld_reason,correction_hold,retraction_hold) VALUES(%s,NULL,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'INTERNAL',NULL,NULL,NULL,FALSE,FALSE)",actions)
    if cur.rowcount!=1679: raise RuntimeError('discipline insert count')
    cur.executemany("INSERT INTO regulatory_source_observations(id,discipline_action_id,source_system,source_dataset,source_observation_key,source_observation_algorithm,logical_matter_detail_key,logical_matter_algorithm,row_fingerprint_sha256,source_payload,revision_state,first_observed_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'CURRENT',%s)",observations)
    if cur.rowcount!=1679: raise RuntimeError('observation insert count')
    cur.executemany("INSERT INTO regulatory_source_occurrences(id,source_observation_id,ingest_batch_id,fiscal_year,source_file_checksum_sha256,source_record_locator,source_file,source_url,observed_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)",occurrences)
    if cur.rowcount!=1679: raise RuntimeError('occurrence insert count')

def main():
    p=argparse.ArgumentParser(); p.add_argument('--raw-dir',type=Path,required=True); p.add_argument('--manifest-output',type=Path,required=True); p.add_argument('--manifest-input',type=Path); p.add_argument('--reverse-output',type=Path,required=True); p.add_argument('--review-output',type=Path,required=True); p.add_argument('--execute',action='store_true'); p.add_argument('--expected-manifest-fingerprint'); p.add_argument('--expected-new-row-count',type=int); p.add_argument('--expected-current-rf-count',type=int); args=p.parse_args()
    inventory,rows=load_sources(args.raw_dir); load_dotenv_files(ROOT/'.env.local',ROOT/'.env'); url=normalize_database_url(os.environ['DATABASE_URL'])
    with psycopg.connect(url,autocommit=False) as conn:
        conn.execute('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'); conn.execute("SET LOCAL statement_timeout='30s'")
        with conn.cursor() as cur:
            baseline=production_baseline(cur); pre=current_fingerprints(cur)
            if pre!=EXPECTED_PRE_FINGERPRINTS: raise RuntimeError(f"PRODUCTION_DRIFT fingerprints {pre}")
            resolver=load_resolver(cur); manifest,analysis=build_manifest(inventory,rows,resolver)
            if args.manifest_input:
                approved=json.loads(args.manifest_input.read_text(encoding='utf-8'))
                manifest=bind_approved_manifest(manifest,approved)
            collisions=validate_ids(cur,manifest); targets=validate_targets(cur,manifest); predicted=predicted_fingerprints(cur,manifest)
        conn.rollback()
    reverse=reverse_manifest(manifest); review={'task':'CTH-FL-STATE-004-ARCH','canonical_main_sha':'9e6e1f84525b1adc6bab46302547a3fa2e575524','source_inventory':inventory,'delta':analysis,'field_contract':list(FL_RECOVERY_FUND_FIELDS),'logical_contract':list(FL_RECOVERY_FUND_LOGICAL_FIELDS),'algorithms':{'source':SOURCE_OBSERVATION_ALGORITHM,'logical':LOGICAL_MATTER_ALGORITHM},'semantic_assertions':semantic_assertions(),'manifest':{'entries':1679,'fingerprint':manifest['manifest_fingerprint'],'batch_ids':[x['ingest_batch_id'] for x in manifest['batches']]},'reverse_manifest_fingerprint':reverse['reverse_manifest_fingerprint'],'collision_checks':collisions,'target_validation':targets,'production_baseline':baseline,'pre_fingerprints':pre,'predicted_post':{'whole':21420,'florida_all':19827,'licensed':6457,'ula':11691,'recovery_fund':1679,'observations':19827,'occurrences':19827,'batches':61,'identity':{'EXACT':1811,'DETERMINISTIC':265,'REVIEW_REQUIRED':1753,'UNRESOLVED':15998},'relationships':{'license_linked':2479,'contractor_linked':0,'neither':17348},'correction':{'true':403,'false':19424},'retraction':{'true':0,'false':19827},'publication':{'INTERNAL':19827,'PUBLIC_ELIGIBLE':0}},'predicted_fingerprints':predicted,'transaction':{'isolation':'REPEATABLE READ','advisory_lock':DATASET_ADVISORY_LOCK,'target_license_locks':49,'lock_timeout':'5s','statement_timeout':'120s','single_transaction':True,'inserts':5042,'updates':0,'deletes':0},'publication_and_scoring':{'public_rows':0,'profile_leakage':False,'discovery_leakage':False,'adverse_history_leakage':False,'gate_on_leakage':False,'scoring_inclusion':False,'ranking_inclusion':False},'production_mutations':0}
    write_json(args.manifest_output,manifest); write_json(args.reverse_output,reverse); write_json(args.review_output,review)
    if not args.execute: return 0
    if args.expected_manifest_fingerprint!=manifest['manifest_fingerprint'] or args.expected_new_row_count!=1679 or args.expected_current_rf_count!=0: raise RuntimeError('EXECUTION_GATE missing or mismatched')
    if predicted!=EXPECTED_POST_FINGERPRINTS: raise RuntimeError('EXECUTION_GATE predicted fingerprints not approved')
    from psycopg.types.json import Jsonb
    source_by_key={observation_key(x['payload']):x['payload'] for x in rows}
    with psycopg.connect(url,autocommit=False) as conn:
        conn.execute('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ'); conn.execute("SET LOCAL lock_timeout='5s'"); conn.execute("SET LOCAL statement_timeout='120s'")
        def operation():
            with conn.cursor() as cur:
                cur.execute('SELECT pg_advisory_xact_lock(hashtext(%s))',(DATASET_ADVISORY_LOCK,)); production_baseline(cur)
                if current_fingerprints(cur)!=EXPECTED_PRE_FINGERPRINTS: raise RuntimeError('PRODUCTION_DRIFT fingerprints')
                validate_ids(cur,manifest); validate_targets(cur,manifest,lock=True); execute(cur,manifest,source_by_key,Jsonb); validate_post_commit_gate(cur,manifest)
        commit_or_rollback(conn,operation)
    return 0

if __name__=='__main__': raise SystemExit(main())
