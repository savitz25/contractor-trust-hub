/**
 * CONTRACTOR-SEO-PATTERN-002 regression guard.
 *
 * The seven state research routes must put their primary research in the
 * initial server HTML. A sibling loading.tsx makes Next.js flush a
 * "Loading…" placeholder as the only visible <main> and stream the real
 * page into a hidden chunk that needs browser JavaScript. These checks fail
 * if that boundary comes back.
 *
 * Florida stays on the FL-SEO-SERVER-RENDER-001 fix. Nested directory
 * loading.tsx files (county, trade, project) are outside this change.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (p: string) => readFileSync(p, "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const STATE_LOADING = [
  "app/arizona/loading.tsx",
  "app/colorado/loading.tsx",
  "app/illinois/loading.tsx",
  "app/new-york/loading.tsx",
  "app/oregon/loading.tsx",
  "app/virginia/loading.tsx",
  "app/washington/loading.tsx",
];

const STATE_PAGES = [
  "app/arizona/page.tsx",
  "app/colorado/page.tsx",
  "app/illinois/page.tsx",
  "app/new-york/page.tsx",
  "app/oregon/page.tsx",
  "app/virginia/page.tsx",
  "app/washington/page.tsx",
];

const NESTED_LOADING_KEPT = [
  "app/arizona/[segment]/loading.tsx",
  "app/arizona/[segment]/[facet]/loading.tsx",
  "app/arizona/projects/[project]/loading.tsx",
  "app/oregon/[segment]/loading.tsx",
  "app/oregon/[segment]/[facet]/loading.tsx",
  "app/oregon/projects/[project]/loading.tsx",
  "app/washington/[segment]/loading.tsx",
  "app/washington/[segment]/[facet]/loading.tsx",
  "app/washington/projects/[project]/loading.tsx",
  "app/florida/[segment]/[facet]/loading.tsx",
];

test("no route-level loading.tsx wraps the seven state research pages", () => {
  for (const file of STATE_LOADING) {
    assert.equal(existsSync(file), false, `${file} must not exist (it streams a loading placeholder)`);
  }
});

test("state research pages stay server components without a client-only boundary", () => {
  for (const file of STATE_PAGES) {
    const src = stripComments(read(file));
    assert.ok(!/\bSuspense\b/.test(src), `${file}: no <Suspense> around primary research`);
    assert.ok(!/Loading (Arizona|Colorado|Illinois|New York|Oregon|Virginia|Washington)/.test(src), `${file}: no loading placeholder copy`);
    assert.ok(!/ssr\s*:\s*false/.test(src), `${file}: no dynamic(..., { ssr: false })`);
    assert.ok(!/^\s*["']use client["']/m.test(src), `${file}: route must stay a server component`);
  }
  assert.match(read("app/arizona/page.tsx"), /loadArizonaContractorView\(\)/);
  assert.match(read("app/colorado/page.tsx"), /loadColoradoContractorView\(\)/);
  assert.match(read("app/illinois/page.tsx"), /loadIllinoisContractorView\(\)/);
  assert.match(read("app/new-york/page.tsx"), /loadNewYorkContractorView\(\)/);
  assert.match(read("app/oregon/page.tsx"), /loadOregonContractorView\(\)/);
  assert.match(read("app/virginia/page.tsx"), /loadVirginiaContractorView\(\)/);
  assert.match(read("app/washington/page.tsx"), /loadWashingtonContractorView\(\)/);
});

test("nested directory loading files and the Florida research fix stay in place", () => {
  for (const file of NESTED_LOADING_KEPT) {
    assert.equal(existsSync(file), true, `${file} is outside this change`);
  }
  assert.equal(existsSync("app/florida/loading.tsx"), false);
  assert.equal(existsSync("app/florida/[segment]/loading.tsx"), false);
  const florida = stripComments(read("app/florida/page.tsx"));
  assert.match(florida, /await getFloridaIntelligenceSnapshot\(\)/);
  assert.ok(!/\bSuspense\b/.test(florida), "Florida page must stay free of Suspense");
});
