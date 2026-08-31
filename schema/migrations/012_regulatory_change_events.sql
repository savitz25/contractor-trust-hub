-- ATH-CUST-008: private observational outbox produced by structured ingest.
-- This table is deliberately separate from authoritative evidence and publication state.

CREATE TABLE IF NOT EXISTS regulatory_change_events (
  sequence_id          BIGSERIAL PRIMARY KEY,
  id                   UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  contractor_id        UUID NOT NULL REFERENCES contractors (id) ON DELETE RESTRICT,
  source_system        TEXT NOT NULL,
  source_dataset       TEXT NOT NULL,
  source_record_id     TEXT NOT NULL,
  change_type          TEXT NOT NULL CHECK (change_type IN (
    'LICENSE_STATUS_CHANGED', 'LICENSE_EXPIRATION_CHANGED',
    'OFFICIAL_ADDRESS_CHANGED', 'BUSINESS_IDENTITY_CHANGED',
    'DISCIPLINE_ADDED', 'DISCIPLINE_UPDATED', 'SOURCE_RECORD_CORRECTED'
  )),
  prior_state          JSONB,
  current_state        JSONB NOT NULL,
  source_effective_at  TIMESTAMPTZ,
  detected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingest_batch_id      UUID REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  fingerprint_sha256   TEXT NOT NULL UNIQUE,
  provenance           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_change_events_fingerprint_check
    CHECK (fingerprint_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS regulatory_change_events_profile_idx
  ON regulatory_change_events (contractor_id, sequence_id);
CREATE INDEX IF NOT EXISTS regulatory_change_events_detected_idx
  ON regulatory_change_events (detected_at, sequence_id);

COMMENT ON TABLE regulatory_change_events IS
  'Private, additive monitoring outbox derived from normalized ingest differences; never authoritative evidence, publication state, or ranking input';
