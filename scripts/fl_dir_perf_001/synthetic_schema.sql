-- FL-DIR-PERF-001 disposable local fixture. Synthetic rows only; never run against a shared database.
-- Columns mirror the Production tables read by lib/discovery/florida-list.ts and lib/discovery/queries.ts.
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
 ('00000000-0000-4000-8000-000000000001','synthetic-roofing-one','Synthetic Roofing One LLC','Synthetic Roofing One LLC','FL','Fort Lauderdale','Broward'),
 ('00000000-0000-4000-8000-000000000002','synthetic-roofing-two','Synthetic Roofing Two Inc','Synthetic Roofing Two Inc','FL','Hollywood','Broward'),
 ('00000000-0000-4000-8000-000000000003','synthetic-roofing-three','Synthetic Roofing Three Co','Synthetic Roofing Three Co','FL','Miami','Miami-Dade');
INSERT INTO licenses_t (id, contractor_id, source_system, external_key, occupation_code, license_number, status_normalized, primary_status, original_licensure_date, city, state, county_name, last_verified_at) VALUES
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','fl_dbpr','SYN-CCC-1','CCC','CCCSYN0001','active','Current','2010-01-01','Fort Lauderdale','FL','Broward',now()),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','fl_dbpr','SYN-CCC-2','CCC','CCCSYN0002','active','Current','2015-01-01','Hollywood','FL','Broward',now()),
 ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003','fl_dbpr','SYN-RC-3','RC','RCSYN0003','inactive','Delinquent','2001-01-01','Miami','FL','Miami-Dade',now());

-- Normal fixture: licenses is a plain view over licenses_t.
CREATE VIEW licenses AS SELECT * FROM licenses_t;
