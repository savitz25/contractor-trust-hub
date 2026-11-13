-- SEO-PATTERN-002 B1 guard: disposable local fixture for the AZ/OR/WA segment pages.
-- Synthetic rows only; never run against a shared or Production database.
-- Tables mirror scripts/fl_dir_perf_001/synthetic_schema.sql (the columns read by lib/discovery/queries.ts).
CREATE TABLE contractors (
  id uuid PRIMARY KEY, slug text UNIQUE, display_name text, legal_name text, dba_name text,
  home_state char(2), primary_city text, primary_county text, phone text, website text,
  is_thin_profile boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE licenses_t (
  id uuid PRIMARY KEY, contractor_id uuid, source_system text, source_board text, external_key text,
  occupation_code text, occupation_description text, license_number text, class_code text,
  licensee_name_raw text, dba_name_raw text, primary_status text, secondary_status text, status_normalized text,
  original_licensure_date date, effective_date date, expiration_date date,
  address_line_1 text, address_line_2 text, address_line_3 text, city text, state char(2), postal_code text,
  county_code text, county_name text, board_number text, raw_payload jsonb, ingest_batch_id uuid,
  first_seen_at timestamptz, last_seen_at timestamptz, last_verified_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE entities (
  id uuid PRIMARY KEY, source_system text, external_key text, legal_name text, entity_type text, status text,
  formation_date date, principal_address text, city text, state char(2), postal_code text, county_name text,
  raw_payload jsonb, ingest_batch_id uuid, last_verified_at timestamptz, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(), name_normalized text, fei_number text, registered_agent_name text, officers jsonb
);
CREATE TABLE contractor_entities (
  contractor_id uuid, entity_id uuid, role text, confidence numeric, evidence jsonb,
  created_at timestamptz DEFAULT now(), match_method text, linked_at timestamptz,
  PRIMARY KEY (contractor_id, entity_id, role)
);
CREATE TABLE discipline_actions (
  id uuid PRIMARY KEY, contractor_id uuid, license_id uuid, source_system text, source_dataset text,
  external_key text, publication_state text, identity_state text, correction_hold boolean DEFAULT false,
  retraction_hold boolean DEFAULT false
);


INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county) VALUES
 ('00000000-0000-4000-8000-0000000000a1','synthetic-az-roofing','Synthetic AZ Roofing LLC','Synthetic AZ Roofing LLC','AZ','Phoenix','Maricopa'),
 ('00000000-0000-4000-8000-0000000000a2','synthetic-az-electric','Synthetic AZ Electric Inc','Synthetic AZ Electric Inc','AZ','Tucson','Pima'),
 ('00000000-0000-4000-8000-0000000000b1','synthetic-or-builder','Synthetic OR Builder LLC','Synthetic OR Builder LLC','OR','Portland','Multnomah'),
 ('00000000-0000-4000-8000-0000000000b2','synthetic-or-commercial','Synthetic OR Commercial Co','Synthetic OR Commercial Co','WA','Vancouver',NULL),
 ('00000000-0000-4000-8000-0000000000c1','synthetic-wa-electric','Synthetic WA Electric LLC','Synthetic WA Electric LLC','WA','Auburn','King'),
 ('00000000-0000-4000-8000-0000000000c2','synthetic-wa-mailing','Synthetic WA Mailing Electric Inc','Synthetic WA Mailing Electric Inc','WA','Portland',NULL);
INSERT INTO licenses_t (id, contractor_id, source_system, external_key, occupation_code, license_number, status_normalized, primary_status, original_licensure_date, city, state, postal_code, county_name, last_verified_at) VALUES
 ('10000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000a1','az_roc','SYN-AZ-1','CR-42','SYNAZ0001','active','Active','2012-01-01','Phoenix','AZ','85001','Maricopa',now()),
 ('10000000-0000-4000-8000-0000000000a2','00000000-0000-4000-8000-0000000000a2','az_roc','SYN-AZ-2','CR-11','SYNAZ0002','active','Active','2014-01-01','Tucson','AZ','85701','Pima',now()),
 ('10000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000b1','or_ccb','SYN-OR-1','RGC','SYNOR0001','active','Active','2011-01-01','Portland','OR','97201','Multnomah',now()),
 ('10000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000b2','or_ccb','SYN-OR-2','CGC1','SYNOR0002','active','Active','2016-01-01','Vancouver','WA','98660','Out of State',now()),
 ('10000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c1','wa_lni','SYN-WA-1','EC','SYNWA0001','active','Active','2013-01-01','Auburn','WA','98001',NULL,now()),
 ('10000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000c2','wa_lni','SYN-WA-2','EC','SYNWA0002','active','Active','2017-01-01','Portland','OR','97201',NULL,now());

-- Failure-mode switch. licenses is a view over licenses_t gated by seo002_gate(), an uncorrelated
-- InitPlan evaluated once per statement before any row is read. Change the mode with
--   UPDATE seo002_fixture_mode SET mode = '<mode>';
-- ok             every read answers normally (real rows and real zero-row filters)
-- slow           every read sleeps 9 s, past the app's 8 s SET LOCAL statement_timeout ("canceling statement due to statement timeout")
-- partial-list   the listing COUNT succeeds, then the row query (WITH picked ...) fails: count ok, rows missing
-- partial-facets listings succeed; the GROUP BY facet reads fail (countByTrade / countCountiesForTrade)
-- partial-oos    only the out-of-state facet COUNT fails (appendOutOfStateFacet on WA trade pages)
CREATE TABLE seo002_fixture_mode (mode text NOT NULL);
INSERT INTO seo002_fixture_mode VALUES ('ok');
CREATE FUNCTION seo002_gate() RETURNS boolean LANGUAGE plpgsql VOLATILE AS $$
DECLARE m text; q text := current_query();
BEGIN
  SELECT mode INTO m FROM seo002_fixture_mode LIMIT 1;
  IF m = 'slow' THEN PERFORM pg_sleep(9); END IF;
  IF m = 'partial-list' AND q ILIKE '%WITH picked AS%' THEN RAISE EXCEPTION 'seo002 fixture: listing rows unavailable'; END IF;
  IF m = 'partial-facets' AND q ILIKE '%GROUP BY%' THEN RAISE EXCEPTION 'seo002 fixture: facet read unavailable'; END IF;
  IF m = 'partial-oos' AND q ILIKE '%COUNT(DISTINCT c.id)%' AND q LIKE '%<> UPPER($2)%' AND q NOT ILIKE '%WITH picked AS%' THEN
    RAISE EXCEPTION 'seo002 fixture: out-of-state count unavailable';
  END IF;
  RETURN true;
END $$;
CREATE VIEW licenses AS SELECT * FROM licenses_t WHERE (SELECT seo002_gate());
