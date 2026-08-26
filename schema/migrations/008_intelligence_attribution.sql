-- INTEL-002 attribution / publication columns (additive).
-- Production already has these from CTH-FL-STATE-004/006A; IF NOT EXISTS keeps this idempotent.

ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS identity_state TEXT;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS identity_method TEXT;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS resolver_version TEXT;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS resolved_license_external_key TEXT;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS identity_evidence JSONB;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS identity_evaluated_at TIMESTAMPTZ;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS publication_state TEXT;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS publication_evidence JSONB;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS publication_evaluated_at TIMESTAMPTZ;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS withheld_reason TEXT;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS correction_hold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE discipline_actions ADD COLUMN IF NOT EXISTS retraction_hold BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS discipline_identity_state_idx
  ON discipline_actions (source_system, source_dataset, identity_state);
CREATE INDEX IF NOT EXISTS discipline_publication_state_idx
  ON discipline_actions (publication_state, contractor_id);

CREATE TABLE IF NOT EXISTS regulatory_source_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_action_id UUID REFERENCES discipline_actions (id) ON DELETE SET NULL,
  source_system TEXT NOT NULL,
  source_dataset TEXT NOT NULL,
  source_observation_key TEXT NOT NULL,
  source_observation_algorithm TEXT,
  logical_matter_detail_key TEXT,
  logical_matter_algorithm TEXT,
  row_fingerprint_sha256 TEXT,
  source_payload JSONB,
  revision_state TEXT NOT NULL DEFAULT 'CURRENT',
  superseded_by_observation_id UUID,
  first_observed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_observation_key)
);

CREATE TABLE IF NOT EXISTS regulatory_source_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_observation_id UUID NOT NULL REFERENCES regulatory_source_observations (id) ON DELETE CASCADE,
  ingest_batch_id UUID REFERENCES ingest_batches (id) ON DELETE SET NULL,
  fiscal_year TEXT,
  source_file_checksum_sha256 TEXT,
  source_record_locator TEXT,
  source_file TEXT,
  source_url TEXT,
  observed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regulatory_obs_dataset_idx
  ON regulatory_source_observations (source_system, source_dataset, revision_state);
CREATE INDEX IF NOT EXISTS regulatory_occ_obs_idx
  ON regulatory_source_occurrences (source_observation_id);

COMMENT ON COLUMN discipline_actions.publication_state IS
  'PUBLIC rows may appear on profiles. NULL is treated as INTERNAL (fail closed) for fl_dbpr/fl_dfs.';
COMMENT ON TABLE regulatory_source_observations IS
  'Parsed observations. Not interchangeable with attributed evidence or distinct contractors.';
