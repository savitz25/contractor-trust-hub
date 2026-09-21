/**
 * EA-CT-002 baseline verification. READ-ONLY. No writes, no DDL, no schema change.
 * Confirms the actual current shape of permit_records / licenses / contractors, distinguishing
 * raw rows, unique permit numbers, unique contractors, and dual-link identity-confirmed rows —
 * rather than trusting any externally-asserted figure.
 */
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
  const q = async (label, sql) => {
    try {
      const r = await c.query(sql);
      out[label] = r.rows;
    } catch (e) {
      out[label] = { ERROR: e.message };
    }
  };
  try {
    await c.query("SET statement_timeout = 20000");
    await c.query("BEGIN READ ONLY");

    await q("identity", "SELECT current_database() db, current_user usr");
    await q("tables_matching_permit_or_dbpr", `
      SELECT table_schema, table_name FROM information_schema.tables
      WHERE table_schema='public' AND (table_name ILIKE '%permit%' OR table_name ILIKE '%dbpr%')
      ORDER BY 1,2`);

    await q("permit_records_columns", `
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='permit_records' ORDER BY ordinal_position`);

    await q("permit_records_totals", `
      SELECT
        count(*) AS raw_rows,
        count(*) FILTER (WHERE contractor_license_key IS NOT NULL AND contractor_license_key <> '') AS rows_with_license_key,
        count(DISTINCT permit_number) FILTER (WHERE permit_number IS NOT NULL AND permit_number <> '') AS distinct_permit_numbers,
        count(DISTINCT (jurisdiction_slug, permit_number)) FILTER (WHERE permit_number IS NOT NULL AND permit_number <> '') AS distinct_permit_numbers_per_jurisdiction,
        count(DISTINCT jurisdiction_slug) AS distinct_jurisdictions,
        count(DISTINCT source_label) AS distinct_source_labels,
        min(retrieved_at) AS earliest_retrieved_at, max(retrieved_at) AS latest_retrieved_at
      FROM permit_records`);

    await q("permit_records_by_source_label", `
      SELECT source_label, count(*) n,
        count(*) FILTER (WHERE contractor_license_key IS NOT NULL AND contractor_license_key <> '') AS with_license_key,
        min(retrieved_at) earliest, max(retrieved_at) latest
      FROM permit_records GROUP BY 1 ORDER BY n DESC LIMIT 30`);

    await q("permit_records_by_jurisdiction", `
      SELECT jurisdiction_slug, jurisdiction_label, count(*) n
      FROM permit_records GROUP BY 1,2 ORDER BY n DESC LIMIT 30`);

    // The exact identity bridge Stage 6's matcher already uses: normalized license key equality
    // against licenses.external_key, joined to its canonical contractor id.
    await q("dual_linked_confirmed", `
      SELECT
        count(*) AS raw_permit_rows_with_confirmed_license_match,
        count(DISTINCT p.id) AS distinct_permit_ids,
        count(DISTINCT c.id) AS distinct_contractors_affected,
        count(DISTINCT UPPER(REGEXP_REPLACE(p.contractor_license_key, '[^A-Za-z0-9]', '', 'g'))) AS distinct_license_keys_matched
      FROM permit_records p
      JOIN licenses l ON UPPER(REGEXP_REPLACE(l.external_key, '[^A-Za-z0-9]', '', 'g'))
                        = UPPER(REGEXP_REPLACE(p.contractor_license_key, '[^A-Za-z0-9]', '', 'g'))
      JOIN contractors c ON c.id = l.contractor_id
      WHERE p.contractor_license_key IS NOT NULL AND p.contractor_license_key <> ''`);

    await q("dual_linked_by_source_label", `
      SELECT p.source_label, count(*) n, count(DISTINCT c.id) contractors
      FROM permit_records p
      JOIN licenses l ON UPPER(REGEXP_REPLACE(l.external_key, '[^A-Za-z0-9]', '', 'g'))
                        = UPPER(REGEXP_REPLACE(p.contractor_license_key, '[^A-Za-z0-9]', '', 'g'))
      JOIN contractors c ON c.id = l.contractor_id
      WHERE p.contractor_license_key IS NOT NULL AND p.contractor_license_key <> ''
      GROUP BY 1 ORDER BY n DESC LIMIT 30`);

    // Same-name, different/absent license — must NOT be counted as linked (identity requirement check).
    await q("name_only_would_be_rows", `
      SELECT count(*) AS name_only_candidate_rows
      FROM permit_records p
      WHERE (p.contractor_license_key IS NULL OR p.contractor_license_key = '')
        AND p.contractor_name IS NOT NULL AND p.contractor_name <> ''`);

    await q("license_key_present_but_unmatched", `
      SELECT count(*) AS unmatched_rows
      FROM permit_records p
      WHERE p.contractor_license_key IS NOT NULL AND p.contractor_license_key <> ''
        AND NOT EXISTS (
          SELECT 1 FROM licenses l
          WHERE UPPER(REGEXP_REPLACE(l.external_key, '[^A-Za-z0-9]', '', 'g'))
              = UPPER(REGEXP_REPLACE(p.contractor_license_key, '[^A-Za-z0-9]', '', 'g'))
        )`);

    await q("status_distribution", `SELECT status, count(*) n FROM permit_records GROUP BY 1 ORDER BY n DESC LIMIT 20`);
    await q("existing_activity_rollup_totals", `SELECT count(*) rows, sum(permit_count) total_permit_count FROM contractor_permit_activity`);
    await q("permit_coverage_stats", `SELECT * FROM permit_coverage_stats ORDER BY updated_at DESC LIMIT 20`);
    await q("ingest_batches_recent", `SELECT source_system, source_dataset, row_count, extracted_at FROM ingest_batches ORDER BY extracted_at DESC LIMIT 15`);

    // Duplicate/lifecycle behavior: how many (permit_number, jurisdiction) groups have >1 row (lifecycle events)?
    await q("lifecycle_duplicate_groups", `
      SELECT count(*) AS groups_with_multiple_rows, sum(cnt) AS rows_in_those_groups
      FROM (
        SELECT jurisdiction_slug, permit_number, count(*) cnt
        FROM permit_records
        WHERE permit_number IS NOT NULL AND permit_number <> ''
        GROUP BY 1,2 HAVING count(*) > 1
      ) g`);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
    await pool.end();
  }
  fs.mkdirSync("docs/qa/ea-ct-002", { recursive: true });
  fs.writeFileSync("docs/qa/ea-ct-002/baseline-verification.local.json", JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
