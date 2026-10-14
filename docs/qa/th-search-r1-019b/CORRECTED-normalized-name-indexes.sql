-- VERIFY NAME SEARCH — corrected index proposal. NOT A MIGRATION. DO NOT APPLY TO PRODUCTION.
-- Generated from NORMALIZED_NAME_INDEXES in lib/contractors/name-search-core.ts.
-- The older PROPOSED-normalized-name-indexes.sql puts GIN on the bare normalized expression.
-- Live broad Verify prefilter uses that expression concatenated with '' so those GIN indexes are not candidates.
-- btree nameorder indexes match the strong-tier prefix on the bare expression and are unchanged.
-- Run each statement by itself, outside a transaction. pg_trgm is already created by schema/migrations/002_search_indexes.sql.
-- A failed CONCURRENTLY build can leave an INVALID index. Drop that index and retry.
-- This file does not run in application migrations.

CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_display_name_nameorder_idx ON contractors ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(display_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE display_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_display_name_namewords_idx ON contractors USING gin (((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(display_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') || '') gin_trgm_ops) WHERE display_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_legal_name_nameorder_idx ON contractors ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(legal_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE legal_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_legal_name_namewords_idx ON contractors USING gin (((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(legal_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') || '') gin_trgm_ops) WHERE legal_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_dba_name_nameorder_idx ON contractors ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(dba_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE dba_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_dba_name_namewords_idx ON contractors USING gin (((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(dba_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') || '') gin_trgm_ops) WHERE dba_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS licenses_licensee_name_raw_nameorder_idx ON licenses ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(licensee_name_raw, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE licensee_name_raw IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS licenses_licensee_name_raw_namewords_idx ON licenses USING gin (((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(licensee_name_raw, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') || '') gin_trgm_ops) WHERE licensee_name_raw IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS licenses_dba_name_raw_nameorder_idx ON licenses ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(dba_name_raw, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE dba_name_raw IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS licenses_dba_name_raw_namewords_idx ON licenses USING gin (((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(dba_name_raw, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') || '') gin_trgm_ops) WHERE dba_name_raw IS NOT NULL;

-- Rollback
-- DROP INDEX CONCURRENTLY IF EXISTS contractors_display_name_nameorder_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS contractors_display_name_namewords_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS contractors_legal_name_nameorder_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS contractors_legal_name_namewords_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS contractors_dba_name_nameorder_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS contractors_dba_name_namewords_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS licenses_licensee_name_raw_nameorder_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS licenses_licensee_name_raw_namewords_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS licenses_dba_name_raw_nameorder_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS licenses_dba_name_raw_namewords_idx;
