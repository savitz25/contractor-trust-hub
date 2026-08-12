-- Search performance for Florida Verify (name ILIKE + license lookup)
-- Safe to re-run. Apply on Supabase Session pooler or direct connection.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Name search (ILIKE %term%) on consumer-facing contractor fields
CREATE INDEX IF NOT EXISTS contractors_display_name_trgm_idx
  ON contractors USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS contractors_legal_name_trgm_idx
  ON contractors USING gin (legal_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS contractors_dba_name_trgm_idx
  ON contractors USING gin (dba_name gin_trgm_ops);

-- Filter thin QB shells out of consumer search
CREATE INDEX IF NOT EXISTS contractors_searchable_idx
  ON contractors (home_state)
  WHERE is_thin_profile = FALSE;

-- License key / prefix search
CREATE INDEX IF NOT EXISTS licenses_external_key_upper_idx
  ON licenses (source_system, (UPPER(external_key)));

CREATE INDEX IF NOT EXISTS licenses_licensee_name_trgm_idx
  ON licenses USING gin (licensee_name_raw gin_trgm_ops);

CREATE INDEX IF NOT EXISTS licenses_dba_name_raw_trgm_idx
  ON licenses USING gin (dba_name_raw gin_trgm_ops);

-- Discipline lookup on detail + search result badges
CREATE INDEX IF NOT EXISTS discipline_contractor_idx
  ON discipline_actions (contractor_id);

-- High-confidence Sunbiz links only (consumer queries filter role + confidence)
CREATE INDEX IF NOT EXISTS contractor_entities_role_conf_idx
  ON contractor_entities (contractor_id, role, confidence DESC);
