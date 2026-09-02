-- NJ-CON-002B production reconciliation (after migration 015 + execute).
-- Dry-run expected: zero rows until an authorized session executes ingest.
-- Public CONFIRMED contractor attachments must remain 0 for this source.

SELECT source_system, state_code, count(*) AS rows
FROM permit_source_records
WHERE source_system = 'nj_dca_construction_permits'
GROUP BY 1, 2;

SELECT identity_state, count(*) AS rows
FROM permit_attributions a
JOIN permit_source_records p ON p.id = a.permit_source_record_id
WHERE p.source_system = 'nj_dca_construction_permits'
GROUP BY 1;
-- Expected: MARKET_ONLY only. CONFIRMED must be 0.

SELECT source_window_status, count(*) AS rows
FROM permit_source_records
WHERE source_system = 'nj_dca_construction_permits'
GROUP BY 1;

-- Aged-out rows must still exist (never hard-deleted).
SELECT count(*) AS aged_out_still_present
FROM permit_source_records
WHERE source_system = 'nj_dca_construction_permits'
  AND source_window_status IN (
    'AGED_OUT_OF_SOURCE_WINDOW',
    'OUTSIDE_STATED_RETENTION_WINDOW_BUT_PRESENT'
  );

SELECT count(*) AS confirmed_public_attachments
FROM permit_attributions a
JOIN permit_source_records p ON p.id = a.permit_source_record_id
WHERE p.source_system = 'nj_dca_construction_permits'
  AND a.identity_state = 'CONFIRMED';
