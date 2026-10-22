-- CON-OSHA-002 state expansion. DRAFT ONLY: do not execute in this PR.
-- Migration 019 is already applied and is not modified or reapplied here.
-- Widening storage does not publish a state. CON_OSHA_PROFILE_STATES stays FL,NJ
-- until a later authorized flag change. Unknown states fail closed in the app.

CREATE TABLE IF NOT EXISTS osha_expansion_load_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state CHAR(2) NOT NULL CHECK (state IN ('CA', 'VA', 'LA', 'NV', 'AZ', 'TN')),
  ingest_batch_id UUID NOT NULL REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  b2_source_system TEXT NOT NULL CHECK (length(btrim(b2_source_system)) > 0),
  b2_package_sha256 CHAR(64) NOT NULL CHECK (b2_package_sha256 ~ '^[0-9a-f]{64}$'),
  ca_name_source TEXT CHECK (ca_name_source IS NULL OR ca_name_source = 'licensee_name_raw'),
  source_zip_sha256 TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  public_profile_count INTEGER NOT NULL CHECK (public_profile_count >= 0),
  inspection_count INTEGER NOT NULL CHECK (inspection_count >= 0),
  citation_count INTEGER NOT NULL CHECK (citation_count >= 0),
  ambiguous_activity_count INTEGER NOT NULL CHECK (ambiguous_activity_count >= 0),
  missing_citation_context_count INTEGER NOT NULL CHECK (missing_citation_context_count >= 0),
  held_row_count INTEGER NOT NULL CHECK (held_row_count >= 0),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'loaded', 'rolled_back')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (state, ingest_batch_id),
  UNIQUE (id, ingest_batch_id)
);

COMMENT ON TABLE osha_expansion_load_receipts IS
  'Per-state CON-OSHA-002 batch owner. One row per expansion state and ingest batch. Not the FL/NJ osha_load_receipts pilot receipt.';

CREATE TABLE IF NOT EXISTS contractor_osha_expansion_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state CHAR(2) NOT NULL CHECK (state IN ('CA', 'VA', 'LA', 'NV', 'AZ', 'TN')),
  license_key TEXT NOT NULL CHECK (
    length(btrim(license_key)) > 0
    OR (activity_nr IS NOT NULL AND length(btrim(activity_nr)) > 0)
  ),
  contractor_id UUID NULL REFERENCES contractors (id) ON DELETE RESTRICT,
  activity_nr TEXT,
  citation_id TEXT,
  hold_reason TEXT NOT NULL CHECK (hold_reason IN (
    'weak',
    'unsupported_tier',
    'person_name',
    'no_verified_license',
    'name_only',
    'ambiguous_activity',
    'matcher_unauthorized',
    'no_activities',
    'missing_citation_context',
    'unsupported_citation',
    'deleted_citation',
    'incomplete_detail',
    'missing_inspection'
  )),
  expansion_receipt_id UUID NOT NULL,
  ingest_batch_id UUID NOT NULL REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (expansion_receipt_id, ingest_batch_id)
    REFERENCES osha_expansion_load_receipts (id, ingest_batch_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS contractor_osha_expansion_holds_idem
  ON contractor_osha_expansion_holds (
    state,
    license_key,
    COALESCE(activity_nr, ''),
    COALESCE(citation_id, ''),
    hold_reason,
    ingest_batch_id
  );

COMMENT ON TABLE contractor_osha_expansion_holds IS
  'Private evidence for excluded OSHA expansion rows. Profile reads must not select this table.';

-- Replace only the four named FL/NJ state checks from migrations 018 and 019.
-- Those inline CHECKs use PostgreSQL's default names. This migration does not
-- search for constraints by pattern. A missing name, a different definition,
-- or a second FL/NJ state check fails closed.
-- osha_load_receipts.pilot_states stays exactly FL,NJ. Loading a state does
-- not publish it.
DO $$
DECLARE
  pilot_def text;
  pilot_count integer;
BEGIN
  SELECT count(*), min(pg_get_constraintdef(oid))
    INTO pilot_count, pilot_def
  FROM pg_constraint
  WHERE conrelid = 'public.osha_load_receipts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%pilot_states%';
  IF pilot_count <> 1
     OR (
       replace(pilot_def, ' ', '') IS DISTINCT FROM 'CHECK((pilot_states=''FL,NJ''::text))'
       AND replace(pilot_def, ' ', '') IS DISTINCT FROM 'CHECK((pilot_states=''FL,NJ''))'
     ) THEN
    RAISE EXCEPTION 'osha_load_receipts.pilot_states is not the live FL,NJ allow-list';
  END IF;
  IF pilot_def LIKE '%CA%' THEN
    RAISE EXCEPTION 'osha_load_receipts.pilot_states must not include an expansion state';
  END IF;
END $$;

DO $$
DECLARE
  def text;
  extra integer;
  compact text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conname = 'contractor_osha_license_matches_state_check'
    AND conrelid = 'public.contractor_osha_license_matches'::regclass
    AND contype = 'c';
  IF def IS NULL THEN
    RAISE EXCEPTION 'missing expected OSHA state check contractor_osha_license_matches_state_check';
  END IF;
  compact := regexp_replace(def, '\s+', '', 'g');
  IF compact <> 'CHECK((state=ANY(ARRAY[''FL''::bpchar,''NJ''::bpchar])))'
     AND compact <> 'CHECK((state=ANY(ARRAY[''FL''::character(2),''NJ''::character(2)])))' THEN
    RAISE EXCEPTION 'contractor_osha_license_matches_state_check is not the live FL/NJ definition';
  END IF;
  SELECT count(*) INTO extra
  FROM pg_constraint
  WHERE conrelid = 'public.contractor_osha_license_matches'::regclass
    AND contype = 'c'
    AND conname <> 'contractor_osha_license_matches_state_check'
    AND pg_get_constraintdef(oid) LIKE '%''FL''%'
    AND pg_get_constraintdef(oid) LIKE '%''NJ''%';
  IF extra <> 0 THEN
    RAISE EXCEPTION 'unexpected extra state check on contractor_osha_license_matches';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conname = 'contractor_osha_identity_review_state_check'
    AND conrelid = 'public.contractor_osha_identity_review'::regclass
    AND contype = 'c';
  IF def IS NULL THEN
    RAISE EXCEPTION 'missing expected OSHA state check contractor_osha_identity_review_state_check';
  END IF;
  compact := regexp_replace(def, '\s+', '', 'g');
  IF compact <> 'CHECK((state=ANY(ARRAY[''FL''::bpchar,''NJ''::bpchar])))'
     AND compact <> 'CHECK((state=ANY(ARRAY[''FL''::character(2),''NJ''::character(2)])))' THEN
    RAISE EXCEPTION 'contractor_osha_identity_review_state_check is not the live FL/NJ definition';
  END IF;
  SELECT count(*) INTO extra
  FROM pg_constraint
  WHERE conrelid = 'public.contractor_osha_identity_review'::regclass
    AND contype = 'c'
    AND conname <> 'contractor_osha_identity_review_state_check'
    AND pg_get_constraintdef(oid) LIKE '%''FL''%'
    AND pg_get_constraintdef(oid) LIKE '%''NJ''%';
  IF extra <> 0 THEN
    RAISE EXCEPTION 'unexpected extra state check on contractor_osha_identity_review';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conname = 'contractor_osha_inspections_state_check'
    AND conrelid = 'public.contractor_osha_inspections'::regclass
    AND contype = 'c';
  IF def IS NULL THEN
    RAISE EXCEPTION 'missing expected OSHA state check contractor_osha_inspections_state_check';
  END IF;
  compact := regexp_replace(def, '\s+', '', 'g');
  IF compact <> 'CHECK((state=ANY(ARRAY[''FL''::bpchar,''NJ''::bpchar])))'
     AND compact <> 'CHECK((state=ANY(ARRAY[''FL''::character(2),''NJ''::character(2)])))' THEN
    RAISE EXCEPTION 'contractor_osha_inspections_state_check is not the live FL/NJ definition';
  END IF;
  SELECT count(*) INTO extra
  FROM pg_constraint
  WHERE conrelid = 'public.contractor_osha_inspections'::regclass
    AND contype = 'c'
    AND conname <> 'contractor_osha_inspections_state_check'
    AND pg_get_constraintdef(oid) LIKE '%''FL''%'
    AND pg_get_constraintdef(oid) LIKE '%''NJ''%';
  IF extra <> 0 THEN
    RAISE EXCEPTION 'unexpected extra state check on contractor_osha_inspections';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conname = 'contractor_osha_match_inspections_state_check'
    AND conrelid = 'public.contractor_osha_match_inspections'::regclass
    AND contype = 'c';
  IF def IS NULL THEN
    RAISE EXCEPTION 'missing expected OSHA state check contractor_osha_match_inspections_state_check';
  END IF;
  compact := regexp_replace(def, '\s+', '', 'g');
  IF compact <> 'CHECK((state=ANY(ARRAY[''FL''::bpchar,''NJ''::bpchar])))'
     AND compact <> 'CHECK((state=ANY(ARRAY[''FL''::character(2),''NJ''::character(2)])))' THEN
    RAISE EXCEPTION 'contractor_osha_match_inspections_state_check is not the live FL/NJ definition';
  END IF;
  SELECT count(*) INTO extra
  FROM pg_constraint
  WHERE conrelid = 'public.contractor_osha_match_inspections'::regclass
    AND contype = 'c'
    AND conname <> 'contractor_osha_match_inspections_state_check'
    AND pg_get_constraintdef(oid) LIKE '%''FL''%'
    AND pg_get_constraintdef(oid) LIKE '%''NJ''%';
  IF extra <> 0 THEN
    RAISE EXCEPTION 'unexpected extra state check on contractor_osha_match_inspections';
  END IF;
END $$;

ALTER TABLE contractor_osha_license_matches
  DROP CONSTRAINT contractor_osha_license_matches_state_check;
ALTER TABLE contractor_osha_license_matches
  ADD CONSTRAINT contractor_osha_license_matches_state_check
  CHECK (state IN ('FL', 'NJ', 'CA', 'VA', 'LA', 'NV', 'AZ', 'TN'));

ALTER TABLE contractor_osha_identity_review
  DROP CONSTRAINT contractor_osha_identity_review_state_check;
ALTER TABLE contractor_osha_identity_review
  ADD CONSTRAINT contractor_osha_identity_review_state_check
  CHECK (state IN ('FL', 'NJ', 'CA', 'VA', 'LA', 'NV', 'AZ', 'TN'));

ALTER TABLE contractor_osha_inspections
  DROP CONSTRAINT contractor_osha_inspections_state_check;
ALTER TABLE contractor_osha_inspections
  ADD CONSTRAINT contractor_osha_inspections_state_check
  CHECK (state IN ('FL', 'NJ', 'CA', 'VA', 'LA', 'NV', 'AZ', 'TN'));

ALTER TABLE contractor_osha_match_inspections
  DROP CONSTRAINT contractor_osha_match_inspections_state_check;
ALTER TABLE contractor_osha_match_inspections
  ADD CONSTRAINT contractor_osha_match_inspections_state_check
  CHECK (state IN ('FL', 'NJ', 'CA', 'VA', 'LA', 'NV', 'AZ', 'TN'));

ALTER TABLE contractor_osha_license_matches
  ALTER COLUMN receipt_id DROP NOT NULL;
ALTER TABLE contractor_osha_license_matches
  ADD COLUMN IF NOT EXISTS expansion_receipt_id UUID;
ALTER TABLE contractor_osha_license_matches
  ADD COLUMN IF NOT EXISTS osha_matched_activity_nrs TEXT;

COMMENT ON COLUMN contractor_osha_license_matches.osha_activity_nrs IS
  'Semicolon-separated published activity numbers. Expansion loads store only post-hold activities here.';
COMMENT ON COLUMN contractor_osha_license_matches.osha_matched_activity_nrs IS
  'Private pre-hold activity list. Public reads and detail APIs must not select this column.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contractor_osha_license_matches_expansion_receipt_batch'
  ) THEN
    ALTER TABLE contractor_osha_license_matches
      ADD CONSTRAINT contractor_osha_license_matches_expansion_receipt_batch
      FOREIGN KEY (expansion_receipt_id, ingest_batch_id)
      REFERENCES osha_expansion_load_receipts (id, ingest_batch_id)
      ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contractor_osha_license_matches_receipt_owner'
  ) THEN
    ALTER TABLE contractor_osha_license_matches
      ADD CONSTRAINT contractor_osha_license_matches_receipt_owner
      CHECK (
        (state IN ('FL', 'NJ') AND receipt_id IS NOT NULL AND expansion_receipt_id IS NULL)
        OR
        (state IN ('CA', 'VA', 'LA', 'NV', 'AZ', 'TN') AND receipt_id IS NULL AND expansion_receipt_id IS NOT NULL)
      );
  END IF;
END $$;

ALTER TABLE contractor_osha_identity_review
  ALTER COLUMN receipt_id DROP NOT NULL;
ALTER TABLE contractor_osha_identity_review
  ADD COLUMN IF NOT EXISTS expansion_receipt_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contractor_osha_identity_review_expansion_receipt_batch'
  ) THEN
    ALTER TABLE contractor_osha_identity_review
      ADD CONSTRAINT contractor_osha_identity_review_expansion_receipt_batch
      FOREIGN KEY (expansion_receipt_id, ingest_batch_id)
      REFERENCES osha_expansion_load_receipts (id, ingest_batch_id)
      ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contractor_osha_identity_review_receipt_owner'
  ) THEN
    ALTER TABLE contractor_osha_identity_review
      ADD CONSTRAINT contractor_osha_identity_review_receipt_owner
      CHECK (
        (state IN ('FL', 'NJ') AND receipt_id IS NOT NULL AND expansion_receipt_id IS NULL)
        OR
        (state IN ('CA', 'VA', 'LA', 'NV', 'AZ', 'TN') AND receipt_id IS NULL AND expansion_receipt_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contractor_osha_license_matches_expansion_receipt_idx
  ON contractor_osha_license_matches (expansion_receipt_id);
CREATE INDEX IF NOT EXISTS contractor_osha_identity_review_expansion_receipt_idx
  ON contractor_osha_identity_review (expansion_receipt_id);
CREATE INDEX IF NOT EXISTS contractor_osha_expansion_holds_batch_idx
  ON contractor_osha_expansion_holds (ingest_batch_id, state);

ALTER TABLE osha_expansion_load_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_osha_expansion_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON osha_expansion_load_receipts FROM PUBLIC;
REVOKE ALL ON contractor_osha_expansion_holds FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON osha_expansion_load_receipts FROM anon';
    EXECUTE 'REVOKE ALL ON contractor_osha_expansion_holds FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON osha_expansion_load_receipts FROM authenticated';
    EXECUTE 'REVOKE ALL ON contractor_osha_expansion_holds FROM authenticated';
  END IF;
END $$;
