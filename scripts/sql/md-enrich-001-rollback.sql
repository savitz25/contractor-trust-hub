-- MD-ENRICH-001 rollback — removes exactly one enrichment batch. Bounded by source_system + batch_id;
-- touches no other table. contractors / licenses were never written by the loader.
-- Equivalent: python scripts/md_enrich_001/load.py --rollback --production --input-dir <private dir>
BEGIN;
DELETE FROM contractor_enrichment_observations
WHERE source_system = 'scout_web_enrich_md_2026_10'
  AND batch_id = 'md-enrich-001-2026-10-06';
-- Expect 0:
SELECT count(*) AS remaining FROM contractor_enrichment_observations
WHERE source_system = 'scout_web_enrich_md_2026_10' AND batch_id = 'md-enrich-001-2026-10-06';
COMMIT;

-- Lift or re-apply contact suppression without reloading (Founder decision only):
-- UPDATE contractor_enrichment_observations SET is_suppressed = false, suppression_reason = NULL
--  WHERE source_system = 'scout_web_enrich_md_2026_10' AND batch_id = 'md-enrich-001-2026-10-06'
--    AND license_external_key = '<LICENSE>' AND field IN ('website','phone','email','address_location');
