-- SEO-PATTERN-002 Oregon dedupe: extra synthetic Oregon rows, loaded AFTER
-- synthetic_schema.sql into the same disposable loopback database.
-- Synthetic rows only; never run against a shared or Production database.
--
-- Mirrors the Production shape: ingest/adapters/or_ccb.py writes one contractor
-- profile per (CCB license number, endorsement), external_key OR-CCB:<number>:<code>.
--
-- License SYNOR1000  Multnomah, 3 published endorsement profiles (RGC, CGC2, LBPR)
--                    + 1 thin profile (RSC, never published) + public discipline on the LBPR profile
-- License SYNOR1001  Multnomah, CGC1 + CGC2 (two codes inside one trade family)
-- License SYNOR1002  Multnomah RGC  } identity collision: different license numbers,
-- License SYNOR1003  Multnomah RGC  } identical name -> must stay two entries
-- License SYNOR1004  Multnomah RSC  } legitimate multiple licenses: same holder name/address,
-- License SYNOR1005  Multnomah RSC  } two CCB numbers -> two entries
-- License SYNOR2000  Out of State (WA mailing), RGC + RSC
-- License SYNOR3000  RGC profile in Multnomah, CSC2 profile in Washington County (county attribution per profile)
-- (blank)            two Multnomah RLC profiles with no license number -> never merged
INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile) VALUES
 ('00000000-0000-4000-8000-00000000d001','or-ccb-synor1000-rgc-synthetic-multi','Synthetic Multi Endorsement LLC','Synthetic Multi Endorsement LLC','OR','Portland','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d002','or-ccb-synor1000-cgc2-synthetic-multi','Synthetic Multi Endorsement LLC','Synthetic Multi Endorsement LLC','OR','Portland','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d003','or-ccb-synor1000-lbpr-synthetic-multi','Synthetic Multi Endorsement RMI','Synthetic Multi Endorsement LLC','OR','Portland','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d004','or-ccb-synor1000-rsc-synthetic-multi','Synthetic Multi Endorsement LLC','Synthetic Multi Endorsement LLC','OR','Portland','Multnomah',true),
 ('00000000-0000-4000-8000-00000000d011','or-ccb-synor1001-cgc1-synthetic-commercial-pair','Synthetic Commercial Pair Inc','Synthetic Commercial Pair Inc','OR','Gresham','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d012','or-ccb-synor1001-cgc2-synthetic-commercial-pair','Synthetic Commercial Pair Inc','Synthetic Commercial Pair Inc','OR','Gresham','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d021','or-ccb-synor1002-rgc-synthetic-same-name','Synthetic Same Name Builders LLC','Synthetic Same Name Builders LLC','OR','Portland','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d022','or-ccb-synor1003-rgc-synthetic-same-name','Synthetic Same Name Builders LLC','Synthetic Same Name Builders LLC','OR','Troutdale','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d031','or-ccb-synor1004-rsc-synthetic-two-licenses','Synthetic Two Licenses Co','Synthetic Two Licenses Co','OR','Portland','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d032','or-ccb-synor1005-rsc-synthetic-two-licenses','Synthetic Two Licenses Co','Synthetic Two Licenses Co','OR','Portland','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d041','or-ccb-synor2000-rgc-synthetic-mailing','Synthetic Mailing Builder LLC','Synthetic Mailing Builder LLC','WA','Vancouver',NULL,false),
 ('00000000-0000-4000-8000-00000000d042','or-ccb-synor2000-rsc-synthetic-mailing','Synthetic Mailing Builder LLC','Synthetic Mailing Builder LLC','WA','Vancouver',NULL,false),
 ('00000000-0000-4000-8000-00000000d051','or-ccb-synor3000-rgc-synthetic-two-county','Synthetic Two County LLC','Synthetic Two County LLC','OR','Portland','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d052','or-ccb-synor3000-csc2-synthetic-two-county','Synthetic Two County LLC','Synthetic Two County LLC','OR','Hillsboro','Washington',false),
 ('00000000-0000-4000-8000-00000000d061','or-ccb-blank-a-synthetic-no-number','Synthetic No Number LLC','Synthetic No Number LLC','OR','Portland','Multnomah',false),
 ('00000000-0000-4000-8000-00000000d062','or-ccb-blank-b-synthetic-no-number','Synthetic No Number LLC','Synthetic No Number LLC','OR','Portland','Multnomah',false);

INSERT INTO licenses_t (id, contractor_id, source_system, external_key, occupation_code, license_number, status_normalized, primary_status, original_licensure_date, city, state, postal_code, county_name, county_code, last_verified_at) VALUES
 ('10000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d001','or_ccb','OR-CCB:SYNOR1000:RGC','RGC','SYNOR1000','active','Active','2010-01-01','Portland','OR','97201','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d002','or_ccb','OR-CCB:SYNOR1000:CGC2','CGC2','SYNOR1000','active','Active','2010-01-01','Portland','OR','97201','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d003','00000000-0000-4000-8000-00000000d003','or_ccb','OR-CCB:SYNOR1000:LBPR','LBPR','SYNOR1000','active','Active','2012-01-01','Portland','OR','97201','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d004','00000000-0000-4000-8000-00000000d004','or_ccb','OR-CCB:SYNOR1000:RSC','RSC','SYNOR1000','active','Active','2012-01-01','Portland','OR','97201','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d011','00000000-0000-4000-8000-00000000d011','or_ccb','OR-CCB:SYNOR1001:CGC1','CGC1','SYNOR1001','active','Active','2015-01-01','Gresham','OR','97030','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d012','00000000-0000-4000-8000-00000000d012','or_ccb','OR-CCB:SYNOR1001:CGC2','CGC2','SYNOR1001','active','Active','2015-01-01','Gresham','OR','97030','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d021','00000000-0000-4000-8000-00000000d021','or_ccb','OR-CCB:SYNOR1002:RGC','RGC','SYNOR1002','active','Active','2016-01-01','Portland','OR','97202','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d022','00000000-0000-4000-8000-00000000d022','or_ccb','OR-CCB:SYNOR1003:RGC','RGC','SYNOR1003','active','Active','2017-01-01','Troutdale','OR','97060','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d031','00000000-0000-4000-8000-00000000d031','or_ccb','OR-CCB:SYNOR1004:RSC','RSC','SYNOR1004','active','Active','2018-01-01','Portland','OR','97203','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d032','00000000-0000-4000-8000-00000000d032','or_ccb','OR-CCB:SYNOR1005:RSC','RSC','SYNOR1005','active','Active','2019-01-01','Portland','OR','97203','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d041','00000000-0000-4000-8000-00000000d041','or_ccb','OR-CCB:SYNOR2000:RGC','RGC','SYNOR2000','active','Active','2013-01-01','Vancouver','WA','98660','Out of State','',now()),
 ('10000000-0000-4000-8000-00000000d042','00000000-0000-4000-8000-00000000d042','or_ccb','OR-CCB:SYNOR2000:RSC','RSC','SYNOR2000','active','Active','2013-01-01','Vancouver','WA','98660','Out of State','',now()),
 ('10000000-0000-4000-8000-00000000d051','00000000-0000-4000-8000-00000000d051','or_ccb','OR-CCB:SYNOR3000:RGC','RGC','SYNOR3000','active','Active','2014-01-01','Portland','OR','97204','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d052','00000000-0000-4000-8000-00000000d052','or_ccb','OR-CCB:SYNOR3000:CSC2','CSC2','SYNOR3000','active','Active','2014-01-01','Hillsboro','OR','97123','Washington','34',now()),
 ('10000000-0000-4000-8000-00000000d061','00000000-0000-4000-8000-00000000d061','or_ccb','OR-CCB::RLC:a','RLC',NULL,'active','Active','2020-01-01','Portland','OR','97205','Multnomah','26',now()),
 ('10000000-0000-4000-8000-00000000d062','00000000-0000-4000-8000-00000000d062','or_ccb','OR-CCB::RLC:b','RLC','','active','Active','2020-01-01','Portland','OR','97205','Multnomah','26',now());

-- Public (non-Florida source) discipline on the LBPR profile only: the deduplicated
-- SYNOR1000 card must still carry it whichever endorsement profile represents it.
INSERT INTO discipline_actions (id, contractor_id, license_id, source_system, source_dataset, external_key) VALUES
 ('20000000-0000-4000-8000-00000000d003','00000000-0000-4000-8000-00000000d003','10000000-0000-4000-8000-00000000d003','or_ccb','synthetic','SYN-OR-DISC-1');
