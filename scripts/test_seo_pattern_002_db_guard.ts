/**
 * SEO-PATTERN-002 B1 guard: a failed or partial AZ/OR/WA directory read must
 * never render as a valid empty license list.
 *
 * Before the guard, listDiscoveryContractors, countByTrade and
 * countCountiesForTrade caught every DB error (8 s statement timeout, 8 s pool
 * connect timeout, SQL error) and returned { results: [], total: 0 } / [].
 * /arizona|oregon|washington/[segment] then rendered "No active ... licenses
 * found for <place>", "0 active contractors" or "No categories with records
 * yet." with HTTP 200 and index/follow robots. With CONTRACTOR-SEO-PATTERN-002
 * removing [segment]/loading.tsx, that text is in the initial HTML of ~127
 * sitemap pages.
 *
 * The segment pages now opt in with `strict`: a failed read throws
 * DiscoveryDirectoryUnavailableError, the page render fails and Next answers
 * a non-200 noindex error (same pattern as FL-DIR-PERF-001). Non-strict
 * callers (Florida, facet and project pages) keep the old behavior.
 *
 * Default mode (CI, no DB): DATABASE_URL points at a closed loopback port, so
 * every query fails fast.
 *
 * Optional mode against the disposable local fixture
 * scripts/seo_pattern_002_guard/synthetic_schema.sql (loopback only):
 *   SEO002_GUARD_DB=fixture DATABASE_URL=postgres://...@127.0.0.1:<port>/<db>
 * runs ok / true-zero / slow (real 8 s statement timeout) / partial-list /
 * partial-facets / partial-oos, switching seo002_fixture_mode between tests.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

import {
  buildFilterClause,
  countByTrade,
  countCountiesForTrade,
  DiscoveryDirectoryUnavailableError,
  isDiscoveryDirectoryUnavailableError,
  listDiscoveryContractors,
} from "../lib/discovery/queries";
import { getCounty, getDiscoveryState, getTrade } from "../lib/discovery/config";
import { getStateBySlug } from "../lib/states/config";

const mode = process.env.SEO002_GUARD_DB || "unreachable";
if (mode === "unreachable") {
  // lib/db reads DATABASE_URL lazily on the first query, so this is in time.
  // Closed port on loopback: ECONNREFUSED immediately; never a real database.
  process.env.DATABASE_URL = "postgres://seo002_guard_test@127.0.0.1:9/postgres_unreachable";
}
if (mode === "fixture") {
  const url = process.env.DATABASE_URL || "";
  assert.match(url, /@(127\.0\.0\.1|localhost):\d+\//, "fixture mode runs only against a loopback database");
}

const disc = (s: string) => {
  const d = getDiscoveryState(s);
  assert.ok(d, `discovery state ${s}`);
  return d;
};
const geo = (s: string, slug: string) => {
  const c = getCounty(disc(s), slug);
  assert.ok(c, `${s} geo ${slug}`);
  return c;
};
const trade = (s: string, slug: string) => {
  const t = getTrade(disc(s), slug);
  assert.ok(t, `${s} trade ${slug}`);
  return t;
};

const isUnavailable = (op: string) => (err: unknown) => {
  assert.ok(err instanceof DiscoveryDirectoryUnavailableError, String(err));
  assert.ok(isDiscoveryDirectoryUnavailableError(err));
  assert.equal((err as DiscoveryDirectoryUnavailableError).op, op);
  assert.ok((err as Error).cause, "keeps the underlying DB error as cause");
  return true;
};

// One county/city and one trade segment per state, as the segment pages call them.
const SEGMENTS = [
  { state: "arizona", county: "maricopa", trade: "roofing" }, // city-list geo
  { state: "oregon", county: "multnomah", trade: "residential-general" }, // county-name geo
  { state: "washington", county: "king", trade: "electrical" }, // ZIP geo + out-of-state facet
] as const;

// ---------------------------------------------------------------- source guards
const SEGMENT_PAGES = ["arizona", "oregon", "washington"].map((s) => `app/${s}/[segment]/page.tsx`);

for (const file of SEGMENT_PAGES) {
  test(`source: ${file} reads the directory strictly (listing + facets)`, () => {
    const src = readFileSync(file, "utf8");
    const listCalls = src.split("listDiscoveryContractors({").length - 1;
    assert.equal(listCalls, 2, "county and trade branches");
    const strictLists = src.match(/listDiscoveryContractors\(\{[^}]*strict: true,[^}]*\}\)/g) || [];
    assert.equal(strictLists.length, 2, "both listings pass strict: true");
    assert.match(src, /countByTrade\(PUBLIC, \w+, \{ strict: true \}\)/);
    assert.match(src, /countCountiesForTrade\(PUBLIC, trade, \{ strict: true \}\)/);
    // The page must not swallow the error into an empty render.
    assert.doesNotMatch(src, /DiscoveryDirectoryUnavailableError/);
    assert.doesNotMatch(src, /catch\s*[({]/);
    // CONTRACTOR-SEO-PATTERN-002: no segment loading boundary may come back
    // (it would flush a 200 shell before the error).
    assert.equal(existsSync(file.replace("page.tsx", "loading.tsx")), false);
  });
}

test("source: strict catches in lib/discovery/queries.ts throw, never return empty", () => {
  const src = readFileSync("lib/discovery/queries.ts", "utf8");
  for (const fn of ["listDiscoveryContractors", "countByTrade", "countCountiesForTrade"]) {
    const start = src.indexOf(`export async function ${fn}(`);
    const next = src.indexOf("\nexport ", start + 10);
    const body = src.slice(start, next);
    const strictLines = body.split("\n").filter((l) => /strict\)/.test(l) && /throw/.test(l));
    assert.ok(strictLines.length >= 1, `${fn} has a strict throw`);
  }
  // FL-DIR-PERF-001 stays intact (merged in via main).
  const fl = readFileSync("lib/discovery/florida-list.ts", "utf8");
  assert.match(fl, /throw new FloridaDirectoryUnavailableError\("listFloridaBrowse", err\)/);
});

test("Oregon (requireInStateAddress: false) still references the bound $2 with a type", () => {
  // Without this every Oregon directory read failed in Postgres with
  // "could not determine data type of parameter $2" (Production logs), and the
  // old empty fallback rendered it as "No active CCB licenses found".
  const d = disc("oregon");
  assert.equal(d.requireInStateAddress, false);
  const st = getStateBySlug(d.evidenceSlug);
  assert.ok(st);
  for (const extra of [{ county: geo("oregon", "multnomah") }, { occupationCodes: ["RGC"] }, {}]) {
    const { where, params } = buildFilterClause({
      licenseSource: st.licenseSource,
      stateCode: st.code,
      activeOnly: true,
      requireInStateAddress: false,
      ...extra,
    });
    assert.equal(params[1], "OR");
    assert.match(where, /\$2::text IS NOT NULL/);
  }
  const src = readFileSync("lib/discovery/queries.ts", "utf8");
  assert.match(src, /requireInState === false \? STATE_PARAM_TYPED_SQL :/);
  // States that require an in-state address keep the original predicate.
  const az = buildFilterClause({ licenseSource: "az_roc", stateCode: "AZ" });
  assert.match(az.where, /\(c\.home_state = \$2 OR l\.state = \$2\)/);
  assert.doesNotMatch(az.where, /\$2::text IS NOT NULL/);
});

// ------------------------------------------------------------ unreachable DB
if (mode === "unreachable") {
  for (const s of SEGMENTS) {
    test(`DB failure: ${s.state}/${s.county} strict listing rejects, not an empty directory`, async () => {
      await assert.rejects(
        () => listDiscoveryContractors({ publicStateSlug: s.state, county: geo(s.state, s.county), strict: true }),
        isUnavailable("listDiscoveryContractors")
      );
    });
    test(`DB failure: ${s.state}/${s.trade} strict listing rejects, not an empty directory`, async () => {
      await assert.rejects(
        () => listDiscoveryContractors({ publicStateSlug: s.state, trade: trade(s.state, s.trade), strict: true }),
        isUnavailable("listDiscoveryContractors")
      );
    });
    test(`DB failure: ${s.state}/${s.county} strict trade facets reject, not "No categories"`, async () => {
      await assert.rejects(
        () => countByTrade(s.state, geo(s.state, s.county), { strict: true }),
        isUnavailable("countByTrade")
      );
    });
    test(`DB failure: ${s.state}/${s.trade} strict county facets reject`, async () => {
      await assert.rejects(
        () => countCountiesForTrade(s.state, trade(s.state, s.trade), { strict: true }),
        isUnavailable("countCountiesForTrade")
      );
    });
    test(`DB failure: ${s.state} non-strict callers keep the old empty fallback (unchanged)`, async () => {
      assert.deepEqual(
        await listDiscoveryContractors({ publicStateSlug: s.state, county: geo(s.state, s.county) }),
        { results: [], total: 0 }
      );
      assert.deepEqual(await countByTrade(s.state, geo(s.state, s.county)), []);
      assert.deepEqual(await countCountiesForTrade(s.state, trade(s.state, s.trade)), []);
    });
  }
}

// ------------------------------------------------------- disposable fixture DB
if (mode === "fixture") {
  const setMode = async (m: string) => {
    const { query } = await import("../lib/db");
    await query("UPDATE seo002_fixture_mode SET mode = $1", [m]);
  };

  test("ok: real rows render; strict reads resolve", async () => {
    await setMode("ok");
    for (const s of SEGMENTS) {
      const byGeo = await listDiscoveryContractors({ publicStateSlug: s.state, county: geo(s.state, s.county), strict: true });
      assert.ok(byGeo.total >= 1, `${s.state}/${s.county} total`);
      assert.equal(byGeo.results.length, byGeo.total);
      const byTrade = await listDiscoveryContractors({ publicStateSlug: s.state, trade: trade(s.state, s.trade), strict: true });
      assert.ok(byTrade.total >= 1, `${s.state}/${s.trade} total`);
      assert.ok((await countByTrade(s.state, geo(s.state, s.county), { strict: true })).length >= 1);
      assert.ok((await countCountiesForTrade(s.state, trade(s.state, s.trade), { strict: true })).length >= 1);
    }
    const wa = await countCountiesForTrade("washington", trade("washington", "electrical"), { strict: true });
    assert.ok(wa.some((f) => f.slug === "out-of-state"), "WA out-of-state facet present");
  });

  test("true zero: strict reads resolve to total 0 / [] without throwing", async () => {
    await setMode("ok");
    for (const [s, g] of [["arizona", "greenlee"], ["oregon", "wheeler"], ["washington", "yakima"]] as const) {
      const r = await listDiscoveryContractors({ publicStateSlug: s, county: geo(s, g), strict: true });
      assert.deepEqual(r, { results: [], total: 0 });
      assert.deepEqual(await countByTrade(s, geo(s, g), { strict: true }), []);
    }
    const pool = await listDiscoveryContractors({ publicStateSlug: "arizona", trade: trade("arizona", "pool"), strict: true });
    assert.deepEqual(pool, { results: [], total: 0 });
    assert.deepEqual(await countCountiesForTrade("arizona", trade("arizona", "pool"), { strict: true }), []);
  });

  test("timeout: the real 8 s statement timeout rejects strict reads", { timeout: 60_000 }, async () => {
    await setMode("slow");
    try {
      await assert.rejects(
        () => listDiscoveryContractors({ publicStateSlug: "washington", county: geo("washington", "king"), strict: true }),
        (err: unknown) => {
          isUnavailable("listDiscoveryContractors")(err);
          assert.match(String((err as Error).cause), /statement timeout/);
          return true;
        }
      );
      await assert.rejects(
        () => countByTrade("arizona", geo("arizona", "maricopa"), { strict: true }),
        (err: unknown) => {
          isUnavailable("countByTrade")(err);
          assert.match(String((err as Error).cause), /statement timeout/);
          return true;
        }
      );
    } finally {
      await setMode("ok");
    }
  });

  test("partial: count succeeds, row query fails -> strict rejects (old code showed an empty list)", async () => {
    await setMode("partial-list");
    try {
      for (const s of SEGMENTS) {
        await assert.rejects(
          () => listDiscoveryContractors({ publicStateSlug: s.state, county: geo(s.state, s.county), strict: true }),
          isUnavailable("listDiscoveryContractors")
        );
      }
      // Documents the defect the guard closes: the non-strict path still collapses to empty.
      assert.deepEqual(
        await listDiscoveryContractors({ publicStateSlug: "arizona", county: geo("arizona", "maricopa") }),
        { results: [], total: 0 }
      );
    } finally {
      await setMode("ok");
    }
  });

  test("partial: listing ok, facet read fails -> strict facets reject", async () => {
    await setMode("partial-facets");
    try {
      for (const s of SEGMENTS) {
        const r = await listDiscoveryContractors({ publicStateSlug: s.state, county: geo(s.state, s.county), strict: true });
        assert.ok(r.total >= 1, "listing itself still answers");
        await assert.rejects(() => countByTrade(s.state, geo(s.state, s.county), { strict: true }), isUnavailable("countByTrade"));
        await assert.rejects(
          () => countCountiesForTrade(s.state, trade(s.state, s.trade), { strict: true }),
          isUnavailable("countCountiesForTrade")
        );
      }
    } finally {
      await setMode("ok");
    }
  });

  test("partial: WA out-of-state facet count fails -> strict rejects (no silently missing facet)", async () => {
    await setMode("partial-oos");
    try {
      await assert.rejects(
        () => countCountiesForTrade("washington", trade("washington", "electrical"), { strict: true }),
        isUnavailable("appendOutOfStateFacet")
      );
      const loose = await countCountiesForTrade("washington", trade("washington", "electrical"));
      assert.ok(!loose.some((f) => f.slug === "out-of-state"), "non-strict drops the facet (unchanged)");
    } finally {
      await setMode("ok");
    }
  });
}
