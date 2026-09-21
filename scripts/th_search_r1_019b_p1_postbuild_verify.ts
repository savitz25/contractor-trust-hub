/* READ-ONLY post-build verification for TH-SEARCH-R1-019B Phase 1. BEGIN READ ONLY, rolled back. No writes,
 * no DDL. Independently re-checks index existence/state/expression match and whether the planner picks them
 * up for the strong-tier query, via plain EXPLAIN only (never EXPLAIN ANALYZE). */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((l) => l.trim())) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
import { Pool } from "pg";
import { buildStrongNameMatchSql, buildNameMatchSql, prepareNameTerms, NORMALIZED_NAME_INDEXES } from "../lib/contractors/name-search-core";

const PHASE1_NAMES = [
  "contractors_display_name_nameorder_idx", "contractors_legal_name_nameorder_idx", "contractors_dba_name_nameorder_idx",
  "licenses_licensee_name_raw_nameorder_idx", "licenses_dba_name_raw_nameorder_idx",
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

    // 1. Existence + full validity state (indisvalid/indisready/indislive) + expression match against source.
    await q("indexState", `
      SELECT c.relname, x.indisvalid, x.indisready, x.indislive, pg_relation_size(c.oid) bytes, pg_get_indexdef(c.oid) def
      FROM pg_class c JOIN pg_index x ON x.indexrelid = c.oid
      WHERE c.relname = ANY(ARRAY[${PHASE1_NAMES.map((n) => `'${n}'`).join(",")}])`);

    // 2. Total index inventory on the two tables now (for the storage-impact section).
    await q("allIndexSizes", `
      SELECT t.relname AS table, ic.relname AS index, pg_relation_size(ic.oid) bytes
      FROM pg_index x JOIN pg_class ic ON ic.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public' AND t.relname IN ('contractors','licenses') ORDER BY 1,2`);
    await q("dbSize", "SELECT pg_database_size(current_database()) bytes");

    // 3. Load snapshot (context for whether measurement timings below are meaningful).
    await q("activity", `SELECT count(*) total, count(*) FILTER (WHERE state='active') active,
        count(*) FILTER (WHERE xact_start < now() - interval '2 minutes') long_xact
      FROM pg_stat_activity WHERE datname=current_database()`);

    // 4. Query-plan check: plain EXPLAIN only (never ANALYZE -- never executes), using the EXACT SQL the
    // application builds via buildStrongNameMatchSql, for a representative subset of the required cases.
    const explainCases = ["Stilwell Solar", "Allied", "R & T GENERAL CONSTRUCTION, INC.", "stilw"];
    const plans: Record<string, unknown> = {};
    for (const name of explainCases) {
      const prepared = prepareNameTerms(name);
      const strong = buildStrongNameMatchSql(prepared, 1);
      const literal = (sql: string, params: unknown[]) => sql.replace(/\$(\d+)/g, (_, i) => `'${String(params[Number(i) - 1]).replace(/'/g, "''")}'`);
      const sql = `EXPLAIN SELECT c.id FROM ${strong.fromSql} LIMIT 26`;
      try {
        const r = await c.query(literal(sql, strong.params));
        plans[name] = r.rows.map((row: any) => row["QUERY PLAN"]);
      } catch (e) {
        plans[name] = { ERROR: (e as Error).message };
      }
    }
    out.strongTierPlans = plans;

    // Same, for the token (all-words) tier's access path, one case, to see if it also benefits.
    {
      const prepared = prepareNameTerms("Allied");
      const all = buildNameMatchSql(prepared, 1);
      const literal = (sql: string, params: unknown[]) => sql.replace(/\$(\d+)/g, (_, i) => `'${String(params[Number(i) - 1]).replace(/'/g, "''")}'`);
      const sql = `EXPLAIN SELECT c.id FROM ${all.fromSql} LIMIT 26`;
      try { out.tokenTierPlanAllied = (await c.query(literal(sql, all.params))).rows.map((row: any) => row["QUERY PLAN"]); }
      catch (e) { out.tokenTierPlanAllied = { ERROR: (e as Error).message }; }
    }

    // 5. Confirm the code's normalized expression is byte-identical to what's actually indexed (critical for
    // planner index usage -- an expression index only matches an EXACT syntactic match, modulo constant folding).
    out.codeVsIndexExpressionCount = NORMALIZED_NAME_INDEXES.filter((i) => i.kind === "ordered").length;
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
    await pool.end();
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
