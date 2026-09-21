/**
 * TH-SEARCH-R1-019B-P2J Section 13 spot-check: Allied page 1 / page 2 distinct, stable order, no
 * duplicate stable keys, truthful hasMore, no page-1 substitution -- against the real operation
 * entry point, post-LATERAL-join-back-rewrite. READ-ONLY.
 */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { executeContractorNameCandidates } = await import("../lib/specialist-execution/contractor-name-candidates.ts");

const p1 = await executeContractorNameCandidates({ operation: "name_candidates", name: "Allied", page: 1, limit: 10 });
const p2 = await executeContractorNameCandidates({ operation: "name_candidates", name: "Allied", page: 2, limit: 10 });
const keys1 = p1.candidates.map((c) => c.stableKey);
const keys2 = p2.candidates.map((c) => c.stableKey);
const overlap = keys1.filter((k) => keys2.includes(k));
const dupWithinP1 = keys1.length !== new Set(keys1).size;
const dupWithinP2 = keys2.length !== new Set(keys2).size;
console.log("page1 resultState", p1.resultState, "returned", p1.candidates.length, "hasMore", p1.pagination.hasMore, "ms", p1.timing.queryMs, "queries", p1.timing.queries);
console.log("page2 resultState", p2.resultState, "returned", p2.candidates.length, "hasMore", p2.pagination.hasMore, "ms", p2.timing.queryMs, "queries", p2.timing.queries);
console.log("overlap between page1 and page2 stableKeys:", overlap.length, overlap);
console.log("duplicate stable keys within page1:", dupWithinP1, "within page2:", dupWithinP2);
console.log("page1 first 3:", keys1.slice(0, 3));
console.log("page2 first 3:", keys2.slice(0, 3));
fs.writeFileSync("docs/qa/th-search-r1-019b/p2j-pagination-check.local.json", JSON.stringify({
  ranAt: new Date().toISOString(),
  page1: { resultState: p1.resultState, returned: p1.candidates.length, hasMore: p1.pagination.hasMore, keys: keys1, ms: p1.timing.queryMs, queries: p1.timing.queries },
  page2: { resultState: p2.resultState, returned: p2.candidates.length, hasMore: p2.pagination.hasMore, keys: keys2, ms: p2.timing.queryMs, queries: p2.timing.queries },
  overlap, dupWithinP1, dupWithinP2,
}, null, 2) + "\n");
