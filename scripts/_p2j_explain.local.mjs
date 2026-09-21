/**
 * TH-SEARCH-R1-019B-P2J: READ-ONLY. Same harness convention as _p2i_explain_check.mjs -- captures
 * the REAL strong-tier statement the candidate operation (executeContractorNameCandidates) issues,
 * through the same NameCandidateDb override hook the operation already accepts for tests, and
 * re-runs it prefixed with EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) against the real connection.
 * SQL is never hand-reconstructed. No writes, no DDL, no planner setting changes, no forced
 * index/seqscan. This captures the join-back shape AFTER the P2J LATERAL rewrite in
 * lib/contractors/name-search-core.ts's build() -- both consumers (name-candidates-query.ts and
 * queries.ts) share that fromSql, so this statement's join-back plan is representative of both.
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const { executeContractorNameCandidates } = await import(pathToFileURL("lib/specialist-execution/contractor-name-candidates.ts").href);
const { Client } = await import("pg");

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("SET statement_timeout = 20000");

class CapturedFirstStatement extends Error {
  constructor(plan) { super("captured"); this.plan = plan; }
}

async function explainFirstStrongStatement(name) {
  let captured = null;
  const db = {
    query: async (text, params) => {
      if (captured) return []; // only ever explain the FIRST statement (the strong tier)
      const res = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${text}`, params);
      captured = res.rows.map((r) => r["QUERY PLAN"]).join("\n");
      throw new CapturedFirstStatement(captured);
    },
  };
  try {
    const response = await executeContractorNameCandidates({ operation: "name_candidates", name, page: 1, limit: 10 }, db);
    if (captured) return { plan: captured };
    return { plan: null, note: `operation completed without issuing a DB query (unexpected). resultState=${response?.resultState}` };
  } catch (e) {
    if (captured) return { plan: captured };
    if (e instanceof CapturedFirstStatement) return { plan: e.plan };
    return { plan: null, error: e.message };
  }
}

function summarize(plan) {
  if (!plan) return null;
  const grab = (re) => (re.exec(plan) ?? [])[1] ?? null;
  const lines = plan.split("\n");
  const contractorsLines = lines.filter((l) => /contractors/i.test(l) && /Scan/.test(l));
  const licensesLines = lines.filter((l) => /on licenses/i.test(l) && /Scan/.test(l));
  return {
    planningTimeMs: Number(grab(/Planning Time: ([\d.]+) ms/)),
    executionTimeMs: Number(grab(/Execution Time: ([\d.]+) ms/)),
    seqScanOnContractors: /Seq Scan on contractors\b/.test(plan) || /Parallel Seq Scan on contractors\b/.test(plan),
    contractorsPkeyUsed: /contractors_pkey/.test(plan),
    contractorsAccessLines: contractorsLines.map((l) => l.trim()),
    licensesAccessLines: licensesLines.map((l) => l.trim()),
    indexNamesUsed: [...plan.matchAll(/(?:Index (?:Only )?Scan|Bitmap Index Scan)(?: using| on)? (\S+)/g)].map((m) => m[1]),
    nameorderIndexesUsed: [...new Set([...plan.matchAll(/(\S*_nameorder_idx)/g)].map((m) => m[1]))],
    namewordsIndexesUsed: [...new Set([...plan.matchAll(/(\S*_namewords_idx)/g)].map((m) => m[1]))],
    hashJoin: /Hash Join/.test(plan),
    nestedLoop: /Nested Loop/.test(plan),
    buffersLine: (plan.match(/Buffers:.*/g) ?? []),
  };
}

const controls = ["R & T GENERAL CONSTRUCTION, INC", "Whaleys Air Conditioning", "Worsham Construction", "Allied", "stilw"];
const out = { ranAt: new Date().toISOString(), note: "READ-ONLY. Post-P2J (LATERAL join-back) EXPLAIN ANALYZE captured from the real operation's own first (strong-tier) statement -- SQL never hand-reconstructed.", controls: {} };
for (const name of controls) {
  const { plan, error, note } = await explainFirstStrongStatement(name);
  out.controls[name] = { summary: summarize(plan), error: error ?? null, note: note ?? null, plan };
  console.log(name, "->", JSON.stringify(summarize(plan) ?? { error, note }));
}
await client.end();
fs.writeFileSync("docs/qa/th-search-r1-019b/p2j-explain.local.json", JSON.stringify(out, (k, v) => (k === "plan" ? undefined : v), 2) + "\n");
fs.writeFileSync("docs/qa/th-search-r1-019b/p2j-explain-fullplans.local.json", JSON.stringify(out, null, 2) + "\n");
console.log("\nWritten: docs/qa/th-search-r1-019b/p2j-explain.local.json (summaries) and -fullplans.local.json (full plan text)");
