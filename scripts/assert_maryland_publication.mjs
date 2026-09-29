import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const data = JSON.parse(read("lib/maryland-intelligence/discipline.json"));
const page = read("app/maryland/page.tsx");
const ask = read("lib/ask/maryland.ts");
const sitemap = read("lib/seo/sitemap-data.ts");
const paths = read("lib/seo/published-state-path.ts");

assert.deepEqual(data.sources.map((source) => source.fiscalYear), [2022, 2023, 2024, 2025]);
assert.equal(data.rows.length, data.sources.reduce((n, source) => n + source.rows, 0));
assert.ok(data.rows.length > 500);
assert.ok(data.rows.some((row) => row.decree === "Proposed Order"));
assert.ok(data.rows.some((row) => row.decree === "Final Order"));
assert.ok(data.rows.some((row) => row.decree.includes("/Final Order")));
assert.ok(data.rows.some((row) => row.guarantyFundAwardDollars !== null));
for (const row of data.rows) {
  assert.match(row.date, /^20\d\d-\d\d-\d\d$/);
  assert.ok(row.complaintNumber && row.decree && row.actionSummary && row.caseName && row.sourcePage);
  assert.equal(row.licenseNumber, null);
  if (row.guarantyFundAwardDollars !== null) {
    assert.match(row.actionSummary, /Guaranty Fund Award/i);
    assert.ok(row.guarantyFundAwardDollars > 0);
  }
}
assert.deepEqual(data.limits, { contractorRoster: "NOT_ACQUIRED", salespersonRoster: "NOT_ACQUIRED", exactEnforcementAttachments: 0, exactGuarantyAttachments: 0, nameOnlyAdverseJoins: 0, newCanonicalCompanies: 0, graphWrites: 0, claimEligibilityChanges: 0 });
assert.match(page, /path: "\/maryland"/);
assert.match(page, /salesperson is a person credential/);
assert.match(page, /A Guaranty Fund award is a compensation order, not a license revocation/);
assert.match(page, /Closed complaint history is available by request/);
assert.match(page, /Open complaints are not publicly reportable/);
assert.match(page, /NOT_ACQUIRED/);
assert.equal((sitemap.match(/path: "\/maryland"/g) ?? []).length, 1);
assert.match(paths, /"maryland"/);
assert.match(ask, /A bare number is ambiguous/);
assert.doesNotMatch(page + ask, /AggregateRating|ratingValue|Trust Score|best contractors|top-rated|recommended contractors/i);
console.log("Maryland publication, grains, decrees, Fund semantics, routing, identifiers and ranking safety: PASS");
