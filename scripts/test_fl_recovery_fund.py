from __future__ import annotations

import copy, json, unittest
from collections import Counter
from pathlib import Path
from unittest.mock import patch

from ingest.regulatory.fl_dbpr_recovery_fund import (
    CONTRACTOR_LINKING_ALLOWED, PUBLICATION_STATE, SCORING_IMPACT,
    claim_stage, detail_type, refresh_decision, semantic_assertions,
)
from ingest.regulatory.source_observation import (
    FL_DISCIPLINE_FIELDS, FL_LOGICAL_MATTER_FIELDS,
    FL_RECOVERY_FUND_FIELDS, FL_RECOVERY_FUND_LOGICAL_FIELDS,
    FL_ULA_FIELDS, FL_ULA_LOGICAL_MATTER_FIELDS, classify_observation,
)
from scripts import ingest_fl_recovery_fund as executor


class FloridaRecoveryFundTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root=executor.ROOT/'artifacts'
        cls.manifest=json.loads((root/'cth-fl-state-004-recovery-fund-execution-manifest.json').read_text())
        cls.reverse=json.loads((root/'cth-fl-state-004-recovery-fund-reverse-manifest.json').read_text())
        cls.review=json.loads((root/'cth-fl-state-004-recovery-fund-architecture-review.json').read_text())

    def test_field_contract_and_existing_contracts(self):
        self.assertEqual(17,len(FL_DISCIPLINE_FIELDS)); self.assertEqual(7,len(FL_LOGICAL_MATTER_FIELDS))
        self.assertEqual(16,len(FL_ULA_FIELDS)); self.assertEqual(6,len(FL_ULA_LOGICAL_MATTER_FIELDS))
        self.assertEqual(17,len(FL_RECOVERY_FUND_FIELDS))
        self.assertEqual(('Claim Nbr','License Type','License Nbr','Respondent Name','Classification','Entered Date','Violation Code'),FL_RECOVERY_FUND_LOGICAL_FIELDS)

    def test_manifest_fingerprint_scope_and_identity(self):
        core={k:self.manifest[k] for k in ('manifest_version','source_system','source_dataset','source_files','batches','entries')}
        self.assertEqual(executor.digest(core),self.manifest['manifest_fingerprint'])
        self.assertEqual(1679,len(self.manifest['entries']))
        allowed={'fiscal_year','source_file_checksum','source_record_locator','source_observation_key','row_fingerprint_sha256','logical_matter_detail_key','claim_semantic_category','detail_semantic_category','identity_state','identity_method','resolver_version','discipline_action_id','observation_id','occurrence_id','ingest_batch_id','license_id','resolved_license_external_key'}
        self.assertTrue(all(set(x)==allowed for x in self.manifest['entries']))
        self.assertEqual(executor.EXPECTED_IDENTITY,dict(Counter(x['identity_state'] for x in self.manifest['entries'])))
        self.assertEqual(104,sum(x['license_id'] is not None for x in self.manifest['entries']))
        self.assertEqual(1575,sum(x['license_id'] is None for x in self.manifest['entries']))
        self.assertEqual(49,len({x['license_id'] for x in self.manifest['entries'] if x['license_id']}))
        for key in ('source_observation_key','discipline_action_id','observation_id','occurrence_id'):
            self.assertEqual(1679,len({x[key] for x in self.manifest['entries']}))

    def test_reverse_manifest(self):
        core={k:self.reverse[k] for k in ('execution_manifest_fingerprint','source_checksums','batch_ids','discipline_action_ids','observation_ids','occurrence_ids')}
        self.assertEqual(executor.digest(core),self.reverse['reverse_manifest_fingerprint'])
        self.assertEqual([5,1679,1679,1679],[len(self.reverse[k]) for k in ('batch_ids','discipline_action_ids','observation_ids','occurrence_ids')])
        self.assertFalse(self.reverse['automatic_rollback_authorized'])

    def test_timestamp_only_drift_binds_approved_manifest_before_prediction(self):
        generated=copy.deepcopy(self.manifest)
        for item in generated['source_files']:
            item['downloaded_at']='2099-01-01T00:00:00+00:00'
        for item in generated['batches']:
            item['downloaded_at']='2099-01-01T00:00:00+00:00'
        generated_core={k:generated[k] for k in ('manifest_version','source_system','source_dataset','source_files','batches','entries')}
        generated['manifest_fingerprint']=executor.digest(generated_core)
        bound=executor.bind_approved_manifest(generated,self.manifest)
        self.assertIs(bound,self.manifest)
        self.assertEqual(executor.EXPECTED_POST_FINGERPRINTS['batches'],executor.digest(bound['batches']))
        self.assertEqual(self.reverse,executor.reverse_manifest(bound))
        source=Path(executor.__file__).read_text(encoding='utf-8')
        main=source[source.index('def main():'):]
        self.assertLess(main.index('manifest=bind_approved_manifest'),main.index('collisions=validate_ids'))
        self.assertLess(main.index('manifest=bind_approved_manifest'),main.index('predicted=predicted_fingerprints'))

    def test_approved_scope_rejects_real_source_drift(self):
        changed=copy.deepcopy(self.manifest)
        changed['source_files'][0]['sha256']='0'*64
        with self.assertRaisesRegex(RuntimeError,'MANIFEST_DRIFT approved execution scope differs'):
            executor.bind_approved_manifest(changed,self.manifest)
        changed=copy.deepcopy(self.manifest)
        changed['source_files'][0]['schema_fingerprint']='sha256:'+'0'*64
        with self.assertRaisesRegex(RuntimeError,'MANIFEST_DRIFT approved execution scope differs'):
            executor.bind_approved_manifest(changed,self.manifest)

    def test_semantic_fixtures_and_no_inference(self):
        self.assertEqual('CLAIM_APPROVED',claim_stage('RF Claim Granted'))
        self.assertEqual('CLAIM_CLOSED',claim_stage('RF Claim Closed'))
        self.assertEqual('UNKNOWN',claim_stage(''))
        self.assertEqual('REIMBURSEMENT_RECORDED',detail_type('01/01/2026 - RF Reimbursement'))
        self.assertEqual('LICENSE_SUSPENSION_RECORDED',detail_type('01/01/2026 - Suspend License'))
        self.assertEqual('OTHER_DETAIL',detail_type('Other official detail'))
        self.assertEqual({'generalized_wrongdoing':False,'liability_inferred':False,'consumer_loss_inferred':False,'payment_or_amount_inferred':False,'scoring_impact':0},semantic_assertions())
        self.assertEqual(0,SCORING_IMPACT); self.assertFalse(CONTRACTOR_LINKING_ALLOWED); self.assertEqual('INTERNAL',PUBLICATION_STATE)

    def test_claim_detail_and_refresh_contract(self):
        base={f:'' for f in FL_RECOVERY_FUND_FIELDS}; base.update({'Claim Nbr':'RF1','License Type':'Certified General Contractor','License Nbr':'CGC1','Respondent Name':'Example','Classification':'Recovery Fund','Entered Date':'01/01/2025','Disposition':'RF Claim Granted','Discipline Date - Description':'01/02/2025 - RF Reimbursement'})
        changed=dict(base,**{'Discipline Date - Description':'01/02/2025 - Suspend License'})
        self.assertNotEqual(executor.observation_key(base),executor.observation_key(changed))
        self.assertEqual(executor.logical_key(base),executor.logical_key(changed))
        self.assertEqual('EXACT_REOBSERVATION',classify_observation(exact_observation_exists=True,logical_group_exists=True))
        self.assertEqual('NOOP_UNCHANGED_SNAPSHOT',refresh_decision(unchanged_snapshot_exists=True,exact_observation_exists=True,logical_group_exists=True))
        self.assertEqual('NEW_OCCURRENCE_ONLY',refresh_decision(unchanged_snapshot_exists=False,exact_observation_exists=True,logical_group_exists=True))
        self.assertEqual('REVISION_REVIEW_REQUIRED',refresh_decision(unchanged_snapshot_exists=False,exact_observation_exists=False,logical_group_exists=True))

    def test_executor_is_opt_in_insert_only_and_locked(self):
        source=Path(executor.__file__).read_text(encoding='utf-8'); lower=source.lower()
        self.assertIn('add_argument(\'--execute\',action=\'store_true\')',source)
        for forbidden in ('update discipline_actions','update regulatory_source_observations','update regulatory_source_occurrences','delete from','on conflict'):
            self.assertNotIn(forbidden,lower)
        self.assertIn('pg_advisory_xact_lock(hashtext(%s))',source); self.assertIn('FOR KEY SHARE',source)
        self.assertIn("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ",source)
        self.assertNotIn('load_fl_dbpr_to_postgres',source)
        self.assertIn('validate_post_commit_gate(cur,manifest)',source)

    def test_precommit_contract_and_rollback(self):
        expected_counts={'whole':21420,'licensed':6457,'ula':11691,'recovery_fund':1679,'florida_all':19827,'observations':19827,'occurrences':19827,'batches':61,'arizona':459,'new_jersey':1134,'identity':{'EXACT':1811,'DETERMINISTIC':265,'REVIEW_REQUIRED':1753,'UNRESOLVED':15998},'relationships':{'license_linked':2479,'contractor_linked':0,'neither':17348},'correction':{'true':403,'false':19424},'retraction':{'true':0,'false':19827},'publication':{'INTERNAL':19827,'PUBLIC_ELIGIBLE':0}}
        cohort={'rows':1679,'EXACT':75,'DETERMINISTIC':29,'REVIEW_REQUIRED':342,'UNRESOLVED':1233,'license_linked':104,'contractor_linked':0,'INTERNAL':1679,'PUBLIC_ELIGIBLE':0,'correction_true':0,'retraction_true':0}
        provenance={'observations':1679,'distinct_actions':1679,'CURRENT':1679,'REVISION_REVIEW_REQUIRED':0,'SUPERSEDED':0,'payload_hash_valid':1679,'source_key_valid':1679,'occurrences':1679,'distinct_occurrences':1679,'occurrence_collisions':0,'fiscal_years':{'2021-22':548,'2022-23':256,'2023-24':216,'2024-25':647,'2025-26':12}}
        class Conn:
            commits=0; rollbacks=0
            def commit(self): self.commits+=1
            def rollback(self): self.rollbacks+=1
        conn=Conn()
        with patch.object(executor,'post_counts',return_value=expected_counts),patch.object(executor,'cohort_invariants',return_value=cohort),patch.object(executor,'provenance_invariants',return_value=provenance),patch.object(executor,'actual_post_fingerprints',return_value={**executor.EXPECTED_POST_FINGERPRINTS,'whole':'bad'}):
            with self.assertRaisesRegex(RuntimeError,'PRE_COMMIT_INVARIANT fingerprints'):
                executor.commit_or_rollback(conn,lambda:executor.validate_post_commit_gate(object(),self.manifest))
        self.assertEqual(0,conn.commits); self.assertEqual(1,conn.rollbacks)

    def test_public_and_scoring_fail_closed(self):
        publication=(executor.ROOT/'lib/regulatory/publication.ts').read_text()
        self.assertIn("d.publication_state = 'PUBLIC_ELIGIBLE'",publication); self.assertIn('d.contractor_id IS NOT NULL',publication)
        result=self.review['publication_and_scoring']
        self.assertEqual({'public_rows':0,'profile_leakage':False,'discovery_leakage':False,'adverse_history_leakage':False,'gate_on_leakage':False,'scoring_inclusion':False,'ranking_inclusion':False},result)
        application='\n'.join(p.read_text(errors='ignore') for root in ('app','lib') for p in (executor.ROOT/root).rglob('*') if p.is_file())
        self.assertNotIn('contractor_disc_rf',application)


if __name__=='__main__': unittest.main()
