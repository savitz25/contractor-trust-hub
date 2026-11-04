-- Rollback for schema/migrations/021_contractor_profile_enrichment.sql.
-- Drops only the enriched-profile cache. Does not change contractors, licenses,
-- or the evidence tables.

DROP TABLE IF EXISTS contractor_profile_enrichment;
