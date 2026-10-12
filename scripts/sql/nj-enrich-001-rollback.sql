-- NJ-ENRICH-001 rollback: removes exactly one county batch of contractor_enrichment_observations.
-- Run ONE statement for the county being rolled back. Each predicate pins both source_system and batch_id,
-- so it cannot reach the Florida batches (md-enrich-001/002, bw/pb/pn-enrich-001) or another NJ county.
-- Preferred path: python scripts/nj_enrich_001/load.py --rollback --production --county <bg|mx|mn|un> ...
-- (the loader also asserts batch_id ~ '^(bg|mx|mn|un)-enrich-001-2026-10-12$').

-- Union
-- DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_un_2026_10' AND batch_id = 'un-enrich-001-2026-10-12';
-- Middlesex
-- DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_mx_2026_10' AND batch_id = 'mx-enrich-001-2026-10-12';
-- Monmouth
-- DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_mn_2026_10' AND batch_id = 'mn-enrich-001-2026-10-12';
-- Bergen
-- DELETE FROM contractor_enrichment_observations WHERE source_system = 'dot_web_enrich_bg_2026_10' AND batch_id = 'bg-enrich-001-2026-10-12';

-- Verify afterwards (expect 0 for the rolled-back batch; other batches unchanged):
-- SELECT source_system, batch_id, count(*) FROM contractor_enrichment_observations GROUP BY 1, 2 ORDER BY 2;
