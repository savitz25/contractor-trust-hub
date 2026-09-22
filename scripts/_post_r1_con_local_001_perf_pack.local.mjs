/**
 * POST-R1-CON-LOCAL-001 investigation only. READ-ONLY. Times ONE executeContractorSpecialistQuery
 * call (real operation, real production-pointed DB via .env.local) per process invocation, so the
 * perf pack (see run-perf-pack.sh below) can run each case in a genuinely separate Node process per
 * Section 10's "run in multiple separate processes where practical" instruction -- no shared
 * connection pool warm-up or in-process JIT warm-up between cases.
 * Usage: node --import tsx scripts/_post_r1_con_local_001_perf_pack.local.mjs <label> <json-request>
 */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { executeContractorSpecialistQuery } = await import("../lib/specialist-execution/contractor-v2.ts");

const label = process.argv[2];
const request = JSON.parse(process.argv[3]);

const startedAt = Date.now();
let response = null;
let error = null;
try {
  response = await executeContractorSpecialistQuery(request);
} catch (e) {
  error = e instanceof Error ? e.message : String(e);
}
const elapsedMs = Date.now() - startedAt;

console.log(JSON.stringify({
  label,
  request,
  elapsedMs,
  resultState: response?.resultState ?? null,
  total: response?.total ?? null,
  rowCount: response?.rows?.length ?? null,
  errorCode: response?.errorCode ?? null,
  error,
}));
process.exit(0);
