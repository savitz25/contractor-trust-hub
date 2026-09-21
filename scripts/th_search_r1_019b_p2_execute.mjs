/**
 * TH-SEARCH-R1-019B Phase 2 index execution -- FOR THE OWNER TO RUN, not executed by this session.
 * Runs the exact 5 Phase-2 CREATE INDEX CONCURRENTLY (GIN, gin_trgm_ops) statements from the approved DDL
 * file, one at a time (never simultaneous), each outside any transaction block (required for CONCURRENTLY),
 * with start/end timestamps and resulting size/valid/ready/live logged after each. The DDL text itself is
 * read verbatim from the approved file -- not retyped, not modified. Stops on the first error, and stops
 * before the next index if a build "succeeds" but is not valid+ready+live. Does NOT touch Phase 1
 * (nameorder/B-tree) indexes, and performs no DROP/REINDEX/VACUUM/ANALYZE/extension operation.
 *
 * Usage:
 *   node scripts/th_search_r1_019b_p2_execute.mjs
 *
 * Requires DATABASE_URL in .env.local (Session pooler, not :6543 -- same file the app itself uses).
 */
import fs from "node:fs";
import { Client } from "pg";

for (const line of fs.readFileSync(".env.local", "utf8").split("\n").map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set in .env.local. Stopping.");
  process.exit(1);
}
{
  const url = new URL(connectionString);
  if (url.port === "6543") {
    console.error("DATABASE_URL uses port 6543 (Transaction pooler). CREATE INDEX CONCURRENTLY requires the Session pooler (port 5432) or a direct connection. Stopping -- not executing.");
    process.exit(1);
  }
}

const DDL_FILE = "docs/qa/th-search-r1-019b/PROPOSED-normalized-name-indexes.sql";
const ddlText = fs.readFileSync(DDL_FILE, "utf8");

// Extract exactly the 5 Phase-2 statements, verbatim, in file order. Phase 1 (nameorder_idx) lines never
// match this filter -- "namewords_idx" and "nameorder_idx" are disjoint substrings.
const phase2Lines = ddlText
  .split("\n")
  .filter((l) => l.startsWith("CREATE INDEX CONCURRENTLY") && l.includes("namewords_idx"));

if (phase2Lines.length !== 5) {
  console.error(`Expected exactly 5 Phase-2 statements in ${DDL_FILE}, found ${phase2Lines.length}. Stopping -- do not proceed on a file that doesn't match the reviewed shape.`);
  process.exit(1);
}
if (phase2Lines.some((l) => l.includes("nameorder_idx"))) {
  console.error("A Phase-1 (nameorder_idx) statement matched the Phase-2 filter -- refusing to run. This should be structurally impossible; stopping.");
  process.exit(1);
}

function indexNameFrom(stmt) {
  const m = /CREATE INDEX CONCURRENTLY IF NOT EXISTS (\S+)/.exec(stmt);
  return m ? m[1] : "unknown";
}

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected. current_database/current_user/version:");
  console.log((await client.query("SELECT current_database(), current_user, version()")).rows[0]);

  const results = [];
  for (const [i, stmt] of phase2Lines.entries()) {
    const name = indexNameFrom(stmt);
    console.log(`\n[${i + 1}/5] ${name} -- starting`);
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    try {
      // CREATE INDEX CONCURRENTLY must run outside a transaction block -- this Client never issues BEGIN.
      await client.query(stmt);
      const ms = Date.now() - t0;
      const check = await client.query(
        `SELECT pg_relation_size(c.oid) bytes, x.indisvalid, x.indisready, x.indislive
         FROM pg_class c JOIN pg_index x ON x.indexrelid = c.oid WHERE c.relname = $1`,
        [name]
      );
      const row = check.rows[0] || {};
      const finishedAt = new Date().toISOString();
      const ok = row.indisvalid === true && row.indisready === true && row.indislive === true;
      console.log(`[${i + 1}/5] ${name} -- done in ${ms}ms, size ${row.bytes} bytes, valid=${row.indisvalid}, ready=${row.indisready}, live=${row.indislive}`);
      results.push({ name, startedAt, finishedAt, ms, bytes: row.bytes, indisvalid: row.indisvalid, indisready: row.indisready, indislive: row.indislive, error: null });
      if (!ok) {
        console.error(`[${i + 1}/5] ${name} built but is not valid+ready+live -- stopping before the next index. Check pg_index, drop and retry per the DDL file's own rollback comment before continuing.`);
        break;
      }
    } catch (e) {
      const finishedAt = new Date().toISOString();
      console.error(`[${i + 1}/5] ${name} -- FAILED: ${e.message}`);
      results.push({ name, startedAt, finishedAt, ms: Date.now() - t0, error: e.message });
      console.error("Stopping -- fail-stop, not continuing to the next index.");
      break;
    }
  }

  fs.writeFileSync(
    "docs/qa/th-search-r1-019b/p2-execution-result.local.json",
    JSON.stringify({ ranAt: new Date().toISOString(), ddlFile: DDL_FILE, results }, null, 2) + "\n"
  );
  console.log("\nResult log written to docs/qa/th-search-r1-019b/p2-execution-result.local.json");
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
