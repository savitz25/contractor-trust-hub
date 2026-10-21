-- CON-OSHA-001B draft schema only. DO NOT EXECUTE in this PR.
-- Detail feature is separately gated by CON_OSHA_001B_DETAIL (default OFF).
-- Rows must be loaded only after B2's source receipt verifies source headers,
-- deleted-marker semantics, scoped counts, and aggregate reconciliation.

CREATE TABLE IF NOT EXISTS osha_detail_load_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_batch_id UUID NOT NULL REFERENCES ingest_batches(id) ON DELETE RESTRICT,
  source_dataset TEXT NOT NULL,
  source_hash CHAR(64) NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  inspection_rows INTEGER NOT NULL CHECK (inspection_rows >= 0),
  citation_rows INTEGER NOT NULL CHECK (citation_rows >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_batch_id, source_dataset, source_hash),
  UNIQUE (id, source_batch_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS contractor_osha_license_matches_detail_scope_key
  ON contractor_osha_license_matches (id, contractor_id, state, license_key);

CREATE TABLE IF NOT EXISTS contractor_osha_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_match_id UUID NOT NULL,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  state CHAR(2) NOT NULL CHECK (state IN ('FL', 'NJ')),
  license_key TEXT NOT NULL CHECK (length(btrim(license_key)) > 0),
  activity_nr TEXT NOT NULL CHECK (length(btrim(activity_nr)) > 0),
  open_date DATE,
  site_city TEXT,
  site_state CHAR(2),
  inspection_type TEXT,
  close_date DATE,
  closing_conference_date DATE,
  citations_verified BOOLEAN NOT NULL DEFAULT FALSE,
  source_batch_id UUID NOT NULL REFERENCES ingest_batches(id) ON DELETE RESTRICT,
  receipt_id UUID NOT NULL,
  source_hash CHAR(64) NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (public_match_id, activity_nr),
  UNIQUE (id, activity_nr),
  FOREIGN KEY (public_match_id, contractor_id, state, license_key)
    REFERENCES contractor_osha_license_matches(id, contractor_id, state, license_key) ON DELETE RESTRICT,
  FOREIGN KEY (receipt_id, source_batch_id)
    REFERENCES osha_detail_load_receipts(id, source_batch_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS contractor_osha_inspections_public_order_idx
  ON contractor_osha_inspections (public_match_id, open_date DESC NULLS LAST, activity_nr DESC);

CREATE TABLE IF NOT EXISTS contractor_osha_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL,
  activity_nr TEXT NOT NULL CHECK (length(btrim(activity_nr)) > 0),
  citation_id TEXT NOT NULL CHECK (length(btrim(citation_id)) > 0),
  standard TEXT NOT NULL,
  viol_type CHAR(1) NOT NULL CHECK (viol_type IN ('S', 'W', 'R', 'O')),
  current_penalty NUMERIC(14,2) NOT NULL CHECK (current_penalty >= 0),
  initial_penalty NUMERIC(14,2),
  contest_date DATE,
  final_order_date DATE,
  delete_flag TEXT,
  source_batch_id UUID NOT NULL REFERENCES ingest_batches(id) ON DELETE RESTRICT,
  receipt_id UUID NOT NULL,
  source_hash CHAR(64) NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, citation_id),
  FOREIGN KEY (inspection_id, activity_nr)
    REFERENCES contractor_osha_inspections(id, activity_nr) ON DELETE RESTRICT,
  FOREIGN KEY (receipt_id, source_batch_id)
    REFERENCES osha_detail_load_receipts(id, source_batch_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS contractor_osha_citations_inspection_idx
  ON contractor_osha_citations (inspection_id, citation_id);

COMMENT ON COLUMN contractor_osha_citations.initial_penalty IS
  'Stored for source provenance only. Never select into public response or render.';
COMMENT ON COLUMN contractor_osha_citations.delete_flag IS
  'Original source marker retained for provenance. Loader must apply B2-verified deletion semantics before public insertion.';

ALTER TABLE osha_detail_load_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_osha_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_osha_citations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON osha_detail_load_receipts FROM PUBLIC;
REVOKE ALL ON contractor_osha_inspections FROM PUBLIC;
REVOKE ALL ON contractor_osha_citations FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON osha_detail_load_receipts FROM anon';
    EXECUTE 'REVOKE ALL ON contractor_osha_inspections FROM anon';
    EXECUTE 'REVOKE ALL ON contractor_osha_citations FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON osha_detail_load_receipts FROM authenticated';
    EXECUTE 'REVOKE ALL ON contractor_osha_inspections FROM authenticated';
    EXECUTE 'REVOKE ALL ON contractor_osha_citations FROM authenticated';
  END IF;
END $$;
