-- CTH-FL-STATE-002A: immutable regulatory source observations and occurrences.
-- Structure only: this migration performs no backfill and changes no evidence,
-- license, contractor, identity, or publication relationship/state.

CREATE TABLE IF NOT EXISTS regulatory_source_observations (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_action_id          UUID NOT NULL REFERENCES discipline_actions (id) ON DELETE RESTRICT,
  source_system                 TEXT NOT NULL,
  source_dataset                TEXT NOT NULL,
  source_observation_key        TEXT NOT NULL,
  source_observation_algorithm  TEXT NOT NULL,
  logical_matter_detail_key     TEXT,
  logical_matter_algorithm      TEXT,
  row_fingerprint_sha256        TEXT NOT NULL,
  source_payload                JSONB NOT NULL,
  revision_state                TEXT NOT NULL DEFAULT 'CURRENT',
  superseded_by_observation_id  UUID REFERENCES regulatory_source_observations (id) ON DELETE RESTRICT,
  first_observed_at             TIMESTAMPTZ NOT NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_source_observations_identity_unique
    UNIQUE (source_system, source_dataset, source_observation_key),
  CONSTRAINT regulatory_source_observations_fingerprint_check
    CHECK (row_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT regulatory_source_observations_revision_state_check
    CHECK (revision_state IN ('CURRENT', 'SUPERSEDED', 'REVISION_REVIEW_REQUIRED')),
  CONSTRAINT regulatory_source_observations_supersession_check
    CHECK (
      (revision_state = 'SUPERSEDED' AND superseded_by_observation_id IS NOT NULL)
      OR (revision_state <> 'SUPERSEDED' AND superseded_by_observation_id IS NULL)
    ),
  CONSTRAINT regulatory_source_observations_not_self_superseded_check
    CHECK (superseded_by_observation_id IS NULL OR superseded_by_observation_id <> id)
);

CREATE INDEX IF NOT EXISTS regulatory_source_observations_discipline_idx
  ON regulatory_source_observations (discipline_action_id);
CREATE INDEX IF NOT EXISTS regulatory_source_observations_logical_review_idx
  ON regulatory_source_observations (source_system, source_dataset, logical_matter_detail_key)
  WHERE logical_matter_detail_key IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_regulatory_source_observation_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.discipline_action_id IS DISTINCT FROM OLD.discipline_action_id
     OR NEW.source_system IS DISTINCT FROM OLD.source_system
     OR NEW.source_dataset IS DISTINCT FROM OLD.source_dataset
     OR NEW.source_observation_key IS DISTINCT FROM OLD.source_observation_key
     OR NEW.source_observation_algorithm IS DISTINCT FROM OLD.source_observation_algorithm
     OR NEW.logical_matter_detail_key IS DISTINCT FROM OLD.logical_matter_detail_key
     OR NEW.logical_matter_algorithm IS DISTINCT FROM OLD.logical_matter_algorithm
     OR NEW.row_fingerprint_sha256 IS DISTINCT FROM OLD.row_fingerprint_sha256
     OR NEW.source_payload IS DISTINCT FROM OLD.source_payload
     OR NEW.first_observed_at IS DISTINCT FROM OLD.first_observed_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'regulatory source observation identity and payload are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS regulatory_source_observations_immutable_trg
  ON regulatory_source_observations;
CREATE TRIGGER regulatory_source_observations_immutable_trg
BEFORE UPDATE ON regulatory_source_observations
FOR EACH ROW EXECUTE FUNCTION enforce_regulatory_source_observation_immutability();

CREATE TABLE IF NOT EXISTS regulatory_source_occurrences (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_observation_id        UUID NOT NULL REFERENCES regulatory_source_observations (id) ON DELETE RESTRICT,
  ingest_batch_id              UUID NOT NULL REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  fiscal_year                  TEXT NOT NULL,
  source_file_checksum_sha256  TEXT NOT NULL,
  source_record_locator        TEXT NOT NULL,
  source_file                  TEXT,
  source_url                   TEXT,
  observed_at                  TIMESTAMPTZ NOT NULL,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_source_occurrences_checksum_check
    CHECK (source_file_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT regulatory_source_occurrences_identity_unique
    UNIQUE (
      source_observation_id, ingest_batch_id, fiscal_year,
      source_file_checksum_sha256, source_record_locator
    )
);

CREATE INDEX IF NOT EXISTS regulatory_source_occurrences_batch_idx
  ON regulatory_source_occurrences (ingest_batch_id);
CREATE INDEX IF NOT EXISTS regulatory_source_occurrences_file_idx
  ON regulatory_source_occurrences (source_file_checksum_sha256, fiscal_year);

COMMENT ON TABLE regulatory_source_observations IS
  'Immutable exact regulator-published row versions linked to logical regulatory evidence; source identity never grants license, contractor, or publication identity';
COMMENT ON COLUMN regulatory_source_observations.logical_matter_detail_key IS
  'Review/grouping hint only; never an automatic dedupe, supersession, linkage, or publication key';
COMMENT ON TABLE regulatory_source_occurrences IS
  'Immutable sightings of an exact source observation in a particular ingest batch/file/period';

-- Manual reversal before adoption/backfill only:
-- DROP TABLE IF EXISTS regulatory_source_occurrences;
-- DROP TABLE IF EXISTS regulatory_source_observations;
-- DROP FUNCTION IF EXISTS enforce_regulatory_source_observation_immutability();
