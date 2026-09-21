/**
 * TH-SEARCH-R1-019B-P2J: characterize wall-clock variance for "Allied" (~482 strong-tier candidate
 * rows) under the LATERAL join-back shape -- run N isolated calls in ONE process (sequential, real
 * network round trips) to see the spread. READ-ONLY.
 */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { executeContractorNameCandidates } = await import("../lib/specialist-execution/contractor-name-candidates.ts");
const results = [];
for (let i = 0; i < 5; i += 1) {
  const started = Date.now();
  const r = await executeContractorNameCandidates({ operation: "name_candidates", name: "Allied", page: 1, limit: 10 });
  const ms = Date.now() - started;
  results.push({ i, ms, resultState: r.resultState, queryMs: r.timing.queryMs });
  console.log(i, ms + "ms", r.resultState, "queryMs=" + r.timing.queryMs);
}
fs.writeFileSync("docs/qa/th-search-r1-019b/p2j-allied-variance.local.json", JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2) + "\n");
