/**
 * TH-SEARCH-R1-019B diagnostic holdout (READ-ONLY against the configured database).
 *
 *   npx tsx scripts/th_search_r1_019b_holdout.ts draw   # freeze the sample (refuses to overwrite)
 *   npx tsx scripts/th_search_r1_019b_holdout.ts run <label> "<why this run exists>"   # one pass, every outcome recorded
 *
 * A 20-record sample is diagnostic, not proof of completeness. Source errors are recorded as
 * errors, never as misses, and the run is never repeated to obtain a nicer score.
 */
import fs from "node:fs";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const DIR = "docs/qa/th-search-r1-019b";
const FROZEN = `${DIR}/holdout-frozen.json`;
const RESULTS = `${DIR}/holdout-results.${process.argv[3] ?? "run"}.json`;
const SEED = 19;
const LEGAL_SUFFIX = /[\s,]+(INCORPORATED|INC|LLC|L\.?L\.?C\.?|CORPORATION|CORP|COMPANY|CO|LTD|LIMITED|PLLC|LP|LLP)\.?$/i;

type Frozen = { scope: string; slug: string; displayName: string; credentialKey: string | null };

async function draw() {
  if (fs.existsSync(FROZEN)) throw new Error(`${FROZEN} already exists; the holdout is frozen and is not redrawn.`);
  const { query } = await import("../lib/db");
  const { nameSearchableScopes } = await import("../lib/specialist-execution/contractor-name-candidates");
  const scopes = nameSearchableScopes();
  // 20 records spread over the searchable scopes: two per scope, trimmed round-robin to 20.
  const perScope: Frozen[][] = [];
  for (const scope of scopes) {
    // Index-driven, seeded pick (block sampling timed out on this database): learn the key shape from the
    // scope's lowest and highest credential key, replace the digits with seeded digits, and take the first
    // eligible public profile at or after that key. Deterministic for a given seed; not hand-selected.
    const rows: Array<{ slug: string; display_name: string; external_key: string | null }> = [];
    for (const direction of ["ASC", "DESC"] as const) {
      const edge = await query<{ external_key: string }>(
        `SELECT external_key FROM licenses WHERE source_system = $1 ORDER BY source_system ${direction}, external_key ${direction} LIMIT 1`,
        [scope.sources[0]], { statementTimeoutMs: 20_000 });
      if (!edge[0]) continue;
      let state = SEED * 7919 + scope.code.charCodeAt(0) * 131 + scope.code.charCodeAt(1) * 17 + (direction === "ASC" ? 1 : 2);
      const seededKey = edge[0].external_key.replace(/\d/g, () => { state = (state * 1103515245 + 12345) % 2147483648; return String(state % 10); });
      const picked = await query<{ slug: string; display_name: string; external_key: string | null }>(
        `SELECT c.slug, c.display_name, l.external_key
         FROM licenses l JOIN contractors c ON c.id = l.contractor_id
         WHERE l.source_system = $1 AND l.external_key >= $2 AND (c.home_state = $3 OR l.state = $3)
           AND c.is_thin_profile = FALSE AND c.slug IS NOT NULL AND c.slug <> ''
           AND LENGTH(TRIM(c.display_name)) >= 3
         ORDER BY l.source_system, l.external_key LIMIT 1`,
        [scope.sources[0], seededKey, scope.code], { statementTimeoutMs: 20_000 });
      if (picked[0] && !rows.some((r) => r.slug === picked[0].slug)) rows.push(picked[0]);
    }
    perScope.push(rows.map((r) => ({ scope: scope.code, slug: r.slug, displayName: r.display_name, credentialKey: r.external_key })));
  }
  const sample: Frozen[] = [];
  for (let round = 0; round < 2 && sample.length < 20; round += 1) for (const rows of perScope) if (rows[round] && sample.length < 20) sample.push(rows[round]);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FROZEN, `${JSON.stringify({ drawnAt: new Date().toISOString(), seed: SEED, method: "Seeded index pick: per name-searchable scope, the digits of the lowest and highest credential key are replaced with seeded digits and the first public non-thin profile with a slug at or after that key is taken; up to two per scope, round-robin to 20. Block sampling (TABLESAMPLE) timed out on this database and was not used.", distribution: Object.fromEntries(scopes.map((s) => [s.code, sample.filter((r) => r.scope === s.code).length])), sample }, null, 2)}\n`);
  console.log(`froze ${sample.length} records`);
}

async function run() {
  const { executeContractorNameCandidates } = await import("../lib/specialist-execution/contractor-name-candidates");
  const frozen = JSON.parse(fs.readFileSync(FROZEN, "utf8")) as { sample: Frozen[] };
  const outcomes: unknown[] = [];
  for (const record of frozen.sample) {
    const stripped = record.displayName.replace(LEGAL_SUFFIX, "").replace(/[\s,]+$/, "");
    const variants = [["displayed", record.displayName], ["lowercase", record.displayName.toLowerCase()], ["suffix_removed", stripped]] as const;
    for (const [variant, name] of variants) {
      const started = Date.now();
      let outcome = "MISS"; let page = 0; let state = ""; let method: string | null = null; let error: string | null = null; let queries = 0;
      try {
        let request: Record<string, unknown> = { operation: "name_candidates", name, limit: 25 };
        for (;;) {
          const r = (await executeContractorNameCandidates(request)) as Record<string, any>;
          queries += 1; page = r.pagination?.page ?? page; state = r.resultState;
          if (r.resultState === "SOURCE_FAILURE") { outcome = "SOURCE_ERROR"; error = r.failureKind; break; }
          const hit = (r.candidates as any[]).find((c) => c.stableKey === `contractor:profile:${record.slug}`);
          if (hit) { outcome = page === 1 ? "FOUND_PAGE_1" : "FOUND_LATER_PAGE"; method = hit.match.method; break; }
          if (r.continuation?.type !== "NEXT_PAGE") { if (r.resultState === "PARTIAL_TRUNCATED") outcome = "BEYOND_SOURCE_CAP"; break; }
          request = r.continuation.request;
        }
      } catch (e) { outcome = "REQUEST_REJECTED"; error = (e as Error).message; }
      outcomes.push({ scope: record.scope, slug: record.slug, variant, name, outcome, page, resultState: state, matchMethod: method, error, queries, ms: Date.now() - started });
      console.log(record.scope, variant.padEnd(14), outcome.padEnd(18), `p${page}`, `${Date.now() - started}ms`, name);
    }
  }
  const tally: Record<string, number> = {};
  for (const o of outcomes as Array<{ outcome: string }>) tally[o.outcome] = (tally[o.outcome] ?? 0) + 1;
  fs.writeFileSync(RESULTS, `${JSON.stringify({ ranAt: new Date().toISOString(), label: process.argv[3] ?? "run", reason: process.argv[4] ?? null, note: "One pass per label; every run is kept. SOURCE_ERROR is a source failure, never a miss.", tally, outcomes }, null, 2)}\n`);
  console.log(JSON.stringify(tally));
}

(process.argv[2] === "draw" ? draw() : process.argv[2] === "run" ? run() : Promise.reject(new Error("usage: draw | run")))
  .then(() => process.exit(0), (e) => { console.error("ERR", (e as Error).message); process.exit(1); });
