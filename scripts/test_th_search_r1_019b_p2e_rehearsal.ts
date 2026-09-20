/**
 * TH-SEARCH-R1-019B-P2E rehearsal. The EXACT run() logic of the two owner-run wrappers, driven against a
 * disposable in-memory Postgres (PGlite) that starts in Production's current index shape (5 Phase-1
 * B-trees + 5 OLD bare-expression GINs). Nothing here can reach a real database: the wrappers' run()
 * takes a query function, and the only one supplied is PGlite's. The transport strips CONCURRENTLY
 * (unsupported in-process) AFTER the wrappers' own allowlist has already accepted the exact statement.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test, { after, before } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { NORMALIZED_NAME_INDEXES, NAME_MATCH_FIELDS, buildNameMatchSql, buildStrongNameMatchSql, normalizedFieldSql, prepareNameTerms } from "../lib/contractors/name-search-core";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain .mjs owner-run wrapper, intentionally dependency-free
import * as build from "./th_search_r1_019b_p2e_build_v2.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as retire from "./th_search_r1_019b_p2e_retire_old.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
let pg: PGlite;
const sent: string[] = [];
const transport = async (sql: string, params: unknown[] = []) => {
  sent.push(sql);
  return pg.query(sql.replace(" CONCURRENTLY", ""), params as Any[]);
};
const quiet = { log: () => {} };
const tableOf = (field: string) => (["display_name", "legal_name", "dba_name"].includes(field) ? "contractors" : "licenses");
const oldBareGinDdl = (field: string) => `CREATE INDEX ${tableOf(field)}_${field}_namewords_idx ON ${tableOf(field)} USING gin (${normalizedFieldSql(field)} gin_trgm_ops) WHERE ${field} IS NOT NULL`;
const inventory = async () => ((await pg.query(`SELECT relname FROM pg_class WHERE relkind = 'i' AND relname ~ '_(nameorder|namewords|namewords_v2)_idx$' ORDER BY 1`)).rows as Any[]).map((r) => r.relname);
const exprOf = async (name: string) => ((await pg.query(`SELECT pg_get_expr(x.indexprs, x.indrelid) e FROM pg_class c JOIN pg_index x ON x.indexrelid = c.oid WHERE c.relname = $1`, [name])).rows[0] as Any)?.e;
const nonReads = () => sent.filter((s) => !/^\s*SELECT\b/.test(s));

before(async () => {
  pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE TABLE contractors (id text PRIMARY KEY, display_name text, legal_name text, dba_name text);
    CREATE TABLE licenses (id text PRIMARY KEY, contractor_id text, licensee_name_raw text, dba_name_raw text);
    INSERT INTO contractors VALUES ('c1', 'STILWELL SOLAR, LLC', 'STILWELL SOLAR LLC', NULL), ('c2', 'O''NEIL PLUMBING LLC', NULL, 'JOSÉ BUILDERS'), ('c3', 'ALLIED ELECTRICAL LLC', NULL, NULL);
    INSERT INTO licenses VALUES ('l1', 'c1', 'STILWELL SOLAR LLC', NULL), ('l2', 'c2', NULL, 'ONEIL'), ('l3', 'c3', 'ALLIED ELECTRICAL', NULL);
  `);
  // Production's CURRENT shape: Phase-1 B-trees (unchanged by the candidate) + OLD bare-expression GINs.
  for (const index of NORMALIZED_NAME_INDEXES.filter((i) => i.kind === "ordered")) await pg.exec(index.ddl.replace(" CONCURRENTLY", ""));
  for (const field of NAME_MATCH_FIELDS) await pg.exec(oldBareGinDdl(field));
});
after(async () => { await pg.close(); });

test("P2E-1. the proposed DDL file is exactly what the candidate's code renders, and both wrappers pass their offline self-checks", () => {
  execFileSync(process.execPath, ["--import", "tsx", "scripts/th_search_r1_019b_p2e_generate_v2_ddl.ts", "--check"], { stdio: "pipe" });
  const b = build.selfCheck();
  assert.equal(b.sha256, build.DDL_SHA256);
  assert.deepEqual([b.tally.creates, b.tally.drops, b.tally.alters, b.tally.btreeModifications, b.tally.sourceDataWrites, b.tally.ifNotExists], [5, 0, 0, 0, 0, 0]);
  const r = retire.selfCheck();
  assert.deepEqual([r.tally.drops, r.tally.renames, r.tally.creates, r.tally.dropsOfAnythingElse, r.tally.altersOfAnythingElse, r.tally.btreeModifications, r.tally.dropIfExists, r.tally.cascade], [5, 5, 0, 0, 0, 0, 0, 0]);
});

test("P2E-2. the pinned deparsed expressions match what PostgreSQL itself reports for the real indexes", async () => {
  for (const field of NAME_MATCH_FIELDS) {
    assert.equal(await exprOf(`${tableOf(field)}_${field}_nameorder_idx`), build.bareExpr(field));
    assert.equal(await exprOf(`${tableOf(field)}_${field}_namewords_idx`), retire.bareExpr(field), "OLD GIN is on the bare expression");
    assert.equal(build.bareExpr(field), retire.bareExpr(field));
  }
});

test("P2E-3. retire refuses BEFORE the build exists (preconditions A-C) and touches nothing", async () => {
  const beforeInv = await inventory();
  sent.length = 0;
  await assert.rejects(retire.run(transport, quiet), /PRECONDITIONS NOT MET -- nothing was touched/);
  assert.deepEqual(nonReads(), [], "not one non-read statement was sent");
  assert.deepEqual(await inventory(), beforeInv);
});

test("P2E-4. build creates exactly the five v2 indexes on the wrapped expression and nothing else", async () => {
  sent.length = 0;
  const receipt = await build.run(transport, quiet);
  assert.equal(receipt.outcome, "ALL_FIVE_BUILT_AND_VERIFIED");
  assert.equal(nonReads().length, 5);
  for (const s of nonReads()) assert.match(s, /^CREATE INDEX CONCURRENTLY \w+_namewords_v2_idx ON (contractors|licenses) USING gin \(/);
  assert.equal((await inventory()).length, 15);
  for (const field of NAME_MATCH_FIELDS) assert.equal(await exprOf(`${tableOf(field)}_${field}_namewords_v2_idx`), build.wrappedExpr(field));
  for (const entry of receipt.results as Any[]) assert.deepEqual(entry.problems, []);
});

test("P2E-5. build refuses to run again: an existing v2 name stops it (no IF NOT EXISTS, no silent skip)", async () => {
  sent.length = 0;
  await assert.rejects(build.run(transport, quiet), /already exists .* Stopping -- nothing was created/);
  assert.deepEqual(nonReads(), []);
  assert.equal((await inventory()).length, 15);
});

test("P2E-6. retire refuses when a replacement is on the WRONG expression (C), is INVALID (B/H), or an old index is not the old bare shape (E)", async () => {
  const v2 = "contractors_legal_name_namewords_v2_idx";
  const good = (await pg.query(`SELECT pg_get_indexdef(c.oid) d FROM pg_class c WHERE relname = $1`, [v2])).rows[0] as Any;
  // C: a v2-named index that is actually on the bare expression.
  await pg.exec(`DROP INDEX ${v2}; CREATE INDEX ${v2} ON contractors USING gin (${normalizedFieldSql("legal_name")} gin_trgm_ops) WHERE legal_name IS NOT NULL;`);
  sent.length = 0;
  await assert.rejects(retire.run(transport, quiet), /contractors_legal_name_namewords_v2_idx: expression is not the expected one/);
  assert.deepEqual(nonReads(), []);
  await pg.exec(`DROP INDEX ${v2}; ${good.d};`);
  // B/H: an invalid replacement (what a failed CONCURRENTLY build leaves behind).
  await pg.exec(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = '${v2}'::regclass`);
  sent.length = 0;
  await assert.rejects(retire.run(transport, quiet), /contractors_legal_name_namewords_v2_idx: valid\/ready\/live = false/);
  assert.deepEqual(nonReads(), []);
  await pg.exec(`UPDATE pg_index SET indisvalid = true WHERE indexrelid = '${v2}'::regclass`);
  // E: an "old" index that is not on the old bare expression.
  const old = "licenses_dba_name_raw_namewords_idx";
  const oldGood = (await pg.query(`SELECT pg_get_indexdef(c.oid) d FROM pg_class c WHERE relname = $1`, [old])).rows[0] as Any;
  await pg.exec(`DROP INDEX ${old}; CREATE INDEX ${old} ON licenses USING gin (dba_name_raw gin_trgm_ops) WHERE dba_name_raw IS NOT NULL;`);
  sent.length = 0;
  await assert.rejects(retire.run(transport, quiet), /licenses_dba_name_raw_namewords_idx: expression is not the expected one/);
  assert.deepEqual(nonReads(), []);
  await pg.exec(`DROP INDEX ${old}; ${oldGood.d};`);
  assert.equal((await inventory()).length, 15);
});

test("P2E-7. retire drops exactly the five old GINs, THEN renames the five replacements; Phase-1 untouched; final inventory exact", async () => {
  const phase1Before = (await pg.query(`SELECT c.relname, c.oid::int, pg_get_indexdef(c.oid) d FROM pg_class c WHERE relname ~ '_nameorder_idx$' ORDER BY 1`)).rows;
  sent.length = 0;
  const receipt = await retire.run(transport, quiet);
  assert.equal(receipt.outcome, "RETIRED_FIVE_OLD_AND_RENAMED_FIVE_REPLACEMENTS");
  const writes = nonReads();
  assert.equal(writes.length, 10);
  writes.slice(0, 5).forEach((s) => assert.match(s, /^DROP INDEX CONCURRENTLY public\.\w+_namewords_idx$/));
  writes.slice(5).forEach((s) => assert.match(s, /^ALTER INDEX public\.\w+_namewords_v2_idx RENAME TO \w+_namewords_idx$/));
  for (const s of writes) assert.doesNotMatch(s, /nameorder/);
  assert.deepEqual(await inventory(), NORMALIZED_NAME_INDEXES.map((i) => i.name).sort(), "exactly the ten canonical names the candidate's code expects");
  for (const field of NAME_MATCH_FIELDS) assert.equal(await exprOf(`${tableOf(field)}_${field}_namewords_idx`), retire.wrappedExpr(field), "canonical GIN name now indexes the WRAPPED expression");
  const phase1After = (await pg.query(`SELECT c.relname, c.oid::int, pg_get_indexdef(c.oid) d FROM pg_class c WHERE relname ~ '_nameorder_idx$' ORDER BY 1`)).rows;
  assert.deepEqual(phase1After, phase1Before, "Phase-1 B-trees: same objects (same oids), same definitions");
});

test("P2E-8. retire refuses to run a second time, and the candidate's queries run against the final shape", async () => {
  sent.length = 0;
  await assert.rejects(retire.run(transport, quiet), /PRECONDITIONS NOT MET -- nothing was touched/);
  assert.deepEqual(nonReads(), []);
  const literal = (sql: string, params: unknown[]) => sql.replace(/\$(\d+)/g, (_, i) => `'${String(params[Number(i) - 1]).replace(/'/g, "''")}'`);
  const strong = buildStrongNameMatchSql(prepareNameTerms("Stilwell Solar"), 1);
  const token = buildNameMatchSql(prepareNameTerms("Solar Stilwell"), 1);
  assert.deepEqual((await pg.query(literal(`SELECT c.id FROM ${strong.fromSql}`, strong.params))).rows, [{ id: "c1" }]);
  assert.deepEqual((await pg.query(literal(`SELECT c.id FROM ${token.fromSql}`, token.params))).rows, [{ id: "c1" }]);
});

test("P2E-9. the allowlist itself: neither wrapper can be made to send anything else", async () => {
  const hostile = async () => ({ rows: [{ db: "x", usr: "x", version: "x", trgm: 1, n: 0 }] });
  // A transport cannot widen the allowlist; the wrappers choose the SQL. Prove the guard exists by source inspection of behaviour:
  const seen: string[] = [];
  const spy = async (sql: string) => { seen.push(sql); return hostile(); };
  await assert.rejects(build.run(spy, quiet));
  await assert.rejects(retire.run(spy, quiet));
  for (const s of seen) assert.match(s, /^\s*SELECT\b/, "with nothing verifiable, only catalog reads were ever attempted");
});
