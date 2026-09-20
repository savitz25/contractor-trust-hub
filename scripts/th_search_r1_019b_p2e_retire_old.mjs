/**
 * TH-SEARCH-R1-019B-P2E STAGE C+D -- DESTRUCTIVE. FOR THE OWNER TO RUN ONLY AFTER A SEPARATE, EXPLICIT
 * AUTHORIZATION THAT NAMES THIS STAGE. NOT executed by the preparing session.
 *
 * Retires the five OLD bare-expression token-tier GIN indexes (*_namewords_idx) and then renames the
 * five verified replacements (*_namewords_v2_idx, on the wrapped expression normalized || '') to the
 * canonical names. It never creates, reindexes, vacuums, analyzes or changes a setting, never touches
 * a *_nameorder_idx index (it only READS them), and never touches table data.
 *
 * FAIL-CLOSED -- before touching anything, ALL of these must hold, or it stops having done nothing:
 *   A. all five *_namewords_v2_idx exist;
 *   B. each is valid, ready and live;
 *   C. each is GIN / gin_trgm_ops on exactly the expected WRAPPED expression and partial predicate;
 *   D. all five old *_namewords_idx still exist;
 *   E. each old one is GIN / gin_trgm_ops on exactly the expected OLD BARE expression and predicate;
 *   F. all five Phase-1 *_nameorder_idx exist, valid/ready/live, btree / text_pattern_ops, bare expression;
 *   G. no CREATE INDEX operation is in progress;
 *   H. none of the 15 objects is invalid, and each of the 15 names resolves to exactly one relation.
 *
 * DROP INDEX CONCURRENTLY cannot run in a transaction, so this sequence is NOT atomic and does not
 * pretend to be. If it stops part-way (e.g. after 3 of 5 drops), rerunning it will refuse (precondition
 * D no longer holds) -- by design. It never retries. A partial state needs a separately reviewed
 * decision; the receipt records exactly which statements completed. At every possible stopping point the
 * five replacement indexes and the five Phase-1 indexes are still present and valid.
 *
 * Every statement passes a runtime allowlist: one of this file's fixed catalog reads, one of five exact
 * `DROP INDEX CONCURRENTLY public.<old>` statements, or one of five exact
 * `ALTER INDEX public.<v2> RENAME TO <canonical>` statements. Anything else throws before sending.
 *
 * Usage:
 *   node scripts/th_search_r1_019b_p2e_retire_old.mjs     # offline self-check only, connects to nothing
 *   node scripts/th_search_r1_019b_p2e_retire_old.mjs --execute-retire-old --owner-authorized-stage-c-and-d
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const RECEIPT_FILE = "docs/qa/th-search-r1-019b/p2e-retire-old-receipt.local.json";

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

export const dropStatement = (target) => `DROP INDEX CONCURRENTLY public.${target.old}`;
export const renameStatement = (target) => `ALTER INDEX public.${target.v2} RENAME TO ${target.old}`;

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
const ACTIVE_BUILDS_SQL = `SELECT count(*)::int AS n FROM pg_stat_progress_create_index`;
const IDENTITY_SQL = `SELECT current_database() AS db, current_user AS usr, current_setting('server_version') AS version`;

/** Offline proof of what this wrapper can and cannot send. Throws on any deviation. */
export function selfCheck() {
  const drops = TARGETS.map(dropStatement);
  const renames = TARGETS.map(renameStatement);
  const all = [...drops, ...renames, INDEX_FACTS_SQL, ACTIVE_BUILDS_SQL, IDENTITY_SQL].join("\n");
  const count = (re) => (all.match(re) ?? []).length;
  const tally = {
    drops: count(/\bDROP INDEX CONCURRENTLY public\.\w+_namewords_idx\b/g),
    dropsOfAnythingElse: count(/\bDROP\b/gi) - 5,
    dropIfExists: count(/\bIF EXISTS\b/gi),
    cascade: count(/\bCASCADE\b/gi),
    renames: count(/\bALTER INDEX public\.\w+_namewords_v2_idx RENAME TO \w+_namewords_idx\b/g),
    altersOfAnythingElse: count(/\bALTER\b/gi) - 5,
    creates: count(/\bCREATE\s+(UNIQUE\s+)?INDEX\b/gi),
    reindexVacuumAnalyze: count(/\b(REINDEX|VACUUM|ANALYZE|CLUSTER)\b/gi),
    settings: count(/\b(SET|RESET)\b/gi),
    btreeModifications: count(/nameorder|text_pattern_ops/gi),
    sourceDataWrites: count(/\b(INSERT|UPDATE|DELETE|TRUNCATE|COPY|MERGE)\b/gi),
    transactions: count(/\b(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\b/gi),
    distinctDropTargets: new Set(drops).size,
    distinctRenameTargets: new Set(renames).size,
  };
  const expected = { drops: 5, dropsOfAnythingElse: 0, dropIfExists: 0, cascade: 0, renames: 5, altersOfAnythingElse: 0, creates: 0, reindexVacuumAnalyze: 0, settings: 0, btreeModifications: 0, sourceDataWrites: 0, transactions: 0, distinctDropTargets: 5, distinctRenameTargets: 5 };
  const problems = Object.keys(expected).filter((k) => tally[k] !== expected[k]).map((k) => `self-check ${k}: expected ${expected[k]}, found ${tally[k]}`);
  if (problems.length > 0) throw new Error(`SELF-CHECK FAILED:\n  - ${problems.join("\n  - ")}`);
  return { tally, drops, renames };
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
  const allowed = new Set([...checked.drops, ...checked.renames]);
  const allowedReads = new Set([INDEX_FACTS_SQL, ACTIVE_BUILDS_SQL, IDENTITY_SQL]);
  const send = async (sql, params = []) => {
    if (!(allowedReads.has(sql) || (allowed.has(sql) && params.length === 0))) throw new Error(`REFUSED: statement is not on the allowlist: ${sql.slice(0, 80)}`);
    return query(sql, params);
  };
  const facts = async (name) => (await send(INDEX_FACTS_SQL, [name])).rows;
  const receipt = { startedAt: new Date().toISOString(), selfCheck: checked.tally, preconditions: {}, completedStatements: [], outcome: "INCOMPLETE" };

  try {
    receipt.identity = (await send(IDENTITY_SQL)).rows[0];

    // ---- Preconditions A-H: gather EVERYTHING first, decide once, touch nothing until all hold. ----
    const problems = [];
    const inventory = {};
    for (const t of TARGETS) {
      const v2 = await facts(t.v2); const old = await facts(t.old); const p1 = await facts(t.nameorder);
      inventory[t.v2] = v2; inventory[t.old] = old; inventory[t.nameorder] = p1;
      problems.push(...problemsWith(v2, { name: t.v2, table: t.table, field: t.field, method: "gin", opclass: "gin_trgm_ops", expr: wrappedExpr(t.field) })); // A, B, C, H
      problems.push(...problemsWith(old, { name: t.old, table: t.table, field: t.field, method: "gin", opclass: "gin_trgm_ops", expr: bareExpr(t.field) })); // D, E, H
      problems.push(...problemsWith(p1, { name: t.nameorder, table: t.table, field: t.field, method: "btree", opclass: "text_pattern_ops", expr: bareExpr(t.field) })); // F, H
    }
    const active = (await send(ACTIVE_BUILDS_SQL)).rows[0].n; // G
    if (active !== 0) problems.push(`${active} CREATE INDEX operation(s) in progress`);
    receipt.preconditions = { inventoryBefore: inventory, activeIndexBuilds: active, problems };
    if (problems.length > 0) throw new Error(`PRECONDITIONS NOT MET -- nothing was touched:\n  - ${problems.join("\n  - ")}`);
    log("Preconditions A-H hold for all 15 objects.");

    // ---- Stage C: retire the five old bare-expression GIN indexes, one at a time, no transaction. ----
    for (const [i, t] of TARGETS.entries()) {
      // Re-prove, immediately before each drop, that its verified replacement is still present and right.
      const stillGood = problemsWith(await facts(t.v2), { name: t.v2, table: t.table, field: t.field, method: "gin", opclass: "gin_trgm_ops", expr: wrappedExpr(t.field) });
      if (stillGood.length > 0) throw new Error(`Replacement changed since the precheck: ${stillGood.join("; ")}. Stopping.`);
      const statement = dropStatement(t);
      log(`[C ${i + 1}/5] ${statement}`);
      await send(statement);
      receipt.completedStatements.push({ statement, at: new Date().toISOString() });
      const gone = await facts(t.old);
      if (gone.length !== 0) throw new Error(`${t.old} still exists after its drop returned. Stopping.`);
    }
    for (const t of TARGETS) if ((await facts(t.old)).length !== 0) throw new Error(`${t.old} is unexpectedly present before the rename stage. Stopping.`);

    // ---- Stage D: only now that all five canonical names are free, rename the replacements. ----
    for (const [i, t] of TARGETS.entries()) {
      const statement = renameStatement(t);
      log(`[D ${i + 1}/5] ${statement}`);
      await send(statement);
      receipt.completedStatements.push({ statement, at: new Date().toISOString() });
    }

    // ---- Final inventory: exactly the intended ten, and no v2 name left. ----
    const finalProblems = [];
    const finalInventory = {};
    for (const t of TARGETS) {
      const canonical = await facts(t.old); const p1 = await facts(t.nameorder); const leftover = await facts(t.v2);
      finalInventory[t.old] = canonical; finalInventory[t.nameorder] = p1;
      finalProblems.push(...problemsWith(canonical, { name: t.old, table: t.table, field: t.field, method: "gin", opclass: "gin_trgm_ops", expr: wrappedExpr(t.field) }));
      finalProblems.push(...problemsWith(p1, { name: t.nameorder, table: t.table, field: t.field, method: "btree", opclass: "text_pattern_ops", expr: bareExpr(t.field) }));
      if (leftover.length !== 0) finalProblems.push(`${t.v2} still exists after the rename`);
    }
    receipt.final = { inventory: finalInventory, problems: finalProblems };
    if (finalProblems.length > 0) throw new Error(`FINAL INVENTORY IS NOT AS EXPECTED:\n  - ${finalProblems.join("\n  - ")}`);
    receipt.outcome = "RETIRED_FIVE_OLD_AND_RENAMED_FIVE_REPLACEMENTS";
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
  console.log(JSON.stringify(checked.tally, null, 2));
  const execute = process.argv.includes("--execute-retire-old");
  const authorized = process.argv.includes("--owner-authorized-stage-c-and-d");
  if (!execute || !authorized) {
    console.log("\nBoth --execute-retire-old and --owner-authorized-stage-c-and-d are required: nothing was connected to and nothing was run.");
    return;
  }
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
