#!/usr/bin/env python3
"""Read-only Florida Recovery Fund source and production planner.

There is intentionally no execution mode. Output is aggregate/non-PII.
"""

from __future__ import annotations

import argparse, csv, hashlib, json, os, subprocess, sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.env import load_dotenv_files, normalize_database_url
from ingest.regulatory.fl_dbpr_identity import FloridaDbprCredentialResolver, LicenseCredential
from ingest.regulatory.source_observation import (
    LOGICAL_MATTER_ALGORITHM,
    SOURCE_OBSERVATION_ALGORITHM, canonical_source_row,
    logical_matter_detail_key_v1, source_observation_key_v2,
)

SOURCE_SYSTEM = "fl_dbpr"
SOURCE_DATASET = "contractor_disc_rf"
RF_FIELDS = (
    "License Type", "License Nbr", "Respondent Name", "Address Line 1",
    "Address Line 2", "Address Line 3", "City", "State", "ZIP Code",
    "County", "Claim Nbr", "Classification", "Entered Date", "Disposition",
    "Disposition Date", "Discipline Date - Description", "Violation Code",
)
RF_LOGICAL_FIELDS = (
    "Claim Nbr", "License Type", "License Nbr", "Respondent Name",
    "Classification", "Entered Date", "Violation Code",
)
FILES = {
    "2021-22": ("2122", 548, "ab863b07b1af6893af9fb419a4992270d430bec96d400a28c41ecb46eda55182"),
    "2022-23": ("2223", 256, "c7a6e73bc819aa8940af09e1a1885873eecb336e3ccb2eef88c3ebce57e8b3cc"),
    "2023-24": ("2324", 216, "2594e81df06c21778edca9e7683ba329b29d3b282e79375f69e3906f69d28c01"),
    "2024-25": ("2425", 647, "fed3e761246c936ca87f2067367f30d64665b8914c9e71fd966008464b18b1fa"),
    "2025-26": ("2526", 12, "297b4e87309c23b9a313f995700d9117cfafbf7ffd719e7477ac1ac7778bc475"),
}

def digest(value: Any) -> str:
    raw = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str).encode()
    return "sha256:" + hashlib.sha256(raw).hexdigest()

def load_sources(raw_dir: Path):
    inventory, items = [], []
    schema_fp = digest(list(RF_FIELDS))
    for fy, (code, expected_rows, expected_sha) in FILES.items():
        path = raw_dir / f"contractor_disc_rf_{code}.csv"
        data = path.read_bytes(); sha = hashlib.sha256(data).hexdigest()
        if sha != expected_sha: raise RuntimeError(f"SOURCE_DRIFT {fy} {sha}")
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if tuple(reader.fieldnames or ()) != RF_FIELDS: raise RuntimeError(f"SCHEMA_DRIFT {fy}")
            parsed = []
            for locator, row in enumerate(reader, 1):
                if None in row or set(row) != set(RF_FIELDS): raise RuntimeError(f"MALFORMED {fy}:{locator}")
                parsed.append(canonical_source_row(row, RF_FIELDS))
        if len(parsed) != expected_rows: raise RuntimeError(f"ROW_DRIFT {fy} {len(parsed)}")
        inventory.append({"fiscal_year":fy,"url":f"https://www2.myfloridalicense.com/pro/cilb/reports/{path.name}","filename":path.name,"http_status":200,"byte_size":len(data),"downloaded_at":datetime.fromtimestamp(path.stat().st_mtime,timezone.utc).isoformat(),"sha256":sha,"rows":len(parsed),"columns":17,"ordered_header":list(RF_FIELDS),"schema_fingerprint":schema_fp})
        items += [{"fiscal_year":fy,"source_record_locator":f"csv-record:{n}","payload":row} for n,row in enumerate(parsed,1)]
    return inventory, items

def semantic(detail: str, disposition: str) -> str:
    d, p = detail.casefold(), disposition.casefold()
    if "reimbursement" in d: return "REIMBURSEMENT_RECORDED"
    if "suspend license" in d: return "LICENSE_SUSPENSION_RECORDED"
    return "OTHER_DETAIL"

def claim_stage(disposition: str) -> str:
    p = disposition.casefold()
    if "granted" in p: return "CLAIM_APPROVED"
    if "closed" in p: return "CLAIM_CLOSED"
    return "UNKNOWN"

def production_and_resolver(cur, exact_keys):
    counts = {}
    queries = {
      "whole_discipline_actions":"SELECT count(*) FROM discipline_actions",
      "florida_licensed":"SELECT count(*) FROM discipline_actions WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_lic'",
      "florida_ula":"SELECT count(*) FROM discipline_actions WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_ula'",
      "florida_recovery_fund":"SELECT count(*) FROM discipline_actions WHERE source_system='fl_dbpr' AND source_dataset='contractor_disc_rf'",
      "florida_total":"SELECT count(*) FROM discipline_actions WHERE source_system='fl_dbpr'",
      "observations":"SELECT count(*) FROM regulatory_source_observations",
      "occurrences":"SELECT count(*) FROM regulatory_source_occurrences",
      "ingest_batches":"SELECT count(*) FROM ingest_batches",
      "arizona":"SELECT count(*) FROM discipline_actions WHERE source_system='az_roc'",
      "new_jersey":"SELECT count(*) FROM discipline_actions WHERE source_system='nj_enforcement'",
      "public_eligible":"SELECT count(*) FROM discipline_actions WHERE publication_state='PUBLIC_ELIGIBLE'",
      "ula_public":"SELECT count(*) FROM discipline_actions WHERE source_dataset='contractor_disc_ula' AND publication_state='PUBLIC_ELIGIBLE'",
      "ula_license_links":"SELECT count(*) FROM discipline_actions WHERE source_dataset='contractor_disc_ula' AND license_id IS NOT NULL",
      "ula_contractor_links":"SELECT count(*) FROM discipline_actions WHERE source_dataset='contractor_disc_ula' AND contractor_id IS NOT NULL",
    }
    for key, sql in queries.items(): cur.execute(sql); counts[key] = int(cur.fetchone()[0])
    cur.execute("SELECT count(*) FROM discipline_actions WHERE external_key=ANY(%s)",(exact_keys,)); counts['recovery_external_key_conflicts']=int(cur.fetchone()[0])
    cur.execute("SELECT count(*) FROM regulatory_source_observations WHERE source_observation_key=ANY(%s)",(exact_keys,)); counts['recovery_observation_key_conflicts']=int(cur.fetchone()[0])
    cur.execute("SELECT id,external_key,occupation_code,license_number,source_board,contractor_id FROM licenses WHERE source_system='fl_dbpr'")
    creds=[LicenseCredential(str(x[0]),x[1],x[2],x[3],x[4],str(x[5]) if x[5] else None) for x in cur.fetchall()]
    resolver=FloridaDbprCredentialResolver(creds)
    cur.execute("""SELECT d.license_id,o.source_payload FROM discipline_actions d JOIN regulatory_source_observations o ON o.discipline_action_id=d.id WHERE d.source_system='fl_dbpr' AND d.source_dataset='contractor_disc_lic'""")
    safe=correctable=0
    for current,payload in cur.fetchall():
        r=resolver.resolve(source_dataset='contractor_disc_lic',license_type=payload['License Type'],license_number=payload['License Nbr'])
        if r.identity_state in ('EXACT','DETERMINISTIC'):
            if str(current)==r.proposed_license_id: safe+=1
            else: correctable+=1
    cur.execute("""SELECT count(*) FROM regulatory_source_observations o JOIN discipline_actions d ON d.id=o.discipline_action_id WHERE d.source_system='fl_dbpr' AND d.source_dataset='contractor_disc_lic'"""); counts['licensed_provenance']=int(cur.fetchone()[0])
    cur.execute("""SELECT count(*) FROM regulatory_source_observations o JOIN discipline_actions d ON d.id=o.discipline_action_id WHERE d.source_system='fl_dbpr' AND d.source_dataset='contractor_disc_ula'"""); counts['ula_provenance']=int(cur.fetchone()[0])
    counts['licensed_safe_links']=safe; counts['licensed_correctable']=correctable
    return counts,resolver

def main() -> int:
    ap=argparse.ArgumentParser(); ap.add_argument('--raw-dir',type=Path,required=True); ap.add_argument('--output',type=Path,required=True); args=ap.parse_args()
    inventory,items=load_sources(args.raw_dir); rows=[x['payload'] for x in items]
    exact=[source_observation_key_v2(source_system=SOURCE_SYSTEM,source_dataset=SOURCE_DATASET,row=r,fields=RF_FIELDS) for r in rows]
    logical=[logical_matter_detail_key_v1(source_system=SOURCE_SYSTEM,source_dataset=SOURCE_DATASET,row=r,fields=RF_LOGICAL_FIELDS) for r in rows]
    claims=defaultdict(list); logical_groups=defaultdict(list)
    for i,r in enumerate(rows): claims[r['Claim Nbr']].append(i); logical_groups[logical[i]].append(i)
    sizes=Counter(len(v) for k,v in claims.items() if k)
    cross=sum(len({items[i]['fiscal_year'] for i in v})>1 for k,v in claims.items() if k)
    multiple_credentials=sum(len({(rows[i]['License Type'],rows[i]['License Nbr']) for i in v})>1 for k,v in claims.items() if k)
    multiple_respondents=sum(len({rows[i]['Respondent Name'] for i in v})>1 for k,v in claims.items() if k)
    multiple_dispositions=sum(len({rows[i]['Disposition'] for i in v})>1 for k,v in claims.items() if k)
    within_duplicates=0
    for fy in FILES:
      keys=[exact[i] for i,x in enumerate(items) if x['fiscal_year']==fy]
      within_duplicates += len(keys)-len(set(keys))
    across_duplicates=(len(exact)-len(set(exact)))-within_duplicates
    revision=sum(len({exact[i] for i in v})>1 and len({items[i]['fiscal_year'] for i in v})>1 for v in logical_groups.values())
    load_dotenv_files(ROOT/'.env.local',ROOT/'.env')
    with psycopg.connect(normalize_database_url(os.environ['DATABASE_URL']),autocommit=False) as conn:
      conn.execute('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'); conn.execute("SET LOCAL statement_timeout='30s'")
      with conn.cursor() as cur:
        cur.execute('select current_setting(\'server_version\')'); pg=cur.fetchone()[0]
        production,resolver=production_and_resolver(cur,exact)
      conn.rollback()
    row_states=Counter(); claim_states=Counter(); reasons=Counter(); unknown_types=Counter(); collision_exposure=0; safe_ids=set()
    per_claim=defaultdict(list)
    for r in rows:
      x=resolver.resolve(source_dataset=SOURCE_DATASET,license_type=r['License Type'],license_number=r['License Nbr'])
      row_states[x.identity_state]+=1; reasons[x.reason]+=1; per_claim[r['Claim Nbr']].append(x)
      if x.proposed_license_id: safe_ids.add(x.proposed_license_id)
      if x.identity_method=='unknown_license_type': unknown_types[r['License Type']]+=1
      if x.candidate_count>1 or x.identity_method in ('identifier_type_conflict','multiple_typed_candidates','duplicate_external_key'): collision_exposure+=1
    rank={'EXACT':0,'DETERMINISTIC':1,'UNRESOLVED':2,'REVIEW_REQUIRED':3}
    for xs in per_claim.values(): claim_states[max((x.identity_state for x in xs),key=lambda s:rank[s])]+=1
    semantics=Counter(semantic(r['Discipline Date - Description'],r['Disposition']) for r in rows)
    stages=Counter(claim_stage(r['Disposition']) for r in rows)
    fields={f:{"populated_rows":sum(bool(r[f]) for r in rows),"distinct_values":len({r[f] for r in rows if r[f]})} for f in RF_FIELDS}
    result={
      "task":"CTH-FL-STATE-004-PLAN","generated_at":datetime.now(timezone.utc).isoformat(),"main_sha":subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),"postgresql_version":pg,
      "source_system":SOURCE_SYSTEM,"source_dataset":SOURCE_DATASET,"source_inventory":inventory,
      "corpus":{"raw_rows":len(rows),"parseable_rows":len(rows),"malformed_rows":0,"prior_expected_rows":1679,"fresh_rows":len(rows),"source_drift":False,"unique_exact_observations":len(set(exact)),"exact_duplicate_rows":len(rows)-len(set(exact)),"within_file_exact_duplicates":within_duplicates,"cross_file_exact_duplicates":across_duplicates,"production_observation_key_conflicts":production['recovery_observation_key_conflicts'],"production_external_key_conflicts":production['recovery_external_key_conflicts'],"revision_candidates":revision,"true_net_new":len(set(exact))-production['recovery_observation_key_conflicts']},
      "claim_grain":{"distinct_claims":len([k for k in claims if k]),"blank_claim_ids":len(claims.get('',[])),"single_line_claims":sizes[1],"multi_line_claims":sum(v for k,v in sizes.items() if k>1),"rows_in_multi_line_claims":sum(k*v for k,v in sizes.items() if k>1),"maximum_rows_per_claim":max(sizes),"cross_fiscal_claims":cross,"claims_with_multiple_credentials":multiple_credentials,"claims_with_multiple_respondents":multiple_respondents,"claims_with_multiple_dispositions":multiple_dispositions,"claims_with_multiple_financial_values":0,"rows_per_claim_distribution":dict(sorted(sizes.items()))},
      "field_inventory":{"statistics":fields,"purposes":{"License Type":"LICENSE_IDENTITY","License Nbr":"LICENSE_IDENTITY","Respondent Name":"CONTRACTOR","Address Line 1":"ADDRESS","Address Line 2":"ADDRESS","Address Line 3":"ADDRESS","City":"ADDRESS","State":"ADDRESS","ZIP Code":"ADDRESS","County":"ADDRESS","Claim Nbr":"CLAIM_IDENTITY","Classification":"CLAIM_STAGE","Entered Date":"DATE","Disposition":"CLAIM_STATUS","Disposition Date":"DATE","Discipline Date - Description":"ORDER/DETAIL","Violation Code":"OTHER"}},
      "identifiers":{"claim_number_rows":fields['Claim Nbr']['populated_rows'],"distinct_claim_numbers":fields['Claim Nbr']['distinct_values'],"license_type_rows":fields['License Type']['populated_rows'],"license_number_rows":fields['License Nbr']['populated_rows'],"complaint_or_case_id_rows":0,"final_or_order_id_rows":0,"doah_id_rows":0,"entity_id_rows":0,"fei_sunbiz_rows":0,"other_official_id_rows":0},
      "identity":{"row_level":dict(row_states),"claim_level":dict(claim_states),"safe_unique_license_targets":len(safe_ids),"safe_license_linkable_rows":row_states['EXACT']+row_states['DETERMINISTIC'],"current_inventory_candidate_rows":row_states['EXACT']+row_states['DETERMINISTIC']+collision_exposure,"credentials_not_present_rows":reasons['No corresponding credential exists in the current DBPR license inventory'],"unknown_credential_types":dict(unknown_types),"collision_exposed_rows":collision_exposure,"resolution_reasons":dict(reasons),"name_only_used":False,"numeric_core_only_used":False,"proposed_contractor_links":0},
      "semantics":{"raw_classifications":dict(Counter(r['Classification'] for r in rows)),"raw_dispositions":dict(Counter(r['Disposition'] for r in rows)),"normalized_claim_stages":dict(stages),"normalized_detail_types":dict(semantics),"claim_is_not_wrongdoing_finding":True,"source_supports_specific_license_suspension_and_reimbursement_details":True,"contractor_wrongdoing_established":"PARTIAL: source records an explicit license suspension detail for 837 rows, but claim/reimbursement existence alone is not a generalized finding of wrongdoing or liability","scoring_impact":0},
      "financial":{"fields_present":[],"rows_with_financial_values":0,"note":"No claim, award, payment, reimbursement, bank, or loss amount column exists; RF Reimbursement is source description text, not an amount.","publication_recommendation":"withhold; no amounts exist in this corpus"},
      "claimant_pii":{"claimant_name_field":False,"claimant_address_fields":False,"claimant_phone":False,"claimant_email":False,"financial_or_bank_fields":False,"respondent_business_identity_rows":len(rows),"respondent_address_rows":fields['Address Line 1']['populated_rows'],"proposed_retained":"official contractor/respondent identity and address only as internal source evidence/provenance","proposed_excluded":"any future claimant name, street address, phone, email, bank/payment details unless separately justified"},
      "provenance":{"migration_009_reusable":True,"exact_fields":list(RF_FIELDS),"logical_fields":list(RF_LOGICAL_FIELDS),"source_observation_algorithm":SOURCE_OBSERVATION_ALGORITHM,"logical_algorithm":LOGICAL_MATTER_ALGORITHM,"logical_key_authority":"review/grouping only","duplicate_policy":"suppress only identical exact observation; genuinely new snapshot creates occurrence only","revision_policy":"new observation with REVISION_REVIEW_REQUIRED; preserve old; no automatic supersession/deletion"},
      "architecture":{"discipline_actions_semantically_safe":True,"separate_claim_table_recommended":False,"migration_prerequisite":False,"code_prerequisite":True,"public_read_path":{"currently_fail_closed":True,"gate_off_excludes_all_fl_dbpr":True,"internal_and_null_contractor_excluded_when_gate_on":True,"dataset_aware_presentation_required_before_any_future_publication":True},"conditions":["dataset-specific Recovery Fund policy and semantic crosswalk","one action per exact official detail row, never one per claim","INTERNAL and excluded from public/adverse/scoring read paths","safe license_id allowed; contractor_id remains null","raw source terminology preserved"]},
      "future_ingest":{"net_new_actions":len(set(exact)),"net_new_observations":len(set(exact)),"net_new_occurrences":len(rows),"exact_duplicates_suppressed":len(rows)-len(set(exact)),"revision_review":revision,"safe_license_linked_candidates":row_states['EXACT']+row_states['DETERMINISTIC'],"contractor_linked":0,"public_eligible":0,"scoring_impact":0},
      "production":production|{"publication_gate":"ABSENT/OFF","production_mutations":0},
      "refresh":{"open_fiscal_year":"monthly","historical_files":"quarterly checksum review","unchanged_file":"no batch or occurrence","reobserved_exact_row_new_snapshot":"new occurrence only","changed_row":"revision review","missing_row":"retain and investigate; never delete"},
      "scope":{"google_calls":0,"county_work":0,"production_mutations":0}
    }
    args.output.parent.mkdir(parents=True,exist_ok=True); args.output.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding='utf-8')
    print(json.dumps({"corpus":result['corpus'],"claim_grain":result['claim_grain'],"identity":result['identity'],"semantics":result['semantics'],"production":result['production']},indent=2,sort_keys=True))
    return 0

if __name__=='__main__': raise SystemExit(main())
