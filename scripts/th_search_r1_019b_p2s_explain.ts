/* TH-SEARCH-R1-019B-P2S plan inspection. READ-ONLY, BEGIN READ ONLY then ROLLBACK. Plain EXPLAIN only --
 * never EXPLAIN ANALYZE (forbidden for this pass). No DDL, no ANALYZE/VACUUM, no planner-setting changes. */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
import { Pool } from "pg";
import { buildStrongNameMatchSql, buildNameMatchSql, prepareNameTerms } from "../lib/contractors/name-search-core";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  const c = await pool.connect();
  const out: Record<string, unknown> = { ranAt: new Date().toISOString(), note: "Plain EXPLAIN only, never ANALYZE. Jurisdiction filtering is applied at the query-orchestration layer, not inside buildStrongNameMatchSql/buildNameMatchSql -- so the 'Stilwell Solar token tier' and 'TX honest-miss token tier' cases below share the identical core match SQL/plan; this is documented, not an oversight." };
  const literal = (sql: string, params: unknown[]) => sql.replace(/\$(\d+)/g, (_, i) => `'${String(params[Number(i) - 1]).replace(/'/g, "''")}'`);

  const q = async (label: string, sql: string) => {
    try {
      const r = await c.query(sql);
      out[label] = r.rows.map((row: any) => row["QUERY PLAN"]);
    } catch (e) {
      out[label] = { ERROR: (e as Error).message };
      await c.query("ROLLBACK").catch(() => {});
      await c.query("BEGIN READ ONLY");
    }
  };

  try {
    await c.query("SET statement_timeout = 8000");
    await c.query("BEGIN READ ONLY");

    {
      const prepared = prepareNameTerms("Allied");
      const strong = buildStrongNameMatchSql(prepared, 1);
      await q("allied_strong_tier", literal(`EXPLAIN SELECT c.id FROM ${strong.fromSql} LIMIT 26`, strong.params));
    }
    {
      const prepared = prepareNameTerms("Stilwell Solar");
      const strong = buildStrongNameMatchSql(prepared, 1);
      await q("stilwell_solar_strong_tier", literal(`EXPLAIN SELECT c.id FROM ${strong.fromSql} LIMIT 26`, strong.params));
    }
    {
      const prepared = prepareNameTerms("Stilwell Solar");
      const all = buildNameMatchSql(prepared, 1);
      await q("stilwell_solar_token_tier", literal(`EXPLAIN SELECT c.id FROM ${all.fromSql} LIMIT 26`, all.params));
    }
    {
      // TX honest-miss token tier: same supplied name, core match SQL is jurisdiction-agnostic (see note above).
      const prepared = prepareNameTerms("Stilwell Solar");
      const all = buildNameMatchSql(prepared, 1);
      await q("stilwell_solar_tx_honest_miss_token_tier", literal(`EXPLAIN SELECT c.id FROM ${all.fromSql} LIMIT 26`, all.params));
    }
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
    await pool.end();
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error(e.message); process.exit(1); });
