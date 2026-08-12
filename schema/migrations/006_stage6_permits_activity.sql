-- Stage 6: permit extract storage + contractor activity join surface
-- Batch loaders populate these tables; app reads high-confidence joins only.

CREATE TABLE IF NOT EXISTS permit_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_slug     TEXT NOT NULL,
  jurisdiction_label    TEXT NOT NULL,
  address_key           TEXT NOT NULL,
  street_normalized     TEXT,
  unit                  TEXT,
  city                  TEXT,
  zip                   TEXT,
  county                TEXT,
  permit_number         TEXT,
  description           TEXT,
  category              TEXT,
  status                TEXT NOT NULL DEFAULT 'unknown',
  filed_date            DATE,
  issued_date           DATE,
  final_date            DATE,
  declared_value        NUMERIC,
  contractor_name       TEXT,
  contractor_license_key TEXT,
  source_label          TEXT NOT NULL,
  source_url            TEXT,
  retrieved_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS permit_records_address_key_idx
  ON permit_records (address_key);
CREATE INDEX IF NOT EXISTS permit_records_jurisdiction_idx
  ON permit_records (jurisdiction_slug);
CREATE INDEX IF NOT EXISTS permit_records_license_idx
  ON permit_records (UPPER(REPLACE(contractor_license_key, ' ', '')))
  WHERE contractor_license_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS permit_records_zip_idx
  ON permit_records (zip);

-- Pre-aggregated activity by license for Trust Report (batch-maintained)
CREATE TABLE IF NOT EXISTS contractor_permit_activity (
  license_key_norm      TEXT PRIMARY KEY,
  permit_count          INT NOT NULL DEFAULT 0,
  counties              TEXT[] NOT NULL DEFAULT '{}',
  categories            TEXT[] NOT NULL DEFAULT '{}',
  recent_window         TEXT,
  sample_types          TEXT[] NOT NULL DEFAULT '{}',
  match_method          TEXT NOT NULL DEFAULT 'license',
  source_label          TEXT NOT NULL,
  retrieved_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permit_coverage_stats (
  jurisdiction_slug     TEXT PRIMARY KEY,
  record_count          BIGINT NOT NULL DEFAULT 0,
  with_license_key      BIGINT NOT NULL DEFAULT 0,
  license_join_hits     BIGINT NOT NULL DEFAULT 0,
  freshness             DATE,
  wave                  TEXT,
  notes                 TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
