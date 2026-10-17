-- NJ-ENRICH-002 rollback: Morris only.
-- Deletes exactly one batch. Refuses every other county and every Florida batch.
-- Predicate is source_system = 'dot_web_enrich_mo_2026_10' AND batch_id = 'mo-enrich-001-2026-10-17'.
-- The loader accepts only batch_id ~ '^mo-enrich-001-2026-10-17$'.
-- Preferred path, after the exact Founder phrase GO CONTRACTOR MORRIS ENRICH LOAD:
--   python scripts/nj_enrich_002/load.py --rollback --production --county mo --package-dir <outside-git> --env-file <gitignored-.env.local>
-- Do not uncomment the statement below in this public file. The executable copy lives outside the repo.

-- DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_mo_2026_10' AND batch_id = 'mo-enrich-001-2026-10-17';
