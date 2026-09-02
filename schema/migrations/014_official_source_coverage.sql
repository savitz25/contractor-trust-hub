-- Official-source coverage and evidence class (NJ-CON-002A-C).
-- Additive. Does not alter Florida discipline_actions or licenses.
-- SOURCE_NOT_ACQUIRED snapshots may exist with NULL row_count; they must never
-- be read as a complete empty scan or a clean-history conclusion.

ALTER TABLE official_source_snapshots
  ADD COLUMN IF NOT EXISTS source_coverage TEXT;

ALTER TABLE official_source_snapshots
  DROP CONSTRAINT IF EXISTS official_source_snapshots_coverage_check;

ALTER TABLE official_source_snapshots
  ADD CONSTRAINT official_source_snapshots_coverage_check
  CHECK (
    source_coverage IS NULL OR source_coverage IN (
      'ACQUIRED',
      'PARTIAL_SOURCE_COVERAGE',
      'SOURCE_NOT_ACQUIRED'
    )
  );

ALTER TABLE official_source_observations
  ADD COLUMN IF NOT EXISTS evidence_class TEXT;

ALTER TABLE official_source_observations
  DROP CONSTRAINT IF EXISTS official_source_observations_evidence_class_check;

ALTER TABLE official_source_observations
  ADD CONSTRAINT official_source_observations_evidence_class_check
  CHECK (
    evidence_class IS NULL OR evidence_class IN (
      'specialty_credential',
      'regulatory_event',
      'registration_roster',
      'exclusion_list'
    )
  );

COMMENT ON COLUMN official_source_snapshots.source_coverage IS
  'ACQUIRED = repeatable complete source file; PARTIAL_SOURCE_COVERAGE = indexed subset, not a complete corpus; SOURCE_NOT_ACQUIRED = source was not obtained. Missing source is never "no record found".';
COMMENT ON COLUMN official_source_observations.evidence_class IS
  'specialty_credential is not a disciplinary action. regulatory_event (NOV, order) is not a credential. registration_roster is not an exclusion list.';

-- Manual reversal before adoption only:
-- ALTER TABLE official_source_observations DROP COLUMN IF EXISTS evidence_class;
-- ALTER TABLE official_source_snapshots DROP COLUMN IF EXISTS source_coverage;
