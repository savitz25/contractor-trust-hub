/**
 * TH-SEARCH-R1-019B review 2 -- LOCAL index-design experiment (alternative B).
 *
 * Disposable in-memory Postgres (PGlite) with SYNTHETIC names only. No production data is read,
 * copied or exported, and nothing here touches a real database. It answers three questions:
 *   1. how large are the proposed normalized-name indexes per row (to extrapolate a footprint);
 *   2. does the planner pick them on its own at a non-trivial table size (no planner settings);
 *   3. how much work does each tier do for a one-word common name and an all-common-words name.
 *
 * Usage: npx tsx scripts/th_search_r1_019b_index_design.ts [rows=200000]
 */
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { buildNameMatchSql, buildStrongNameMatchSql, NORMALIZED_NAME_INDEXES, prepareNameTerms } from "../lib/contractors/name-search-core";

const ROWS = Number(process.argv[2] ?? 200_000);
const FIRST = ["ALLIED", "GENERAL", "PREMIER", "COASTAL", "SUNSHINE", "AMERICAN", "NATIONAL", "QUALITY", "PRECISION", "ELITE", "RELIABLE", "SOUTHERN", "A", "R & T", "J.B.", "O'NEIL", "MCDONALD'S", "D'ARCY", "JOSÉ", "MÜLLER", "TRIPLE", "BLUE", "GREEN", "FIRST", "ALL"];
const SECOND = ["CONSTRUCTION", "ROOFING", "PLUMBING", "ELECTRIC", "ELECTRICAL", "BUILDERS", "CONTRACTING", "SERVICES", "HOMES", "MECHANICAL", "AIR CONDITIONING", "POOLS", "PAINTING", "RESTORATION", "GENERAL CONSTRUCTION"];
const SUFFIX = ["", "", " LLC", ", INC.", " INC", " CORP", " CO.", " OF TAMPA", " & SONS", " GROUP LLC"];

function nameFor(i: number): string {
  // Deterministic. A third of the rows get a distinguishing number-word so names are not all duplicates.
  const a = FIRST[i % FIRST.length], b = SECOND[(i * 7 + 3) % SECOND.length], c = SUFFIX[(i * 13 + 5) % SUFFIX.length];
  const tag = i % 3 === 0 ? ` ${(i * 2654435761 % 0xfffff).toString(36).toUpperCase()}` : "";
  return `${a}${tag} ${b}${c}`;
}

async function main() {
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE TABLE contractors (id int PRIMARY KEY, slug text, display_name text, legal_name text, dba_name text, is_thin_profile boolean DEFAULT FALSE, home_state text);
    CREATE TABLE licenses (id int PRIMARY KEY, contractor_id int, licensee_name_raw text, dba_name_raw text, source_system text, state text);
  `);
  const BATCH = 5000;
  for (let start = 0; start < ROWS; start += BATCH) {
    const names = Array.from({ length: Math.min(BATCH, ROWS - start) }, (_, k) => nameFor(start + k));
    await pg.query(
      `INSERT INTO contractors (id, slug, display_name, legal_name, dba_name, home_state)
       SELECT $1::int + o - 1, 'p-' || ($1::int + o - 1), n, n, CASE WHEN o % 5 < 2 THEN 'DBA ' || n END, 'FL' FROM unnest($2::text[]) WITH ORDINALITY AS t(n, o)`,
      [start, names]
    );
    await pg.query(
      `INSERT INTO licenses (id, contractor_id, licensee_name_raw, dba_name_raw, source_system, state)
       SELECT $1::int + o - 1, $1::int + o - 1, n, CASE WHEN o % 5 < 2 THEN 'DBA ' || n END, 'fl_dbpr', 'FL' FROM unnest($2::text[]) WITH ORDINALITY AS t(n, o)`,
      [start, names]
    );
  }
  // The shape production already has: raw trigram indexes, for a like-for-like size ratio.
  await pg.exec(`
    CREATE INDEX raw_display_trgm ON contractors USING gin (display_name gin_trgm_ops);
    CREATE INDEX raw_display_btree ON contractors (display_name);
  `);
  const buildMs: Record<string, number> = {};
  for (const index of NORMALIZED_NAME_INDEXES) {
    const t = Date.now();
    await pg.exec(index.ddl.replace(" CONCURRENTLY", ""));
    buildMs[index.name] = Date.now() - t;
  }
  await pg.exec("ANALYZE contractors; ANALYZE licenses;");

  const sizes = (await pg.query<{ relname: string; bytes: number }>(
    `SELECT c.relname, pg_relation_size(c.oid)::bigint AS bytes FROM pg_class c WHERE c.relkind = 'i' AND (c.relname LIKE '%name%idx' OR c.relname LIKE 'raw_%') ORDER BY 1`
  )).rows.map((r) => ({ index: r.relname, bytes: Number(r.bytes), bytesPerTableRow: Math.round((Number(r.bytes) / ROWS) * 10) / 10, buildMs: buildMs[r.relname] ?? null }));

  const literal = (sql: string, params: unknown[]) => sql.replace(/\$(\d+)/g, (_, i) => `'${String(params[Number(i) - 1]).replace(/'/g, "''")}'`);
  const tiers = [] as unknown[];
  for (const name of ["Allied", "R & T GENERAL CONSTRUCTION, INC", "R & T", "ONeil Plumbing", "General Construction"]) {
    for (const [tier, match] of [["strong", buildStrongNameMatchSql(prepareNameTerms(name), 1)], ["allWords", buildNameMatchSql(prepareNameTerms(name), 1)]] as const) {
      // Natural plan: NO planner setting is changed here.
      const sql = literal(`SELECT c.id FROM ${match.fromSql} ORDER BY c.id LIMIT 26`, match.params);
      const plan = (await pg.query<{ "QUERY PLAN": string }>(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`)).rows.map((r) => r["QUERY PLAN"]);
      tiers.push({
        name, tier,
        usesProposedIndex: plan.some((l) => /_name(order|words)_idx/.test(l)),
        sequentialScan: plan.some((l) => /Seq Scan/.test(l)),
        indexesNamed: [...new Set(plan.flatMap((l) => l.match(/\w+_name(?:order|words)_idx/g) ?? []))],
        executionMs: Number(/Execution Time: ([\d.]+)/.exec(plan.join("\n"))?.[1] ?? NaN),
      });
    }
  }
  const out = {
    ranAt: new Date().toISOString(),
    kind: "LOCAL SYNTHETIC EXPERIMENT -- in-memory PGlite, generated names, warm memory. Sizes-per-row are MEASURED here and only an ESTIMATE for production; latencies say nothing about a cold production cache.",
    postgres: (await pg.query<{ v: string }>("SELECT version() AS v")).rows[0].v,
    rowsPerTable: ROWS,
    indexes: sizes,
    tiers,
  };
  fs.writeFileSync("docs/qa/th-search-r1-019b/index-design-local.review2.json", JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 1));
  await pg.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
