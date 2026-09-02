-- Official list snapshots and observations (NJ-CON-001).
-- Generic reusable model: source-family adapters, not a new table pair per state.
-- Not discipline_actions: those rows are board/ULA discipline with Florida
-- publication gates. Not regulatory_source_observations: that table requires a
-- non-null discipline_action_id. PWCR is a registration roster; WALL/watchlist/
-- Treasury are current official lists. Source families stay distinct via
-- source_family. contractor_id is nullable. No composite score.

CREATE TABLE IF NOT EXISTS official_source_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_family        TEXT NOT NULL CHECK (source_family ~ '^[A-Z][A-Z0-9_]{2,}$'),
  agency               TEXT NOT NULL,
  official_url         TEXT NOT NULL,
  retrieved_at         TIMESTAMPTZ NOT NULL,
  source_as_of         DATE,
  source_hash_sha256   TEXT NOT NULL,
  row_count            INTEGER,
  schema_fingerprint   TEXT NOT NULL,
  jurisdiction         CHAR(2) NOT NULL,
  is_baseline          BOOLEAN NOT NULL DEFAULT TRUE,
  is_current_only      BOOLEAN,
  ingest_batch_id      UUID REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT official_source_snapshots_hash_check
    CHECK (source_hash_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT official_source_snapshots_family_hash_unique
    UNIQUE (source_family, source_hash_sha256)
);

CREATE INDEX IF NOT EXISTS official_source_snapshots_family_idx
  ON official_source_snapshots (source_family, retrieved_at DESC);

CREATE TABLE IF NOT EXISTS official_source_observations (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id                UUID NOT NULL REFERENCES official_source_snapshots (id) ON DELETE RESTRICT,
  ingest_batch_id            UUID REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  source_family              TEXT NOT NULL CHECK (source_family ~ '^[A-Z][A-Z0-9_]{2,}$'),
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
  CONSTRAINT official_source_observations_fingerprint_check
    CHECK (row_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT official_source_observations_identity_unique
    UNIQUE (source_family, source_observation_key)
);

CREATE INDEX IF NOT EXISTS official_source_observations_contractor_idx
  ON official_source_observations (contractor_id)
  WHERE contractor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS official_source_observations_family_idx
  ON official_source_observations (source_family, match_method);
CREATE INDEX IF NOT EXISTS official_source_observations_vendor_idx
  ON official_source_observations (certificate_or_vendor_id)
  WHERE certificate_or_vendor_id IS NOT NULL;

-- Duplicate official rows keep provenance here; the observation row is unique.
CREATE TABLE IF NOT EXISTS official_source_occurrences (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id          UUID NOT NULL REFERENCES official_source_observations (id) ON DELETE RESTRICT,
  snapshot_id             UUID NOT NULL REFERENCES official_source_snapshots (id) ON DELETE RESTRICT,
  ingest_batch_id         UUID REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  source_record_locator   TEXT NOT NULL,
  source_file             TEXT,
  observed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT official_source_occurrences_identity_unique
    UNIQUE (observation_id, snapshot_id, source_record_locator)
);

CREATE INDEX IF NOT EXISTS official_source_occurrences_snapshot_idx
  ON official_source_occurrences (snapshot_id);

COMMENT ON TABLE official_source_snapshots IS
  'Provenance for one official list/file snapshot. Reusable across jurisdictions. Families are never collapsed.';
COMMENT ON TABLE official_source_observations IS
  'Normalized official list rows (registration, watchlist, debarment, etc.). contractor_id nullable. Absence is not a clean history.';
COMMENT ON TABLE official_source_occurrences IS
  'Each sighting of an official row in a file/snapshot, including duplicate source rows.';
COMMENT ON COLUMN official_source_observations.public_eligibility_status IS
  'NJ-CON-001 remains internal_only; no New Jersey UI, sitemap, score, or badge publication';

-- Manual reversal before adoption only:
-- DROP TABLE IF EXISTS official_source_occurrences;
-- DROP TABLE IF EXISTS official_source_observations;
-- DROP TABLE IF EXISTS official_source_snapshots;
