/**
 * TH-SEARCH-R1-019B Phase 1 post-build measurement. READ-ONLY name-search reads through the real, unmodified
 * callable operation (lib/specialist-execution/contractor-name-candidates.ts -> lib/contractors/name-
 * candidates-query.ts -> lib/contractors/name-search-core.ts) -- the exact code path PR #86 ships. No writes,
 * no DDL, no index creation. Each case: one request, then an immediate repeat (cold vs warm), never averaged,
 * never called p95 from one sample.
 */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }

async function main() {
  const { executeContractorNameCandidates } = await import("../lib/specialist-execution/contractor-name-candidates");

  type Case = { label: string; name: string; jurisdiction?: string };
  const cases: Case[] = [
    { label: "1. Stilwell Solar", name: "Stilwell Solar" },
    { label: "2. STILWELL SOLAR, LLC", name: "STILWELL SOLAR, LLC" },
    { label: "3. Worsham Construction", name: "Worsham Construction" },
    { label: "4. Whaley's Air Conditioning", name: "Whaley's Air Conditioning" },
    { label: "5. R & T GENERAL CONSTRUCTION, INC.", name: "R & T GENERAL CONSTRUCTION, INC." },
    { label: "6. Allied", name: "Allied" },
    { label: "7. stilw (short prefix)", name: "stilw" },
    { label: "8. explicit-jurisdiction positive (Stilwell Solar @ FL)", name: "Stilwell Solar", jurisdiction: "FL" },
    { label: "9. explicit-jurisdiction honest miss (Stilwell Solar @ TX)", name: "Stilwell Solar", jurisdiction: "TX" },
  ];

  const results: unknown[] = [];
  for (const c of cases) {
    const attempts: unknown[] = [];
    for (const pass of ["cold-ish", "immediate-warm-repeat"]) {
      const started = Date.now();
      let out: any;
      try {
        out = await executeContractorNameCandidates({ operation: "name_candidates", name: c.name, ...(c.jurisdiction ? { jurisdiction: c.jurisdiction } : {}), limit: 10 });
      } catch (e) {
        out = { thrown: (e as Error).message };
      }
      const ms = Date.now() - started;
      attempts.push({
        pass, ms,
        resultState: out.resultState,
        failureKind: out.failureKind ?? null,
        candidateCount: Array.isArray(out.candidates) ? out.candidates.length : null,
        firstCandidate: out.candidates?.[0] ? { name: out.candidates[0].displayName, method: out.candidates[0].match?.method, stableKey: out.candidates[0].stableKey } : null,
        strongTier: out.completeness?.strongNameMatches ?? null,
        tokenTier: out.completeness?.wordMatchesElsewhereInName ?? null,
        completenessMeaning: out.completeness?.meaning ?? null,
        scopesSearched: out.scope?.searched?.map((s: any) => s.code) ?? null,
        thrown: out.thrown ?? null,
      });
      console.log(`${c.label} [${pass}] ${ms}ms state=${out.resultState} strong=${out.completeness?.strongNameMatches} token=${out.completeness?.wordMatchesElsewhereInName} candidates=${Array.isArray(out.candidates) ? out.candidates.length : "n/a"}`);
    }
    results.push({ case: c.label, name: c.name, jurisdiction: c.jurisdiction ?? null, attempts });
  }

  fs.writeFileSync(
    "docs/qa/th-search-r1-019b/p1-measurement.local.json",
    JSON.stringify({ ranAt: new Date().toISOString(), note: "Two attempts per case (cold-ish, immediate warm repeat), never averaged, never p95 from a single sample.", results }, null, 2) + "\n"
  );
  console.log("\nWritten to docs/qa/th-search-r1-019b/p1-measurement.local.json");
}
main().catch((e) => { console.error(e); process.exit(1); });
