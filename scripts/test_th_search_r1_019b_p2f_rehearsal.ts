/**
 * TH-SEARCH-R1-019B-P2F rehearsal (Stage A+B recovery only). The EXACT run() logic of the two recovery
 * wrappers against disposable in-memory Postgres instances (PGlite) that start in Production's shape:
 * 5 Phase-1 B-trees + 5 OLD bare-expression GINs. Nothing here can reach a real database: run() takes a
 * query function and the only one ever supplied is PGlite's. The transport strips CONCURRENTLY
 * (unsupported in-process) AFTER the wrappers' own allowlist has already accepted the exact statement.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { NORMALIZED_NAME_INDEXES, NAME_MATCH_FIELDS, normalizedFieldSql } from "../lib/contractors/name-search-core";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain .mjs owner-run wrapper, intentionally dependency-free
import * as cleanup from "./th_search_r1_019b_p2f_cleanup_invalid_v2.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as build from "./th_search_r1_019b_p2f_build_v2.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const quiet = { log: () => {} };
const FAILED = "contractors_display_name_namewords_v2_idx";
const tableOf = (field: string) => (["display_name", "legal_name", "dba_name"].includes(field) ? "contractors" : "licenses");
const bareGin = (name: string, field: string) => `CREATE INDEX ${name} ON ${tableOf(field)} USING gin (${normalizedFieldSql(field)} gin_trgm_ops) WHERE ${field} IS NOT NULL`;
const wrappedGin = (name: string, field: string) => `CREATE INDEX ${name} ON ${tableOf(field)} USING gin ((${normalizedFieldSql(field)} || '') gin_trgm_ops) WHERE ${field} IS NOT NULL`;

async function productionShape() {
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE TABLE contractors (id text PRIMARY KEY, display_name text, legal_name text, dba_name text);
    CREATE TABLE licenses (id text PRIMARY KEY, contractor_id text, licensee_name_raw text, dba_name_raw text);
    INSERT INTO contractors VALUES ('c1', 'STILWELL SOLAR, LLC', 'STILWELL SOLAR LLC', NULL), ('c2', 'ALLIED ELECTRICAL LLC', NULL, 'ALLIED');
    INSERT INTO licenses VALUES ('l1', 'c1', 'STILWELL SOLAR LLC', NULL), ('l2', 'c2', NULL, 'ALLIED');
  `);
  for (const index of NORMALIZED_NAME_INDEXES.filter((i) => i.kind === "ordered")) await pg.exec(index.ddl.replace(" CONCURRENTLY", ""));
  for (const field of NAME_MATCH_FIELDS) await pg.exec(bareGin(`${tableOf(field)}_${field}_namewords_idx`, field));
  const sent: string[] = [];
  let failOnCreateNumber = 0; // 0 = never
  let creates = 0;
  const transport = async (sql: string, params: unknown[] = []) => {
    sent.push(sql);
    if (sql.startsWith("CREATE INDEX CONCURRENTLY")) {
      creates += 1;
      if (creates === failOnCreateNumber) {
        // What a cancelled CONCURRENTLY build leaves behind: the index exists but is not valid.
        await pg.query(sql.replace(" CONCURRENTLY", ""));
        const name = /CREATE INDEX CONCURRENTLY (\S+)/.exec(sql)![1];
        await pg.exec(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = '${name}'::regclass`);
        throw new Error("canceling statement due to statement timeout");
      }
    }
    return pg.query(sql.replace(" CONCURRENTLY", ""), params as Any[]);
  };
  const nonReads = () => sent.filter((s) => !/^\s*SELECT\b/.test(s));
  const inventory = async () => ((await pg.query(`SELECT relname FROM pg_class WHERE relname ~ '(nameorder|namewords)' ORDER BY 1`)).rows as Any[]).map((r) => r.relname);
  const snapshot = async () => (await pg.query(`SELECT c.relname, c.oid::int AS oid, pg_get_indexdef(c.oid) AS def, x.indisvalid FROM pg_class c JOIN pg_index x ON x.indexrelid = c.oid WHERE c.relname ~ '(_nameorder_idx|_namewords_idx)$' ORDER BY 1`)).rows;
  const leaveFailedStageA = async () => { await pg.exec(wrappedGin(FAILED, "display_name")); await pg.exec(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = '${FAILED}'::regclass`); };
  return { pg, sent, transport, nonReads, inventory, snapshot, leaveFailedStageA, failOn: (n: number) => { failOnCreateNumber = n; } };
}

test("P2F-1. cleanup refuses if the invalid first v2 index is absent", async () => {
  const db = await productionShape();
  await assert.rejects(cleanup.run(db.transport, quiet), /PRECONDITIONS NOT MET -- nothing was touched[\s\S]*contractors_display_name_namewords_v2_idx: expected exactly one relation/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.close();
});

test("P2F-2. cleanup refuses if the first v2 index is VALID (it only ever removes an invalid temporary index)", async () => {
  const db = await productionShape();
  await db.pg.exec(wrappedGin(FAILED, "display_name"));
  await assert.rejects(cleanup.run(db.transport, quiet), /indisvalid = true; this script only removes an INVALID temporary index/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.close();
});

test("P2F-3. cleanup refuses if any other v2 exists, or any unexpected relevant relation exists", async () => {
  const db = await productionShape();
  await db.leaveFailedStageA();
  await db.pg.exec(wrappedGin("contractors_legal_name_namewords_v2_idx", "legal_name"));
  await assert.rejects(cleanup.run(db.transport, quiet), /contractors_legal_name_namewords_v2_idx: must be completely absent/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.exec(`DROP INDEX contractors_legal_name_namewords_v2_idx; ${wrappedGin("contractors_display_name_namewords_v3_idx", "display_name")};`);
  db.sent.length = 0;
  await assert.rejects(cleanup.run(db.transport, quiet), /relevant relations are not exactly the expected eleven/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.close();
});

test("P2F-4. cleanup refuses if any Phase-1 or old-Phase-2 reference is wrong (expression, validity, or missing)", async () => {
  const db = await productionShape();
  await db.leaveFailedStageA();
  await db.pg.exec(`DROP INDEX licenses_dba_name_raw_namewords_idx; CREATE INDEX licenses_dba_name_raw_namewords_idx ON licenses USING gin (dba_name_raw gin_trgm_ops) WHERE dba_name_raw IS NOT NULL;`);
  await assert.rejects(cleanup.run(db.transport, quiet), /licenses_dba_name_raw_namewords_idx: expression is not the expected one/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.exec(`DROP INDEX licenses_dba_name_raw_namewords_idx; ${bareGin("licenses_dba_name_raw_namewords_idx", "dba_name_raw")};`);
  await db.pg.exec(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'contractors_dba_name_nameorder_idx'::regclass`);
  db.sent.length = 0;
  await assert.rejects(cleanup.run(db.transport, quiet), /contractors_dba_name_nameorder_idx: valid\/ready\/live = false/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.exec(`UPDATE pg_index SET indisvalid = true WHERE indexrelid = 'contractors_dba_name_nameorder_idx'::regclass; DROP INDEX licenses_licensee_name_raw_nameorder_idx;`);
  db.sent.length = 0;
  await assert.rejects(cleanup.run(db.transport, quiet), /licenses_licensee_name_raw_nameorder_idx: expected exactly one relation/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.close();
});

test("P2F-5/6/7. build refuses while the failed index remains; cleanup sends exactly ONE drop; all five v2 names are then absent; the ten are untouched", async () => {
  const db = await productionShape();
  await db.leaveFailedStageA();
  // 7: the new build wrapper refuses, and sends nothing but reads -- not even the SET.
  await assert.rejects(build.run(db.transport, quiet), /PRECONDITIONS NOT MET -- nothing was sent but catalog reads[\s\S]*contractors_display_name_namewords_v2_idx already exists \(valid=false\)/);
  assert.deepEqual(db.nonReads(), []);
  // 5: exact failed state -> exactly one statement.
  const before = await db.snapshot();
  assert.equal(before.length, 10);
  db.sent.length = 0;
  const receipt = await cleanup.run(db.transport, quiet);
  assert.equal(receipt.outcome, "INVALID_TEMP_INDEX_REMOVED_TEN_EXISTING_INDEXES_UNTOUCHED");
  assert.deepEqual(db.nonReads(), ["DROP INDEX CONCURRENTLY public.contractors_display_name_namewords_v2_idx"]);
  // 6: all five v2 names absent; ten existing indexes are the same objects with the same definitions.
  assert.deepEqual((await db.inventory()).filter((n: string) => n.includes("_v2_")), []);
  assert.deepEqual(await db.snapshot(), before);
  // and a second run refuses (nothing left to clean).
  db.sent.length = 0;
  await assert.rejects(cleanup.run(db.transport, quiet), /PRECONDITIONS NOT MET/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.close();
});

test("P2F-8/9/13. build sets the session timeout to exactly 10min, reads it back, sends exactly 5 creates; final inventory is 5 + 5 + 5", async () => {
  const db = await productionShape();
  const before = await db.snapshot();
  const receipt: Any = await build.run(db.transport, quiet);
  assert.equal(receipt.outcome, "ALL_FIVE_BUILT_AND_VERIFIED");
  assert.equal(receipt.session.statementTimeoutAfterSet, "10min");
  assert.notEqual(receipt.session.statementTimeoutBefore, "10min");
  assert.deepEqual(receipt.session.persistentSettingsAfter, receipt.session.persistentSettingsBefore);
  const writes = db.nonReads();
  assert.equal(writes.length, 6);
  assert.equal(writes[0], "SET statement_timeout = '10min'", "the SET is sent once, first, and only after the read-only prechecks passed");
  for (const s of writes.slice(1)) assert.match(s, /^CREATE INDEX CONCURRENTLY \w+_namewords_v2_idx ON (contractors|licenses) USING gin \(/);
  assert.equal(((await db.pg.query(`SELECT current_setting('statement_timeout') AS t`)).rows[0] as Any).t, "10min", "session-level: visible on this session only");
  assert.deepEqual(await db.snapshot(), before, "five Phase-1 B-trees and five OLD canonical GINs: same objects, same definitions");
  const inv = await db.inventory();
  assert.equal(inv.length, 15);
  assert.equal(inv.filter((n: string) => n.endsWith("_nameorder_idx")).length, 5);
  assert.equal(inv.filter((n: string) => n.endsWith("_namewords_idx")).length, 5);
  assert.equal(inv.filter((n: string) => n.endsWith("_namewords_v2_idx")).length, 5);
  for (const entry of receipt.results as Any[]) { assert.deepEqual(entry.problems, []); assert.equal(entry.expr, build.wrappedExpr(entry.name.replace(/^(contractors|licenses)_/, "").replace(/_namewords_v2_idx$/, ""))); }
  // and it refuses to run again: existing names stop it, with nothing sent but reads.
  db.sent.length = 0;
  await assert.rejects(build.run(db.transport, quiet), /PRECONDITIONS NOT MET/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.close();
});

test("P2F-11/12. build stops on the first failure, attempts nothing later, and NEVER drops what the failed build left behind", async () => {
  const db = await productionShape();
  db.failOn(2);
  let stopped: Any;
  await assert.rejects(build.run(db.transport, quiet), (error: Any) => { stopped = error; return /contractors_legal_name_namewords_v2_idx: canceling statement due to statement timeout\. Stopping/.test(error.message); });
  const writes = db.nonReads();
  assert.deepEqual(writes.map((s: string) => s.split(" ").slice(0, 4).join(" ")), ["SET statement_timeout = '10min'", "CREATE INDEX CONCURRENTLY contractors_display_name_namewords_v2_idx", "CREATE INDEX CONCURRENTLY contractors_legal_name_namewords_v2_idx"]);
  for (const s of db.sent) assert.doesNotMatch(s, /\b(DROP|ALTER|REINDEX)\b/);
  // The receipt survives the stop and says exactly what happened and what was left behind.
  assert.equal(stopped.receipt.outcome, "STOPPED");
  assert.equal(stopped.receipt.results.length, 2);
  assert.deepEqual(stopped.receipt.results[0].problems, []);
  assert.equal(stopped.receipt.results[1].leftBehind[0].indisvalid, false);
  const inv = await db.inventory();
  assert.ok(inv.includes("contractors_legal_name_namewords_v2_idx"), "the failed build's invalid index is still there");
  assert.equal(inv.filter((n: string) => n.endsWith("_namewords_v2_idx")).length, 2);
  // Neither wrapper will act on this different failure shape: both refuse.
  db.sent.length = 0;
  await assert.rejects(build.run(db.transport, quiet), /PRECONDITIONS NOT MET/);
  await assert.rejects(cleanup.run(db.transport, quiet), /PRECONDITIONS NOT MET -- nothing was touched/);
  assert.deepEqual(db.nonReads(), []);
  await db.pg.close();
});

test("P2F-8b. a session whose timeout does not read back as exactly 10min stops before any create", async () => {
  const db = await productionShape();
  const lying = async (sql: string, params: unknown[] = []) => (sql.startsWith("SET statement_timeout") ? { rows: [] } : db.transport(sql, params));
  await assert.rejects(build.run(lying, quiet), /statement_timeout reads back as '.*', expected exactly '10min'\. Stopping -- nothing was created/);
  assert.equal(db.sent.filter((s: string) => s.startsWith("CREATE")).length, 0);
  await db.pg.close();
});

test("P2F-10. no persistent-setting command, no other setting, no unbounded timeout exists in anything either wrapper can send", () => {
  const c = cleanup.selfCheck().tally;
  assert.deepEqual([c.dropsTotal, c.dropsOfTheInvalidTempIndex, c.dropIfExists, c.cascade, c.creates, c.alters, c.settings, c.sourceDataWrites, c.canonicalOrPhase1NamesInStatements], [1, 1, 0, 0, 0, 0, 0, 0, 0]);
  const b = build.selfCheck();
  assert.equal(b.sha256, "4aefa3644d622c43616113c60d55ff206a926b071875e87cd1f7ed413c7e644e");
  assert.deepEqual([b.tally.creates, b.tally.drops, b.tally.alters, b.tally.sessionTimeoutSets, b.tally.settingStatementsTotal, b.tally.setLocalOrTransaction, b.tally.setConfigCalls, b.tally.unlimitedTimeout, b.tally.otherSettingsNamed, b.tally.ifNotExists], [5, 0, 0, 1, 1, 0, 0, 0, 0, 0]);
  const everything = [...cleanup.sendableStatements(), ...build.sendableStatements()];
  for (const s of everything) {
    assert.doesNotMatch(s, /\bALTER\s+(ROLE|DATABASE|SYSTEM|USER)\b/i);
    assert.doesNotMatch(s, /\bSET\s+(LOCAL|SESSION\s+AUTHORIZATION|ROLE)\b/i);
    assert.doesNotMatch(s, /\b(RESET|set_config|pg_reload_conf)\b/i);
  }
  assert.deepEqual(everything.filter((s: string) => /^\s*SET\b/i.test(s)), ["SET statement_timeout = '10min'"]);
});
