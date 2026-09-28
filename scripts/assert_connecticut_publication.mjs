import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const data = JSON.parse(read("lib/connecticut-intelligence/snapshot.json"));
const page = read("app/connecticut/page.tsx");
const ask = read("lib/ask/connecticut.ts");
const sitemap = read("lib/seo/sitemap-data.ts");
const paths = read("lib/seo/published-state-path.ts");
const builder = read("scripts/build_connecticut_snapshot.mjs");

assert.equal(data.source.datasetId, "ngch-56tr");
assert.equal(data.decisionSource.datasetId, "2twc-xaxs");
assert.equal(data.decisionSource.windowStart, "2022-01-01");
assert.equal(data.decisionSource.windowEnd, "2026-09-28");
assert.equal(data.core.length, 28026);
assert.equal(new Set(data.core.map((r) => r.number)).size, data.core.length);
assert.equal(data.decisions.length, 107);
assert.equal(data.decisions.filter((r) => r.exactCredentialMatch).length, 107);
assert.equal(new Set(data.decisions.map((r) => r.credentialNumber)).size, 50);
assert.equal(data.decisions.filter((r) => r.matchedHolderType === "INDIVIDUAL").length, 69);
assert.equal(data.decisions.filter((r) => r.matchedHolderType !== "INDIVIDUAL").length, 38);
const active = (name) => data.grouped.filter((r) => r.class === name && r.status === "ACTIVE").reduce((n, r) => n + r.rows, 0);
assert.equal(active("HOME IMPROVEMENT CONTRACTOR"), 23684);
assert.equal(active("NEW HOME CONSTRUCTION CONTRACTOR"), 2964);
assert.equal(active("HOME IMPROVEMENT SALESPERSON"), 3395);
for (const row of data.core) {
  assert.match(row.number, /^(?:HIC|NHC)\.\d{5,8}(?:\.[A-Z0-9]+)?$/);
  assert.equal(row.activeFlag, true);
  assert.equal("address" in row, false);
  assert.equal("phone" in row, false);
  if (row.holderType === "INDIVIDUAL") {
    assert.equal(row.businessName, null);
    assert.equal(row.city, null);
  }
}
for (const row of data.decisions) {
  assert.match(row.decisionDate, /^20\d\d-\d\d-\d\d$/);
  assert.ok(row.caseNumber && row.credentialNumber && row.decisionUrl);
  assert.equal(row.exactCredentialMatch, true);
}
assert.deepEqual(data.limits, {
  graphWrites: 0, newCanonicalCompanies: 0, nameOnlyAdverseJoins: 0, claimEligibilityBroadened: false,
  providerComplaintRows: null, guarantyProviderRows: null, decisionCorpusIsCensus: false,
});
assert.match(builder, /fullcredentialcode in\(/);
assert.match(page, /NOT_ACQUIRED/);
assert.match(page, /status === "ACTIVE"/);
assert.match(page, /exactCredentialMatch/);
assert.match(ask, /const FULL_NUMBER/);
assert.match(ask, /bare number is ambiguous/i);
assert.equal((sitemap.match(/path: "\/connecticut"/g) ?? []).length, 1);
assert.match(paths, /"connecticut"/);
assert.doesNotMatch(page, /AggregateRating|ratingValue|Trust Score|best contractors|top-rated|recommended contractors/i);
console.log("Connecticut credential grain, privacy, exact enforcement links, Ask, sitemap, and ranking safety: PASS");
