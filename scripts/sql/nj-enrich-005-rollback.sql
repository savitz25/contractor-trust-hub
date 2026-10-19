-- NJ-ENRICH-005 rollback: Mercer only.
-- Deletes exactly one batch. Refuses Morris, Passaic, Burlington, the other NJ counties, and every Florida batch.
-- Predicate is source_system = 'dot_web_enrich_me_2026_10' AND batch_id = 'me-enrich-001-2026-10-18'.
-- The loader accepts only batch_id ~ '^me-enrich-001-2026-10-18$'.
-- Preferred path, after the exact Founder phrase GO CONTRACTOR MERCER ENRICH LOAD:
--   python scripts/nj_enrich_005/load.py --rollback --production --county me --package-dir <outside-git> --env-file <gitignored-.env.local>
-- Do not uncomment the statement below in this public file. The executable copy lives outside the repo.

-- DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_me_2026_10' AND batch_id = 'me-enrich-001-2026-10-18';
