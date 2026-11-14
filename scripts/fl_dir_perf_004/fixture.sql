-- FL-DIR-PERF-004 disposable local fixture. Synthetic rows only.
-- Never run against a shared or production database.
CREATE TABLE contractors (
  id uuid PRIMARY KEY,
  slug text UNIQUE,
  display_name text NOT NULL,
  legal_name text,
  dba_name text,
  home_state char(2),
  primary_city text,
  primary_county text,
  is_thin_profile boolean NOT NULL DEFAULT false
);
CREATE TABLE licenses (
  id uuid PRIMARY KEY,
  contractor_id uuid REFERENCES contractors (id),
  source_system text NOT NULL,
  external_key text NOT NULL,
  occupation_code text NOT NULL,
  occupation_description text,
  class_code text,
  licensee_name_raw text NOT NULL,
  status_normalized text,
  primary_status text,
  secondary_status text,
  original_licensure_date date,
  city text,
  state char(2),
  county_code text,
  county_name text,
  last_verified_at timestamptz
);
CREATE INDEX licenses_county_code_idx ON licenses (county_code);
CREATE INDEX licenses_county_name_lower_idx
  ON licenses (LOWER(TRIM(county_name)))
  WHERE county_name IS NOT NULL AND TRIM(county_name) <> '';
CREATE INDEX licenses_contractor_idx ON licenses (contractor_id);
CREATE INDEX contractors_primary_county_lower_idx
  ON contractors (LOWER(TRIM(primary_county)))
  WHERE primary_county IS NOT NULL AND TRIM(primary_county) <> '' AND is_thin_profile = FALSE;

CREATE TABLE entities (
  id uuid PRIMARY KEY,
  source_system text NOT NULL,
  external_key text NOT NULL,
  legal_name text NOT NULL,
  status text
);
CREATE TABLE contractor_entities (
  contractor_id uuid NOT NULL,
  entity_id uuid NOT NULL,
  role text NOT NULL,
  confidence numeric,
  PRIMARY KEY (contractor_id, entity_id, role)
);
CREATE TABLE discipline_actions (
  id uuid PRIMARY KEY,
  contractor_id uuid,
  source_system text NOT NULL,
  source_dataset text NOT NULL,
  external_key text NOT NULL
);

-- Other-county mass so a leading contractors scan is the expensive plan.
INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile)
SELECT
  ('f0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'filler-' || i,
  'Filler Contractor ' || lpad(i::text, 5, '0'),
  'Filler Contractor ' || lpad(i::text, 5, '0'),
  'FL',
  'Tampa',
  'Polk',
  false
FROM generate_series(1, 12000) AS i;
INSERT INTO licenses (
  id, contractor_id, source_system, external_key, occupation_code, licensee_name_raw,
  status_normalized, original_licensure_date, city, state, county_code, county_name, last_verified_at
)
SELECT
  ('e0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  ('f0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'fl_dbpr',
  'FILL-' || i,
  'CCC',
  'Filler',
  'active',
  DATE '2012-01-01',
  'Tampa',
  'FL',
  '99',
  'Polk',
  TIMESTAMPTZ '2026-01-01'
FROM generate_series(1, 12000) AS i;

INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile)
SELECT
  ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'orange-page-' || lpad(i::text, 2, '0'),
  'Orange Page Firm ' || lpad(i::text, 2, '0'),
  'Orange Page Firm ' || lpad(i::text, 2, '0'),
  'FL',
  'Orlando',
  'Orange',
  false
FROM generate_series(1, 30) AS i;
INSERT INTO licenses (
  id, contractor_id, source_system, external_key, occupation_code, licensee_name_raw,
  status_normalized, original_licensure_date, city, state, county_code, county_name, last_verified_at
)
SELECT
  ('21000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  'fl_dbpr',
  'ORANGE-PAGE-' || i,
  'CCC',
  'Orange Page',
  'active',
  DATE '2010-06-01',
  'Orlando',
  'FL',
  '58',
  'Orange',
  TIMESTAMPTZ '2026-01-01'
FROM generate_series(1, 30) AS i;

INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile) VALUES
  ('20000000-0000-4000-8000-000000000101', 'orange-code-only', 'Orange Code Only', 'Orange Code Only', 'FL', 'Orlando', 'Leon', false),
  ('20000000-0000-4000-8000-000000000102', 'orange-code-pad', 'Orange Code Pad', 'Orange Code Pad', 'FL', 'Orlando', NULL, false),
  ('20000000-0000-4000-8000-000000000103', 'orange-primary-name', 'Orange Primary Name', 'Orange Primary Name', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000104', 'orange-primary-code', 'Orange Primary Code', 'Orange Primary Code', 'FL', 'Orlando', '58', false),
  ('20000000-0000-4000-8000-000000000105', 'orange-thin', 'Orange Thin', 'Orange Thin', 'FL', 'Orlando', 'Orange', true),
  ('20000000-0000-4000-8000-000000000106', 'orange-inactive', 'Orange Inactive', 'Orange Inactive', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000107', 'orange-tenure-new', 'Orange Tenure New', 'Orange Tenure New', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000108', 'orange-tenure-mid', 'Orange Tenure Mid', 'Orange Tenure Mid', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000109', 'orange-tenure-old', 'Orange Tenure Old', 'Orange Tenure Old', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000110', 'orange-winter-park', 'Orange Winter Park', 'Orange Winter Park', 'FL', 'Winter Park', 'Orange', false),
  ('20000000-0000-4000-8000-000000000111', 'orange-occ-rc', 'Orange Occupation RC', 'Orange Occupation RC', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000112', 'orange-class-spc', 'Orange Class SPC', 'Orange Class SPC', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000113', 'orange-desc-shingle', 'Orange Desc Shingle', 'Orange Desc Shingle', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000114', 'orange-entity', 'Orange Entity Linked', 'Orange Entity Linked', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000115', 'orange-discipline', 'Orange Discipline', 'Orange Discipline', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000116', 'orange-lower-name', 'Orange Lower Name', 'Orange Lower Name', 'FL', 'Orlando', 'orange', false),
  ('20000000-0000-4000-8000-000000000117', 'orange-two-licenses', 'Orange Two Licenses', 'Orange Two Licenses', 'FL', 'Orlando', 'Orange', false),
  ('20000000-0000-4000-8000-000000000201', 'miami-hyphen', 'Miami Hyphen Firm', 'Miami Hyphen Firm', 'FL', 'Miami', 'Miami-Dade', false),
  ('20000000-0000-4000-8000-000000000202', 'miami-space', 'Miami Space Firm', 'Miami Space Firm', 'FL', 'Miami', NULL, false),
  ('20000000-0000-4000-8000-000000000203', 'miami-alias', 'Miami Alias Firm', 'Miami Alias Firm', 'FL', 'Miami', NULL, false),
  ('20000000-0000-4000-8000-000000000204', 'palm-space', 'Palm Space Firm', 'Palm Space Firm', 'FL', 'West Palm Beach', NULL, false),
  ('20000000-0000-4000-8000-000000000205', 'palm-alias', 'Palm Alias Firm', 'Palm Alias Firm', 'FL', 'West Palm Beach', NULL, false);

INSERT INTO licenses (
  id, contractor_id, source_system, external_key, occupation_code, occupation_description, class_code,
  licensee_name_raw, status_normalized, original_licensure_date, city, state, county_code, county_name, last_verified_at
) VALUES
  ('21000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000101', 'fl_dbpr', 'ORANGE-CODE', 'CCC', NULL, NULL, 'Code', 'active', DATE '2010-06-01', 'Orlando', 'FL', '58', NULL, TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000102', 'fl_dbpr', 'ORANGE-PAD', 'CCC', NULL, NULL, 'Pad', 'active', DATE '2010-06-01', 'Orlando', 'FL', '058', NULL, TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000103', 'fl_dbpr', 'ORANGE-PRIMARY-NAME', 'CCC', NULL, NULL, 'Primary', 'active', DATE '2010-06-01', 'Orlando', 'FL', NULL, NULL, TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000104', '20000000-0000-4000-8000-000000000104', 'fl_dbpr', 'ORANGE-PRIMARY-CODE', 'CCC', NULL, NULL, 'Primary Code', 'active', DATE '2010-06-01', 'Orlando', 'FL', NULL, NULL, TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000105', '20000000-0000-4000-8000-000000000105', 'fl_dbpr', 'ORANGE-THIN', 'CCC', NULL, NULL, 'Thin', 'active', DATE '2010-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000106', '20000000-0000-4000-8000-000000000106', 'fl_dbpr', 'ORANGE-INACTIVE', 'CCC', NULL, NULL, 'Inactive', 'inactive', DATE '2010-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000107', '20000000-0000-4000-8000-000000000107', 'fl_dbpr', 'ORANGE-NEW', 'CCC', NULL, NULL, 'New', 'active', DATE '2024-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-06-01'),
  ('21000000-0000-4000-8000-000000000108', '20000000-0000-4000-8000-000000000108', 'fl_dbpr', 'ORANGE-MID', 'CCC', NULL, NULL, 'Mid', 'active', DATE '2014-01-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000109', '20000000-0000-4000-8000-000000000109', 'fl_dbpr', 'ORANGE-OLD', 'CCC', NULL, NULL, 'Old', 'active', DATE '2001-01-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2020-01-01'),
  ('21000000-0000-4000-8000-000000000110', '20000000-0000-4000-8000-000000000110', 'fl_dbpr', 'ORANGE-WP', 'CCC', NULL, NULL, 'Winter Park', 'active', DATE '2010-06-01', 'Winter Park', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000111', '20000000-0000-4000-8000-000000000111', 'fl_dbpr', 'ORANGE-RC', 'RC', NULL, NULL, 'RC', 'active', DATE '2010-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000112', '20000000-0000-4000-8000-000000000112', 'fl_dbpr', 'ORANGE-SPC', 'CCC', 'general roof', 'SPC', 'SPC', 'active', DATE '2010-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000113', '20000000-0000-4000-8000-000000000113', 'fl_dbpr', 'ORANGE-SHINGLE', 'CCC', 'Metal shingle roof', NULL, 'Shingle', 'active', DATE '2010-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000114', '20000000-0000-4000-8000-000000000114', 'fl_dbpr', 'ORANGE-ENTITY', 'CCC', NULL, NULL, 'Entity', 'active', DATE '2010-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000115', '20000000-0000-4000-8000-000000000115', 'fl_dbpr', 'ORANGE-DISC', 'CCC', NULL, NULL, 'Discipline', 'active', DATE '2010-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000116', '20000000-0000-4000-8000-000000000116', 'fl_dbpr', 'ORANGE-LOWER', 'CCC', NULL, NULL, 'Lower', 'active', DATE '2010-06-01', 'Orlando', 'FL', NULL, 'orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000117', '20000000-0000-4000-8000-000000000117', 'fl_dbpr', 'ORANGE-TWO-A', 'CCC', NULL, NULL, 'Two A', 'active', DATE '2010-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000118', '20000000-0000-4000-8000-000000000117', 'fl_dbpr', 'ORANGE-TWO-B', 'CCC', NULL, NULL, 'Two B', 'active', DATE '2011-06-01', 'Orlando', 'FL', '58', 'Orange', TIMESTAMPTZ '2026-02-01'),
  ('21000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000201', 'fl_dbpr', 'MIAMI-HYPHEN', 'CCC', NULL, NULL, 'Hyphen', 'active', DATE '2010-06-01', 'Miami', 'FL', NULL, 'Miami-Dade', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000202', 'fl_dbpr', 'MIAMI-SPACE', 'CCC', NULL, NULL, 'Space', 'active', DATE '2010-06-01', 'Miami', 'FL', NULL, 'Miami Dade', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000203', '20000000-0000-4000-8000-000000000203', 'fl_dbpr', 'MIAMI-ALIAS', 'CCC', NULL, NULL, 'Alias', 'active', DATE '2010-06-01', 'Miami', 'FL', NULL, 'Dade', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000204', '20000000-0000-4000-8000-000000000204', 'fl_dbpr', 'PALM-SPACE', 'CCC', NULL, NULL, 'Palm', 'active', DATE '2010-06-01', 'West Palm Beach', 'FL', NULL, 'Palm Beach', TIMESTAMPTZ '2026-01-01'),
  ('21000000-0000-4000-8000-000000000205', '20000000-0000-4000-8000-000000000205', 'fl_dbpr', 'PALM-ALIAS', 'CCC', NULL, NULL, 'Palm Alias', 'active', DATE '2010-06-01', 'West Palm Beach', 'FL', NULL, 'PalmBeach', TIMESTAMPTZ '2026-01-01');

INSERT INTO entities (id, source_system, external_key, legal_name, status) VALUES
  ('30000000-0000-4000-8000-000000000001', 'fl_sunbiz', 'SYN-SUNBIZ-ORANGE', 'Orange Entity LLC', 'ACTIVE');
INSERT INTO contractor_entities (contractor_id, entity_id, role, confidence) VALUES
  ('20000000-0000-4000-8000-000000000114', '30000000-0000-4000-8000-000000000001', 'sunbiz_entity', 0.95);
INSERT INTO discipline_actions (id, contractor_id, source_system, source_dataset, external_key) VALUES
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000115', 'az_roc', 'synthetic', 'SYN-DISC-ORANGE');

ANALYZE contractors;
ANALYZE licenses;
