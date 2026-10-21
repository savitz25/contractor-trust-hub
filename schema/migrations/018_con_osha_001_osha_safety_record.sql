-- CON-OSHA-001 draft schema. DO NOT EXECUTE in this PR.
-- No production load, no application of this file, no contractor profile inserts.
--
-- License-level OSHA totals for an existing Florida or New Jersey contractor license.
-- The verified 2026-10-21 handoff does not include per-inspection open date,
-- citation count, contest status, or final-order date. This migration therefore
-- does not create an inspection table. Do not split osha_activity_nrs into rows.
--
-- Public reads use contractor_osha_license_matches only (exact, strong).
-- Weak matches belong only in contractor_osha_identity_review.
-- Every public or review row requires an osha_load_receipts row tied to ingest_batches.

CREATE TABLE IF NOT EXISTS osha_load_receipts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingest_batch_id       UUID NOT NULL UNIQUE REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  source_system         TEXT NOT NULL CHECK (source_system = 'us_dol_osha'),
  source_dataset        TEXT NOT NULL,
  source_domain         TEXT NOT NULL CHECK (source_domain = 'data.dol.gov'),
  package_sha256        CHAR(64) NOT NULL CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  pilot_states          TEXT NOT NULL CHECK (pilot_states = 'FL,NJ'),
  fl_source_rows        INTEGER NOT NULL CHECK (fl_source_rows >= 0),
  nj_source_rows        INTEGER NOT NULL CHECK (nj_source_rows >= 0),
  fl_exact              INTEGER NOT NULL CHECK (fl_exact >= 0),
  fl_strong             INTEGER NOT NULL CHECK (fl_strong >= 0),
  fl_weak               INTEGER NOT NULL CHECK (fl_weak >= 0),
  nj_exact              INTEGER NOT NULL CHECK (nj_exact >= 0),
  nj_strong             INTEGER NOT NULL CHECK (nj_strong >= 0),
  nj_weak               INTEGER NOT NULL CHECK (nj_weak >= 0),
  public_rows_inserted  INTEGER NOT NULL DEFAULT 0 CHECK (public_rows_inserted >= 0),
  review_rows_inserted  INTEGER NOT NULL DEFAULT 0 CHECK (review_rows_inserted >= 0),
  skipped_no_profile    INTEGER NOT NULL DEFAULT 0 CHECK (skipped_no_profile >= 0),
  status                TEXT NOT NULL CHECK (status IN ('received', 'loaded', 'rolled_back')),
  loaded_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE osha_load_receipts IS
  'CON-OSHA-001 load receipt. A match row cannot exist without this receipt and its ingest_batches parent.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'osha_load_receipts_id_batch_key'
  ) THEN
    ALTER TABLE osha_load_receipts
      ADD CONSTRAINT osha_load_receipts_id_batch_key UNIQUE (id, ingest_batch_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS contractor_osha_license_matches (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id           UUID NOT NULL REFERENCES contractors (id) ON DELETE RESTRICT,
  license_key             TEXT NOT NULL CHECK (length(btrim(license_key)) > 0),
  state                   CHAR(2) NOT NULL CHECK (state IN ('FL', 'NJ')),
  match_tier              TEXT NOT NULL CHECK (match_tier IN ('exact', 'strong')),
  source_system           TEXT NOT NULL CHECK (source_system = 'us_dol_osha'),
  source_dataset          TEXT NOT NULL,
  ingest_batch_id         UUID NOT NULL REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  receipt_id              UUID NOT NULL REFERENCES osha_load_receipts (id) ON DELETE RESTRICT,
  n_inspections           INTEGER NOT NULL CHECK (n_inspections >= 0),
  first_open              DATE,
  last_open               DATE,
  n_citation_items        INTEGER NOT NULL CHECK (n_citation_items >= 0),
  n_serious               INTEGER NOT NULL CHECK (n_serious >= 0),
  n_willful_repeat        INTEGER NOT NULL CHECK (n_willful_repeat >= 0),
  initial_penalty_amount  INTEGER NOT NULL CHECK (initial_penalty_amount >= 0),
  current_penalty_amount  INTEGER NOT NULL CHECK (current_penalty_amount >= 0),
  n_with_final_order      INTEGER NOT NULL CHECK (n_with_final_order >= 0),
  n_contested             INTEGER NOT NULL CHECK (n_contested >= 0),
  osha_activity_nrs       TEXT,
  source_observed_on      DATE NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contractor_osha_license_matches_idem
    UNIQUE (state, license_key, ingest_batch_id),
  CONSTRAINT contractor_osha_license_matches_receipt_batch
    FOREIGN KEY (receipt_id, ingest_batch_id)
    REFERENCES osha_load_receipts (id, ingest_batch_id)
);

CREATE INDEX IF NOT EXISTS contractor_osha_license_matches_contractor_idx
  ON contractor_osha_license_matches (contractor_id);

CREATE INDEX IF NOT EXISTS contractor_osha_license_matches_batch_idx
  ON contractor_osha_license_matches (ingest_batch_id);

COMMENT ON COLUMN contractor_osha_license_matches.initial_penalty_amount IS
  'Whole dollars from the source extract. Not for public display. Profile SQL must not select it.';

COMMENT ON COLUMN contractor_osha_license_matches.osha_activity_nrs IS
  'Semicolon-separated activity numbers kept for a future official join. Do not render them as inspection rows.';

COMMENT ON TABLE contractor_osha_license_matches IS
  'Public OSHA license totals for an existing contractor. Weak matches are rejected by match_tier. Deleting a row does not delete the contractor.';

CREATE TABLE IF NOT EXISTS contractor_osha_identity_review (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id           UUID REFERENCES contractors (id) ON DELETE RESTRICT,
  license_key             TEXT NOT NULL CHECK (length(btrim(license_key)) > 0),
  state                   CHAR(2) NOT NULL CHECK (state IN ('FL', 'NJ')),
  match_tier              TEXT NOT NULL CHECK (match_tier = 'weak'),
  source_system           TEXT NOT NULL CHECK (source_system = 'us_dol_osha'),
  source_dataset          TEXT NOT NULL,
  ingest_batch_id         UUID NOT NULL REFERENCES ingest_batches (id) ON DELETE RESTRICT,
  receipt_id              UUID NOT NULL REFERENCES osha_load_receipts (id) ON DELETE RESTRICT,
  review_reason           TEXT NOT NULL CHECK (review_reason = 'name_location_below_public_threshold'),
  source_observed_on      DATE NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contractor_osha_identity_review_idem
    UNIQUE (state, license_key, ingest_batch_id),
  CONSTRAINT contractor_osha_identity_review_receipt_batch
    FOREIGN KEY (receipt_id, ingest_batch_id)
    REFERENCES osha_load_receipts (id, ingest_batch_id)
);

COMMENT ON TABLE contractor_osha_identity_review IS
  'Human-review queue for weak OSHA name matches. Profile reads must not select this table. No contractor is created from these rows.';

CREATE INDEX IF NOT EXISTS contractor_osha_identity_review_batch_idx
  ON contractor_osha_identity_review (ingest_batch_id);

ALTER TABLE osha_load_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_osha_license_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_osha_identity_review ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON osha_load_receipts FROM PUBLIC;
REVOKE ALL ON contractor_osha_license_matches FROM PUBLIC;
REVOKE ALL ON contractor_osha_identity_review FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON osha_load_receipts FROM anon';
    EXECUTE 'REVOKE ALL ON contractor_osha_license_matches FROM anon';
    EXECUTE 'REVOKE ALL ON contractor_osha_identity_review FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON osha_load_receipts FROM authenticated';
    EXECUTE 'REVOKE ALL ON contractor_osha_license_matches FROM authenticated';
    EXECUTE 'REVOKE ALL ON contractor_osha_identity_review FROM authenticated';
  END IF;
END $$;

-- Blocked until a later official extract is attached by activity number:
-- OPEN_DATE, per-activity citation count, CONTEST_DATE, FINAL_ORDER_DATE.
-- Do not add contractor_osha_inspections with values inferred from these totals.
