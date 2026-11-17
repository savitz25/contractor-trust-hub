-- FL-DIR-PERF-005 disposable local fixture. Synthetic rows only.
-- Never run against a shared or Production database. No Production indexes.
-- Statewide CGC/RG and CBC/RB firms, plus noise contractors with no licenses,
-- so a dropped occupation filter cannot hide inside a tiny table.
SET client_min_messages = warning;

CREATE TABLE contractors (
  id uuid PRIMARY KEY,
  slug text UNIQUE,
  display_name text,
  legal_name text,
  dba_name text,
  home_state char(2),
  primary_city text,
  primary_county text,
  is_thin_profile boolean NOT NULL DEFAULT false
);

CREATE TABLE licenses (
  id uuid PRIMARY KEY,
  contractor_id uuid,
  source_system text,
  external_key text,
  occupation_code text,
  license_number text,
  primary_status text,
  secondary_status text,
  status_normalized text,
  original_licensure_date date,
  city text,
  state char(2),
  postal_code text,
  county_code text,
  county_name text,
  last_verified_at timestamptz
);

CREATE TABLE entities (
  id uuid PRIMARY KEY,
  source_system text,
  external_key text,
  legal_name text,
  status text
);

CREATE TABLE contractor_entities (
  contractor_id uuid,
  entity_id uuid,
  role text,
  confidence numeric,
  match_method text,
  PRIMARY KEY (contractor_id, entity_id, role)
);

CREATE TABLE discipline_actions (
  id uuid PRIMARY KEY,
  contractor_id uuid,
  license_id uuid,
  source_system text,
  external_key text,
  publication_state text,
  identity_state text,
  correction_hold boolean DEFAULT false,
  retraction_hold boolean DEFAULT false
);

-- 001-030 active CGC. 010 is Lee; the rest are Orange.
-- 031 active RG. 032 inactive CGC (status recheck).
-- thin and GA rows are ineligible and must not appear.
INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile)
SELECT
  ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  'gc-firm-' || lpad(g::text, 3, '0'),
  'GC Firm ' || lpad(g::text, 3, '0'),
  'GC Firm ' || lpad(g::text, 3, '0'),
  'FL',
  CASE WHEN g = 10 THEN 'Cape Coral' ELSE 'Orlando' END,
  CASE WHEN g = 10 THEN 'Lee' ELSE 'Orange' END,
  false
FROM generate_series(1, 32) g;

INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile)
VALUES
  ('00000000-0000-4000-8000-000000000901', 'gc-firm-thin', 'GC Firm Thin', 'GC Firm Thin', 'FL', 'Orlando', 'Orange', true),
  ('00000000-0000-4000-8000-000000000902', 'gc-firm-ga', 'GC Firm GA', 'GC Firm GA', 'GA', 'Atlanta', 'Fulton', false);

INSERT INTO licenses (
  id, contractor_id, source_system, external_key, occupation_code, license_number,
  status_normalized, primary_status, original_licensure_date, city, state,
  county_code, county_name, last_verified_at
)
SELECT
  ('20000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  'fl_dbpr',
  'SYN-CGC-' || lpad(g::text, 3, '0'),
  CASE WHEN g = 31 THEN 'RG' ELSE 'CGC' END,
  'SYN-CGC-' || lpad(g::text, 3, '0'),
  CASE WHEN g = 32 THEN 'inactive' ELSE 'active' END,
  CASE WHEN g = 32 THEN 'Delinquent' ELSE 'Current' END,
  DATE '2010-01-01',
  CASE WHEN g = 10 THEN 'Cape Coral' ELSE 'Orlando' END,
  'FL',
  CASE WHEN g = 10 THEN '46' ELSE '58' END,
  CASE WHEN g = 10 THEN 'Lee' ELSE 'Orange' END,
  now()
FROM generate_series(1, 32) g;

-- Second active license on firm 001. Firm roll-up must keep one firm.
INSERT INTO licenses (
  id, contractor_id, source_system, external_key, occupation_code, license_number,
  status_normalized, primary_status, original_licensure_date, city, state,
  county_code, county_name, last_verified_at
) VALUES (
  '20000000-0000-4000-8000-000000000099',
  '00000000-0000-4000-8000-000000000001',
  'fl_dbpr', 'SYN-RG-001', 'RG', 'SYN-RG-001', 'active', 'Current',
  DATE '2012-06-01', 'Orlando', 'FL', '58', 'Orange', now()
);

INSERT INTO licenses (
  id, contractor_id, source_system, external_key, occupation_code, license_number,
  status_normalized, primary_status, original_licensure_date, city, state,
  county_code, county_name, last_verified_at
) VALUES
  ('20000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000901', 'fl_dbpr', 'SYN-CGC-THIN', 'CGC', 'SYN-CGC-THIN', 'active', 'Current', DATE '2011-01-01', 'Orlando', 'FL', '58', 'Orange', now()),
  ('20000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000902', 'fl_dbpr', 'SYN-CGC-GA', 'CGC', 'SYN-CGC-GA', 'active', 'Current', DATE '2011-01-01', 'Atlanta', 'GA', NULL, 'Fulton', now());

-- CBC/RB. 001-026 active CBC, 027 active RB, 028 inactive CBC.
INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile)
SELECT
  ('30000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  'bc-firm-' || lpad(g::text, 3, '0'),
  'BC Firm ' || lpad(g::text, 3, '0'),
  'BC Firm ' || lpad(g::text, 3, '0'),
  'FL', 'Tampa', 'Hillsborough', false
FROM generate_series(1, 28) g;

INSERT INTO licenses (
  id, contractor_id, source_system, external_key, occupation_code, license_number,
  status_normalized, primary_status, original_licensure_date, city, state,
  county_code, county_name, last_verified_at
)
SELECT
  ('40000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  ('30000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  'fl_dbpr',
  'SYN-CBC-' || lpad(g::text, 3, '0'),
  CASE WHEN g = 27 THEN 'RB' ELSE 'CBC' END,
  'SYN-CBC-' || lpad(g::text, 3, '0'),
  CASE WHEN g = 28 THEN 'inactive' ELSE 'active' END,
  CASE WHEN g = 28 THEN 'Delinquent' ELSE 'Current' END,
  DATE '2014-01-01', 'Tampa', 'FL', '39', 'Hillsborough', now()
FROM generate_series(1, 28) g;

INSERT INTO entities (id, source_system, external_key, legal_name, status)
VALUES ('50000000-0000-4000-8000-000000000001', 'fl_sunbiz', 'SYN-ENT-1', 'Synthetic Entity 001', 'ACTIVE');

INSERT INTO contractor_entities (contractor_id, entity_id, role, confidence, match_method)
VALUES ('00000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'sunbiz_entity', 0.95, 'synthetic');

-- Noise contractors have no directory licenses. Noise licenses are a different
-- occupation so the CGC/RG predicate stays selective and can use the index.
INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile)
SELECT
  ('10000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  'noise-' || g,
  'Noise Firm ' || g,
  'Noise Firm ' || g,
  'FL', 'Orlando', 'Orange', false
FROM generate_series(1, 20000) g;

INSERT INTO licenses (
  id, contractor_id, source_system, external_key, occupation_code, license_number,
  status_normalized, primary_status, original_licensure_date, city, state,
  county_code, county_name, last_verified_at
)
SELECT
  ('60000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  ('10000000-0000-4000-8000-' || lpad(((g - 1) % 20000 + 1)::text, 12, '0'))::uuid,
  'fl_dbpr',
  'SYN-NOISE-' || g,
  'ZZZ',
  'SYN-NOISE-' || g,
  'active',
  'Current',
  DATE '2001-01-01',
  'Orlando',
  'FL',
  '58',
  'Orange',
  now()
FROM generate_series(1, 80000) g;

CREATE INDEX licenses_contractor_idx ON licenses (contractor_id);
CREATE INDEX licenses_occupation_idx ON licenses (occupation_code);
CREATE INDEX licenses_occupation_source_idx ON licenses (source_system, occupation_code);
CREATE INDEX contractor_entities_role_conf_idx ON contractor_entities (contractor_id, role, confidence DESC);

ANALYZE contractors;
ANALYZE licenses;
ANALYZE entities;
ANALYZE contractor_entities;
ANALYZE discipline_actions;
