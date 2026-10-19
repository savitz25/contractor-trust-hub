-- LE-ENRICH-001 rollback. Deletes one Lee batch only.
-- The loader refuses every other batch_id. No contact values.

DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_le_2026_10' AND batch_id = 'le-enrich-001-2026-10-17';
