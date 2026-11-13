/**
 * FL-DIR-PERF-002 regression guard: fast, accurate Florida directory reads
 * that never turn a failed or partial read into an empty directory.
 *
 * Default mode (CI, no DB): DATABASE_URL points at a closed loopback port, so
 * every query fails fast (connection failure). Source guards + pure checks +
 * connection-failure behavior run here.
 *
 * Optional modes against a disposable LOCAL Postgres (never a shared DB):
 *   FL_DIR_PERF_DB=ok      representative synthetic data
 *                          (scripts/fl_dir_perf_002/representative_sample.sql):
 *                          success, real zero rows, stats parity with an
 *                          independent count, sort order, and no duplicate or
 *                          missing firm across every page.
 *   FL_DIR_PERF_DB=slowok  FL-DIR-PERF-001 fixture + slow_ok_override.sql: a
 *                          slow (2 s) read under the 8 s budget still succeeds.
 *   FL_DIR_PERF_DB=slow    FL-DIR-PERF-001 fixture + its slow_override.sql: the
 *                          8 s statement timeout rejects, never empty.
 *   FL_DIR_PERF_DB=sqlerr  database without the directory tables: SQL error
 *                          rejects, never empty.
 *   FL_DIR_PERF_DB=empty   FL-DIR-PERF-001 schema with zero rows: every read
 *                          resolves to a real, distinguishable total 0.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  floridaBrowseRequestKey,
  FloridaDirectoryUnavailableError,
  listFloridaBrowse,
  listFloridaBrowseOnce,
} from "../lib/discovery/florida-list";
import { getDiscoveryState, getTrade, getCounty } from "../lib/discovery/config";
import { parseBrowseParams } from "../lib/discovery/browse";
import { buildFilterClause, DISCOVERY_PAGE_SIZE } from "../lib/discovery/queries";
import { query } from "../lib/db";

const mode = process.env.FL_DIR_PERF_DB || "unreachable";
if (mode === "unreachable") {
  // lib/db reads DATABASE_URL lazily on the first query. Closed loopback port:
  // ECONNREFUSED immediately; never a real database.
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
const rejectsUnavailable = async (p: () => Promise<unknown>, cause?: RegExp) =>
  assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof FloridaDirectoryUnavailableError, String(err));
    assert.ok((err as Error).cause, "keeps the underlying DB error as cause");
    if (cause) assert.match(String((err as Error).cause), cause);
    return true;
  });

const src = (p: string) => readFileSync(p, "utf8");
const browseBody = () => {
  const s = src("lib/discovery/florida-list.ts");
  return s.slice(s.indexOf("export async function listFloridaBrowse("), s.indexOf("type FloridaBrowseOpts"));
};

// ---------------------------------------------------------------- always run

test("source: trade predicate is sargable (no UPPER() on licenses.occupation_code)", () => {
  const q = src("lib/discovery/queries.ts");
  assert.doesNotMatch(q, /UPPER\(l\.occupation_code\)/);
  assert.match(q, /AND l\.occupation_code = ANY\(\$\$\{params\.length\}::text\[\]\)/);
});

test("normalization: bind values are uppercased, so mixed-case config still matches uppercase data", () => {
  const { where, params } = buildFilterClause({
    licenseSource: "fl_dbpr",
    stateCode: "FL",
    occupationCodes: ["ccc", "Rc", "CGC"],
  });
  assert.match(where, /l\.occupation_code = ANY\(\$3::text\[\]\)/);
  assert.deepEqual(params[2], ["CCC", "RC", "CGC"]);
});

test("normalization: every discovery trade code (FL/AZ/OR/WA) is already uppercase and trimmed", () => {
  for (const slug of ["florida", "arizona", "oregon", "washington"]) {
    const disc = getDiscoveryState(slug);
    if (!disc) continue;
    for (const t of disc.trades) {
      for (const c of t.occupationCodes) {
        assert.equal(c, c.toUpperCase().trim(), `${slug}/${t.slug} code ${c}`);
      }
    }
  }
});

test("source: listFloridaBrowse issues exactly one statement (stats + page + siblings)", () => {
  const body = browseBody();
  assert.equal((body.match(/await query(One)?</g) || []).length, 1);
  assert.match(body, /keyed AS MATERIALIZED \(/);
  assert.match(body, /ROW_NUMBER\(\) OVER \(ORDER BY \$\{sortSql\(browse\.sort\)\}, p\.firm_key\)/);
});

test("source: an incomplete read (no stats row) throws, a failure never returns empty", () => {
  const body = browseBody();
  assert.match(body, /if \(!statsRow\) \{\s*throw new Error\(/);
  const catchBlock = body.slice(body.lastIndexOf("} catch (err) {"));
  assert.match(catchBlock, /throw new FloridaDirectoryUnavailableError\(/);
  assert.doesNotMatch(catchBlock, /return\s+empty/);
});

test("loading boundary: no loading.tsx anywhere under app/florida (county/trade is not a 200 shell)", () => {
  assert.equal(existsSync("app/florida/[segment]/[facet]/loading.tsx"), false);
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  assert.deepEqual(walk("app/florida").filter((p) => /(^|\/)loading\.tsx$/.test(p)), []);
  for (const p of [
    "app/florida/[segment]/[facet]/page.tsx",
    "app/florida/[segment]/[facet]/[trade]/page.tsx",
  ]) {
    assert.doesNotMatch(src(p), /<Suspense/, `${p} must not stream a fallback`);
  }
});

test("source: county/trade and city+trade run the facet query after the directory read", () => {
  for (const p of [
    "app/florida/[segment]/[facet]/page.tsx",
    "app/florida/[segment]/[facet]/[trade]/page.tsx",
  ]) {
    const page = src(p).slice(src(p).indexOf("export default"));
    assert.doesNotMatch(page, /Promise\.all\(/, p);
    assert.ok(
      page.indexOf("listFloridaBrowse") < page.indexOf("listFloridaCities("),
      `${p}: directory before facets`
    );
  }
});

test("source: city+trade metadata and page share one request-scoped read; failure stays noindex", () => {
  const s = src("app/florida/[segment]/[facet]/[trade]/page.tsx");
  const meta = s.slice(s.indexOf("export async function generateMetadata"), s.indexOf("export default"));
  const page = s.slice(s.indexOf("export default"));
  assert.match(meta, /listFloridaBrowseOnce\(/);
  assert.match(page, /listFloridaBrowseOnce\(/);
  assert.match(meta, /catch \(err\) \{\s*if \(!isFloridaDirectoryUnavailableError\(err\)\) throw err;/);
  assert.match(meta, /thin = true;/);
  assert.match(meta, /noIndex: thin \|\|/);
});

test("request key: city+trade metadata (page 1) and page body read the same directory", () => {
  const c = county("broward");
  const t = trade("roofers");
  const b = browse();
  const metaKey = floridaBrowseRequestKey({ county: c, trade: t, browse: { ...b, citySlug: "fort-lauderdale", page: 1 }, pathCitySlug: "fort-lauderdale" });
  const pageKey = floridaBrowseRequestKey({ county: c, trade: t, browse: b, pathCitySlug: "fort-lauderdale" });
  assert.equal(metaKey, pageKey);
  // Different page, sort, filter or place never share a read.
  for (const other of [
    { county: c, trade: t, browse: { ...b, page: 2 }, pathCitySlug: "fort-lauderdale" },
    { county: c, trade: t, browse: { ...b, sort: "longest" as const }, pathCitySlug: "fort-lauderdale" },
    { county: c, trade: t, browse: { ...b, status: "active" as const }, pathCitySlug: "fort-lauderdale" },
    { county: c, trade: t, browse: b, pathCitySlug: "hollywood" },
    { county: c, trade: trade("general-contractors"), browse: b, pathCitySlug: "fort-lauderdale" },
    { county: county("orange"), trade: t, browse: b, pathCitySlug: "fort-lauderdale" },
  ]) {
    assert.notEqual(floridaBrowseRequestKey(other), pageKey);
  }
});

// ---------------------------------------------------------------- failures

if (mode === "unreachable") {
  const cases = [
    ["trade general-contractors", { trade: trade("general-contractors"), browse: browse() }],
    ["trade roofers", { trade: trade("roofers"), browse: browse() }],
    ["county+trade broward/roofers", { county: county("broward"), trade: trade("roofers"), browse: browse() }],
    ["county+trade miami-dade/general-contractors", { county: county("miami-dade"), trade: trade("general-contractors"), browse: browse() }],
    ["city+trade broward/fort-lauderdale/roofers", { county: county("broward"), trade: trade("roofers"), browse: browse(), pathCitySlug: "fort-lauderdale" }],
  ] as const;
  for (const [label, opts] of cases) {
    test(`connection failure (${label}) rejects, never an empty directory`, async () => {
      await rejectsUnavailable(() => listFloridaBrowse(opts));
      await rejectsUnavailable(() => listFloridaBrowseOnce(opts));
    });
  }
}

if (mode === "slow") {
  test("query timeout (8 s statement_timeout) rejects for trade and county/trade", { timeout: 60_000 }, async () => {
    await rejectsUnavailable(() => listFloridaBrowse({ trade: trade("roofers"), browse: browse() }), /statement timeout/);
    await rejectsUnavailable(
      () => listFloridaBrowse({ county: county("broward"), trade: trade("roofers"), browse: browse() }),
      /statement timeout/
    );
  });
}

if (mode === "sqlerr") {
  test("SQL error rejects, never an empty directory", async () => {
    await rejectsUnavailable(() => listFloridaBrowse({ county: county("broward"), trade: trade("roofers"), browse: browse() }));
  });
}

// ---------------------------------------------------------------- success / empty

if (mode === "slowok") {
  test("slow read inside the budget (2 s) succeeds with results", { timeout: 30_000 }, async () => {
    const t0 = Date.now();
    const r = await listFloridaBrowse({ county: county("broward"), trade: trade("roofers"), browse: browse() });
    assert.ok(Date.now() - t0 >= 1_900, "the override really slowed the read");
    assert.ok(r.total > 0);
    assert.equal(r.results.length, r.total);
  });
}

if (mode === "empty") {
  test("real zero rows resolve to total 0 (distinguishable from failure)", async () => {
    for (const opts of [
      { trade: trade("roofers"), browse: browse() },
      { county: county("broward"), trade: trade("roofers"), browse: browse() },
      { county: county("broward"), trade: trade("roofers"), browse: browse(), pathCitySlug: "fort-lauderdale" },
    ]) {
      const r = await listFloridaBrowse(opts);
      assert.equal(r.total, 0);
      assert.deepEqual(r.results, []);
      assert.deepEqual(r.stats, { firms: 0, activeFirms: 0, entityLinked: 0, withDiscipline: 0 });
    }
  });
}

if (mode === "ok") {
  const independentFirms = async (codes: string[], countyName?: string) => {
    const params: unknown[] = [codes];
    let extra = "";
    if (countyName) {
      params.push(countyName.toLowerCase());
      extra = "AND (lower(trim(l.county_name)) = $2 OR lower(trim(c.primary_county)) = $2)";
    }
    const rows = await query<{ n: string }>(
      `SELECT COUNT(DISTINCT COALESCE(ent.entity_id::text, 'solo:' || c.id::text))::text AS n
       FROM licenses l JOIN contractors c ON c.id = l.contractor_id
       LEFT JOIN LATERAL (
         SELECT ce.entity_id FROM contractor_entities ce JOIN entities e ON e.id = ce.entity_id
         WHERE ce.contractor_id = c.id AND ce.role = 'sunbiz_entity' AND e.source_system = 'fl_sunbiz'
           AND ce.confidence >= 0.9 ORDER BY ce.confidence DESC LIMIT 1) ent ON TRUE
       WHERE l.source_system = 'fl_dbpr' AND NOT c.is_thin_profile
         AND (c.home_state = 'FL' OR l.state = 'FL')
         AND upper(l.occupation_code) = ANY($1::text[]) ${extra}`,
      params
    );
    return Number(rows[0].n);
  };

  test("success: GC and roofers totals match an independent UPPER()-based count", async () => {
    for (const slug of ["general-contractors", "roofers"]) {
      const t = trade(slug);
      const r = await listFloridaBrowse({ trade: t, browse: browse() });
      assert.equal(r.total, await independentFirms(t.occupationCodes), slug);
      assert.equal(r.results.length, Math.min(DISCOVERY_PAGE_SIZE, r.total));
      for (const x of r.results) assert.ok(t.occupationCodes.includes(x.occupationCode || ""), "trade matching");
    }
    const c = county("broward");
    const t = trade("roofers");
    const r = await listFloridaBrowse({ county: c, trade: t, browse: browse() });
    assert.ok(r.total > 0);
    assert.ok(r.total <= (await independentFirms(t.occupationCodes)));
  });

  test("real zero rows: roofers with discipline=present resolves to total 0", async () => {
    const r = await listFloridaBrowse({ trade: trade("roofers"), browse: browse({ discipline: "present" }) });
    assert.equal(r.total, 0);
    assert.deepEqual(r.results, []);
  });

  test("page past the end: results empty, total kept (not a false 'No matches' count)", async () => {
    const r = await listFloridaBrowse({ county: county("broward"), trade: trade("roofers"), browse: browse({ page: "9999" }) });
    assert.ok(r.total > 0);
    assert.deepEqual(r.results, []);
  });

  for (const sort of ["name", "longest", "updated", "entity"]) {
    test(`no duplicate or missing firm across every page (broward/roofers, sort=${sort})`, { timeout: 300_000 }, async () => {
      const first = await listFloridaBrowse({ county: county("broward"), trade: trade("roofers"), browse: browse({ sort }) });
      const pages = Math.ceil(first.total / DISCOVERY_PAGE_SIZE);
      const seen = new Set<string>();
      let prevName: string | null = null;
      for (let p = 1; p <= pages; p++) {
        const r = p === 1 ? first : await listFloridaBrowse({ county: county("broward"), trade: trade("roofers"), browse: browse({ sort, page: String(p) }) });
        assert.equal(r.total, first.total, "total stable across pages");
        for (const x of r.results) {
          const key = `${x.slug}|${x.primaryLicenseKey}`;
          assert.ok(!seen.has(key), `duplicate ${key} on page ${p}`);
          seen.add(key);
          if (sort === "name") {
            if (prevName !== null) assert.ok(prevName <= x.displayName || x.relatedProfiles, "name order");
            prevName = x.displayName;
          }
        }
      }
      assert.equal(seen.size, first.total, "every firm appears exactly once");
    });
  }
}
