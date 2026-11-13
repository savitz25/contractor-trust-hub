/**
 * FL-SEO-SERVER-RENDER-001 regression guard.
 *
 * /florida and the Florida county research pages must put their primary
 * research (H1, intro, county figures, sources, internal links) in the
 * initial server HTML. A route-level loading.tsx or a page-level <Suspense>
 * around the research body makes Next.js flush a "Loading…" placeholder as
 * the only visible <main> and stream the real content into hidden chunks that
 * need browser JavaScript to swap in. These checks fail if that comes back.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (p: string) => readFileSync(p, "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const STREAMING_BOUNDARY_FILES = [
  "app/loading.tsx",
  "app/florida/loading.tsx",
  "app/florida/[segment]/loading.tsx",
];

const ROUTE_FILES = ["app/florida/page.tsx", "app/florida/[segment]/page.tsx"];

const SERVER_RESEARCH_COMPONENTS = [
  "components/intelligence/FloridaStateIntelligence.tsx",
  "components/intelligence/CountyIntelligence.tsx",
];

test("no route-level loading.tsx wraps /florida or Florida county pages", () => {
  for (const f of STREAMING_BOUNDARY_FILES) {
    assert.equal(existsSync(f), false, `${f} must not exist (it streams a loading placeholder)`);
  }
});

test("Florida route files render research without a client-only boundary", () => {
  for (const f of ROUTE_FILES) {
    const src = stripComments(read(f));
    assert.ok(!/\bSuspense\b/.test(src), `${f}: no <Suspense> around primary research`);
    assert.ok(!/Loading Florida research/.test(src), `${f}: no loading placeholder copy`);
    assert.ok(!/ssr\s*:\s*false/.test(src), `${f}: no dynamic(..., { ssr: false })`);
    assert.ok(!/^\s*["']use client["']/m.test(src), `${f}: route must stay a server component`);
  }
  const state = read("app/florida/page.tsx");
  assert.match(state, /await getFloridaIntelligenceSnapshot\(\)/, "/florida awaits the snapshot on the server");
  assert.match(state, /<FloridaStateIntelligence payload=\{payload\} \/>/);
  const county = read("app/florida/[segment]/page.tsx");
  assert.match(county, /getFloridaCountyIntelligenceSnapshot\(county\.slug\)/);
  assert.match(county, /<CountyIntelligence payload=\{intelPayload\} \/>/);
});

test("primary research components are server components with no client fetch", () => {
  for (const f of SERVER_RESEARCH_COMPONENTS) {
    const src = stripComments(read(f));
    assert.ok(!/^\s*["']use client["']/m.test(src), `${f}: must stay a server component`);
    assert.ok(!/\bSuspense\b/.test(src), `${f}: no Suspense boundary`);
    assert.ok(!/\buseEffect\b|\bfetch\(/.test(src), `${f}: no client-side data fetching`);
  }
});

test("snapshots stay bounded (cache + timeout) so SSR cannot hang", () => {
  const fl = read("lib/intelligence/florida-snapshot.ts");
  assert.match(fl, /unstable_cache\(/);
  assert.match(fl, /withTimeout\(getCached\(\), TIMEOUT_MS\)/);
  assert.match(fl, /emptyFloridaIntelligencePayload/);
  const co = read("lib/intelligence/county-snapshot.ts");
  assert.match(co, /unstable_cache\(/);
  assert.match(co, /county-intel-timeout/);
  assert.match(co, /emptyTimedOut\(countySlug\)/);
});
