-- FL-DIR-PERF-002 disposable LOCAL benchmark dataset. Synthetic rows only (no Production rows, no PII).
-- Shape mirrors Production aggregates read on 2026-11-13 (counts only):
--   licenses ~1.32M rows (fl_dbpr 176,076 with the real per-code/status counts, az_roc 58,408, or_ccb 55,980,
--   wa_lni 160,998, remainder other sources), contractors ~1.39M, entities ~6.47M, contractor_entities ~281k,
--   discipline_actions ~69.7k; ~54% of FL roofer/GC licenses Sunbiz-linked at confidence >= 0.9, ~2.5% of links
--   shared by two contractors (multi-license firms); ~11% out-of-state mailing; no discipline on roofer/GC rows.
-- Same column set and the same indexes the directory query can use on Production.
-- NEVER run against a shared or Production database.
SET client_min_messages = warning;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE contractors (
  id uuid PRIMARY KEY, slug text UNIQUE, display_name text, legal_name text, dba_name text,
  home_state char(2), primary_city text, primary_county text, phone text, website text,
  is_thin_profile boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  pad text
);
CREATE TABLE licenses (
  id uuid PRIMARY KEY, contractor_id uuid, source_system text, source_board text, external_key text,
  occupation_code text, occupation_description text, license_number text, class_code text,
  licensee_name_raw text, dba_name_raw text, primary_status text, secondary_status text, status_normalized text,
  original_licensure_date date, effective_date date, expiration_date date,
  address_line_1 text, city text, state char(2), postal_code text,
  county_code text, county_name text, raw_payload text, last_verified_at timestamptz
);
CREATE TABLE entities (
  id uuid PRIMARY KEY, source_system text, external_key text, legal_name text, status text, pad text
);
CREATE TABLE contractor_entities (
  contractor_id uuid, entity_id uuid, role text, confidence numeric, match_method text,
  PRIMARY KEY (contractor_id, entity_id, role)
);
CREATE TABLE discipline_actions (
  id uuid PRIMARY KEY, contractor_id uuid, license_id uuid, source_system text, source_dataset text,
  external_key text, publication_state text, identity_state text, correction_hold boolean DEFAULT false,
  retraction_hold boolean DEFAULT false
);

-- Florida per-code/status counts (Production aggregate, 2026-11-13).
CREATE TEMP TABLE fl_mix(code text, status text, n int);
INSERT INTO fl_mix VALUES
('CAC','active',11125),('CAC','inactive',1253),('CBC','active',17242),('CBC','inactive',2479),('CCC','active',10093),
('CCC','inactive',1182),('CFC','active',8440),('CFC','inactive',870),('CGC','active',33056),('CGC','inactive',5866),
('CGC','other',1),('CMC','active',2412),('CMC','inactive',364),('CPC','active',4260),('CPC','inactive',361),
('CRC','active',7283),('CRC','inactive',1273),('CRS1','current',4895),('CSC','active',97),('CUC','active',2633),
('CUC','inactive',371),('CVC','active',437),('CVC','inactive',76),('EC','active',12323),('EF','active',1465),
('EG','active',545),('ER','active',1656),('ES','active',1785),('ET','active',112),('EY','active',65),
('FRO','current',19087),('HI','active',8026),('MRSA','active',3339),('MRSR','active',3219),('PCC','active',376),
('PVDR','current',303),('RA','active',285),('RA','inactive',40),('RB','active',385),('RB','inactive',42),
('RC','active',466),('RC','current',1),('RC','inactive',52),('RF','active',533),('RF','inactive',56),
('RG','active',379),('RG','inactive',43),('RG','other',1),('RM','active',71),('RM','inactive',12),
('RP','active',453),('RP','inactive',26),('RQ','active',28),('RR','active',588),('RR','inactive',84),
('RS','active',9),('RU','active',57),('RU','inactive',8),('RX','active',207),('RX','inactive',9),
('SCC','active',3631),('SCC','inactive',214);

CREATE TEMP TABLE fl_county(i int, name text, code text, city text);
INSERT INTO fl_county VALUES
(0,'Miami-Dade','23','Miami'),(1,'Miami-Dade','23','Hialeah'),(2,'Broward','16','Fort Lauderdale'),(3,'Broward','16','Hollywood'),
(4,'Palm Beach','60','West Palm Beach'),(5,'Palm Beach','60','Boca Raton'),(6,'Hillsborough','39','Tampa'),(7,'Orange','58','Orlando'),
(8,'Pinellas','62','St Petersburg'),(9,'Duval','26','Jacksonville'),(10,'Lee','46','Cape Coral'),(11,'Polk','63','Lakeland'),
(12,'Brevard','15','Melbourne'),(13,'Volusia','74','Daytona Beach'),(14,'Pasco','61','New Port Richey'),(15,'Seminole','69','Sanford'),
(16,'Sarasota','68','Sarasota'),(17,'Manatee','51','Bradenton'),(18,'Collier','21','Naples'),(19,'Osceola','59','Kissimmee');

-- Florida licenses in random physical order (fl_dbpr rows are interleaved with other sources on Production).
CREATE TEMP TABLE fl_rows AS
SELECT row_number() OVER () AS rn, m.code, m.status
FROM fl_mix m, LATERAL generate_series(1, m.n);

-- 143,516 Florida contractors for 176,076 FL license rows: roofer/GC rows are one license per contractor
-- (Production aggregate), the surplus rows of other codes reuse a contractor.
CREATE TEMP TABLE fl_lic AS
SELECT rn, code, status,
  CASE WHEN code IN ('CCC','RC','CGC','RG') OR rn % 6 <> 0 THEN rn ELSE rn - 1 END AS c_rn
FROM fl_rows;

INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile, pad)
SELECT gen_random_uuid(), 'syn-fl-' || c_rn, 'Synthetic Firm ' || lpad((c_rn * 7919 % 1000003)::text, 7, '0'),
  'Synthetic Firm ' || c_rn,
  CASE WHEN c_rn % 5 = 0 THEN 'GA' ELSE 'FL' END,
  fc.city, fc.name, false, repeat('x', 300)
FROM (SELECT DISTINCT c_rn FROM fl_lic) d JOIN fl_county fc ON fc.i = (d.c_rn * 31 % 20);
CREATE TEMP TABLE fl_cmap AS SELECT id, substr(slug, 8)::bigint AS c_rn, primary_city, primary_county, home_state FROM contractors;

-- Non-FL contractors (fill to ~1.39M; ~12% thin like Production search tables).
INSERT INTO contractors (id, slug, display_name, legal_name, home_state, primary_city, primary_county, is_thin_profile, pad)
SELECT gen_random_uuid(), 'syn-x-' || g, 'Other Firm ' || g, 'Other Firm ' || g,
  (ARRAY['AZ','OR','WA','TX','NJ','CA','NY','VA'])[1 + g % 8], 'Othertown', 'Other', g % 8 = 0, repeat('x', 300)
FROM generate_series(1, 1246600) g;

CREATE TEMP TABLE lic_stage AS
SELECT gen_random_uuid() AS id, cm.id AS contractor_id, 'fl_dbpr'::text AS source_system, 'SYN-FL-' || l.rn AS external_key,
  l.code AS occupation_code, l.status AS status_normalized,
  CASE l.status WHEN 'active' THEN 'Current' WHEN 'current' THEN 'Current' ELSE 'Delinquent' END AS primary_status,
  DATE '1975-01-01' + (l.rn * 37 % 18000)::int AS original_licensure_date,
  cm.primary_city AS city,
  -- ~11% of roofer/GC rows have an out-of-state mailing address on Production; the contractor home_state rule above
  -- covers most of them, a few FL-homed rows still list out-of-state license state.
  CASE WHEN cm.home_state = 'FL' THEN 'FL' WHEN l.rn % 2 = 0 THEN 'FL' ELSE 'GA' END::char(2) AS state,
  fc.code AS county_code, cm.primary_county AS county_name,
  now() - ((l.rn % 400) || ' days')::interval AS last_verified_at
FROM fl_lic l JOIN fl_cmap cm ON cm.c_rn = l.c_rn JOIN fl_county fc ON fc.i = (l.c_rn * 31 % 20);

INSERT INTO lic_stage
SELECT gen_random_uuid(), c.id, s.src, 'SYN-' || s.src || '-' || c.slug, s.code, 'active', 'Active',
  DATE '1990-01-01' + (abs(hashtext(c.slug)) % 12000), 'Othertown', c.home_state, NULL, 'Other', now()
FROM (SELECT id, slug, home_state, row_number() OVER () AS k FROM contractors WHERE slug LIKE 'syn-x-%') c
CROSS JOIN LATERAL (SELECT CASE
    WHEN c.k <= 58408 THEN 'az_roc' WHEN c.k <= 114388 THEN 'or_ccb' WHEN c.k <= 275386 THEN 'wa_lni'
    ELSE (ARRAY['tx_tdlr','nj_dca','ca_cslb','ny_dol_pw','va_dpor'])[1 + (c.k % 5)::int] END AS src,
  (ARRAY['B','CR-42','CB','EL','GC'])[1 + (c.k % 5)::int] AS code) s
WHERE c.k <= 1148600;

INSERT INTO licenses (id, contractor_id, source_system, external_key, occupation_code, license_number, status_normalized,
  primary_status, original_licensure_date, city, state, postal_code, county_code, county_name, raw_payload, last_verified_at)
SELECT id, contractor_id, source_system, external_key, occupation_code, external_key, status_normalized, primary_status,
  original_licensure_date, city, state, '33301', county_code, county_name, repeat('p', 1150), last_verified_at
FROM lic_stage ORDER BY md5(id::text);

-- Entities: 6.47M (Sunbiz-sized), random physical order.
INSERT INTO entities (id, source_system, external_key, legal_name, status, pad)
SELECT gen_random_uuid(), CASE WHEN g % 50 = 0 THEN 'other_sos' ELSE 'fl_sunbiz' END, 'E' || g,
  'Synthetic Entity ' || g, CASE WHEN g % 5 = 0 THEN 'INACTIVE' ELSE 'ACTIVE' END, repeat('e', 180)
FROM generate_series(1, 6474946) g;

-- Links: ~54% of FL contractors get a sunbiz_entity link (most >= 0.9), ~2.5% share an entity (multi-license firm).
CREATE TEMP TABLE ent_pick AS SELECT id, row_number() OVER () AS k FROM entities WHERE source_system = 'fl_sunbiz' LIMIT 200000;
INSERT INTO contractor_entities (contractor_id, entity_id, role, confidence, match_method)
SELECT cm.id, e.id, 'sunbiz_entity', CASE WHEN cm.c_rn % 20 = 7 THEN 0.80 ELSE 0.95 END, 'synthetic'
FROM fl_cmap cm
JOIN ent_pick e ON e.k = CASE WHEN cm.c_rn % 40 = 1 THEN cm.c_rn - 1 ELSE cm.c_rn END % 200000 + 1
WHERE cm.c_rn % 100 < 56;
INSERT INTO contractor_entities (contractor_id, entity_id, role, confidence, match_method)
SELECT c.id, e.id, 'officer', 0.7, 'synthetic'
FROM (SELECT id, row_number() OVER () AS k FROM contractors WHERE slug LIKE 'syn-x-%' LIMIT 200000) c
JOIN ent_pick e ON e.k = c.k
ON CONFLICT DO NOTHING;

-- Discipline: ~69.7k rows on non roofer/GC contractors (mostly fl_dbpr, gated off by PUBLIC_REGULATORY_SQL).
INSERT INTO discipline_actions (id, contractor_id, source_system, external_key, publication_state, identity_state)
SELECT gen_random_uuid(), c.id, CASE WHEN c.k % 4 = 0 THEN 'az_roc' ELSE 'fl_dbpr' END, 'D' || c.k, 'HELD', 'UNRESOLVED'
FROM (SELECT l.contractor_id AS id, row_number() OVER () AS k FROM licenses l
      WHERE l.source_system = 'fl_dbpr' AND l.occupation_code NOT IN ('CCC','RC','CGC','RG') LIMIT 69674) c;

-- Production indexes relevant to the directory query (pg_indexes, 2026-11-13).
CREATE INDEX licenses_contractor_idx ON licenses (contractor_id);
CREATE INDEX licenses_occupation_idx ON licenses (occupation_code);
CREATE INDEX licenses_occupation_source_idx ON licenses (source_system, occupation_code);
CREATE INDEX licenses_source_status_occ_idx ON licenses (source_system, occupation_code, status_normalized);
CREATE INDEX licenses_sitemap_source_contractor_idx ON licenses (source_system, contractor_id);
CREATE UNIQUE INDEX licenses_source_system_external_key_key ON licenses (source_system, external_key);
CREATE INDEX licenses_state_city_idx ON licenses (state, city);
CREATE INDEX licenses_state_status_idx ON licenses (state, status_normalized);
CREATE INDEX licenses_status_idx ON licenses (status_normalized);
CREATE INDEX licenses_county_code_idx ON licenses (county_code);
CREATE INDEX licenses_county_name_lower_idx ON licenses (lower(TRIM(BOTH FROM county_name)))
  WHERE county_name IS NOT NULL AND TRIM(BOTH FROM county_name) <> '';
CREATE INDEX contractors_home_state_idx ON contractors (home_state);
CREATE INDEX contractors_display_name_idx ON contractors (display_name);
CREATE INDEX contractors_searchable_idx ON contractors (home_state) WHERE is_thin_profile = false;
CREATE INDEX contractors_primary_county_lower_idx ON contractors (lower(TRIM(BOTH FROM primary_county)))
  WHERE primary_county IS NOT NULL AND TRIM(BOTH FROM primary_county) <> '' AND is_thin_profile = false;
CREATE INDEX contractor_entities_entity_idx ON contractor_entities (entity_id);
CREATE INDEX contractor_entities_role_conf_idx ON contractor_entities (contractor_id, role, confidence DESC);
CREATE INDEX discipline_contractor_idx ON discipline_actions (contractor_id);
CREATE INDEX discipline_publication_gate_idx ON discipline_actions (contractor_id, publication_state, identity_state)
  WHERE source_system = 'fl_dbpr' AND publication_state = 'PUBLIC_ELIGIBLE';
VACUUM ANALYZE;
