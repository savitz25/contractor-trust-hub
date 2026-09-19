/* READ-ONLY post-build verification for TH-SEARCH-R1-019B Phase 1+2. BEGIN READ ONLY, rolled back. No
 * writes, no DDL, no planner-setting changes. Plain EXPLAIN only (never ANALYZE). */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((l) => l.trim())) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
import { Pool } from "pg";
import { buildStrongNameMatchSql, buildNameMatchSql, prepareNameTerms } from "../lib/contractors/name-search-core";

const ALL_NAMES = [
  "contractors_display_name_nameorder_idx", "contractors_legal_name_nameorder_idx", "contractors_dba_name_nameorder_idx",
  "licenses_licensee_name_raw_nameorder_idx", "licenses_dba_name_raw_nameorder_idx",
  "contractors_display_name_namewords_idx", "contractors_legal_name_namewords_idx", "contractors_dba_name_namewords_idx",
  "licenses_licensee_name_raw_namewords_idx", "licenses_dba_name_raw_namewords_idx",
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  const c = await pool.connect();
  const out: Record<string, unknown> = { ranAt: new Date().toISOString() };
  const q = async (label: string, sql: string) => { try { out[label] = (await c.query(sql)).rows; } catch (e) { out[label] = { ERROR: (e as Error).message }; await c.query("ROLLBACK"); await c.query("BEGIN READ ONLY"); } };
  try {
    await c.query("SET statement_timeout = 8000");
    await c.query("BEGIN READ ONLY");
    await q("identity", "SELECT current_database() db, current_user usr");

    await q("indexState", `
      SELECT c.relname, x.indisvalid, x.indisready, x.indislive, pg_relation_size(c.oid) bytes
      FROM pg_class c JOIN pg_index x ON x.indexrelid = c.oid
      WHERE c.relname = ANY(ARRAY[${ALL_NAMES.map((n) => `'${n}'`).join(",")}]) ORDER BY 1`);

    await q("activity", `SELECT count(*) total, count(*) FILTER (WHERE state='active') active,
        count(*) FILTER (WHERE xact_start < now() - interval '2 minutes') long_xact,
        count(*) FILTER (WHERE wait_event_type='Lock') waiting_on_lock
      FROM pg_stat_activity WHERE datname=current_database()`);
    await q("progressCreateIndex", `SELECT pid, relid::regclass::text, phase FROM pg_stat_progress_create_index`);

    const literal = (sql: string, params: unknown[]) => sql.replace(/\$(\d+)/g, (_, i) => `'${String(params[Number(i) - 1]).replace(/'/g, "''")}'`);
    const cases = ["Stilwell Solar", "R & T GENERAL CONSTRUCTION, INC.", "Stilwell Solar", "Allied"]; // 3rd = honest-miss context (jurisdiction applied at query layer, not fromSql)
    const labels = ["Stilwell Solar", "R & T GENERAL CONSTRUCTION, INC.", "Stilwell Solar (honest-miss context)", "Allied"];

    const strongPlans: Record<string, unknown> = {};
    const tokenPlans: Record<string, unknown> = {};
    for (const [i, name] of cases.entries()) {
      const label = labels[i];
      const prepared = prepareNameTerms(name);
      try {
        const strong = buildStrongNameMatchSql(prepared, 1);
        const r = await c.query(literal(`EXPLAIN SELECT c.id FROM ${strong.fromSql} LIMIT 26`, strong.params));
        strongPlans[label] = r.rows.map((row: any) => row["QUERY PLAN"]);
      } catch (e) { strongPlans[label] = { ERROR: (e as Error).message }; }
      try {
        const all = buildNameMatchSql(prepared, 1);
        const r2 = await c.query(literal(`EXPLAIN SELECT c.id FROM ${all.fromSql} LIMIT 26`, all.params));
        tokenPlans[label] = r2.rows.map((row: any) => row["QUERY PLAN"]);
      } catch (e) { tokenPlans[label] = { ERROR: (e as Error).message }; }
    }
    out.strongTierPlans = strongPlans;
    out.tokenTierPlans = tokenPlans;
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
    await pool.end();
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
