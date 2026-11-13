/**
 * FL-DIR-PERF-001 regression guard: a failed Florida directory read must never
 * look like an empty directory.
 *
 * Before the fix, listFloridaBrowse caught every DB error (8 s statement
 * timeout, pool connect timeout, SQL error) and returned
 * { results: [], total: 0 }. The page then rendered "No matches for <trade>"
 * with HTTP 200 and index/follow robots.
 *
 * Default mode (CI, no DB): DATABASE_URL points at a closed local port, so
 * every query fails fast. listFloridaBrowse must reject with
 * FloridaDirectoryUnavailableError instead of resolving to an empty result.
 *
 * Optional modes against a disposable local Postgres seeded with
 * scripts/fl_dir_perf_001/synthetic_schema.sql:
 *   FL_DIR_PERF_DB=ok   DATABASE_URL=... -> real data renders; a real zero-row
 *                                           trade resolves to total 0 (no throw)
 *   FL_DIR_PERF_DB=slow DATABASE_URL=... -> (also slow_override.sql) the 8 s
 *                                           statement timeout rejects, never empty
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  listFloridaBrowse,
  FloridaDirectoryUnavailableError,
  isFloridaDirectoryUnavailableError,
} from "../lib/discovery/florida-list";
import { getDiscoveryState, getTrade, getCounty } from "../lib/discovery/config";
import { parseBrowseParams } from "../lib/discovery/browse";

const mode = process.env.FL_DIR_PERF_DB || "unreachable";
if (mode === "unreachable") {
  // lib/db reads DATABASE_URL lazily on the first query, so this is in time.
  // Closed port on loopback: ECONNREFUSED immediately; never a real database.
  process.env.DATABASE_URL = "postgres://fl_dir_perf_test@127.0.0.1:9/postgres_unreachable";
}

const state = getDiscoveryState("florida");
assert.ok(state, "florida discovery state exists");
const browse = parseBrowseParams({});
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

test("source: the listFloridaBrowse catch throws and never returns the empty result", () => {
  const src = readFileSync("lib/discovery/florida-list.ts", "utf8");
  const start = src.indexOf("export async function listFloridaBrowse(");
  const end = src.indexOf("export async function listFloridaCities(");
  assert.ok(start > 0 && end > start);
  const body = src.slice(start, end);
  const catchBlock = body.slice(body.lastIndexOf("} catch (err) {"));
  assert.match(catchBlock, /throw new FloridaDirectoryUnavailableError\(/);
  assert.doesNotMatch(catchBlock, /return\s+empty/);
});

test("source: city+trade metadata keeps a failed read out of the index", () => {
  const src = readFileSync("app/florida/[segment]/[facet]/[trade]/page.tsx", "utf8");
  const meta = src.slice(src.indexOf("export async function generateMetadata"), src.indexOf("export default"));
  assert.match(meta, /catch \(err\) \{\s*if \(!isFloridaDirectoryUnavailableError\(err\)\) throw err;/);
  assert.match(meta, /thin = true;/);
  assert.match(meta, /noIndex: thin \|\|/);
});

if (mode === "unreachable") {
  for (const [label, opts] of [
    ["trade general-contractors", { trade: trade("general-contractors") }],
    ["trade roofers", { trade: trade("roofers") }],
    ["county broward", { county: county("broward") }],
    ["county+trade broward/roofers", { county: county("broward"), trade: trade("roofers") }],
  ] as const) {
    test(`DB failure (${label}) rejects with FloridaDirectoryUnavailableError, not an empty directory`, async () => {
      await assert.rejects(
        () => listFloridaBrowse({ ...opts, browse }),
        (err: unknown) => {
          assert.ok(err instanceof FloridaDirectoryUnavailableError);
          assert.ok(isFloridaDirectoryUnavailableError(err));
          assert.equal((err as FloridaDirectoryUnavailableError).op, "listFloridaBrowse");
          assert.ok((err as Error).cause, "keeps the underlying DB error as cause");
          return true;
        }
      );
    });
  }
}

if (mode === "ok") {
  test("real data: roofers resolves with results", async () => {
    const r = await listFloridaBrowse({ trade: trade("roofers"), browse });
    assert.ok(r.total > 0);
    assert.equal(r.results.length, r.total);
  });
  test("real zero rows: underground-utility resolves to total 0 without throwing", async () => {
    const r = await listFloridaBrowse({ trade: trade("underground-utility"), browse });
    assert.equal(r.total, 0);
    assert.deepEqual(r.results, []);
    assert.equal(r.stats.firms, 0);
  });
}

if (mode === "slow") {
  test("statement timeout (8 s) rejects with FloridaDirectoryUnavailableError", { timeout: 30_000 }, async () => {
    await assert.rejects(
      () => listFloridaBrowse({ trade: trade("roofers"), browse }),
      (err: unknown) => {
        assert.ok(err instanceof FloridaDirectoryUnavailableError);
        assert.match(String((err as Error).cause), /statement timeout/);
        return true;
      }
    );
  });
}
