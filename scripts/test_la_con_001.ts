import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { LA_SNAPSHOT } from "../lib/louisiana-intelligence/snapshot";
import { interpretLouisiana } from "../lib/ask/louisiana";
import { interpretAskQuery } from "../lib/ask/interpret";
import { researchRoute } from "../lib/ask/request";
import { planContractorSearch } from "../lib/search/contractor-discovery";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

const ask = (q: string) => interpretAskQuery(q, {} as Parameters<typeof interpretAskQuery>[1]);

test("LSLBC certificate types stay separate and match the 2026-10-05 Active re-pull", () => {
  assert.equal(LA_SNAPSHOT.retrievedAt, "2026-10-05");
  assert.equal(LA_SNAPSHOT.sourceDate, "2026-10-05");
  assert.deepEqual(
    LA_SNAPSHOT.certificates.map((row) => [row.code, row.status, row.rows]),
    [
      ["CLC", "Active", 19898],
      ["RLC", "Active", 4701],
      ["HIR", "Active", 1501],
      ["MRL", "Active", 269],
    ],
  );
  assert.equal(LA_SNAPSHOT.certificates.reduce((n, row) => n + row.rows, 0), LA_SNAPSHOT.certificateRows);
  assert.equal(LA_SNAPSHOT.certificateRows, 26369);
  assert.equal(LA_SNAPSHOT.statusCounts.Active, 26369);
  assert.equal(LA_SNAPSHOT.duplicateLicenseKeys, 0);
  assert.equal(LA_SNAPSHOT.skippedRows, 0);
  assert.equal(LA_SNAPSHOT.classifications, "NOT_ACQUIRED");
  assert.equal(LA_SNAPSHOT.qualifyingParties, "NOT_ACQUIRED");
  assert.equal(LA_SNAPSHOT.plumbingBoardPersonLicenses, "NOT_ACQUIRED");
  assert.equal(LA_SNAPSHOT.expiredInactive, "NOT_IN_ACTIVE_EXPORT");
  assert.equal(LA_SNAPSHOT.exactDisciplinaryAttachments, 0);
  assert.equal(LA_SNAPSHOT.nameOnlyAdverseJoins, 0);
  assert.equal(LA_SNAPSHOT.newCanonicalCompanies, 0);
  assert.equal(LA_SNAPSHOT.graphWrites, 0);
  assert.equal(LA_SNAPSHOT.claimEligibilityChanges, 0);
});

test("Louisiana routing is statewide; cities and parishes are not pages", () => {
  for (const query of [
    "contractor Louisiana",
    "Louisiana contractor license",
    "commercial contractor Louisiana",
    "residential contractor Louisiana",
    "home improvement Louisiana",
    "mold remediation Louisiana",
    "contractor New Orleans",
    "contractor Baton Rouge",
    "contractor Shreveport",
    "contractor Lafayette",
  ]) {
    const result = ask(query);
    assert.match(result.href ?? "", /^\/louisiana/, query);
    assert.equal(result.count, null, query);
    assert.equal(result.aggregate, null, query);
  }
  assert.equal(normalizedPublishedStatePath("/Louisiana"), "/louisiana");
  assert.equal(normalizedPublishedStatePath("/louisiana/new-orleans"), null);
  assert.equal(normalizedPublishedStatePath("/louisiana/orleans-parish"), null);
  assert.equal(researchRoute("how many Louisiana contractors", planContractorSearch("how many Louisiana contractors")), "/ask");
  assert.equal(researchRoute("contractor New Orleans", planContractorSearch("contractor New Orleans")), "/ask");
});

test("census and class queries fail closed and do not add the four types", () => {
  for (const query of [
    "how many Louisiana contractors",
    "Louisiana contractor census",
    "number of Louisiana contractors",
    "count of commercial and residential contractors in Louisiana",
    "total Louisiana contractors",
    "how many contractors in New Orleans",
    "roofing contractors Louisiana",
    "electrical contractor Louisiana",
    "Louisiana contractor classifications",
    "HVAC contractor Baton Rouge",
  ]) {
    const result = ask(query);
    assert.equal(result.mode, "fail_closed", query);
    assert.equal(result.count, null, query);
    assert.equal(result.aggregate, null, query);
    assert.match(result.failMessage ?? "", /not added into one Louisiana contractors total|NOT_ACQUIRED/i, query);
    assert.doesNotMatch(result.failMessage ?? "", /26,?369/, query);
  }
  const plumbing = ask("Louisiana State Plumbing Board plumber license");
  assert.equal(plumbing.mode, "fail_closed");
  assert.match(plumbing.failMessage ?? "", /NOT_ACQUIRED/);
  assert.equal(plumbing.count, null);
  const expired = ask("expired Louisiana contractor license");
  assert.equal(expired.mode, "fail_closed");
  assert.match(expired.failMessage ?? "", /not zero/i);
});

test("exact license numbers stay identity; bare numbers and rankings do not mint a profile", () => {
  const exact = interpretLouisiana("Louisiana license 68755");
  assert.equal(exact?.interpretation.identifier, "LA-LSLBC:68755");
  assert.match(exact?.href ?? "", /\/louisiana\?license=68755#lookup/);
  assert.doesNotMatch(exact?.href ?? "", /\/contractors\//);
  assert.match(exact?.definition?.body ?? "", /not a new contractor profile/);
  assert.equal(interpretLouisiana("68755"), null);
  assert.equal(ask("68755").mode, "fail_closed");
  assert.equal(interpretLouisiana("68755 Louisiana contractor")?.interpretation.identifier, null);
  for (const query of [
    "best Louisiana contractor",
    "safest Louisiana contractor",
    "recommended Louisiana contractor",
    "most trustworthy Louisiana contractor",
    "top-rated Louisiana contractor",
    "highest-rated Louisiana contractor",
    "#1 Louisiana contractor",
    "Trust Score Louisiana contractor",
    "AggregateRating Louisiana contractor",
    "ratingValue Louisiana contractor",
    "paid ranking Louisiana contractor",
    "sponsored ranking Louisiana contractor",
  ]) {
    assert.equal(ask(query).mode, "fail_closed", query);
  }
});

test("Louisiana publication states the gaps and does not emit rating schema", () => {
  const page = readFileSync(new URL("../app/louisiana/page.tsx", import.meta.url), "utf8");
  const sitemap = readFileSync(new URL("../lib/seo/sitemap-data.ts", import.meta.url), "utf8");
  const askResults = readFileSync(new URL("../components/ask/AskResults.tsx", import.meta.url), "utf8");
  assert.match(page, /NOT_ACQUIRED/);
  assert.match(page, /Home Improvement Registration is not a commercial or residential construction license by itself/);
  assert.match(page, /not a general construction license/);
  assert.match(page, /Parish on the roster is an address field, not a service area/);
  assert.match(page, /No parish pages/);
  assert.match(page, /missing is not zero/i);
  assert.match(page, /Louisiana State Plumbing Board person licenses are a separate grain and were/);
  assert.match(page, /not a deduplicated company census/);
  assert.equal((sitemap.match(/path: "\/louisiana"/g) ?? []).length, 1);
  assert.match(askResults, /wisconsinEvidenceGateway \? null : <GeographyNotice/);
  assert.match(askResults, /louisianaEvidenceGateway/);
  assert.doesNotMatch(page, /AggregateRating|ratingValue|Trust Score/);
  assert.match(ask("contractor Wisconsin").href ?? "", /^\/wisconsin/);
  assert.match(ask("contractor Indiana").href ?? "", /^\/indiana/);
  assert.match(ask("contractor Maryland").href ?? "", /^\/maryland/);
});
