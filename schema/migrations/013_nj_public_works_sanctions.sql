-- NJ-CON-001: public-works registration and exclusion-source observations.
-- Additive only. Does not alter Florida, national, HIC/board, sitemap, or publication tables.
-- contractor_id is nullable. Source families stay distinct. No composite score.

CREATE TABLE IF NOT EXISTS nj_source_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_family        TEXT NOT NULL CHECK (source_family IN (
    'NJ_PWCR_REGISTRATION',
    'NJ_PREVAILING_WAGE_DEBARMENT',
    'NJ_WALL',
    'NJ_WAGE_VIOLATION_WATCHLIST',
    'NJ_TREASURY_CONSTRUCTION_DEBARMENT',
    'NJ_TREASURY_VENDOR_DEBARMENT'
  )),
  agency               TEXT NOT NULL,
  official_url         TEXT NOT NULL,
  retrieved_at         TIMESTAMPTZ NOT NULL,
  source_as_of         DATE,
  source_hash_sha256   TEXT NOT NULL,
  row_count            INTEGER,
  schema_fingerprint   TEXT NOT NULL,
  jurisdiction         CHAR(2) NOT NULL DEFAULT 'NJ',
  is_baseline          BOOLEAN NOT NULL DEFAULT TRUE,
  is_current_only      BOOLEAN,
  ingest_batch_id      UUID REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT nj_source_snapshots_hash_check
    CHECK (source_hash_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT nj_source_snapshots_family_hash_unique
    UNIQUE (source_family, source_hash_sha256)
);

CREATE INDEX IF NOT EXISTS nj_source_snapshots_family_idx
  ON nj_source_snapshots (source_family, retrieved_at DESC);

CREATE TABLE IF NOT EXISTS nj_source_observations (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id                UUID NOT NULL REFERENCES nj_source_snapshots (id) ON DELETE RESTRICT,
  ingest_batch_id            UUID REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  source_family              TEXT NOT NULL CHECK (source_family IN (
    'NJ_PWCR_REGISTRATION',
    'NJ_PREVAILING_WAGE_DEBARMENT',
    'NJ_WALL',
    'NJ_WAGE_VIOLATION_WATCHLIST',
    'NJ_TREASURY_CONSTRUCTION_DEBARMENT',
    'NJ_TREASURY_VENDOR_DEBARMENT'
  )),
  source_record_id           TEXT NOT NULL,
  source_observation_key     TEXT NOT NULL,
  row_fingerprint_sha256     TEXT NOT NULL,
  contractor_id              UUID REFERENCES contractors (id) ON DELETE RESTRICT,
  official_business_name     TEXT,
  individual_name            TEXT,
  address_line_1             TEXT,
  city                       TEXT,
  state                      TEXT,
  postal_code                TEXT,
  county                     TEXT,
  certificate_or_vendor_id   TEXT,
  registration_status        TEXT,
  effective_date             DATE,
  expiration_date            DATE,
  action                     TEXT,
  reason_code                TEXT,
  reason_text                TEXT,
  debarring_department       TEXT,
  debarring_agency           TEXT,
  permanent_flag             TEXT,
  source_publication_date    DATE,
  match_method               TEXT NOT NULL CHECK (match_method IN (
    'exact', 'high_confidence', 'review_required', 'conflict', 'unresolved'
  )),
  match_confidence           TEXT NOT NULL,
  public_eligibility_status  TEXT NOT NULL DEFAULT 'internal_only',
  currency                   TEXT NOT NULL DEFAULT 'current_snapshot',
  raw_payload                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT nj_source_observations_fingerprint_check
    CHECK (row_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT nj_source_observations_identity_unique
    UNIQUE (source_family, source_observation_key)
);

CREATE INDEX IF NOT EXISTS nj_source_observations_contractor_idx
  ON nj_source_observations (contractor_id)
  WHERE contractor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS nj_source_observations_family_idx
  ON nj_source_observations (source_family, match_method);
CREATE INDEX IF NOT EXISTS nj_source_observations_vendor_idx
  ON nj_source_observations (certificate_or_vendor_id)
  WHERE certificate_or_vendor_id IS NOT NULL;

COMMENT ON TABLE nj_source_snapshots IS
  'Provenance for one official NJ public-works or exclusion-source file snapshot; families are never collapsed';
COMMENT ON TABLE nj_source_observations IS
  'Normalized official NJ PWCR/exclusion rows. contractor_id nullable. Absence from a snapshot is not a clean history.';
COMMENT ON COLUMN nj_source_observations.public_eligibility_status IS
  'NJ-CON-001 remains internal_only; no New Jersey UI, sitemap, score, or badge publication';

-- Manual reversal before adoption only:
-- DROP TABLE IF EXISTS nj_source_observations;
-- DROP TABLE IF EXISTS nj_source_snapshots;
