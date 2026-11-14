/**
 * FL-DIR-PERF-003 rank 3 guard: county research pages (Broward, Palm Beach,
 * Miami-Dade, Pinellas) never serve an incomplete research snapshot (missing
 * statewide comparison values / "What stands out") as indexable, and never
 * cache one for 30 minutes. No database needed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildCountyIntelligencePayload,
  isCountyIntelComplete,
  type CountyLiveCounts,
} from "../lib/intelligence/county-payload";
import { buildCompareRows, standsOutStatements } from "../lib/intelligence/os-layer";

const src = (p: string) => readFileSync(p, "utf8");

const full: CountyLiveCounts = {
  tracked: 12_000,
  active: 7_000,
  tradeTracked: 11_000,
  tradeActive: 6_500,
  asOf: "2026-11-01T00:00:00.000Z",
  floridaTracked: 176_076,
  floridaActive: 98_000,
  floridaRoofing: 9_300,
  floridaGeneral: 35_000,
  occupationRows: [
    { occupation_code: "CCC", tracked: 700, active: 400 },
    { occupation_code: "CGC", tracked: 2_600, active: 1_500 },
  ],
  jurisdictionRows: null,
  permitRows: 0,
  localCredentialRows: 0,
  contactRows: null,
  sourceFileRows: 0,
  permitEvidence: null,
};
const build = (counts: CountyLiveCounts | null, timedOut = false) =>
  buildCountyIntelligencePayload({ countySlug: "broward", generatedAt: "2026-11-13T00:00:00.000Z", timedOut, counts });

/** The same rows CountyIntelligence renders in "Compare with Florida". */
const compareRows = (p: ReturnType<typeof build>) =>
  buildCompareRows({
    floridaTracked: p.floridaBaseline.tracked,
    floridaActive: p.floridaBaseline.active,
    floridaRoofing: p.floridaBaseline.roofing,
    floridaGeneral: p.floridaBaseline.general,
    counties: [{
      id: p.countySlug, label: "Broward", href: p.canonicalPath,
      tracked: p.metrics.find((m) => m.id === "county_credentials")?.value ?? null,
      active: p.metrics.find((m) => m.id === "county_active_credentials")?.value ?? null,
      roofing: p.categories.find((c) => c.slug === "roofers")?.tracked ?? null,
      general: p.categories.find((c) => c.slug === "general-contractors")?.tracked ?? null,
      researchDepth: p.coverageLevel,
    }],
  });

test("complete snapshot: statewide row has values and 'What stands out' has statements", () => {
  const p = build(full);
  assert.equal(isCountyIntelComplete(p), true);
  const rows = compareRows(p);
  assert.notEqual(rows[0].activeShare, null);
  assert.ok(standsOutStatements(rows).length > 0);
});

test("missing statewide baseline (the Prod '— — — —' case) is incomplete", () => {
  // getFloridaIntelligenceSnapshot timed out: empty payload, metrics [] -> tracked/active null,
  // categories tracked 0 -> roofing/general 0.
  const p = build({ ...full, floridaTracked: null, floridaActive: null, floridaRoofing: 0, floridaGeneral: 0 });
  assert.equal(isCountyIntelComplete(p), false);
  const rows = compareRows(p);
  assert.equal(rows[0].activeShare, null, "statewide row renders dashes");
  assert.equal(standsOutStatements(rows).length, 0, "'What stands out' disappears");
});

test("timed-out snapshot and missing county counts are incomplete", () => {
  assert.equal(isCountyIntelComplete(build(null, true)), false);
  assert.equal(isCountyIntelComplete(build({ ...full, tracked: null, active: null })), false);
  assert.equal(isCountyIntelComplete(build({ ...full, tracked: 0, active: 0 })), false, "zero county credentials: no comparison");
});

test("source: an incomplete snapshot throws inside the cached loader (never cached) and the key is bumped", () => {
  const s = src("lib/intelligence/county-snapshot.ts");
  const load = s.slice(s.indexOf("async function loadLive("), s.indexOf("function emptyTimedOut("));
  assert.match(load, /if \(!isCountyIntelComplete\(payload\)\) \{\s*throw new Error\("county-intel-incomplete"\);/);
  assert.match(s, /\["contractor-county-intel-v2", countySlug\]/);
  assert.doesNotMatch(s, /contractor-county-intel-v1/);
  assert.match(s, /export const getFloridaCountyIntelligenceSnapshotOnce = cache\(/);
});

test("source: county page metadata and body share the snapshot; incomplete research is noindex", () => {
  const s = src("app/florida/[segment]/page.tsx");
  const meta = s.slice(s.indexOf("export async function generateMetadata"), s.indexOf("export default"));
  const body = s.slice(s.indexOf("export default"));
  assert.match(meta, /getFloridaCountyIntelligenceSnapshotOnce\(county\.slug\)/);
  assert.match(meta, /if \(!isCountyIntelComplete\(intel\)\) degraded = true;/);
  assert.match(meta, /noIndex: degraded \|\|/);
  assert.match(body, /getFloridaCountyIntelligenceSnapshotOnce\(county\.slug\)/);
  assert.doesNotMatch(s, /getFloridaCountyIntelligenceSnapshot\(/);
});
