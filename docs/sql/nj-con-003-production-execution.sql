-- NJ-CON-003 production execution (authorized session only).
-- Set-based load. Do not per-row INSERT 2.68 million records over the network.
-- Do not hard-delete aged-out rows. Do not attach contractors from this source.

-- 0) Identity (do not print secrets)
-- SELECT current_database(), current_user, inet_server_addr();

-- 1) Pre-counts
SELECT 'licenses_nj_dca' AS metric, count(*) FROM licenses WHERE source_system = 'nj_dca';
SELECT 'official_source_observations' AS metric, count(*) FROM official_source_observations;
SELECT 'permit_source_records' AS metric, count(*) FROM permit_source_records;
SELECT 'permit_attributions' AS metric, count(*) FROM permit_attributions;

-- 2) Apply migrations 013, 014, 015 via apply_migration_013.py / 014 / 015.

-- 3) Staging for the permit extract (TEMP, not an nj_permits silo)
CREATE TEMP TABLE nj_permit_stage (
  comu TEXT,
  recordid TEXT,
  pk TEXT,
  permitno TEXT,
  status TEXT,
  county TEXT,
  muniname TEXT,
  munitype TEXT,
  permitdate DATE,
  certdate DATE,
  processdate DATE,
  permittype TEXT,
  permittypedesc TEXT,
  update_flag TEXT,
  constcost NUMERIC,
  salegained INTEGER,
  rentgained INTEGER,
  raw_payload JSONB NOT NULL
);

-- COPY nj_permit_stage FROM STDIN WITH (FORMAT csv, HEADER true);
-- Validate: SELECT count(*) FROM nj_permit_stage;  -- expect 2678341

-- 4) Set-based upsert into permit_source_records
INSERT INTO permit_source_records (
  source_system, source_jurisdiction, county_slug, municipality, permit_number,
  source_record_id, source_record_key, permit_type_raw, permit_type_normalized,
  status_raw, status_normalized, issue_date, final_date, event_date, valuation,
  sale_units, rental_units, work_type_raw, state_code, municipality_code,
  source_window_status, source_fingerprint, raw_payload, first_seen_at, last_seen_at
)
SELECT
  'nj_dca_construction_permits',
  comu,
  lower(replace(county, ' ', '-')),
  muniname,
  permitno,
  recordid,
  pk,
  permittype,
  permittypedesc,
  status,
  CASE status WHEN 'P' THEN 'issued' WHEN 'C' THEN 'closed' ELSE 'unknown' END,
  permitdate,
  certdate,
  CASE WHEN status = 'C' THEN certdate ELSE permitdate END,
  constcost,
  salegained,
  rentgained,
  permittypedesc,
  'NJ',
  comu,
  'IN_CURRENT_SOURCE_SNAPSHOT',
  encode(sha256(convert_to(pk, 'UTF8')), 'hex'),
  raw_payload,
  now(),
  now()
FROM nj_permit_stage s
WHERE NOT EXISTS (
  SELECT 1 FROM permit_source_records p
  WHERE p.source_system = 'nj_dca_construction_permits'
    AND p.source_record_key = s.pk
);

UPDATE permit_source_records p
SET last_seen_at = now(),
    source_window_status = 'IN_CURRENT_SOURCE_SNAPSHOT'
FROM nj_permit_stage s
WHERE p.source_system = 'nj_dca_construction_permits'
  AND p.source_record_key = s.pk;

-- 5) MARKET_ONLY attributions only (no contractor match)
INSERT INTO permit_attributions (permit_source_record_id, identity_state, identity_method)
SELECT p.id, 'MARKET_ONLY', 'source_has_no_contractor_or_license_fields'
FROM permit_source_records p
WHERE p.source_system = 'nj_dca_construction_permits'
  AND NOT EXISTS (
    SELECT 1 FROM permit_attributions a WHERE a.permit_source_record_id = p.id
  );

-- 6) Post-counts / gates
SELECT status_raw, count(*) FROM permit_source_records
WHERE source_system = 'nj_dca_construction_permits' GROUP BY 1;

SELECT identity_state, count(*) FROM permit_attributions a
JOIN permit_source_records p ON p.id = a.permit_source_record_id
WHERE p.source_system = 'nj_dca_construction_permits' GROUP BY 1;
-- CONFIRMED must be 0.

SELECT count(*) AS confirmed_public_attachments
FROM permit_attributions a
JOIN permit_source_records p ON p.id = a.permit_source_record_id
WHERE p.source_system = 'nj_dca_construction_permits'
  AND a.identity_state = 'CONFIRMED';
