import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/rhode-island/page.tsx", "utf8");
const slugs = readFileSync("lib/seo/published-state-path.ts", "utf8");
const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");

for (const population of [
  "General Contractor Registration",
  "Commercial Roofer",
  "Home Inspector and Associate Home Inspector",
  "Underground Utility",
  "Water Filtration Contractor and Installer",
  "Well Drilling and Pump Installer",
]) {
  assert.ok(page.includes(population), `missing source-defined population: ${population}`);
}

assert.ok(page.includes("NOT_ACQUIRED"));
assert.ok(page.includes("valid for one year"));
assert.ok(page.includes("Enforcement records are a separate evidence population"));
assert.ok(page.includes("not a zero count"));
assert.ok(page.includes("/portal/public/online-reports"));
assert.ok(slugs.includes('"rhode-island"'));
assert.ok(sitemap.includes('{ path: "/rhode-island"'));
assert.doesNotMatch(page, /Trust Score|AggregateRating|Providence route/i);
assert.doesNotMatch(page, /total contractors|combined total|contractor census/i);

console.log("RI contractor publication assertions passed.");
