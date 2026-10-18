-- NJ-ENRICH-003 rollback: Burlington only.
-- Deletes exactly one batch. Refuses Morris, every other NJ county, and every Florida batch.
-- Predicate is source_system = 'dot_web_enrich_bu_2026_10' AND batch_id = 'bu-enrich-001-2026-10-17'.
-- The loader accepts only batch_id ~ '^bu-enrich-001-2026-10-17$'.
-- Preferred path, after the exact Founder phrase GO CONTRACTOR BURLINGTON ENRICH LOAD:
--   python scripts/nj_enrich_003/load.py --rollback --production --county bu --package-dir <outside-git> --env-file <gitignored-.env.local> --authorize "<exact phrase>"
-- Do not uncomment the statement below in this public file. The executable copy lives outside the repo.

-- DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_bu_2026_10' AND batch_id = 'bu-enrich-001-2026-10-17';
