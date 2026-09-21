/**
 * TH-SEARCH-R1-019B-P2H Section 5/6: named performance pack, isolated executions.
 * Calls the real operation entry point exactly as a caller would. READ-ONLY.
 */
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((l) => l.trim())) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const CONTROLS: Array<{ id: string; name: string; jurisdiction?: string }> = [
  { id: "1_Allied", name: "Allied" },
  { id: "2_stilw", name: "stilw" },
  { id: "3_Stilwell_Solar", name: "Stilwell Solar" },
  { id: "4_Whaleys_Air_Conditioning", name: "Whaleys Air Conditioning" },
  { id: "5_Worsham_Construction", name: "Worsham Construction" },
  { id: "6_R_and_T", name: "R & T GENERAL CONSTRUCTION, INC" },
  { id: "7_explicit_TX_miss_Stilwell", name: "Stilwell Solar", jurisdiction: "TX" },
  { id: "8_unsupported_OH", name: "Stilwell Solar", jurisdiction: "OH" },
  { id: "9_fictitious_miss", name: "Zqxplorvantium Nonexistent Fictitious Contracting" },
];

async function main() {
  const { executeContractorNameCandidates } = await import("../lib/specialist-execution/contractor-name-candidates");
  const label = process.argv[2] ?? "run1";
  const outcomes: unknown[] = [];
  for (const c of CONTROLS) {
    const started = Date.now();
    let result: any = null; let errMsg: string | null = null;
    try {
      const req: Record<string, unknown> = { operation: "name_candidates", name: c.name, limit: 10 };
      if (c.jurisdiction) req.jurisdiction = c.jurisdiction;
      result = await executeContractorNameCandidates(req);
    } catch (e) {
      errMsg = (e as Error).message;
    }
    const wallMs = Date.now() - started;
    const first = result?.candidates?.[0];
    outcomes.push({
      id: c.id, name: c.name, jurisdiction: c.jurisdiction ?? null,
      wallMs,
      resultState: result?.resultState ?? null,
      failureKind: result?.limitations?.failureKind ?? result?.failureKind ?? null,
      returned: result?.candidates?.length ?? null,
      hasMore: result?.pagination?.hasMore ?? null,
      firstCandidate: first ? { displayName: first.displayName, stableKey: first.stableKey, method: first.match?.method } : null,
      timingReported: result?.timing ?? null,
      errMsg,
    });
    console.log(c.id, wallMs + "ms", result?.resultState ?? `ERROR:${errMsg}`, first?.displayName ?? "(none)");
  }
  fs.writeFileSync(`docs/qa/th-search-r1-019b/p2h-named-pack.${label}.local.json`, JSON.stringify({ ranAt: new Date().toISOString(), label, outcomes }, null, 2) + "\n");
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
