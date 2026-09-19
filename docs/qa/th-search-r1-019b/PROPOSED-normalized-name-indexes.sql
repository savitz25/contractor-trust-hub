-- TH-SEARCH-R1-019B review 2 -- PROPOSAL ONLY. NOT APPLIED. NOT A MIGRATION. Requires explicit owner approval.
-- Generated from NORMALIZED_NAME_INDEXES in lib/contractors/name-search-core.ts (same expression as the predicate).
-- Run each statement on its own, outside a transaction (CREATE INDEX CONCURRENTLY). No table rewrite, no new column,
-- no new table, no function, no extension (pg_trgm 1.6 is already installed). Postgres maintains the indexes on write.
-- Phase 1 = the five *_nameorder_idx (ordered equality/prefix: the strong tier). Phase 2 = the five *_namewords_idx.
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS <name>;  (nothing else depends on them)
-- After a failed CONCURRENTLY build an INVALID index remains: check pg_index.indisvalid, drop it, retry.

-- PHASE 1: ordered (btree, text_pattern_ops)
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_display_name_nameorder_idx ON contractors ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(display_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE display_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_legal_name_nameorder_idx ON contractors ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(legal_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE legal_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_dba_name_nameorder_idx ON contractors ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(dba_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE dba_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS licenses_licensee_name_raw_nameorder_idx ON licenses ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(licensee_name_raw, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE licensee_name_raw IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS licenses_dba_name_raw_nameorder_idx ON licenses ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(dba_name_raw, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') text_pattern_ops) WHERE dba_name_raw IS NOT NULL;

-- PHASE 2: every-word (GIN trigram on the normalized expression)
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_display_name_namewords_idx ON contractors USING gin ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(display_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') gin_trgm_ops) WHERE display_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_legal_name_namewords_idx ON contractors USING gin ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(legal_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') gin_trgm_ops) WHERE legal_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS contractors_dba_name_namewords_idx ON contractors USING gin ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(dba_name, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') gin_trgm_ops) WHERE dba_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS licenses_licensee_name_raw_namewords_idx ON licenses USING gin ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(licensee_name_raw, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') gin_trgm_ops) WHERE licensee_name_raw IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS licenses_dba_name_raw_namewords_idx ON licenses USING gin ((' ' || btrim(regexp_replace(regexp_replace(upper(coalesce(dba_name_raw, '')), '[''`\u2018\u2019\u02BC]', '', 'g'), '[\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\u00A0\u2013\u2014\u201C\u201D]+', ' ', 'g')) || ' ') gin_trgm_ops) WHERE dba_name_raw IS NOT NULL;

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
