-- NJ-CON-002B statewide construction-permit market intelligence.
-- Additive. Preserves Florida UNIQUE (source_system, source_jurisdiction, permit_number)
-- behavior via a partial unique index replacement. Does not create an nj_permits silo.
-- MARKET_ONLY is the default attribution for records without a source license number.
-- Never hard-delete a previously acquired permit because it aged out of a rolling window.

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS state_code CHAR(2);

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS municipality_code TEXT;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS source_record_key TEXT;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS source_window_status TEXT;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS work_type_raw TEXT;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS work_subtype_raw TEXT;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS sale_units INTEGER;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS rental_units INTEGER;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS last_source_snapshot_id UUID;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS certificate_type_raw TEXT;

ALTER TABLE permit_source_records
  ADD COLUMN IF NOT EXISTS event_date DATE;

ALTER TABLE permit_source_records
  DROP CONSTRAINT IF EXISTS permit_source_records_window_check;

ALTER TABLE permit_source_records
  ADD CONSTRAINT permit_source_records_window_check
  CHECK (
    source_window_status IS NULL OR source_window_status IN (
      'IN_CURRENT_SOURCE_SNAPSHOT',
      'AGED_OUT_OF_SOURCE_WINDOW',
      'REMOVED_FOR_UNKNOWN_SOURCE_REASON',
      'OUTSIDE_STATED_RETENTION_WINDOW_BUT_PRESENT',
      'STATUS_CHANGED'
    )
  );

-- Florida uniqueness is (source_system, source_jurisdiction, permit_number).
-- NJ permit numbers are not unique even within a municipality. Keep Florida
-- uniqueness as a partial index and add a source_record_key unique index.
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'permit_source_records'
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) ILIKE '%(source_system, source_jurisdiction, permit_number)%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE permit_source_records DROP CONSTRAINT %I', conname);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS permit_source_records_fl_uidx
  ON permit_source_records (source_system, source_jurisdiction, permit_number)
  WHERE source_system IS DISTINCT FROM 'nj_dca_construction_permits';

CREATE UNIQUE INDEX IF NOT EXISTS permit_source_records_source_key_uidx
  ON permit_source_records (source_system, source_record_key)
  WHERE source_record_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS permit_source_records_state_county_idx
  ON permit_source_records (state_code, county_slug, municipality_code);

ALTER TABLE permit_attributions
  DROP CONSTRAINT IF EXISTS permit_attributions_state_check;

ALTER TABLE permit_attributions
  ADD CONSTRAINT permit_attributions_state_check
  CHECK (identity_state IN (
    'CONFIRMED',
    'HIGH_CONFIDENCE',
    'REVIEW_REQUIRED',
    'UNRESOLVED',
    'MARKET_ONLY'
  ));

COMMENT ON COLUMN permit_source_records.source_record_key IS
  'Stable source identity. For NJ Construction Permit Data: Socrata PK = muni code || record id. Permit numbers are not globally unique.';
COMMENT ON COLUMN permit_source_records.source_window_status IS
  'Rolling-window tracking. Absence from a later snapshot is never treated as cancellation, revocation, completion, or withdrawal.';
COMMENT ON COLUMN permit_attributions.identity_state IS
  'MARKET_ONLY is the default for market-intelligence sources that do not identify a licensed contractor. CONFIRMED requires an exact source license/registration number.';

-- Manual reversal before adoption only:
-- ALTER TABLE permit_attributions DROP CONSTRAINT IF EXISTS permit_attributions_state_check;
-- ALTER TABLE permit_attributions ADD CONSTRAINT permit_attributions_state_check CHECK (identity_state IN ('CONFIRMED','HIGH_CONFIDENCE','REVIEW_REQUIRED','UNRESOLVED'));
-- DROP INDEX IF EXISTS permit_source_records_source_key_uidx;
-- DROP INDEX IF EXISTS permit_source_records_fl_uidx;
-- ALTER TABLE permit_source_records ADD UNIQUE (source_system, source_jurisdiction, permit_number);
