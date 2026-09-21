/** EA-CT-002 baseline verification, part 3. READ-ONLY. Confirms the exact ~80,810 figure and its grain. */
import fs from "node:fs";
import { Pool } from "pg";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });

async function main() {
  const c = await pool.connect();
  const out = {};
  const q = async (label, sql) => { try { out[label] = (await c.query(sql)).rows; } catch (e) { out[label] = { ERROR: e.message }; } };
  try {
    await c.query("SET statement_timeout = 30000");
    await c.query("BEGIN READ ONLY");

    await q("attributions_by_state", `SELECT identity_state, count(*) n FROM permit_attributions GROUP BY 1 ORDER BY n DESC`);
    await q("attributions_by_state_method", `SELECT identity_state, identity_method, count(*) n FROM permit_attributions GROUP BY 1,2 ORDER BY 1, n DESC`);

    await q("confirmed_dbpr_total", `
      SELECT count(*) n FROM permit_attributions
      WHERE identity_state = 'CONFIRMED' AND identity_method = 'FULL_DBPR_LICENSE'`);
    await q("confirmed_all_methods_total", `
      SELECT count(*) n FROM permit_attributions WHERE identity_state = 'CONFIRMED'`);

    await q("confirmed_dbpr_distinct_permits_contractors", `
      SELECT
        count(*) AS raw_attribution_rows,
        count(DISTINCT a.permit_source_record_id) AS distinct_permit_source_records,
        count(DISTINCT a.matched_contractor_id) AS distinct_contractors_affected,
        count(DISTINCT a.matched_license_id) AS distinct_licenses_matched
      FROM permit_attributions a
      WHERE a.identity_state = 'CONFIRMED' AND a.identity_method = 'FULL_DBPR_LICENSE'`);

    await q("confirmed_dbpr_source_record_uniqueness", `
      SELECT count(*) n, count(DISTINCT (s.source_system, s.source_jurisdiction, s.permit_number)) distinct_by_natural_key
      FROM permit_attributions a
      JOIN permit_source_records s ON s.id = a.permit_source_record_id
      WHERE a.identity_state = 'CONFIRMED' AND a.identity_method = 'FULL_DBPR_LICENSE'`);

    await q("confirmed_dbpr_by_jurisdiction", `
      SELECT s.county_slug, s.source_system, count(*) n
      FROM permit_attributions a JOIN permit_source_records s ON s.id = a.permit_source_record_id
      WHERE a.identity_state = 'CONFIRMED' AND a.identity_method = 'FULL_DBPR_LICENSE'
      GROUP BY 1,2 ORDER BY n DESC LIMIT 30`);

    // Cross-check: does matched_license_id actually correspond to an exact contractor_license_normalized == licenses.external_key match?
    await q("confirmed_dbpr_integrity_spotcheck", `
      SELECT
        count(*) FILTER (
          WHERE UPPER(REGEXP_REPLACE(l.external_key, '[^A-Za-z0-9]', '', 'g'))
              = UPPER(REGEXP_REPLACE(s.contractor_license_normalized, '[^A-Za-z0-9]', '', 'g'))
        ) AS exact_key_matches,
        count(*) AS total
      FROM permit_attributions a
      JOIN permit_source_records s ON s.id = a.permit_source_record_id
      JOIN licenses l ON l.id = a.matched_license_id
      WHERE a.identity_state = 'CONFIRMED' AND a.identity_method = 'FULL_DBPR_LICENSE'`);

    await q("high_confidence_and_review_totals", `
      SELECT identity_state, identity_method, count(*) n FROM permit_attributions
      WHERE identity_state IN ('HIGH_CONFIDENCE','REVIEW_REQUIRED') GROUP BY 1,2 ORDER BY 1, n DESC`);

    // local_credentials context (a second identity namespace referenced by permit_attributions)
    await q("local_credentials_exists", `SELECT to_regclass('public.local_credentials') AS reg`);

    // permit_lifecycle_events / permit_events row counts + whether they key off permit_source_records
    await q("permit_lifecycle_events_count", `SELECT count(*) n FROM permit_lifecycle_events`);
    await q("permit_events_count", `SELECT count(*) n FROM permit_events`);
    await q("permit_lifecycle_events_columns", `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='permit_lifecycle_events' ORDER BY ordinal_position`);

    // Any evidence-activation batch/run tracking table?
    await q("evidence_activation_tables", `
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND (table_name ILIKE '%evidence%' OR table_name ILIKE '%activation%' OR table_name ILIKE '%ea_ct%')`);

    // Source freshness for the CONFIRMED DBPR cohort.
    await q("confirmed_dbpr_freshness", `
      SELECT min(s.retrieved_at) earliest_retrieved, max(s.retrieved_at) latest_retrieved,
             min(s.source_updated_at) earliest_source_updated, max(s.source_updated_at) latest_source_updated,
             count(DISTINCT s.parser_version) parser_versions
      FROM permit_attributions a JOIN permit_source_records s ON s.id = a.permit_source_record_id
      WHERE a.identity_state = 'CONFIRMED' AND a.identity_method = 'FULL_DBPR_LICENSE'`);

    // Duplicate/lifecycle check specific to the confirmed cohort: any natural-key collisions across counties?
    await q("confirmed_dbpr_status_distribution", `
      SELECT s.status_normalized, count(*) n
      FROM permit_attributions a JOIN permit_source_records s ON s.id = a.permit_source_record_id
      WHERE a.identity_state = 'CONFIRMED' AND a.identity_method = 'FULL_DBPR_LICENSE'
      GROUP BY 1 ORDER BY n DESC`);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
    await pool.end();
  }
  fs.writeFileSync("docs/qa/ea-ct-002/baseline-verification-confirmed.local.json", JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
