/**
 * POST-R1-CON-LOCAL-001 investigation only. READ-ONLY. Same harness convention as
 * scripts/_p2j_explain.local.mjs -- captures the REAL statements
 * executeContractorSpecialistQuery (lib/specialist-execution/contractor-v2.ts) issues, through the
 * same {query,queryOne} override hook the operation already accepts, and re-runs each one prefixed
 * with EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) against the real connection. SQL is never
 * hand-reconstructed. No writes, no DDL, no planner setting changes, no forced index/seqscan.
 * This is a NEW, separate script -- it does not modify or touch any P2H/P2I/P2J script or output.
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const { executeContractorSpecialistQuery } = await import(pathToFileURL("lib/specialist-execution/contractor-v2.ts").href);
const { Client } = await import("pg");

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("SET statement_timeout = 30000");

async function explainAllStatements(label, request) {
  const captured = [];
  const db = {
    query: async (text, params) => {
      const t0 = Date.now();
      const res = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${text}`, params);
      const plan = res.rows.map((r) => r["QUERY PLAN"]).join("\n");
      captured.push({ kind: "query", text, wallMsIncludingExplainOverhead: Date.now() - t0, plan });
      // Also actually run the real (non-EXPLAIN) statement so downstream code gets real rows and the
      // operation can complete normally to reveal any second/third statement it issues.
      const real = await client.query(text, params);
      return real.rows;
    },
    queryOne: async (text, params) => {
      const rows = await db.query(text, params);
      return rows[0] ?? null;
    },
  };
  let response = null;
  let error = null;
  const startedAt = Date.now();
  try {
    response = await executeContractorSpecialistQuery(request, db);
  } catch (e) {
    error = e.message;
  }
  const totalMs = Date.now() - startedAt;
  return { label, request, totalMs, resultState: response?.resultState, total: response?.total, statementCount: captured.length, statements: captured, error };
}

function summarizePlan(plan) {
  if (!plan) return null;
  const grab = (re) => (re.exec(plan) ?? [])[1] ?? null;
  return {
    planningTimeMs: Number(grab(/Planning Time: ([\d.]+) ms/)),
    executionTimeMs: Number(grab(/Execution Time: ([\d.]+) ms/)),
    seqScanOnContractors: /Seq Scan on contractors\b/.test(plan) || /Parallel Seq Scan on contractors\b/.test(plan),
    seqScanOnLicenses: /Seq Scan on licenses\b/.test(plan) || /Parallel Seq Scan on licenses\b/.test(plan),
    indexNamesUsed: [...plan.matchAll(/(?:Index (?:Only )?Scan|Bitmap Index Scan)(?: using| on)? (\S+)/g)].map((m) => m[1]),
    rowsRemoved: [...plan.matchAll(/Rows Removed by Filter: (\d+)/g)].map((m) => Number(m[1])),
    actualRowsTop: (grab(/actual time=[\d.]+\.\.[\d.]+ rows=(\d+)/)) ?? null,
  };
}

const cases = [
  { label: "general_contractor_miami_dade_city_and_county", request: { queryType: "cohort", state: "FL", trade: "general contractor", city: "Miami", county: "miami-dade" } },
  { label: "plumbing_miami_dade_city_and_county", request: { queryType: "cohort", state: "FL", trade: "plumbing", city: "Miami", county: "miami-dade" } },
];

const out = { ranAt: new Date().toISOString(), note: "READ-ONLY POST-R1-CON-LOCAL-001 investigation. Real statements from executeContractorSpecialistQuery's own {query,queryOne} calls -- SQL never hand-reconstructed. Each statement is EXPLAIN ANALYZE'd AND then actually executed so the operation completes normally.", cases: [] };

for (const c of cases) {
  console.log(`\n=== ${c.label} ===`);
  const result = await explainAllStatements(c.label, c.request);
  console.log(`resultState=${result.resultState} total=${result.total} statementCount=${result.statementCount} totalWallMs=${result.totalMs} error=${result.error ?? "none"}`);
  for (const [i, s] of result.statements.entries()) {
    const sum = summarizePlan(s.plan);
    console.log(`  stmt[${i}] wallMs=${s.wallMsIncludingExplainOverhead} summary=${JSON.stringify(sum)}`);
  }
  out.cases.push(result);
}

await client.end();
fs.mkdirSync("docs/qa/post-r1-con-local-001", { recursive: true });
fs.writeFileSync(
  "docs/qa/post-r1-con-local-001/explain-cohort.local.json",
  JSON.stringify(out, (k, v) => (k === "plan" ? undefined : v), 2) + "\n"
);
fs.writeFileSync(
  "docs/qa/post-r1-con-local-001/explain-cohort-fullplans.local.json",
  JSON.stringify(out, null, 2) + "\n"
);
console.log("\nWritten: docs/qa/post-r1-con-local-001/explain-cohort.local.json (summaries) and -fullplans.local.json (full plan text)");
