/**
 * TH-SEARCH-R1-019B-P2F RECOVERY STEP 2 (STAGE A+B RETRY) -- FOR THE OWNER TO RUN AFTER REVIEW AND
 * AUTHORIZATION, AND ONLY AFTER the invalid temporary index has been removed (step 1). NOT executed by
 * the preparing session.
 *
 * Same job as the reviewed P2E build wrapper -- build and verify the five temporary replacement token-tier
 * GIN indexes (*_namewords_v2_idx) from the SAME reviewed DDL file -- with one difference: the first
 * attempt was cancelled by the managed connection's observed 2-minute statement timeout, so this wrapper
 * sends exactly one SESSION-ONLY setting for its own connection:
 *
 *     SET statement_timeout = '10min'
 *
 * and reads it back before building anything. Why 10 minutes: the observed session ceiling is 2 min; the
 * first replacement build exceeded it; the comparable old Phase-2 builds took roughly 27-96 s each. 10 min
 * is a BOUNDED operational ceiling with substantial headroom -- not a prediction that a build takes 10
 * minutes, and not unlimited (never 0): a stuck build is still cancelled. It is a plain session SET (not
 * SET LOCAL, no transaction, not ALTER ROLE / ALTER DATABASE / ALTER SYSTEM), so it changes no persistent
 * configuration and dies when this script's connection closes. As an independent witness the script
 * fingerprints pg_db_role_setting before and after and reports both in the receipt.
 * No other setting is touched: not lock_timeout, work_mem, maintenance_work_mem, shared_buffers, any
 * planner enable_* switch, or anything else.
 *
 * FAIL-CLOSED -- before the SET or anything else non-read is sent, ALL must hold:
 *   - the DDL file's sha256 is the reviewed one pinned below;
 *   - the relations whose names contain "nameorder" or "namewords" are EXACTLY the ten existing indexes
 *     (so all five v2 names are absent -- including the failed one -- and nothing unexpected exists);
 *   - no relation of any kind, in any schema, holds any of the five v2 names;
 *   - all five Phase-1 *_nameorder_idx: valid/ready/live, btree / text_pattern_ops, bare expression;
 *   - all five old canonical *_namewords_idx: valid/ready/live, GIN / gin_trgm_ops, OLD bare expression;
 *   - zero CREATE INDEX operations in progress; pg_trgm installed.
 * Then: SET, read back (must be exactly 10min), and build one index at a time, never inside a transaction,
 * re-proving the timeout and the name's absence before each build and verifying each result (valid/ready/
 * live, GIN, gin_trgm_ops, exact wrapped expression, exact predicate, size) before starting the next.
 * It stops on the first error. It NEVER drops, renames or cleans up anything -- a failed build is left
 * exactly as it is for a separately reviewed decision -- and it writes a receipt even when it stops.
 *
 * Runtime allowlist (enforced before anything reaches the connection): this file's fixed catalog reads,
 * the one exact SET above, and the five exact CREATE INDEX CONCURRENTLY lines of the reviewed DDL file.
 *
 * Usage:
 *   node scripts/th_search_r1_019b_p2f_build_v2.mjs                                # offline self-check only
 *   node scripts/th_search_r1_019b_p2f_build_v2.mjs --execute-build-v2-recovery    # owner, after authorization
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const DDL_FILE = "docs/qa/th-search-r1-019b/PROPOSED-namewords-v2-indexes.sql";
export const DDL_SHA256 = "4aefa3644d622c43616113c60d55ff206a926b071875e87cd1f7ed413c7e644e";
export const RECEIPT_FILE = "docs/qa/th-search-r1-019b/p2f-build-v2-receipt.local.json";
export const SET_TIMEOUT_STATEMENT = "SET statement_timeout = '10min'";
export const EXPECTED_TIMEOUT = "10min";

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
  SELECT n.nspname AS schema, c.relname AS name, c.relkind::text AS kind, t.relname AS table_name, am.amname AS method,
         x.indisvalid, x.indisready, x.indislive, x.indnatts::int AS natts,
         (SELECT opcname FROM pg_opclass WHERE oid = x.indclass[0]) AS opclass,
         pg_get_expr(x.indexprs, x.indrelid) AS expr,
         pg_get_expr(x.indpred, x.indrelid) AS pred,
         pg_relation_size(c.oid)::text AS bytes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_index x ON x.indexrelid = c.oid
  LEFT JOIN pg_class t ON t.oid = x.indrelid
  LEFT JOIN pg_am am ON am.oid = c.relam
  WHERE c.relname = $1`;
const RELEVANT_RELATIONS_SQL = `SELECT n.nspname AS schema, c.relname AS name, c.relkind::text AS kind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname ~ '(nameorder|namewords)' ORDER BY 1, 2`;
const ACTIVE_BUILDS_SQL = `SELECT count(*)::int AS n FROM pg_stat_progress_create_index`;
const IDENTITY_SQL = `SELECT current_database() AS db, current_user AS usr, current_setting('server_version') AS version, (SELECT count(*)::int FROM pg_extension WHERE extname = 'pg_trgm') AS trgm`;
const TIMEOUT_READBACK_SQL = `SELECT current_setting('statement_timeout') AS statement_timeout`;
const PERSISTENT_SETTINGS_SQL = `SELECT count(*)::int AS entries, coalesce(md5(string_agg(setdatabase::text || ':' || setrole::text || ':' || setconfig::text, '|' ORDER BY setdatabase, setrole)), 'none') AS fingerprint FROM pg_db_role_setting`;
const FIXED_READS = [INDEX_FACTS_SQL, RELEVANT_RELATIONS_SQL, ACTIVE_BUILDS_SQL, IDENTITY_SQL, TIMEOUT_READBACK_SQL, PERSISTENT_SETTINGS_SQL];

export function loadStatements() {
  const bytes = fs.readFileSync(DDL_FILE);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const lines = bytes.toString("utf8").split("\n").filter((l) => l.trim() !== "" && !l.startsWith("--"));
  return { sha256, lines };
}

/** Every statement this wrapper is able to send (DDL lines without their trailing semicolon). */
export const sendableStatements = () => [SET_TIMEOUT_STATEMENT, ...loadStatements().lines.map((l) => l.slice(0, -1)), ...FIXED_READS];

/** Offline proof of what this wrapper can and cannot send. Throws on any deviation. */
export function selfCheck() {
  const { sha256, lines } = loadStatements();
  const problems = [];
  if (sha256 !== DDL_SHA256) problems.push(`DDL file sha256 ${sha256} is not the reviewed ${DDL_SHA256}`);
  if (lines.length !== 5) problems.push(`expected exactly 5 statements, found ${lines.length}`);
  for (const [i, target] of TARGETS.entries()) {
    const line = lines[i] ?? "";
    const prefix = `CREATE INDEX CONCURRENTLY ${target.v2} ON ${target.table} USING gin (`;
    const suffix = ` || '') gin_trgm_ops) WHERE ${target.field} IS NOT NULL;`;
    if (!line.startsWith(prefix)) problems.push(`statement ${i + 1} does not start with: ${prefix}`);
    if (!line.endsWith(suffix)) problems.push(`statement ${i + 1} does not end with: ${suffix}`);
    if (!line.includes(`coalesce(${target.field}, '')`)) problems.push(`statement ${i + 1} does not normalize ${target.field}`);
  }
  const all = sendableStatements().join("\n");
  const count = (re) => (all.match(re) ?? []).length;
  const tally = {
    creates: count(/\bCREATE INDEX CONCURRENTLY\b/g),
    ifNotExists: count(/\bIF NOT EXISTS\b/gi),
    drops: count(/\bDROP\b/gi),
    alters: count(/\bALTER\b/gi),
    reindexVacuumAnalyze: count(/\b(REINDEX|VACUUM|ANALYZE|CLUSTER)\b/gi),
    sessionTimeoutSets: count(/^SET statement_timeout = '10min'$/gm),
    settingStatementsTotal: count(/\b(SET|RESET)\b/gi),
    setLocalOrTransaction: count(/\bSET LOCAL\b|\b(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\b/gi),
    setConfigCalls: count(/\bset_config\b/gi),
    unlimitedTimeout: count(/statement_timeout\s*(=|TO)\s*'?0/gi),
    otherSettingsNamed: count(/\b(lock_timeout|work_mem|maintenance_work_mem|shared_buffers|enable_\w+|idle_in_transaction_session_timeout)\b/gi),
    btreeModifications: count(/nameorder_idx|text_pattern_ops|USING btree/gi),
    canonicalNamewordsNames: count(/_namewords_idx\b/g),
    sourceDataWrites: count(/\b(INSERT|UPDATE|DELETE|TRUNCATE|COPY|MERGE)\b/gi),
    statementsPerLine: lines.every((l) => (l.match(/;/g) ?? []).length === 1 && l.endsWith(";")),
  };
  const expected = { creates: 5, ifNotExists: 0, drops: 0, alters: 0, reindexVacuumAnalyze: 0, sessionTimeoutSets: 1, settingStatementsTotal: 1, setLocalOrTransaction: 0, setConfigCalls: 0, unlimitedTimeout: 0, otherSettingsNamed: 0, btreeModifications: 0, canonicalNamewordsNames: 0, sourceDataWrites: 0, statementsPerLine: true };
  for (const key of Object.keys(expected)) if (tally[key] !== expected[key]) problems.push(`self-check ${key}: expected ${expected[key]}, found ${tally[key]}`);
  if (problems.length > 0) throw new Error(`SELF-CHECK FAILED:\n  - ${problems.join("\n  - ")}`);
  return { sha256, tally, statements: lines.map((l) => l.slice(0, -1)) };
}

function problemsWith(facts, { name, table, field, method, opclass, expr }) {
  if (facts.length !== 1) return [`${name}: expected exactly one relation by that name, found ${facts.length}`];
  const f = facts[0];
  const problems = [];
  if (f.kind !== "i") problems.push(`${name}: relation kind is '${f.kind}', not an index`);
  if (f.schema !== "public") problems.push(`${name}: schema is ${f.schema}, expected public`);
  if (f.table_name !== table) problems.push(`${name}: table is ${f.table_name}, expected ${table}`);
  if (f.method !== method) problems.push(`${name}: access method is ${f.method}, expected ${method}`);
  if (f.opclass !== opclass) problems.push(`${name}: operator class is ${f.opclass}, expected ${opclass}`);
  if (f.natts !== 1) problems.push(`${name}: ${f.natts} columns, expected 1`);
  if (f.indisvalid !== true || f.indisready !== true || f.indislive !== true) problems.push(`${name}: valid/ready/live = ${f.indisvalid}/${f.indisready}/${f.indislive}`);
  if (f.expr !== expr) problems.push(`${name}: expression is not the expected one: ${f.expr}`);
  if (f.pred !== `(${field} IS NOT NULL)`) problems.push(`${name}: partial predicate is ${f.pred}`);
  return problems;
}

/** `query(sql, params)` -> { rows }. The allowlist is enforced HERE, before anything reaches the transport. */
export async function run(query, { log = console.log } = {}) {
  const checked = selfCheck();
  const allowedCreates = new Set(checked.statements);
  const allowedReads = new Set(FIXED_READS);
  const send = async (sql, params = []) => {
    const allowed = allowedReads.has(sql) || (params.length === 0 && (allowedCreates.has(sql) || sql === SET_TIMEOUT_STATEMENT));
    if (!allowed) throw new Error(`REFUSED: statement is not on the allowlist: ${sql.slice(0, 80)}`);
    return query(sql, params);
  };
  const facts = async (name) => (await send(INDEX_FACTS_SQL, [name])).rows;
  const timeoutNow = async () => (await send(TIMEOUT_READBACK_SQL)).rows[0].statement_timeout;
  const receipt = { startedAt: new Date().toISOString(), ddlFile: DDL_FILE, ddlSha256: checked.sha256, selfCheck: checked.tally, precheck: {}, session: {}, results: [], outcome: "INCOMPLETE" };

  try {
    // ---- Prechecks: reads only. Nothing else is sent unless every one of them holds. ----
    const identity = (await send(IDENTITY_SQL)).rows[0];
    receipt.precheck.identity = identity;
    const problems = [];
    if (identity.trgm !== 1) problems.push("pg_trgm extension is not installed");
    const active = (await send(ACTIVE_BUILDS_SQL)).rows[0].n;
    receipt.precheck.activeIndexBuilds = active;
    if (active !== 0) problems.push(`${active} CREATE INDEX operation(s) already in progress`);
    const relevant = (await send(RELEVANT_RELATIONS_SQL)).rows.map((r) => `${r.schema}.${r.name}`).sort();
    const expectedRelevant = TARGETS.flatMap((t) => [`public.${t.old}`, `public.${t.nameorder}`]).sort();
    receipt.precheck.relevantRelations = relevant;
    if (JSON.stringify(relevant) !== JSON.stringify(expectedRelevant)) problems.push(`relevant relations are not exactly the ten existing indexes (a leftover or unexpected object exists): ${JSON.stringify(relevant)}`);
    for (const t of TARGETS) {
      const taken = await facts(t.v2);
      if (taken.length > 0) problems.push(`a relation named ${t.v2} already exists (valid=${taken[0].indisvalid}); this script never removes anything`);
      problems.push(...problemsWith(await facts(t.nameorder), { name: t.nameorder, table: t.table, field: t.field, method: "btree", opclass: "text_pattern_ops", expr: bareExpr(t.field) }));
      problems.push(...problemsWith(await facts(t.old), { name: t.old, table: t.table, field: t.field, method: "gin", opclass: "gin_trgm_ops", expr: bareExpr(t.field) }));
    }
    receipt.precheck.problems = problems;
    if (problems.length > 0) throw new Error(`PRECONDITIONS NOT MET -- nothing was sent but catalog reads:\n  - ${problems.join("\n  - ")}`);

    // ---- The one session-only setting, then proof that it took and that nothing persistent moved. ----
    receipt.session.persistentSettingsBefore = (await send(PERSISTENT_SETTINGS_SQL)).rows[0];
    receipt.session.statementTimeoutBefore = await timeoutNow();
    await send(SET_TIMEOUT_STATEMENT);
    receipt.session.statementTimeoutAfterSet = await timeoutNow();
    if (receipt.session.statementTimeoutAfterSet !== EXPECTED_TIMEOUT) throw new Error(`statement_timeout reads back as '${receipt.session.statementTimeoutAfterSet}', expected exactly '${EXPECTED_TIMEOUT}'. Stopping -- nothing was created.`);
    log(`session statement_timeout: ${receipt.session.statementTimeoutBefore} -> ${receipt.session.statementTimeoutAfterSet} (this connection only)`);

    for (const [i, target] of TARGETS.entries()) {
      const statement = checked.statements[i];
      if ((await facts(target.v2)).length > 0) throw new Error(`${target.v2} appeared since the precheck. Stopping.`);
      const effective = await timeoutNow();
      if (effective !== EXPECTED_TIMEOUT) throw new Error(`statement_timeout is '${effective}' before build ${i + 1}, expected '${EXPECTED_TIMEOUT}' (the session was reset?). Stopping.`);
      log(`[${i + 1}/5] ${target.v2} -- starting`);
      const entry = { name: target.v2, startedAt: new Date().toISOString() };
      receipt.results.push(entry);
      const t0 = Date.now();
      try {
        await send(statement); // outside any transaction: this function never sends BEGIN
      } catch (error) {
        entry.failedAt = new Date().toISOString();
        entry.ms = Date.now() - t0;
        entry.error = error.message;
        // Record what the failed build left behind. READ ONLY -- it is never dropped or repaired here.
        entry.leftBehind = await facts(target.v2).catch(() => "could not be read");
        throw new Error(`${target.v2}: ${error.message}. Stopping. Whatever this build left behind has NOT been removed.`);
      }
      entry.finishedAt = new Date().toISOString();
      entry.ms = Date.now() - t0;
      const rows = await facts(target.v2);
      if (rows.length === 1) Object.assign(entry, rows[0]);
      const found = problemsWith(rows, { name: target.v2, table: target.table, field: target.field, method: "gin", opclass: "gin_trgm_ops", expr: wrappedExpr(target.field) });
      entry.problems = found;
      log(`[${i + 1}/5] ${target.v2} -- ${entry.ms}ms, ${rows[0]?.bytes} bytes, valid/ready/live=${rows[0]?.indisvalid}/${rows[0]?.indisready}/${rows[0]?.indislive}`);
      if (found.length > 0) throw new Error(`${target.v2} is not exactly as expected: ${found.join("; ")}. Stopping before the next index. Nothing will be removed by this script.`);
    }

    receipt.session.persistentSettingsAfter = (await send(PERSISTENT_SETTINGS_SQL)).rows[0];
    if (JSON.stringify(receipt.session.persistentSettingsAfter) !== JSON.stringify(receipt.session.persistentSettingsBefore)) {
      throw new Error("pg_db_role_setting changed while this script ran. This script sends no statement that can do that; all five indexes are built and verified, but the change must be explained before proceeding.");
    }
    receipt.outcome = "ALL_FIVE_BUILT_AND_VERIFIED";
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
  console.log(JSON.stringify({ ddlSha256: checked.sha256, sessionSetting: SET_TIMEOUT_STATEMENT, ...checked.tally }, null, 2));
  if (!process.argv.includes("--execute-build-v2-recovery")) {
    console.log("\nNo --execute-build-v2-recovery flag: nothing was connected to and nothing was run.");
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
    if (new URL(connectionString).port === "6543") throw new Error("DATABASE_URL uses port 6543 (Transaction pooler). CREATE INDEX CONCURRENTLY and a session-level SET both need the Session pooler (5432) or a direct connection. Stopping.");
    const { Client } = await import("pg");
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      receipt = await run((sql, params) => client.query(sql, params));
    } finally {
      await client.end(); // the session, and with it the 10min setting, ends here
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
