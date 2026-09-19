/**
 * TH-SEARCH-R1-019B-P2S isolated 9-case reproduction pack. READ-ONLY HTTP GETs against a freshly started
 * `next start` server (see docs/qa/th-search-r1-019b/p2s-runtime.local.json for its PID/SHA/port/start time).
 * Sequential, >=5s apart, one case at a time, nothing else run concurrently. Never averaged, never called p95.
 *
 * Usage: node scripts/th_search_r1_019b_p2s_isolated_pack.mjs <run1|run2> <port>
 */
import fs from "node:fs";

const runLabel = process.argv[2];
const port = process.argv[3];
if (!runLabel || !port) {
  console.error("Usage: node scripts/th_search_r1_019b_p2s_isolated_pack.mjs <run1|run2> <port>");
  process.exit(1);
}

const BASE = `http://localhost:${port}/api/specialist-execution/name-candidates/v1`;
const GAP_MS = 5000;

const cases = [
  { label: "Stilwell Solar", params: { operation: "name_candidates", name: "Stilwell Solar", limit: 10 } },
  { label: "STILWELL SOLAR, LLC", params: { operation: "name_candidates", name: "STILWELL SOLAR, LLC", limit: 10 } },
  { label: "Worsham Construction", params: { operation: "name_candidates", name: "Worsham Construction", limit: 10 } },
  { label: "Whaley's Air Conditioning", params: { operation: "name_candidates", name: "Whaley's Air Conditioning", limit: 10 } },
  { label: "R & T GENERAL CONSTRUCTION, INC.", params: { operation: "name_candidates", name: "R & T GENERAL CONSTRUCTION, INC.", limit: 10 } },
  { label: "Allied", params: { operation: "name_candidates", name: "Allied", limit: 10 } },
  { label: "stilw", params: { operation: "name_candidates", name: "stilw", limit: 10 } },
  { label: "Stilwell Solar @ FL", params: { operation: "name_candidates", name: "Stilwell Solar", jurisdiction: "FL", limit: 10 } },
  { label: "Stilwell Solar @ TX", params: { operation: "name_candidates", name: "Stilwell Solar", jurisdiction: "TX", limit: 10 } },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const results = [];
  for (const [i, c] of cases.entries()) {
    if (i > 0) {
      console.log(`(waiting ${GAP_MS}ms before next case)`);
      await sleep(GAP_MS);
    }
    const url = new URL(BASE);
    for (const [k, v] of Object.entries(c.params)) url.searchParams.set(k, v);

    const startedAtIso = new Date().toISOString();
    const t0 = performance.now();
    let status = null;
    let body = null;
    let networkError = null;
    try {
      const res = await fetch(url, { cache: "no-store" });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch (e) {
      networkError = e.message;
    }
    const elapsedMs = Math.round(performance.now() - t0);

    const row = {
      case: c.label,
      requestUrl: url.toString(),
      startedAtIso,
      elapsedMs,
      httpStatus: status,
      networkError,
      resultState: body?.resultState ?? null,
      failureKind: body?.failureKind ?? null,
      candidateCount: Array.isArray(body?.candidates) ? body.candidates.length : null,
      firstCandidate: body?.candidates?.[0]
        ? { name: body.candidates[0].displayName, method: body.candidates[0].match?.method, stableKey: body.candidates[0].stableKey }
        : null,
      strongTier: body?.completeness?.strongNameMatches ?? null,
      tokenTier: body?.completeness?.wordMatchesElsewhereInName ?? null,
      scopesSearched: body?.scope?.searched?.map((s) => s.code) ?? null,
    };
    console.log(
      `[${runLabel}] ${c.label} -> ${elapsedMs}ms http=${status} state=${row.resultState} failureKind=${row.failureKind} strong=${row.strongTier} token=${row.tokenTier} candidates=${row.candidateCount}`
    );
    results.push(row);
  }

  const outPath = `docs/qa/th-search-r1-019b/p2s-isolated-${runLabel}.local.json`;
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        runLabel,
        note: "Isolated settled-state reproduction pack, sequential, >=5s apart, single pass, never averaged, never called p95.",
        port: Number(port),
        writtenAtIso: new Date().toISOString(),
        results,
      },
      null,
      2
    ) + "\n"
  );
  console.log(`\nWritten to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
