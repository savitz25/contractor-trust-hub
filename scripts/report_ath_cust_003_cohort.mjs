import pg from "pg";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({
  connectionString,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const sql = `
WITH profile_flags AS (
  SELECT
    c.id,
    c.slug,
    c.is_thin_profile,
    c.home_state,
    BOOL_OR(l.state = 'FL') AS has_fl_license,
    BOOL_OR(l.source_system = 'fl_dbpr') AS has_dbpr,
    BOOL_OR(
      l.source_system = 'fl_dbpr'
      AND (c.home_state = 'FL' OR l.state = 'FL')
      AND NULLIF(TRIM(l.external_key), '') IS NOT NULL
    ) AS has_eligible_dbpr_key
  FROM contractors c
  LEFT JOIN licenses l ON l.contractor_id = c.id
  GROUP BY c.id, c.slug, c.is_thin_profile, c.home_state
), florida AS (
  SELECT * FROM profile_flags WHERE home_state = 'FL' OR has_fl_license
)
SELECT
  COUNT(*)::int AS florida_total,
  COUNT(*) FILTER (WHERE is_thin_profile)::int AS thin_excluded,
  COUNT(*) FILTER (WHERE NOT is_thin_profile)::int AS non_thin,
  COUNT(*) FILTER (WHERE NOT is_thin_profile AND has_dbpr)::int AS fl_dbpr_candidate,
  COUNT(*) FILTER (
    WHERE NOT is_thin_profile
      AND NULLIF(TRIM(slug), '') IS NOT NULL
      AND has_eligible_dbpr_key
  )::int AS cta_eligible,
  COUNT(*) FILTER (WHERE NOT is_thin_profile AND NOT has_dbpr)::int AS unsupported_source,
  COUNT(*) FILTER (WHERE NOT is_thin_profile AND NULLIF(TRIM(slug), '') IS NULL)::int AS missing_slug,
  COUNT(*) FILTER (WHERE NOT is_thin_profile AND has_dbpr AND NOT has_eligible_dbpr_key)::int AS missing_or_non_fl_dbpr_key
FROM florida
`;

try {
  const result = await pool.query(sql);
  console.log(JSON.stringify(result.rows[0], null, 2));
} finally {
  await pool.end();
}
