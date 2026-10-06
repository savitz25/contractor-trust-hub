-- MD-ENRICH-001 — Contractor business-website enrichment observations (NOT APPLIED BY DEPLOY).
-- Target: Contractor Trust Hub production database. Operator applies with
-- scripts/apply_migration_017.py before the loader runs.
--
-- Additive and independent: one new table, no change to contractors, licenses,
-- or any existing table. Each row is one value observed on a business's own
-- website for an EXISTING contractor profile (keyed by contractors.id and
-- confirmed against the DBPR license external_key at load time).
--
-- DBPR stays authoritative for license number, status, legal identity and the
-- primary address. Nothing here is copied into contractors.phone/website or
-- licenses.* — the profile reads these rows as separately-labelled evidence.
--
-- Every row carries source_system + batch_id, so a whole load is reversible with
-- one bounded statement (see scripts/sql/md-enrich-001-rollback.sql).
-- is_suppressed keeps a reviewed value on file but out of every public read, so
-- suppression can be lifted or applied without reloading the batch.
--
-- The application reads through the server-only Postgres pool. anon and
-- authenticated get no privileges and RLS is enabled with no policies.
--
-- Rollback (structure): DROP TABLE contractor_enrichment_observations;

CREATE TABLE IF NOT EXISTS contractor_enrichment_observations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id        UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  license_external_key TEXT NOT NULL,
  field                TEXT NOT NULL CHECK (field IN ('website', 'phone', 'email', 'address_location', 'specialty')),
  value                TEXT NOT NULL CHECK (length(btrim(value)) > 0),
  value_normalized     TEXT NOT NULL CHECK (length(value_normalized) > 0),
  ordinal              SMALLINT NOT NULL DEFAULT 0,
  source_refs          TEXT[] NOT NULL DEFAULT '{}',
  source_system        TEXT NOT NULL,
  confidence           TEXT,
  review_flags         TEXT[] NOT NULL DEFAULT '{}',
  decision_ref         TEXT,
  batch_id             TEXT NOT NULL,
  observed_at          TIMESTAMPTZ NOT NULL,
  loaded_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_suppressed        BOOLEAN NOT NULL DEFAULT FALSE,
  suppression_reason   TEXT,
  CONSTRAINT contractor_enrichment_observations_idem
    UNIQUE (contractor_id, field, value_normalized, batch_id)
);

CREATE INDEX IF NOT EXISTS contractor_enrichment_observations_public_idx
  ON contractor_enrichment_observations (contractor_id)
  WHERE NOT is_suppressed;

CREATE INDEX IF NOT EXISTS contractor_enrichment_observations_batch_idx
  ON contractor_enrichment_observations (source_system, batch_id);

ALTER TABLE contractor_enrichment_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON contractor_enrichment_observations FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON contractor_enrichment_observations FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON contractor_enrichment_observations FROM authenticated';
  END IF;
END $$;

-- Verification marker (read-only). Expected: 17 columns, rls = true, 0 anon/authenticated grants.
-- SELECT count(*) FROM information_schema.columns WHERE table_name = 'contractor_enrichment_observations';
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'contractor_enrichment_observations';
-- SELECT count(*) FROM information_schema.role_table_grants
--   WHERE table_name = 'contractor_enrichment_observations' AND grantee IN ('anon', 'authenticated');
