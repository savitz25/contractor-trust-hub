-- CTH-FL-SAFE-001 / SAFE-002A-R: additive, fail-closed Florida regulatory
-- identity/publication state on the shared multi-state discipline table.
-- The deployed application is pre-migration compatible only while
-- REGULATORY_PUBLICATION_GATE_V1 is OFF. Apply this migration before a Florida
-- regulatory backfill, before running the safety-aware Florida DBPR loader in
-- production, and before enabling REGULATORY_PUBLICATION_GATE_V1.
-- This migration initializes safety state only for existing fl_dbpr rows. It
-- does not relink or publish rows. NULL on a non-FL row means not evaluated
-- under the Florida safety contract v1.

ALTER TABLE discipline_actions
  ADD COLUMN IF NOT EXISTS identity_state TEXT,
  ADD COLUMN IF NOT EXISTS identity_method TEXT,
  ADD COLUMN IF NOT EXISTS resolver_version TEXT,
  ADD COLUMN IF NOT EXISTS resolved_license_external_key TEXT,
  ADD COLUMN IF NOT EXISTS identity_evidence JSONB,
  ADD COLUMN IF NOT EXISTS identity_evaluated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS publication_state TEXT,
  ADD COLUMN IF NOT EXISTS publication_evidence JSONB,
  ADD COLUMN IF NOT EXISTS publication_evaluated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withheld_reason TEXT,
  ADD COLUMN IF NOT EXISTS correction_hold BOOLEAN,
  ADD COLUMN IF NOT EXISTS retraction_hold BOOLEAN;

UPDATE discipline_actions
SET identity_state = 'UNRESOLVED',
    publication_state = 'INTERNAL',
    correction_hold = FALSE,
    retraction_hold = FALSE
WHERE source_system = 'fl_dbpr';

ALTER TABLE discipline_actions
  DROP CONSTRAINT IF EXISTS discipline_actions_identity_state_check,
  ADD CONSTRAINT discipline_actions_identity_state_check
    CHECK (
      source_system <> 'fl_dbpr'
      OR (
        identity_state IS NOT NULL
        AND identity_state IN ('EXACT', 'DETERMINISTIC', 'REVIEW_REQUIRED', 'UNRESOLVED')
      )
    ),
  DROP CONSTRAINT IF EXISTS discipline_actions_publication_state_check,
  ADD CONSTRAINT discipline_actions_publication_state_check
    CHECK (
      source_system <> 'fl_dbpr'
      OR (
        publication_state IS NOT NULL
        AND publication_state IN ('INTERNAL', 'PUBLIC_ELIGIBLE', 'WITHHELD')
      )
    ),
  DROP CONSTRAINT IF EXISTS discipline_actions_fl_hold_state_check,
  ADD CONSTRAINT discipline_actions_fl_hold_state_check
    CHECK (
      source_system <> 'fl_dbpr'
      OR (correction_hold IS NOT NULL AND retraction_hold IS NOT NULL)
    ),
  DROP CONSTRAINT IF EXISTS discipline_actions_public_eligibility_check,
  ADD CONSTRAINT discipline_actions_public_eligibility_check CHECK (
    source_system <> 'fl_dbpr'
    OR publication_state <> 'PUBLIC_ELIGIBLE'
    OR (
      identity_state IN ('EXACT', 'DETERMINISTIC')
      AND contractor_id IS NOT NULL
      AND license_id IS NOT NULL
      AND ingest_batch_id IS NOT NULL
      AND last_verified_at IS NOT NULL
      AND identity_evaluated_at IS NOT NULL
      AND publication_evaluated_at IS NOT NULL
      AND (publication_evidence @> '{
        "authoritative_source": true,
        "valid_license_contractor_relationship": true,
        "recognized_regulatory_semantics": true,
        "provenance_complete": true,
        "source_fresh": true,
        "identifier_conflict": false
      }'::jsonb) IS TRUE
      AND correction_hold IS FALSE
      AND retraction_hold IS FALSE
    )
  );

CREATE INDEX IF NOT EXISTS discipline_publication_gate_idx
  ON discipline_actions (contractor_id, publication_state, identity_state)
  WHERE source_system = 'fl_dbpr'
    AND publication_state = 'PUBLIC_ELIGIBLE';

COMMENT ON COLUMN discipline_actions.identity_state IS
  'Florida safety v1 resolver outcome for fl_dbpr; NULL means a non-FL row was not evaluated under that contract';
COMMENT ON COLUMN discipline_actions.publication_state IS
  'Florida safety v1 fail-closed publication state for fl_dbpr; contractor_id alone never authorizes publication';
COMMENT ON COLUMN discipline_actions.identity_evidence IS
  'Non-secret resolver evidence/reason metadata; source identifiers remain in their original columns';

-- Reversal (manual, only after application rollback; destructive to safety metadata):
-- DROP INDEX IF EXISTS discipline_publication_gate_idx;
-- ALTER TABLE discipline_actions
--   DROP CONSTRAINT IF EXISTS discipline_actions_public_eligibility_check,
--   DROP CONSTRAINT IF EXISTS discipline_actions_fl_hold_state_check,
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
