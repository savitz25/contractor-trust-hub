import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const data = JSON.parse(read("lib/michigan-intelligence/discipline.json"));
const page = read("app/michigan/page.tsx");
const ask = read("lib/ask/michigan.ts");
const sitemap = read("lib/seo/sitemap-data.ts");
const paths = read("lib/seo/published-state-path.ts");

assert.equal(data.rows.length, 192);
assert.deepEqual(Object.fromEntries(data.sources.map((s) => [s.report, data.rows.filter((r) => r.report === s.report).length])), { FY26: 3, FY25: 49, FY24: 60, FY23: 52, FY22: 28 });
assert.equal(new Set(data.sources.map((s) => s.report)).size, 5);
for (const row of data.rows) {
  assert.match(row.licenseNumber, /^\d{7,12}$/);
  assert.match(row.effectiveDate, /^20\d\d-\d\d-\d\d$/);
  assert.equal(row.licenseGrain, "unresolved");
  assert.ok(row.actions.length);
  assert.ok(data.sources.some((s) => s.report === row.report && row.page >= 1 && row.page <= s.pages));
  assert.equal("respondentAsPrinted" in row, false);
}
assert.match(page, /NOT_ACQUIRED/);
assert.match(page, /No canonical company was created or matched/);
assert.match(page, /No matching row in this extracted report window/);
assert.match(ask, /licenseNumber === number/);
assert.equal((sitemap.match(/path: "\/michigan"/g) ?? []).length, 1);
assert.match(paths, /"michigan"/);
assert.doesNotMatch(page, /AggregateRating|Trust Score|best contractors|top-rated|recommended contractors/i);
console.log("Michigan publication, grain/privacy, enforcement, exact identifiers, sitemap, and ranking safety: PASS");
