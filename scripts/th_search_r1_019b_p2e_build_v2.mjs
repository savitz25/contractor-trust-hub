/**
 * TH-SEARCH-R1-019B-P2E STAGE A+B -- FOR THE OWNER TO RUN AFTER REVIEW. NOT executed by the preparing session.
 *
 * Builds ONLY the five temporary replacement token-tier GIN indexes (*_namewords_v2_idx) on the wrapped
 * expression (normalized || ''), one at a time, each outside any transaction, and verifies each one
 * (valid/ready/live, size, access method, operator class, exact expression, exact partial predicate)
 * before starting the next. It never drops, renames, reindexes, vacuums, analyzes or changes a setting,
 * and never touches a *_nameorder_idx index or any table data.
 *
 * FAIL-CLOSED:
 *   - does nothing without --execute-build-v2 (default: offline self-check only, no connection);
 *   - refuses the Transaction pooler (port 6543);
 *   - refuses to run if the DDL file's sha256 is not the reviewed one pinned below;
 *   - refuses to run if ANY relation already carries one of the five v2 names (no IF NOT EXISTS);
 *   - every statement passes a runtime allowlist: a catalog SELECT, or one of the five exact
 *     CREATE INDEX CONCURRENTLY lines from the reviewed DDL file. Anything else throws before sending;
 *   - stops on the first error or the first index that is not exactly as expected. No retry.
 *     A failed CONCURRENTLY build leaves an INVALID index behind; this script will not remove it and
 *     will refuse to run again while it exists -- that state needs a separately reviewed decision.
 *
 * Usage:
 *   node scripts/th_search_r1_019b_p2e_build_v2.mjs                      # offline self-check only
 *   node scripts/th_search_r1_019b_p2e_build_v2.mjs --execute-build-v2   # owner, after authorization
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const DDL_FILE = "docs/qa/th-search-r1-019b/PROPOSED-namewords-v2-indexes.sql";
export const DDL_SHA256 = "4aefa3644d622c43616113c60d55ff206a926b071875e87cd1f7ed413c7e644e";
export const RECEIPT_FILE = "docs/qa/th-search-r1-019b/p2e-build-v2-receipt.local.json";

export const TARGETS = [
  { table: "contractors", field: "display_name" },
  { table: "contractors", field: "legal_name" },
  { table: "contractors", field: "dba_name" },
  { table: "licenses", field: "licensee_name_raw" },
  { table: "licenses", field: "dba_name_raw" },
].map((t) => ({ ...t, v2: `${t.table}_${t.field}_namewords_v2_idx`, nameorder: `${t.table}_${t.field}_nameorder_idx` }));

/** The bare normalized expression exactly as PostgreSQL deparses it (pg_get_expr), per field. */
// Backslash sequences are assembled from a char code so no editor, tool or transport can ever decode them:
// PostgreSQL reports these regex classes as LITERAL backslash-u / backslash-x text, and this must match it byte for byte.
const BS = String.fromCharCode(92);
const U = (hex) => `${BS}u${hex}`;
const X = (hex) => `${BS}x${hex}`;
const APOSTROPHE_CLASS = "[''" + String.fromCharCode(96) + U("2018") + U("2019") + U("02BC") + "]";
const SEPARATOR_CLASS = "[" + X("01") + "-" + X("2F") + X("3A") + "-" + X("40") + X("5B") + "-" + X("60") + X("7B") + "-" + X("7F") + U("00A0") + U("2013") + U("2014") + U("201C") + U("201D") + "]+";
export const bareExpr = (field) =>
  `((' '::text || btrim(regexp_replace(regexp_replace(upper(COALESCE(${field}, ''::text)), '${APOSTROPHE_CLASS}'::text, ''::text, 'g'::text), '${SEPARATOR_CLASS}'::text, ' '::text, 'g'::text))) || ' '::text)`;
export const wrappedExpr = (field) => `(${bareExpr(field)} || ''::text)`;

const INDEX_FACTS_SQL = `
  SELECT n.nspname AS schema, c.relname AS name, t.relname AS table_name, am.amname AS method,
         x.indisvalid, x.indisready, x.indislive, x.indnatts::int AS natts,
         (SELECT opcname FROM pg_opclass WHERE oid = x.indclass[0]) AS opclass,
         pg_get_expr(x.indexprs, x.indrelid) AS expr,
         pg_get_expr(x.indpred, x.indrelid) AS pred,
         pg_relation_size(c.oid)::text AS bytes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_index x ON x.indexrelid = c.oid
  JOIN pg_class t ON t.oid = x.indrelid
  JOIN pg_am am ON am.oid = c.relam
  WHERE c.relname = $1`;
const NAME_TAKEN_SQL = `SELECT n.nspname AS schema, c.relkind::text AS kind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1`;
const ACTIVE_BUILDS_SQL = `SELECT count(*)::int AS n FROM pg_stat_progress_create_index`;
const IDENTITY_SQL = `SELECT current_database() AS db, current_user AS usr, current_setting('server_version') AS version, (SELECT count(*)::int FROM pg_extension WHERE extname = 'pg_trgm') AS trgm`;

export function loadStatements() {
  const bytes = fs.readFileSync(DDL_FILE);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const lines = bytes.toString("utf8").split("\n").filter((l) => l.trim() !== "" && !l.startsWith("--"));
  return { sha256, lines };
}

/** Offline proof of what this wrapper can and cannot send. Throws on any deviation. */
export function selfCheck({ requirePinnedHash = true } = {}) {
  const { sha256, lines } = loadStatements();
  const problems = [];
  if (requirePinnedHash && sha256 !== DDL_SHA256) problems.push(`DDL file sha256 ${sha256} is not the reviewed ${DDL_SHA256}`);
  if (lines.length !== 5) problems.push(`expected exactly 5 statements, found ${lines.length}`);
  for (const [i, target] of TARGETS.entries()) {
    const line = lines[i] ?? "";
    const prefix = `CREATE INDEX CONCURRENTLY ${target.v2} ON ${target.table} USING gin (`;
    const suffix = ` || '') gin_trgm_ops) WHERE ${target.field} IS NOT NULL;`;
    if (!line.startsWith(prefix)) problems.push(`statement ${i + 1} does not start with: ${prefix}`);
    if (!line.endsWith(suffix)) problems.push(`statement ${i + 1} does not end with: ${suffix}`);
    if (!line.includes(`coalesce(${target.field}, '')`)) problems.push(`statement ${i + 1} does not normalize ${target.field}`);
  }
  // Everything this wrapper is able to send: the five DDL lines plus its four fixed catalog reads.
  const all = [...lines, INDEX_FACTS_SQL, NAME_TAKEN_SQL, ACTIVE_BUILDS_SQL, IDENTITY_SQL].join("\n");
  const count = (re) => (all.match(re) ?? []).length;
  const tally = {
    creates: count(/\bCREATE INDEX CONCURRENTLY\b/g),
    ifNotExists: count(/\bIF NOT EXISTS\b/gi),
    drops: count(/\bDROP\b/gi),
    alters: count(/\bALTER\b/gi),
    reindexVacuumAnalyze: count(/\b(REINDEX|VACUUM|ANALYZE|CLUSTER)\b/gi),
    settings: count(/\b(SET|RESET)\b/gi),
    btreeModifications: count(/nameorder|text_pattern_ops|USING btree/gi),
    canonicalNamewordsNames: count(/_namewords_idx\b/g),
    sourceDataWrites: count(/\b(INSERT|UPDATE|DELETE|TRUNCATE|COPY|MERGE)\b/gi),
    statementsPerLine: lines.every((l) => (l.match(/;/g) ?? []).length === 1 && l.endsWith(";")),
  };
  const expected = { creates: 5, ifNotExists: 0, drops: 0, alters: 0, reindexVacuumAnalyze: 0, settings: 0, btreeModifications: 0, canonicalNamewordsNames: 0, sourceDataWrites: 0, statementsPerLine: true };
  for (const key of Object.keys(expected)) if (tally[key] !== expected[key]) problems.push(`self-check ${key}: expected ${expected[key]}, found ${tally[key]}`);
  if (problems.length > 0) throw new Error(`SELF-CHECK FAILED:\n  - ${problems.join("\n  - ")}`);
  return { sha256, tally, statements: lines.map((l) => l.slice(0, -1)) };
}

function describeMismatch(target, facts) {
  const problems = [];
  if (facts.schema !== "public") problems.push(`schema is ${facts.schema}, expected public`);
  if (facts.table_name !== target.table) problems.push(`table is ${facts.table_name}, expected ${target.table}`);
  if (facts.method !== "gin") problems.push(`access method is ${facts.method}, expected gin`);
  if (facts.opclass !== "gin_trgm_ops") problems.push(`operator class is ${facts.opclass}, expected gin_trgm_ops`);
  if (facts.natts !== 1) problems.push(`index has ${facts.natts} columns, expected 1`);
  if (facts.indisvalid !== true || facts.indisready !== true || facts.indislive !== true) problems.push(`valid/ready/live = ${facts.indisvalid}/${facts.indisready}/${facts.indislive}`);
  if (facts.expr !== wrappedExpr(target.field)) problems.push(`expression is not the expected wrapped expression: ${facts.expr}`);
  if (facts.pred !== `(${target.field} IS NOT NULL)`) problems.push(`partial predicate is ${facts.pred}`);
  return problems;
}

/**
 * `query(sql, params)` -> { rows }. `transport` exists so the identical logic can be rehearsed against a
 * disposable in-memory database; the allowlist is enforced HERE, before anything reaches the transport.
 */
export async function run(query, { requirePinnedHash = true, log = console.log } = {}) {
  const checked = selfCheck({ requirePinnedHash });
  const allowedCreates = new Set(checked.statements);
  const allowedReads = new Set([INDEX_FACTS_SQL, NAME_TAKEN_SQL, ACTIVE_BUILDS_SQL, IDENTITY_SQL]);
  const send = async (sql, params = []) => {
    const allowed = allowedReads.has(sql) || (allowedCreates.has(sql) && params.length === 0);
    if (!allowed) throw new Error(`REFUSED: statement is not on the allowlist: ${sql.slice(0, 80)}`);
    return query(sql, params);
  };
  const receipt = { startedAt: new Date().toISOString(), ddlFile: DDL_FILE, ddlSha256: checked.sha256, selfCheck: checked.tally, precheck: {}, results: [], outcome: "INCOMPLETE" };
  try {
    const identity = (await send(IDENTITY_SQL)).rows[0];
    receipt.precheck.identity = identity;
    if (identity.trgm !== 1) throw new Error("pg_trgm extension is not installed. Stopping.");
    const active = (await send(ACTIVE_BUILDS_SQL)).rows[0].n;
    receipt.precheck.activeIndexBuilds = active;
    if (active !== 0) throw new Error(`${active} CREATE INDEX operation(s) already in progress. Stopping.`);
    for (const target of TARGETS) {
      const taken = (await send(NAME_TAKEN_SQL, [target.v2])).rows;
      if (taken.length > 0) throw new Error(`A relation named ${target.v2} already exists (${JSON.stringify(taken)}). Stopping -- nothing was created.`);
      const reference = (await send(INDEX_FACTS_SQL, [target.nameorder])).rows;
      if (reference.length !== 1 || reference[0].expr !== bareExpr(target.field) || reference[0].indisvalid !== true) {
        throw new Error(`Phase-1 reference index ${target.nameorder} is missing, invalid, or not on the expected bare expression. Stopping -- nothing was created.`);
      }
    }
    receipt.precheck.allFiveV2NamesAbsent = true;
    receipt.precheck.allFivePhase1ReferencesAsExpected = true;

    for (const [i, target] of TARGETS.entries()) {
      const statement = checked.statements[i];
      const again = (await send(NAME_TAKEN_SQL, [target.v2])).rows;
      if (again.length > 0) throw new Error(`${target.v2} appeared since the precheck. Stopping.`);
      log(`[${i + 1}/5] ${target.v2} -- starting`);
      const startedAt = new Date().toISOString();
      const t0 = Date.now();
      const entry = { name: target.v2, startedAt };
      receipt.results.push(entry);
      await send(statement); // outside any transaction: this function never sends BEGIN
      entry.finishedAt = new Date().toISOString();
      entry.ms = Date.now() - t0;
      const rows = (await send(INDEX_FACTS_SQL, [target.v2])).rows;
      if (rows.length !== 1) throw new Error(`${target.v2}: expected exactly one index by that name after the build, found ${rows.length}. Stopping.`);
      Object.assign(entry, rows[0]);
      const problems = describeMismatch(target, rows[0]);
      entry.problems = problems;
      log(`[${i + 1}/5] ${target.v2} -- ${entry.ms}ms, ${rows[0].bytes} bytes, valid/ready/live=${rows[0].indisvalid}/${rows[0].indisready}/${rows[0].indislive}`);
      if (problems.length > 0) throw new Error(`${target.v2} is not exactly as expected: ${problems.join("; ")}. Stopping before the next index. Nothing will be removed by this script.`);
    }
    receipt.outcome = "ALL_FIVE_BUILT_AND_VERIFIED";
  } catch (error) {
    receipt.outcome = "STOPPED";
    receipt.error = error.message;
    receipt.finishedAt = new Date().toISOString();
    error.receipt = receipt; // the partial receipt survives the stop
    throw error;
  }
  receipt.finishedAt = new Date().toISOString();
  return receipt;
}

async function main() {
  const checked = selfCheck();
  console.log("Offline self-check passed:");
  console.log(JSON.stringify({ ddlSha256: checked.sha256, ...checked.tally }, null, 2));
  if (!process.argv.includes("--execute-build-v2")) {
    console.log("\nNo --execute-build-v2 flag: nothing was connected to and nothing was run.");
    return;
  }
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set in .env.local. Stopping.");
  if (new URL(connectionString).port === "6543") throw new Error("DATABASE_URL uses port 6543 (Transaction pooler). CREATE INDEX CONCURRENTLY needs the Session pooler (5432) or a direct connection. Stopping.");
  const { Client } = await import("pg");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let receipt;
  try {
    receipt = await run((sql, params) => client.query(sql, params));
  } catch (error) {
    console.error(`\nSTOPPED: ${error.message}`);
    process.exitCode = 1;
    receipt = error.receipt ?? { outcome: "STOPPED", error: error.message, finishedAt: new Date().toISOString() };
  } finally {
    await client.end();
  }
  fs.writeFileSync(RECEIPT_FILE, JSON.stringify(receipt, null, 2) + "\n");
  console.log(`\nReceipt written to ${RECEIPT_FILE} (contains no credentials).`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}
