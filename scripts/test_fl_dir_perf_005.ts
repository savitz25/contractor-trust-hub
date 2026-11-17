/**
 * FL-DIR-PERF-005: statewide trade pages prefetch occupation license ids,
 * then one primary-key lookup. County pages and mode "legacy" keep the join.
 *
 * Default mode (no database): source and SQL-shape guards only.
 *   FL_DIR_PERF_DB=plan  disposable fixture.sql: CGC/RG and CBC/RB equivalence,
 *                        thin-profile and status recheck, EXPLAIN shape.
 *   FL_DIR_PERF_DB=scan  fixture.sql + slow_scan.sql, with nestloop and mergejoin
 *                        disabled on that database only. Legacy must throw the
 *                        8 s statement timeout. Auto must return the page inside
 *                        that budget. A timeout on auto fails this test.
 *   FL_DIR_PERF_DB=lateral  fixture.sql + lateral_cost.sql. The Sunbiz reader
 *                        is one function scan, not a per-row timeout. Both modes
 *                        return. Not a CI gate. The unconstrained EXPLAIN on
 *                        FL_DIR_PERF_DB=plan is the evidence that both modes
 *                        already use the occupation index and the contractor
 *                        primary key.
 *
 * Disposable synthetic rows only. Never a shared or Production database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getCounty, getDiscoveryState, getTrade } from "../lib/discovery/config";
import { parseBrowseParams } from "../lib/discovery/browse";
import { DISCOVERY_PAGE_SIZE } from "../lib/discovery/queries";
import { query } from "../lib/db";
import {
  floridaBrowseStatement,
  FloridaDirectoryUnavailableError,
  listFloridaBrowse,
  type FloridaReadMode,
} from "../lib/discovery/florida-list";

const mode = process.env.FL_DIR_PERF_DB || "unreachable";
if (mode === "unreachable") {
  process.env.DATABASE_URL = "postgres://fl_dir_perf_test@127.0.0.1:9/postgres_unreachable";
}

const state = getDiscoveryState("florida");
assert.ok(state, "florida discovery state exists");
const browse = (sp: Record<string, string> = {}) => parseBrowseParams(sp);
const trade = (slug: string) => {
  const t = getTrade(state, slug);
  assert.ok(t, `trade ${slug}`);
  return t;
};
const county = (slug: string) => {
  const c = getCounty(state, slug);
  assert.ok(c, `county ${slug}`);
  return c;
};

const src = (p: string) => readFileSync(p, "utf8");

function ids(r: { results: { slug: string; primaryLicenseKey: string | null }[]; total: number }) {
  return { total: r.total, slugs: r.results.map((row) => row.slug), keys: r.results.map((row) => row.primaryLicenseKey) };
}

async function both(opts: Parameters<typeof listFloridaBrowse>[0]) {
  const legacy = await listFloridaBrowse(opts, "legacy");
  const auto = await listFloridaBrowse(opts, "auto");
  assert.deepEqual(ids(auto), ids(legacy));
  assert.deepEqual(auto.stats, legacy.stats);
  return auto;
}

test("source: statement timeout stays 8000 ms", () => {
  const db = src("lib/db.ts");
  assert.match(db, /const DEFAULT_STATEMENT_TIMEOUT_MS = 8_000;/);
  assert.doesNotMatch(src("lib/discovery/florida-list.ts"), /statement_timeout/);
});

test("source: listFloridaBrowse still issues one query and a failure does not return empty", () => {
  const s = src("lib/discovery/florida-list.ts");
  const body = s.slice(
    s.indexOf("export async function listFloridaBrowse("),
    s.indexOf("export function floridaBrowseRequestKey(")
  );
  assert.equal((body.match(/await query(One)?</g) || []).length, 1);
  const catchBlock = body.slice(body.lastIndexOf("} catch (err) {"));
  assert.match(catchBlock, /throw new FloridaDirectoryUnavailableError\(/);
  assert.doesNotMatch(catchBlock, /return\s+empty/);
  assert.match(body, /if \(!statsRow\) \{\s*throw new Error\(/);
});

test("shape: statewide auto prefetches occupation ids and joins contractors by primary key", () => {
  const built = floridaBrowseStatement(
    { trade: trade("general-contractors"), browse: browse() },
    "auto"
  );
  assert.ok(built);
  assert.equal(built.prefetch, true);
  assert.match(built.sql, /occupation_license_ids AS MATERIALIZED \(/);
  assert.match(built.sql, /l\.occupation_code = ANY\(\$\d+::text\[\]\)/);
  assert.match(built.sql, /SELECT \* FROM contractors WHERE id = l\.contractor_id LIMIT 1/);
  assert.match(built.sql, /keyed AS MATERIALIZED \(/);
});

test("shape: legacy mode and a county page keep the contractor-to-license join", () => {
  const legacy = floridaBrowseStatement(
    { trade: trade("general-contractors"), browse: browse() },
    "legacy"
  );
  const countyPage = floridaBrowseStatement({
    county: county("lee"),
    trade: trade("general-contractors"),
    browse: browse(),
  });
  for (const built of [legacy, countyPage]) {
    assert.ok(built);
    assert.equal(built.prefetch, false);
    assert.match(built.sql, /FROM contractors c\s+JOIN licenses l ON l\.contractor_id = c\.id/);
    assert.doesNotMatch(built.sql, /occupation_license_ids/);
  }
});

test("shape: building contractors use the same statewide prefetch", () => {
  const built = floridaBrowseStatement(
    { trade: trade("building-contractors"), browse: browse() },
    "auto"
  );
  assert.ok(built);
  assert.equal(built.prefetch, true);
  assert.deepEqual(
    built.params.find((p) => Array.isArray(p)),
    ["CBC", "RB"]
  );
});

if (mode === "plan") {
  test("equivalence: CGC/RG pages 1 and 2, thin rows out, status recheck", async () => {
    assert.equal(DISCOVERY_PAGE_SIZE, 24);
    const page1 = await both({ trade: trade("general-contractors"), browse: browse() });
    const page2 = await both({ trade: trade("general-contractors"), browse: browse({ page: "2" }) });
    assert.equal(page1.total, 32);
    assert.equal(page1.stats.activeFirms, 31);
    assert.equal(page1.stats.entityLinked, 1);
    assert.deepEqual(
      page1.results.map((row) => row.slug),
      Array.from({ length: 24 }, (_, i) => `gc-firm-${String(i + 1).padStart(3, "0")}`)
    );
    assert.equal(page1.results[0]?.primaryLicenseKey, "SYN-CGC-001");
    assert.deepEqual(
      page2.results.map((row) => row.slug),
      ["gc-firm-025", "gc-firm-026", "gc-firm-027", "gc-firm-028", "gc-firm-029", "gc-firm-030", "gc-firm-031", "gc-firm-032"]
    );
    const seen = new Set([...page1.results.map((row) => row.slug), ...page2.results.map((row) => row.slug)]);
    assert.equal(seen.size, 32);
    assert.equal(seen.has("gc-firm-thin"), false);
    assert.equal(seen.has("gc-firm-ga"), false);

    const active = await both({
      trade: trade("general-contractors"),
      browse: browse({ status: "active", page: "2" }),
    });
    assert.equal(active.total, 31);
    assert.equal(active.results.some((row) => row.slug === "gc-firm-032"), false);
    assert.equal(active.results.some((row) => row.slug === "gc-firm-031"), true);
  });

  test("equivalence: CBC/RB pages 1 and 2", async () => {
    const page1 = await both({ trade: trade("building-contractors"), browse: browse() });
    const page2 = await both({ trade: trade("building-contractors"), browse: browse({ page: "2" }) });
    assert.equal(page1.total, 28);
    assert.equal(page1.stats.activeFirms, 27);
    assert.equal(page1.results.length, 24);
    assert.deepEqual(
      page2.results.map((row) => row.slug),
      ["bc-firm-025", "bc-firm-026", "bc-firm-027", "bc-firm-028"]
    );
    assert.equal(page2.results[2]?.primaryLicenseKey, "SYN-CBC-027");
    const active = await both({
      trade: trade("building-contractors"),
      browse: browse({ status: "active" }),
    });
    assert.equal(active.total, 27);
    assert.equal(active.results.some((row) => row.slug === "bc-firm-028"), false);
  });

  test("equivalence: county page stays on the legacy join and agrees", async () => {
    const opts = {
      county: county("lee"),
      trade: trade("general-contractors"),
      browse: browse(),
    };
    const built = floridaBrowseStatement(opts, "auto");
    assert.ok(built);
    assert.equal(built.prefetch, false);
    const page = await both(opts);
    assert.equal(page.total, 1);
    assert.equal(page.results[0]?.slug, "gc-firm-010");
  });

  test("plan: statewide auto uses the occupation index and does not seq-scan contractors", async () => {
    const built = floridaBrowseStatement(
      { trade: trade("general-contractors"), browse: browse() },
      "auto"
    );
    assert.ok(built);
    const rows = await query<{ "QUERY PLAN": string }>(`EXPLAIN ${built.sql}`, built.params);
    const plan = rows.map((row) => row["QUERY PLAN"]).join("\n");
    // Either occupation index is acceptable. The planner picks
    // licenses_occupation_idx when occupation_code is the selective column,
    // and licenses_occupation_source_idx when source_system is selective too.
    assert.match(
      plan,
      /Index Scan using licenses_occupation(?:_source)?_idx[\s\S]*?Index Cond: \([^\n]*occupation_code = ANY/
    );
    assert.doesNotMatch(plan, /Seq Scan on contractors\b/);
    assert.doesNotMatch(plan, /Seq Scan on licenses\b/);
    assert.match(plan, /Index Scan using contractors_pkey|Index Only Scan using contractors_pkey/);

    const legacyBuilt = floridaBrowseStatement(
      { trade: trade("general-contractors"), browse: browse() },
      "legacy"
    );
    assert.ok(legacyBuilt);
    const legacyRows = await query<{ "QUERY PLAN": string }>(`EXPLAIN ${legacyBuilt.sql}`, legacyBuilt.params);
    const legacyPlan = legacyRows.map((row) => row["QUERY PLAN"]).join("\n");
    assert.match(legacyPlan, /Index Scan using licenses_occupation(?:_source)?_idx/);
    assert.match(legacyPlan, /Index Scan using contractors_pkey/);
    assert.doesNotMatch(legacyPlan, /Seq Scan on contractors\b/);
  });
}

async function readMode(read: FloridaReadMode) {
  const started = Date.now();
  try {
    const result = await listFloridaBrowse(
      { trade: trade("general-contractors"), browse: browse() },
      read
    );
    return { ok: true as const, ms: Date.now() - started, total: result.total };
  } catch (err) {
    return {
      ok: false as const,
      ms: Date.now() - started,
      timeout: err instanceof FloridaDirectoryUnavailableError && /statement timeout/.test(String(err.cause)),
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

if (mode === "scan") {
  test("scan fixture: occupation prefetch returns the page; legacy seq scan times out", { timeout: 40_000 }, async () => {
    const auto = await readMode("auto");
    assert.equal(auto.ok, true, `auto failed closed: ${JSON.stringify(auto)}`);
    if (auto.ok) {
      assert.equal(auto.total, 32);
      assert.ok(auto.ms < 8_000, `auto took ${auto.ms}ms`);
    }
    const legacy = await readMode("legacy");
    assert.equal(legacy.ok, false, `legacy did not time out: ${JSON.stringify(legacy)}`);
    if (!legacy.ok) assert.equal(legacy.timeout, true, JSON.stringify(legacy));
  });
}

if (mode === "lateral") {
  test("lateral fixture: one function scan is not a per-row timeout", { timeout: 20_000 }, async () => {
    const legacy = await readMode("legacy");
    const auto = await readMode("auto");
    assert.equal(legacy.ok, true, JSON.stringify(legacy));
    assert.equal(auto.ok, true, JSON.stringify(auto));
    if (legacy.ok && auto.ok) {
      assert.equal(legacy.total, 32);
      assert.equal(auto.total, 32);
      assert.ok(legacy.ms < 8_000 && auto.ms < 8_000);
    }
  });
}
