-- CON-THIN-PROFILE-SITEMAP-001 — enriched profile cache (NOT APPLIED BY THIS PR).
-- Target: Contractor Trust Hub production database. Do not run this file from
-- the deploy. An operator applies it, then runs
-- scripts/refresh_contractor_profile_enrichment.mjs --apply
-- before the sitemap code that reads this table is promoted.
--
-- The sitemap statement timeout is 8 seconds. A correlated EXISTS over the
-- evidence tables did not finish in 25 seconds. Building the enriched set once
-- took about 11 seconds, which is still too slow to do on the request. This
-- table stores that set. The request reads only these rows.
--
-- One row per enriched contractor. Absence means thin. contractor_id is the
-- primary key because lookup and refresh are by the existing contractor id.
-- slug, home_state, is_thin_profile, and license_sources are copied at refresh
-- time so the sitemap does not scan contractors.
--
-- The application reads through the server-only Postgres pool. anon and
-- authenticated get no privileges and RLS is enabled with no policies.
--
-- Rollback: schema/rollback/021_contractor_profile_enrichment.sql

CREATE TABLE IF NOT EXISTS contractor_profile_enrichment (
  contractor_id       UUID PRIMARY KEY REFERENCES contractors (id) ON DELETE CASCADE,
  enriched            BOOLEAN NOT NULL CHECK (enriched),
  signals             TEXT[] NOT NULL CHECK (
    cardinality(signals) > 0
    AND signals <@ ARRAY[
      'business_contact',
      'public_contact',
      'confirmed_permit',
      'osha',
      'discipline',
      'business_managed'
    ]::text[]
  ),
  content_changed_at  TIMESTAMPTZ,
  slug                TEXT NOT NULL CHECK (length(btrim(slug)) > 0),
  home_state          TEXT,
  is_thin_profile     BOOLEAN NOT NULL,
  license_sources     TEXT[] NOT NULL DEFAULT ARRAY[]::text[]
);

COMMENT ON TABLE contractor_profile_enrichment IS
  'Refreshed cache of enriched contractor profiles. Sitemap and profile robots read this table. Rebuild with scripts/refresh_contractor_profile_enrichment.mjs --apply.';

CREATE INDEX IF NOT EXISTS contractor_profile_enrichment_sitemap_idx
  ON contractor_profile_enrichment (slug, contractor_id)
  INCLUDE (content_changed_at, home_state, license_sources)
  WHERE enriched
    AND is_thin_profile = FALSE
    AND slug IS NOT NULL
    AND slug <> '';

ALTER TABLE contractor_profile_enrichment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON contractor_profile_enrichment FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON contractor_profile_enrichment FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON contractor_profile_enrichment FROM authenticated';
  END IF;
END $$;
