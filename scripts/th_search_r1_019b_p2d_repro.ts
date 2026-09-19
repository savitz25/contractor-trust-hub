/**
 * TH-SEARCH-R1-019B-P2D step 1: RED reproduction. Disposable in-memory PGlite fixture only --
 * nothing here ever touches a real database. Builds BOTH index families (Phase 1 B-tree nameorder_idx,
 * Phase 2 GIN namewords_idx) exactly as NORMALIZED_NAME_INDEXES defines them today, on a fixture large
 * and skewed enough to give the planner a genuine cost choice, then captures plain EXPLAIN (never
 * ANALYZE-execute) for the current buildStrongNameMatchSql() query shape to see whether the planner is
 * ALLOWED to pick the GIN index for the strong (prefix) tier -- which is the defect this ticket targets.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { buildStrongNameMatchSql, buildNameMatchSql, prepareNameTerms, NORMALIZED_NAME_INDEXES } from "../lib/contractors/name-search-core";

async function main() {
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE TABLE contractors (id text PRIMARY KEY, display_name text, legal_name text, dba_name text);
    CREATE TABLE licenses (id text PRIMARY KEY, contractor_id text, licensee_name_raw text, dba_name_raw text);
  `);

  // Skewed fixture: many rows share the "ALLIED" prefix (mirrors a common, non-selective prefix), plus a
  // long tail of unrelated names, to give the planner a genuine row-count/selectivity choice to make --
  // a tiny, uniformly-distinct fixture (as in the existing 19-test PGlite suite) does not exercise this.
  let seq = 0;
  const rows: string[] = [];
  const alliedVariants = [
    "ALLIED ELECTRICAL LLC", "ALLIED ROOFING OF TAMPA INC", "ALLIED MECHANICAL SERVICES",
    "ALLIED PLUMBING AND HEATING", "ALLIED CONSTRUCTION GROUP", "ALLIED HOME BUILDERS",
    "ALLIED SOLAR ENERGY LLC", "ALLIED PAINTING CO", "ALLIED CONCRETE WORKS", "ALLIED DRYWALL LLC",
  ];
  const ALLIED_COUNT = 6000;
  const UNRELATED_COUNT = 60000;
  for (let i = 0; i < ALLIED_COUNT; i += 1) {
    seq += 1;
    const base = alliedVariants[i % alliedVariants.length];
    rows.push(`${base} ${i}`);
  }
  for (let i = 0; i < UNRELATED_COUNT; i += 1) {
    seq += 1;
    rows.push(`UNRELATED BUILDERS ${i}`);
  }
  // Realistic sparsity: most rows have only a display_name and a licensee_name_raw (the two fields the
  // Production Allied plan actually put weight on); legal_name/dba_name/dba_name_raw stay mostly NULL,
  // matching how a partial-index (`WHERE field IS NOT NULL`) universe behaves on a real registry where
  // not every contractor has a distinct legal/DBA name.
  await pg.exec("BEGIN");
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const cValues: string[] = [];
    const cParams: unknown[] = [];
    const lValues: string[] = [];
    const lParams: unknown[] = [];
    chunk.forEach((display, j) => {
      const idx = i + j;
      const id = `c${idx}`;
      const dbaEveryTenth = idx % 10 === 0 ? display.replace("ALLIED", "A. ALLIED") : null;
      cValues.push(`($${cParams.length + 1},$${cParams.length + 2},$${cParams.length + 3},$${cParams.length + 4})`);
      cParams.push(id, display, null, dbaEveryTenth);
      lValues.push(`($${lParams.length + 1},$${lParams.length + 2},$${lParams.length + 3},$${lParams.length + 4})`);
      lParams.push(`${id}-l`, id, display, null);
    });
    await pg.query(`INSERT INTO contractors VALUES ${cValues.join(",")}`, cParams);
    await pg.query(`INSERT INTO licenses VALUES ${lValues.join(",")}`, lParams);
  }
  await pg.exec("COMMIT");

  // Current (unmodified) NORMALIZED_NAME_INDEXES -- all 10, exactly as PR #86 ships (5 Phase-1 B-tree
  // nameorder_idx + 5 Phase-2 GIN namewords_idx), so the planner sees the identical index landscape
  // Production has.
  assert(NORMALIZED_NAME_INDEXES.length === 10, `expected 10 indexes, found ${NORMALIZED_NAME_INDEXES.length}`);
  for (const idx of NORMALIZED_NAME_INDEXES) await pg.exec(idx.ddl.replace(" CONCURRENTLY", ""));

  const plan = async (sql: string, params: unknown[]) => {
    const literal = sql.replace(/\$(\d+)/g, (_, i) => `'${String(params[Number(i) - 1]).replace(/'/g, "''")}'`);
    return (await pg.query(`EXPLAIN ${literal}`)).rows.map((row) => (row as Record<string, unknown>)["QUERY PLAN"]).join("\n");
  };

  const report: Record<string, unknown> = {};
  await pg.exec("SET enable_seqscan = off");
  try {
    for (const analyzed of [false, true]) {
      if (analyzed) await pg.exec("ANALYZE contractors; ANALYZE licenses;");
      const label = analyzed ? "after_analyze" : "before_analyze";
      const strong = buildStrongNameMatchSql(prepareNameTerms("Allied"), 1);
      const strongPlan = await plan(`SELECT c.id FROM ${strong.fromSql} LIMIT 26`, strong.params);
      const all = buildNameMatchSql(prepareNameTerms("Allied"), 1);
      const tokenPlan = await plan(`SELECT c.id FROM ${all.fromSql} LIMIT 26`, all.params);
      report[label] = {
        strongTierUsesGin: /_namewords_idx/.test(strongPlan),
        strongTierUsesBtree: /_nameorder_idx/.test(strongPlan),
        strongPlan,
        tokenPlan,
      };
      console.log(`\n=== ${label} ===`);
      console.log("strong tier uses GIN namewords_idx:", /_namewords_idx/.test(strongPlan));
      console.log("strong tier uses B-tree nameorder_idx:", /_nameorder_idx/.test(strongPlan));
    }
  } finally {
    await pg.exec("RESET enable_seqscan");
  }

  fs.writeFileSync("docs/qa/th-search-r1-019b/p2d-red-repro.local.json", JSON.stringify(report, null, 2) + "\n");
  console.log("\nWritten to docs/qa/th-search-r1-019b/p2d-red-repro.local.json");
  await pg.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
