/**
 * TH-SEARCH-R1-019B-P2F RECOVERY STEP 1 -- DESTRUCTIVE (ONE STATEMENT). FOR THE OWNER TO RUN ONLY AFTER
 * REVIEW AND AN EXPLICIT AUTHORIZATION NAMING THIS STEP. NOT executed by the preparing session.
 *
 * The first Stage-A attempt was cancelled by the connection's 2-minute statement timeout while building
 * index 1 of 5, leaving ONE INVALID temporary index behind. This script removes exactly that one object:
 *
 *     DROP INDEX CONCURRENTLY public.contractors_display_name_namewords_v2_idx
 *
 * (no IF EXISTS, no CASCADE) and nothing else. It never creates, renames, reindexes, vacuums, analyzes,
 * changes any setting (session or persistent), or touches table data, any old canonical *_namewords_idx,
 * or any *_nameorder_idx (those ten are only READ, before and after, and must be byte-for-byte unchanged).
 *
 * FAIL-CLOSED -- it refuses, having sent nothing but fixed catalog reads, unless Production is EXACTLY:
 *   A. contractors_display_name_namewords_v2_idx exists;
 *   B. it is an index, in public, on contractors, GIN / gin_trgm_ops, one column, on exactly the wrapped
 *      expression, with exactly the predicate (display_name IS NOT NULL), and indisvalid = FALSE;
 *   C. the other four *_namewords_v2_idx names are held by no relation of any kind in any schema;
 *   D. all five old canonical *_namewords_idx exist, valid/ready/live, GIN / gin_trgm_ops, OLD bare expression;
 *   E. all five Phase-1 *_nameorder_idx exist, valid/ready/live, btree / text_pattern_ops, bare expression;
 *   F. no CREATE INDEX operation is in progress;
 *   G. the relations whose names contain "nameorder" or "namewords" are exactly those eleven, all in public.
 *
 * It never retries. DROP INDEX CONCURRENTLY cannot run in a transaction and waits for conflicting
 * transactions; under the connection's statement timeout it can itself be cancelled. If that happens the
 * index is still present and still not valid, the receipt says so, and running this script again is a
 * fresh, separately decided act (its preconditions will be re-proved from scratch).
 *
 * Usage:
 *   node scripts/th_search_r1_019b_p2f_cleanup_invalid_v2.mjs      # offline self-check only, connects to nothing
 *   node scripts/th_search_r1_019b_p2f_cleanup_invalid_v2.mjs --execute-cleanup-invalid-v2 --owner-authorized-p2f-cleanup
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const RECEIPT_FILE = "docs/qa/th-search-r1-019b/p2f-cleanup-invalid-v2-receipt.local.json";

export const TARGETS = [
  { table: "contractors", field: "display_name" },
  { table: "contractors", field: "legal_name" },
  { table: "contractors", field: "dba_name" },
  { table: "licenses", field: "licensee_name_raw" },
  { table: "licenses", field: "dba_name_raw" },
].map((t) => ({
  ...t,
  old: `${t.table}_${t.field}_namewords_idx`,
  v2: `${t.table}_${t.field}_namewords_v2_idx`,
  nameorder: `${t.table}_${t.field}_nameorder_idx`,
}));
export const FAILED = TARGETS[0];
export const DROP_STATEMENT = "DROP INDEX CONCURRENTLY public.contractors_display_name_namewords_v2_idx";

// Backslash sequences are assembled from a char code so no editor, tool or transport can ever decode them:
// PostgreSQL reports these regex classes as LITERAL backslash-u / backslash-x text, and this must match it byte for byte.
const BS = String.fromCharCode(92);
const U = (hex) => `${BS}u${hex}`;
const X = (hex) => `${BS}x${hex}`;
const APOSTROPHE_CLASS = "[''" + String.fromCharCode(96) + U("2018") + U("2019") + U("02BC") + "]";
const SEPARATOR_CLASS = "[" + X("01") + "-" + X("2F") + X("3A") + "-" + X("40") + X("5B") + "-" + X("60") + X("7B") + "-" + X("7F") + U("00A0") + U("2013") + U("2014") + U("201C") + U("201D") + "]+";
/** The bare normalized expression exactly as PostgreSQL deparses it (pg_get_expr), per field. */
export const bareExpr = (field) =>
  `((' '::text || btrim(regexp_replace(regexp_replace(upper(COALESCE(${field}, ''::text)), '${APOSTROPHE_CLASS}'::text, ''::text, 'g'::text), '${SEPARATOR_CLASS}'::text, ' '::text, 'g'::text))) || ' '::text)`;
export const wrappedExpr = (field) => `(${bareExpr(field)} || ''::text)`;

const INDEX_FACTS_SQL = `
  SELECT n.nspname AS schema, c.relname AS name, c.relkind::text AS kind, c.oid::int AS oid, t.relname AS table_name, am.amname AS method,
         x.indisvalid, x.indisready, x.indislive, x.indnatts::int AS natts,
         (SELECT opcname FROM pg_opclass WHERE oid = x.indclass[0]) AS opclass,
         pg_get_expr(x.indexprs, x.indrelid) AS expr,
         pg_get_expr(x.indpred, x.indrelid) AS pred,
         pg_get_indexdef(c.oid) AS def,
         pg_relation_size(c.oid)::text AS bytes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_index x ON x.indexrelid = c.oid
  LEFT JOIN pg_class t ON t.oid = x.indrelid
  LEFT JOIN pg_am am ON am.oid = c.relam
  WHERE c.relname = $1`;
const RELEVANT_RELATIONS_SQL = `SELECT n.nspname AS schema, c.relname AS name, c.relkind::text AS kind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname ~ '(nameorder|namewords)' ORDER BY 1, 2`;
const ACTIVE_BUILDS_SQL = `SELECT count(*)::int AS n FROM pg_stat_progress_create_index`;
const IDENTITY_SQL = `SELECT current_database() AS db, current_user AS usr, current_setting('server_version') AS version`;

/** Every statement this wrapper is able to send. */
export const sendableStatements = () => [DROP_STATEMENT, INDEX_FACTS_SQL, RELEVANT_RELATIONS_SQL, ACTIVE_BUILDS_SQL, IDENTITY_SQL];

/** Offline proof of what this wrapper can and cannot send. Throws on any deviation. */
export function selfCheck() {
  const all = sendableStatements().join("\n");
  const count = (re) => (all.match(re) ?? []).length;
  const tally = {
    dropsOfTheInvalidTempIndex: count(/\bDROP INDEX CONCURRENTLY public\.contractors_display_name_namewords_v2_idx(?!\w)/g),
    dropsTotal: count(/\bDROP\b/gi),
    dropIfExists: count(/\bIF EXISTS\b/gi),
    cascade: count(/\bCASCADE\b/gi),
    canonicalOrPhase1NamesInStatements: count(/_namewords_idx\b|_nameorder_idx\b/g),
    creates: count(/\bCREATE\s+(UNIQUE\s+)?INDEX\b/gi),
    alters: count(/\bALTER\b/gi),
    reindexVacuumAnalyze: count(/\b(REINDEX|VACUUM|ANALYZE|CLUSTER)\b/gi),
    settings: count(/\b(SET|RESET)\b/gi),
    sourceDataWrites: count(/\b(INSERT|UPDATE|DELETE|TRUNCATE|COPY|MERGE)\b/gi),
    transactions: count(/\b(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\b/gi),
  };
  const expected = { dropsOfTheInvalidTempIndex: 1, dropsTotal: 1, dropIfExists: 0, cascade: 0, canonicalOrPhase1NamesInStatements: 0, creates: 0, alters: 0, reindexVacuumAnalyze: 0, settings: 0, sourceDataWrites: 0, transactions: 0 };
  const problems = Object.keys(expected).filter((k) => tally[k] !== expected[k]).map((k) => `self-check ${k}: expected ${expected[k]}, found ${tally[k]}`);
  if (DROP_STATEMENT !== `DROP INDEX CONCURRENTLY public.${FAILED.v2}`) problems.push("the one permitted DROP does not name the failed temporary index");
  if (problems.length > 0) throw new Error(`SELF-CHECK FAILED:\n  - ${problems.join("\n  - ")}`);
  return { tally };
}

function problemsWith(facts, { name, table, field, method, opclass, expr, valid }) {
  if (facts.length !== 1) return [`${name}: expected exactly one relation by that name, found ${facts.length}`];
  const f = facts[0];
  const problems = [];
  if (f.kind !== "i") problems.push(`${name}: relation kind is '${f.kind}', not an index`);
  if (f.schema !== "public") problems.push(`${name}: schema is ${f.schema}, expected public`);
  if (f.table_name !== table) problems.push(`${name}: table is ${f.table_name}, expected ${table}`);
  if (f.method !== method) problems.push(`${name}: access method is ${f.method}, expected ${method}`);
  if (f.opclass !== opclass) problems.push(`${name}: operator class is ${f.opclass}, expected ${opclass}`);
  if (f.natts !== 1) problems.push(`${name}: ${f.natts} columns, expected 1`);
  if (valid === true && (f.indisvalid !== true || f.indisready !== true || f.indislive !== true)) problems.push(`${name}: valid/ready/live = ${f.indisvalid}/${f.indisready}/${f.indislive}, expected true/true/true`);
  if (valid === false && f.indisvalid !== false) problems.push(`${name}: indisvalid = ${f.indisvalid}; this script only removes an INVALID temporary index`);
  if (f.expr !== expr) problems.push(`${name}: expression is not the expected one: ${f.expr}`);
  if (f.pred !== `(${field} IS NOT NULL)`) problems.push(`${name}: partial predicate is ${f.pred}`);
  return problems;
}

/** What must be identical before and after for the ten untouched indexes (size excluded: live tables take writes). */
const identityOf = (f) => ({ oid: f.oid, def: f.def, valid: f.indisvalid, ready: f.indisready, live: f.indislive });

/** `query(sql, params)` -> { rows }. The allowlist is enforced HERE, before anything reaches the transport. */
export async function run(query, { log = console.log } = {}) {
  const checked = selfCheck();
  const allowedReads = new Set([INDEX_FACTS_SQL, RELEVANT_RELATIONS_SQL, ACTIVE_BUILDS_SQL, IDENTITY_SQL]);
  const send = async (sql, params = []) => {
    if (!(allowedReads.has(sql) || (sql === DROP_STATEMENT && params.length === 0))) throw new Error(`REFUSED: statement is not on the allowlist: ${sql.slice(0, 80)}`);
    return query(sql, params);
  };
  const facts = async (name) => (await send(INDEX_FACTS_SQL, [name])).rows;
  const receipt = { startedAt: new Date().toISOString(), selfCheck: checked.tally, permittedDrop: DROP_STATEMENT, preconditions: {}, completedStatements: [], outcome: "INCOMPLETE" };

  try {
    receipt.identity = (await send(IDENTITY_SQL)).rows[0];

    // ---- Preconditions A-G: gather everything, decide once, touch nothing until all hold. ----
    const problems = [];
    const failedFacts = await facts(FAILED.v2);
    problems.push(...problemsWith(failedFacts, { name: FAILED.v2, table: FAILED.table, field: FAILED.field, method: "gin", opclass: "gin_trgm_ops", expr: wrappedExpr(FAILED.field), valid: false })); // A, B
    for (const t of TARGETS.slice(1)) { // C
      const other = await facts(t.v2);
      if (other.length !== 0) problems.push(`${t.v2}: must be completely absent, found ${other.length} relation(s)`);
    }
    const untouchedBefore = {};
    for (const t of TARGETS) {
      const old = await facts(t.old); const p1 = await facts(t.nameorder);
      problems.push(...problemsWith(old, { name: t.old, table: t.table, field: t.field, method: "gin", opclass: "gin_trgm_ops", expr: bareExpr(t.field), valid: true })); // D
      problems.push(...problemsWith(p1, { name: t.nameorder, table: t.table, field: t.field, method: "btree", opclass: "text_pattern_ops", expr: bareExpr(t.field), valid: true })); // E
      if (old.length === 1) untouchedBefore[t.old] = identityOf(old[0]);
      if (p1.length === 1) untouchedBefore[t.nameorder] = identityOf(p1[0]);
    }
    const active = (await send(ACTIVE_BUILDS_SQL)).rows[0].n; // F
    if (active !== 0) problems.push(`${active} CREATE INDEX operation(s) in progress`);
    const relevant = (await send(RELEVANT_RELATIONS_SQL)).rows; // G
    const expectedRelevant = [...TARGETS.flatMap((t) => [t.old, t.nameorder]), FAILED.v2].sort();
    const foundRelevant = relevant.map((r) => `${r.schema}.${r.name}`).sort();
    if (JSON.stringify(foundRelevant) !== JSON.stringify(expectedRelevant.map((n) => `public.${n}`).sort())) problems.push(`relevant relations are not exactly the expected eleven: ${JSON.stringify(foundRelevant)}`);
    receipt.preconditions = { failedIndex: failedFacts, untouchedBefore, activeIndexBuilds: active, relevantRelations: foundRelevant, problems };
    if (problems.length > 0) throw new Error(`PRECONDITIONS NOT MET -- nothing was touched:\n  - ${problems.join("\n  - ")}`);
    log("Preconditions A-G hold. Sending the one permitted statement.");

    // ---- The one destructive statement. No transaction, no retry. ----
    log(DROP_STATEMENT);
    const startedAt = new Date().toISOString();
    await send(DROP_STATEMENT);
    receipt.completedStatements.push({ statement: DROP_STATEMENT, startedAt, finishedAt: new Date().toISOString() });

    // ---- Verify: that exact name is gone, all five v2 names are free, the ten are untouched. ----
    const after = [];
    for (const t of TARGETS) if ((await facts(t.v2)).length !== 0) after.push(`${t.v2} exists after the cleanup`);
    const untouchedAfter = {};
    for (const t of TARGETS) for (const name of [t.old, t.nameorder]) {
      const f = await facts(name);
      untouchedAfter[name] = f.length === 1 ? identityOf(f[0]) : null;
      if (JSON.stringify(untouchedAfter[name]) !== JSON.stringify(untouchedBefore[name])) after.push(`${name} changed: before ${JSON.stringify(untouchedBefore[name])}, after ${JSON.stringify(untouchedAfter[name])}`);
    }
    const relevantAfter = (await send(RELEVANT_RELATIONS_SQL)).rows.map((r) => `${r.schema}.${r.name}`).sort();
    if (relevantAfter.length !== 10) after.push(`expected exactly ten relevant relations after cleanup, found ${relevantAfter.length}`);
    receipt.after = { untouchedAfter, relevantRelations: relevantAfter, problems: after };
    if (after.length > 0) throw new Error(`POST-CLEANUP STATE IS NOT AS EXPECTED:\n  - ${after.join("\n  - ")}`);
    receipt.outcome = "INVALID_TEMP_INDEX_REMOVED_TEN_EXISTING_INDEXES_UNTOUCHED";
  } catch (error) {
    receipt.outcome = "STOPPED";
    receipt.error = error.message;
    receipt.finishedAt = new Date().toISOString();
    error.receipt = receipt;
    throw error;
  }
  receipt.finishedAt = new Date().toISOString();
  return receipt;
}

async function main() {
  const checked = selfCheck();
  console.log("Offline self-check passed:");
  console.log(JSON.stringify({ permittedDrop: DROP_STATEMENT, ...checked.tally }, null, 2));
  if (!process.argv.includes("--execute-cleanup-invalid-v2") || !process.argv.includes("--owner-authorized-p2f-cleanup")) {
    console.log("\nBoth --execute-cleanup-invalid-v2 and --owner-authorized-p2f-cleanup are required: nothing was connected to and nothing was run.");
    return;
  }
  let receipt = { outcome: "STOPPED", error: "did not reach the database", finishedAt: new Date().toISOString() };
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set in .env.local. Stopping.");
    if (new URL(connectionString).port === "6543") throw new Error("DATABASE_URL uses port 6543 (Transaction pooler). DROP INDEX CONCURRENTLY needs the Session pooler (5432) or a direct connection. Stopping.");
    const { Client } = await import("pg");
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      receipt = await run((sql, params) => client.query(sql, params));
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error(`\nSTOPPED: ${error.message}`);
    process.exitCode = 1;
    receipt = error.receipt ?? { outcome: "STOPPED", error: error.message, finishedAt: new Date().toISOString() };
  }
  fs.writeFileSync(RECEIPT_FILE, JSON.stringify(receipt, null, 2) + "\n");
  console.log(`\nReceipt written to ${RECEIPT_FILE} (contains no credentials).`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}
