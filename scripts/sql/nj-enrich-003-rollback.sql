-- NJ-ENRICH-003 rollback: Passaic only.
-- Deletes exactly one batch. Refuses Morris, the other NJ counties, and every Florida batch.
-- Predicate is source_system = 'dot_web_enrich_ps_2026_10' AND batch_id = 'ps-enrich-001-2026-10-17'.
-- The loader accepts only batch_id ~ '^ps-enrich-001-2026-10-17$'.
-- Preferred path, after the exact Founder phrase GO CONTRACTOR PASSAIC ENRICH LOAD:
--   python scripts/nj_enrich_003/load.py --rollback --production --county ps --package-dir <outside-git> --env-file <gitignored-.env.local>
-- Do not uncomment the statement below in this public file. The executable copy lives outside the repo.

-- DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_ps_2026_10' AND batch_id = 'ps-enrich-001-2026-10-17';
