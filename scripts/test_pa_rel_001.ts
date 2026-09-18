import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PA_STATE_PUBLIC_FINGERPRINT, PA_STATE_INTEL_VERSION } from "../lib/pennsylvania-intelligence/publication";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

test("PA-REL-001 mixed-case statewide paths normalize to lowercase", () => {
  assert.equal(normalizedPublishedStatePath("/Pennsylvania"), "/pennsylvania");
  assert.equal(normalizedPublishedStatePath("/PENNSYLVANIA"), "/pennsylvania");
  assert.equal(normalizedPublishedStatePath("/PeNnSyLvAnIa"), "/pennsylvania");
  assert.equal(normalizedPublishedStatePath("/pennsylvania"), null);
  assert.equal(normalizedPublishedStatePath("/Pennsylvania/philadelphia"), null);
  assert.equal(normalizedPublishedStatePath("/contractors/Some-Slug"), null);
});

test("PA-REL-001 proxy issues 308 and preserves query", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /normalizedPublishedStatePath/);
  assert.match(proxy, /308/);
  assert.match(proxy, /url\.pathname = nextPath/);
});

test("PA-REL-001 footer and sitemap publish lowercase /pennsylvania", () => {
  const footer = read("components/layout/SiteFooter.tsx");
  assert.match(footer, /href: "\/pennsylvania"/);
  assert.doesNotMatch(footer, /href: "\/Pennsylvania"/);
  const sitemap = read("lib/seo/sitemap-data.ts");
  const hits = [...sitemap.matchAll(/"\/pennsylvania"/g)];
  assert.equal(hits.length, 1);
  assert.doesNotMatch(sitemap, /"\/Pennsylvania"/);
});

test("PA-REL-001 Pennsylvania fingerprint and snapshot version stay locked", () => {
  assert.equal(PA_STATE_INTEL_VERSION, "contractor-pa-state-intel-v1");
  assert.equal(
    PA_STATE_PUBLIC_FINGERPRINT,
    "ad8e95e11e486c9c124b7da270d6fa38808fa4ab0be5d2008167283728324e9a",
  );
});
