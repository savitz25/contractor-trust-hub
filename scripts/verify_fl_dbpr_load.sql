-- Verification queries after FL DBPR load
-- Usage: psql "$DATABASE_URL" -f scripts/verify_fl_dbpr_load.sql

\echo '=== Totals ==='
SELECT 'contractors' AS table_name, COUNT(*) AS n FROM contractors
UNION ALL
SELECT 'licenses', COUNT(*) FROM licenses
UNION ALL
SELECT 'entities', COUNT(*) FROM entities
UNION ALL
SELECT 'discipline_actions', COUNT(*) FROM discipline_actions
UNION ALL
SELECT 'ingest_batches', COUNT(*) FROM ingest_batches;

\echo '=== Licenses by status_normalized ==='
SELECT COALESCE(status_normalized, '(null)') AS status, COUNT(*) AS n
FROM licenses
GROUP BY 1
ORDER BY n DESC;

\echo '=== Top FL counties by license count ==='
SELECT
  COALESCE(NULLIF(county_name, ''), county_code, '(unknown)') AS county,
  COUNT(*) AS licenses
FROM licenses
WHERE state = 'FL'
GROUP BY 1
ORDER BY licenses DESC
LIMIT 15;

\echo '=== Top occupation codes ==='
SELECT occupation_code, COUNT(*) AS n
FROM licenses
GROUP BY 1
ORDER BY n DESC
LIMIT 15;

\echo '=== Sample high-quality active contractors ==='
SELECT
  c.slug,
  c.display_name,
  c.primary_city,
  c.primary_county,
  l.external_key,
  l.occupation_code,
  l.status_normalized,
  l.expiration_date
FROM licenses l
JOIN contractors c ON c.id = l.contractor_id
WHERE l.status_normalized = 'active'
  AND l.state = 'FL'
  AND c.is_thin_profile = FALSE
  AND l.expiration_date IS NOT NULL
ORDER BY l.expiration_date DESC
LIMIT 20;

\echo '=== QB entities (no license numbers invented) ==='
SELECT entity_type, status, COUNT(*) AS n
FROM entities
WHERE source_system = 'fl_dbpr'
GROUP BY 1, 2
ORDER BY n DESC;

\echo '=== Discipline linkage rate ==='
SELECT
  COUNT(*) AS total_actions,
  COUNT(license_id) AS linked_to_license,
  COUNT(contractor_id) AS linked_to_contractor
FROM discipline_actions
WHERE source_system = 'fl_dbpr';

\echo '=== Latest ingest batches ==='
SELECT source_dataset, row_count, extracted_at, left(checksum_sha256, 12) AS checksum_prefix
FROM ingest_batches
WHERE source_system = 'fl_dbpr'
ORDER BY extracted_at DESC
LIMIT 10;
