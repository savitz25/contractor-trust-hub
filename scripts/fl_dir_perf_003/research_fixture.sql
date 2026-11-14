-- FL-DIR-PERF-003 disposable LOCAL fixture (apply on top of scripts/fl_dir_perf_001/synthetic_schema.sql).
-- Synthetic rows only; never run against a shared database.
-- Gives each county research page (Broward 16, Miami-Dade 23, Palm Beach 60, Pinellas 62) live DBPR
-- county_code counts so its research snapshot is complete (statewide comparison + "What stands out").
UPDATE licenses_t SET county_code = '16' WHERE county_name = 'Broward';
UPDATE licenses_t SET county_code = '23' WHERE county_name = 'Miami-Dade';
INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county) VALUES
 ('00000000-0000-4000-8000-000000000101','synthetic-research-pb-1','Synthetic Research PB One LLC','Synthetic Research PB One LLC','FL','Boca Raton','Palm Beach'),
 ('00000000-0000-4000-8000-000000000102','synthetic-research-pb-2','Synthetic Research PB Two LLC','Synthetic Research PB Two LLC','FL','Jupiter','Palm Beach'),
 ('00000000-0000-4000-8000-000000000103','synthetic-research-pi-1','Synthetic Research PI One LLC','Synthetic Research PI One LLC','FL','Clearwater','Pinellas'),
 ('00000000-0000-4000-8000-000000000104','synthetic-research-pi-2','Synthetic Research PI Two LLC','Synthetic Research PI Two LLC','FL','Largo','Pinellas');
INSERT INTO licenses_t (id, contractor_id, source_system, external_key, occupation_code, license_number, status_normalized, primary_status, original_licensure_date, city, state, county_name, county_code, last_verified_at) VALUES
 ('10000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101','fl_dbpr','SYN-R-101','CGC','CGCSYN0101','active','Current','2012-01-01','Boca Raton','FL','Palm Beach','60',now()),
 ('10000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102','fl_dbpr','SYN-R-102','CCC','CCCSYN0102','inactive','Delinquent','2004-01-01','Jupiter','FL','Palm Beach','60',now()),
 ('10000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000103','fl_dbpr','SYN-R-103','CGC','CGCSYN0103','active','Current','2018-01-01','Clearwater','FL','Pinellas','62',now()),
 ('10000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000104','fl_dbpr','SYN-R-104','RC','RCSYN0104','active','Current','2009-01-01','Largo','FL','Pinellas','62',now());
