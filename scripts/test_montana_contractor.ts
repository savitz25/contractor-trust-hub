import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

const page = readFileSync("app/montana/page.tsx", "utf8");
const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");

test("Montana contractor route is published as a statewide page", () => {
  assert.equal(normalizedPublishedStatePath("/Montana"), "/montana");
  assert.equal(normalizedPublishedStatePath("/montana/billings"), null);
  assert.match(page, /path:\s*"\/montana"/);
  assert.match(sitemap, /path:\s*"\/montana"/);
});

test("Montana contractor page preserves source populations and limits", () => {
  assert.match(page, /January 1, 2026/);
  assert.match(page, /HTTP 403/);
  assert.match(page, /NOT_ACQUIRED/);
  assert.match(page, /ICEC/);
  assert.match(page, /Exemptions/);
  assert.match(page, /Electrical contractor credentials are a separate population/);
  assert.match(page, /Plumbing credentials are administered in separate license classes/);
  assert.match(page, /not used as a license census/);
  assert.doesNotMatch(page, /AggregateRating|Trust Score|StateCountyLinks/);
});
