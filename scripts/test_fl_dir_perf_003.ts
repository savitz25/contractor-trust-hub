/**
 * FL-DIR-PERF-003 regression guard (ranks 1, 2 and 4):
 *  1. Florida directory routes never run their reads in parallel on the max:1
 *     pool: directory first, side lists after, nothing after a failure.
 *  2. A failed side list (city / trade / county facet) is reported, never an
 *     empty list on an indexable page.
 *  4. Robots come from the same request-scoped reads as the body (no
 *     "index, follow" on a failed render); a failed directory read is
 *     remembered per instance for 15 s (no repeat statement on the error
 *     re-render or an immediate crawler repeat); successes are never memoised.
 *
 * Default mode (CI, no DB): DATABASE_URL points at a closed loopback port.
 * Optional modes against a disposable LOCAL Postgres (never a shared DB):
 *   FL_DIR_PERF_DB=ok         FL-DIR-PERF-001 synthetic fixture
 *   FL_DIR_PERF_DB=empty      same schema, zero rows
 *   FL_DIR_PERF_DB=facetfail  fixture + scripts/fl_dir_perf_003/side_list_fault_override.sql
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FLORIDA_FAILURE_MEMO_TTL_MS,
  FloridaDirectoryUnavailableError,
  floridaFailureMemoSizeForTests,
  listFloridaBrowseOnce,
  listFloridaCitiesChecked,
  resetFloridaFailureMemoForTests,
} from "../lib/discovery/florida-list";
import {
  checkedSharedFacet,
  loadFloridaCityTradePage,
  loadFloridaCountyPage,
  loadFloridaCountyTradePage,
  loadFloridaTradePage,
} from "../lib/discovery/florida-directory-page";
import { getCounty, getDiscoveryState, getTrade } from "../lib/discovery/config";
import { parseBrowseParams } from "../lib/discovery/browse";

const mode = process.env.FL_DIR_PERF_DB || "unreachable";
if (mode === "unreachable") {
  process.env.DATABASE_URL = "postgres://fl_dir_perf_test@127.0.0.1:9/postgres_unreachable";
}

const state = getDiscoveryState("florida");
assert.ok(state);
const browse = (sp: Record<string, string> = {}) => parseBrowseParams(sp);
const trade = (slug: string) => {
  const t = getTrade(state, slug);
  assert.ok(t, slug);
  return t;
};
const county = (slug: string) => {
  const c = getCounty(state, slug);
  assert.ok(c, slug);
  return c;
};
const src = (p: string) => readFileSync(p, "utf8");
const metaOf = (s: string) =>
  s.slice(s.indexOf("export async function generateMetadata"), s.indexOf("export default"));
const bodyOf = (s: string) => s.slice(s.indexOf("export default"));
const unavailable = (op?: string) => (err: unknown) => {
  assert.ok(err instanceof FloridaDirectoryUnavailableError, String(err));
  assert.ok((err as Error).cause, "keeps the DB error as cause");
  if (op) assert.equal((err as FloridaDirectoryUnavailableError).op, op);
  return true;
};

// ------------------------------------------------------------ source guards

test("rank 1: /florida/{trade} and /florida/{county} bodies run no parallel DB reads", () => {
  const body = bodyOf(src("app/florida/[segment]/page.tsx"));
  assert.doesNotMatch(body, /Promise\.all\(/);
  assert.match(body, /loadFloridaTradePage\(/);
  assert.match(body, /loadFloridaCountyPage\(/);
  assert.doesNotMatch(body, /countByTrade\(|countCountiesForTrade\(|listFloridaCities\(/);
  // The research snapshot is read after the directory, not alongside it.
  assert.ok(body.indexOf("loadFloridaCountyPage(") < body.indexOf("getFloridaCountyIntelligenceSnapshot("));
});

test("rank 1: loaders read the directory first and side lists strictly after it", () => {
  const s = src("lib/discovery/florida-directory-page.ts");
  assert.doesNotMatch(s, /Promise\.all\(|Promise\.allSettled\(/);
  for (const [fn, facet] of [
    ["loadFloridaTradePage", "countCountiesForTrade("],
    ["loadFloridaCountyPage", "countByTrade("],
    ["loadFloridaCountyTradePage", "listFloridaCitiesChecked("],
    ["loadFloridaCityTradePage", "listFloridaCitiesChecked("],
  ] as const) {
    const rest = s.slice(s.indexOf(`export function ${fn}(`));
    const b = rest.slice(0, rest.indexOf("\n}\n"));
    const dir = b.indexOf("await listFloridaBrowseOnce(");
    assert.ok(dir > 0, `${fn}: awaited directory read`);
    assert.ok(dir < b.indexOf(facet), `${fn}: directory before ${facet}`);
  }
});

test("rank 4: directory-route metadata uses the same loader and is noindex on failure", () => {
  for (const [p, loader] of [
    ["app/florida/[segment]/page.tsx", "loadFloridaTradePage("],
    ["app/florida/[segment]/page.tsx", "loadFloridaCountyPage("],
    ["app/florida/[segment]/[facet]/page.tsx", "loadFloridaCountyTradePage("],
    ["app/florida/[segment]/[facet]/[trade]/page.tsx", "loadFloridaCityTradePage("],
  ] as const) {
    const meta = metaOf(src(p));
    assert.ok(meta.includes(loader), `${p}: metadata calls ${loader}`);
    assert.match(meta, /if \(!isFloridaDirectoryUnavailableError\(err\)\) throw err;/, p);
  }
  for (const p of ["app/florida/[segment]/page.tsx", "app/florida/[segment]/[facet]/page.tsx"]) {
    const meta = metaOf(src(p));
    assert.match(meta, /degraded = true;/, p);
    assert.match(meta, /noIndex: degraded \|\|/, p);
  }
  const ct = metaOf(src("app/florida/[segment]/[facet]/[trade]/page.tsx"));
  assert.doesNotMatch(ct, /page: 1/, "city+trade metadata reads the same page as the body");
  assert.match(ct, /!data\.complete/);
});

test("rank 2: Florida routes use the checked city list and show an 'unavailable' notice", () => {
  for (const p of [
    "app/florida/[segment]/page.tsx",
    "app/florida/[segment]/[facet]/page.tsx",
    "app/florida/[segment]/[facet]/[trade]/page.tsx",
  ]) {
    assert.doesNotMatch(src(p), /listFloridaCities\(/, p);
    assert.match(src(p), /citiesUnavailable/, p);
  }
  assert.match(src("components/discovery/FloridaBrowseSection.tsx"), /city list could not be loaded/);
  assert.match(src("app/florida/[segment]/page.tsx"), /SideListUnavailable what="(trade|county)"/);
});

test("rank 2: shared-helper facet list: empty next to a non-empty directory is a failed read", () => {
  const f = [{ slug: "broward", label: "Broward", count: 2 }];
  assert.deepEqual(checkedSharedFacet(f, 3), { ok: true, facets: f });
  assert.deepEqual(checkedSharedFacet([], 0), { ok: true, facets: [] }, "real zero directory: real empty list");
  assert.deepEqual(checkedSharedFacet([], 3), { ok: false, facets: [] });
});

test("rank 4: failure memo TTL is 15 s", () => {
  assert.equal(FLORIDA_FAILURE_MEMO_TTL_MS, 15_000);
});

// --------------------------------------------------------------- DB modes

if (mode === "unreachable") {
  test("memo: a failed read is reused for the same key (no SQL), not for another key, and expires", async () => {
    resetFloridaFailureMemoForTests();
    const a = { trade: trade("roofers"), browse: browse() };
    await assert.rejects(() => listFloridaBrowseOnce(a), unavailable("listFloridaBrowse"));
    await assert.rejects(() => listFloridaBrowseOnce(a), unavailable("listFloridaBrowse (recent failure)"));
    const other = { trade: trade("roofers"), browse: browse({ page: "2" }) };
    await assert.rejects(() => listFloridaBrowseOnce(other), unavailable("listFloridaBrowse"));
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + FLORIDA_FAILURE_MEMO_TTL_MS + 1;
      await assert.rejects(() => listFloridaBrowseOnce(a), unavailable("listFloridaBrowse"));
    } finally {
      Date.now = realNow;
    }
  });

  test("memo: bounded size", async () => {
    resetFloridaFailureMemoForTests();
    for (let i = 1; i <= 300; i++) {
      await assert.rejects(() => listFloridaBrowseOnce({ trade: trade("roofers"), browse: browse({ page: String(i) }) }));
    }
    assert.ok(floridaFailureMemoSizeForTests() <= 256, String(floridaFailureMemoSizeForTests()));
  });

  test("loaders: a failed directory read rejects (500 + noindex), never empty", async () => {
    resetFloridaFailureMemoForTests();
    await assert.rejects(() => loadFloridaTradePage(trade("general-contractors"), browse()), unavailable());
    await assert.rejects(() => loadFloridaCountyPage(county("manatee"), browse()), unavailable());
    await assert.rejects(() => loadFloridaCountyTradePage(county("broward"), trade("roofers"), browse()), unavailable());
    await assert.rejects(() => loadFloridaCityTradePage(county("broward"), trade("roofers"), "fort-lauderdale", browse()), unavailable());
  });

  test("checked city list: a failed read is ok:false (not 'no cities')", async () => {
    const r = await listFloridaCitiesChecked(county("broward"), trade("roofers"));
    assert.equal(r.ok, false);
  });
}

if (mode === "ok") {
  test("ok: every loader resolves complete with real data; successes are not memoised", async () => {
    resetFloridaFailureMemoForTests();
    const t = await loadFloridaTradePage(trade("roofers"), browse());
    assert.ok(t.directory.total > 0);
    assert.equal(t.facets?.ok, true);
    assert.ok((t.facets?.facets.length ?? 0) > 0);
    assert.equal(t.complete, true);
    const c = await loadFloridaCountyPage(county("broward"), browse());
    assert.ok(c.directory.total > 0);
    assert.equal(c.facets?.ok, true);
    assert.equal(c.cities?.ok, true, "a real short city list is ok, not a failure");
    assert.equal(c.complete, true);
    const ct = await loadFloridaCountyTradePage(county("broward"), trade("roofers"), browse());
    assert.equal(ct.complete, true);
    const cty = await loadFloridaCityTradePage(county("broward"), trade("roofers"), "fort-lauderdale", browse());
    assert.ok(cty.directory.total > 0);
    assert.equal(cty.complete, true);
    assert.equal(floridaFailureMemoSizeForTests(), 0);
  });
}

if (mode === "empty") {
  test("empty: a real zero directory keeps a real empty side list (complete, indexable)", async () => {
    const t = await loadFloridaTradePage(trade("roofers"), browse());
    assert.equal(t.directory.total, 0);
    assert.deepEqual(t.facets, { ok: true, facets: [] });
    assert.equal(t.complete, true);
    const c = await loadFloridaCountyPage(county("broward"), browse());
    assert.equal(c.directory.total, 0);
    assert.equal(c.complete, true);
  });
}

if (mode === "facetfail") {
  test("facetfail: directory OK + failed side list = complete:false (noindex), results kept", async () => {
    const t = await loadFloridaTradePage(trade("roofers"), browse());
    assert.ok(t.directory.total > 0 && t.directory.results.length > 0);
    assert.equal(t.facets?.ok, false);
    assert.equal(t.complete, false);
    const ct = await loadFloridaCountyTradePage(county("broward"), trade("roofers"), browse());
    assert.ok(ct.directory.results.length > 0);
    assert.equal(ct.cities?.ok, false);
    assert.equal(ct.complete, false);
    const c = await loadFloridaCountyPage(county("broward"), browse());
    assert.ok(c.directory.results.length > 0);
    assert.equal(c.cities?.ok, false);
    assert.equal(c.complete, false);
  });
}
