-- CTH-FL-SAFE-001: additive, fail-closed regulatory identity/publication state.
-- Apply before deploying application queries or the Florida DBPR loader in this commit.
-- This migration intentionally does not backfill, relink, or publish existing rows.

ALTER TABLE discipline_actions
  ADD COLUMN IF NOT EXISTS identity_state TEXT NOT NULL DEFAULT 'UNRESOLVED',
  ADD COLUMN IF NOT EXISTS identity_method TEXT,
  ADD COLUMN IF NOT EXISTS resolver_version TEXT,
  ADD COLUMN IF NOT EXISTS resolved_license_external_key TEXT,
  ADD COLUMN IF NOT EXISTS identity_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS identity_evaluated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS publication_state TEXT NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS publication_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS publication_evaluated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withheld_reason TEXT,
  ADD COLUMN IF NOT EXISTS correction_hold BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retraction_hold BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE discipline_actions
  DROP CONSTRAINT IF EXISTS discipline_actions_identity_state_check,
  ADD CONSTRAINT discipline_actions_identity_state_check
    CHECK (identity_state IN ('EXACT', 'DETERMINISTIC', 'REVIEW_REQUIRED', 'UNRESOLVED')),
  DROP CONSTRAINT IF EXISTS discipline_actions_publication_state_check,
  ADD CONSTRAINT discipline_actions_publication_state_check
    CHECK (publication_state IN ('INTERNAL', 'PUBLIC_ELIGIBLE', 'WITHHELD')),
  DROP CONSTRAINT IF EXISTS discipline_actions_public_eligibility_check,
  ADD CONSTRAINT discipline_actions_public_eligibility_check CHECK (
    publication_state <> 'PUBLIC_ELIGIBLE'
    OR (
      identity_state IN ('EXACT', 'DETERMINISTIC')
      AND contractor_id IS NOT NULL
      AND license_id IS NOT NULL
      AND ingest_batch_id IS NOT NULL
      AND last_verified_at IS NOT NULL
      AND identity_evaluated_at IS NOT NULL
      AND publication_evaluated_at IS NOT NULL
      AND publication_evidence @> '{
        "authoritative_source": true,
        "valid_license_contractor_relationship": true,
        "recognized_regulatory_semantics": true,
        "provenance_complete": true,
        "source_fresh": true,
        "identifier_conflict": false
      }'::jsonb
      AND correction_hold = FALSE
      AND retraction_hold = FALSE
    )
  );

CREATE INDEX IF NOT EXISTS discipline_publication_gate_idx
  ON discipline_actions (contractor_id, publication_state, identity_state)
  WHERE publication_state = 'PUBLIC_ELIGIBLE';

COMMENT ON COLUMN discipline_actions.identity_state IS
  'Resolver outcome: EXACT, DETERMINISTIC, REVIEW_REQUIRED, or UNRESOLVED';
COMMENT ON COLUMN discipline_actions.publication_state IS
  'Explicit fail-closed publication state; contractor_id alone never authorizes publication';
COMMENT ON COLUMN discipline_actions.identity_evidence IS
  'Non-secret resolver evidence/reason metadata; source identifiers remain in their original columns';

-- Reversal (manual, only after application rollback; destructive to safety metadata):
-- DROP INDEX IF EXISTS discipline_publication_gate_idx;
-- ALTER TABLE discipline_actions
--   DROP CONSTRAINT IF EXISTS discipline_actions_public_eligibility_check,
--   DROP CONSTRAINT IF EXISTS discipline_actions_publication_state_check,
--   DROP CONSTRAINT IF EXISTS discipline_actions_identity_state_check,
--   DROP COLUMN IF EXISTS retraction_hold,
--   DROP COLUMN IF EXISTS correction_hold,
--   DROP COLUMN IF EXISTS withheld_reason,
--   DROP COLUMN IF EXISTS publication_evaluated_at,
--   DROP COLUMN IF EXISTS publication_evidence,
--   DROP COLUMN IF EXISTS publication_state,
--   DROP COLUMN IF EXISTS review_reason,
--   DROP COLUMN IF EXISTS identity_evaluated_at,
--   DROP COLUMN IF EXISTS identity_evidence,
--   DROP COLUMN IF EXISTS resolved_license_external_key,
--   DROP COLUMN IF EXISTS resolver_version,
--   DROP COLUMN IF EXISTS identity_method,
--   DROP COLUMN IF EXISTS identity_state;
