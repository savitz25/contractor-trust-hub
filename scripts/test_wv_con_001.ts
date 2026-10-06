import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { interpretWestVirginia } from "../lib/ask/west-virginia";
import { WV_SNAPSHOT as data } from "../lib/west-virginia-intelligence/snapshot";
import { pageMetadata } from "../lib/seo/page-meta";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";
import { absoluteUrl } from "../lib/site";
import { PUBLISHED_STATES } from "../lib/states/published-coverage";

const ADDED = data.elevatorInspectors.inspectorRows + data.elevatorInspectors.distinctBusinessNameStrings;

test("West Virginia elevator inspectors stay off the contractor roster", () => {
  assert.equal(data.combinedContractorDenominator, null);
  assert.equal(data.contractorLicenseRoster, "NOT_ACQUIRED");
  assert.equal(data.hvacCertificationRoster, "NOT_ACQUIRED");
  assert.equal(data.plumbingCertificationRoster, "NOT_ACQUIRED");
  assert.equal(data.manufacturedHousingRoster, "NOT_ACQUIRED");
  assert.equal(data.elevatorInspectors.inspectorRows, 23);
  assert.equal(data.elevatorInspectors.distinctInspectorNameStrings, 23);
  assert.equal(data.elevatorInspectors.distinctBusinessNameStrings, 17);
  assert.equal(data.elevatorInspectors.businessNameStringsAreResolvedEntities, false);
  assert.equal(data.elevatorInspectors.statusNotesStillOnList, 2);
  assert.equal(data.elevatorInspectors.statusNotesRemovedFromCount, false);
  assert.equal(data.elevatorInspectors.isContractorLicense, false);
  assert.equal(data.elevatorInspectors.bytes, 28293);
  assert.equal(
    data.elevatorInspectors.sha256,
    "c26453628399a63c853e0dc23b34d591cd47646dd92225f6f5fd3199571038ca",
  );
  assert.equal(data.elevatorInspectors.httpDate, "Tue, 06 Oct 2026 19:25:04 GMT");
  assert.equal(data.elevatorInspectors.listAsOfDate, "NOT_PRINTED");
  assert.equal(data.graphWrites, 0);
  assert.equal(data.newCanonicalEntities, 0);
  assert.equal(data.nameOnlyAdverseJoins, 0);
  assert.equal(ADDED, 40);
  assert.notEqual(ADDED, data.elevatorInspectors.inspectorRows);
});

test("West Virginia page publishes one statewide route", () => {
  const page = readFileSync("app/west-virginia/page.tsx", "utf8");
  const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");
  const meta = pageMetadata({
    title: "West Virginia contractor and elevator-inspector evidence",
    description: "Division of Labor evidence.",
    path: "/west-virginia",
  });
  assert.match(page, /path: "\/west-virginia"/);
  assert.match(page, /inspectorRows/);
  assert.match(page, /distinctBusinessNameStrings/);
  assert.match(page, /An elevator inspector is not a contractor license/);
  assert.match(page, /not\s+resolved into companies/);
  assert.match(page, /not removed from the row count/);
  assert.match(page, /contractorLicenseRoster/);
  assert.match(page, /hvacCertificationRoster/);
  assert.match(page, /does not rank/);
  assert.match(page, /Charleston, Morgantown, and Huntington are geography only/);
  assert.doesNotMatch(page, /AggregateRating|Trust Score|ratingValue/);
  assert.doesNotMatch(page, /\/west-virginia\/charleston/);
  assert.doesNotMatch(page, /\b40\b/);
  assert.equal((sitemap.match(/path: "\/west-virginia"/g) || []).length, 1);
  assert.match(sitemap, /path: "\/idaho"/);
  assert.match(sitemap, /path: "\/kansas"/);
  assert.match(sitemap, /path: "\/nebraska"/);
  assert.equal(normalizedPublishedStatePath("/West-Virginia"), "/west-virginia");
  assert.equal(normalizedPublishedStatePath("/west-virginia"), null);
  assert.equal(normalizedPublishedStatePath("/west-virginia/charleston"), null);
  assert.equal(absoluteUrl("/west-virginia"), "https://www.contractortrusthub.com/west-virginia");
  assert.equal(
    (meta.alternates as { canonical?: string }).canonical,
    "https://www.contractortrusthub.com/west-virginia",
  );
  assert.deepEqual(meta.robots, { index: true, follow: true });
  assert.equal(PUBLISHED_STATES.some((state) => state.slug === "west-virginia" && state.code === "WV"), true);
  assert.equal(PUBLISHED_STATES.some((state) => state.slug === "nebraska" && state.code === "NE"), true);
  assert.equal(PUBLISHED_STATES.some((state) => state.slug === "kansas" && state.code === "KS"), true);
  const interpret = readFileSync("lib/ask/interpret.ts", "utf8");
  const request = readFileSync("lib/ask/request.ts", "utf8");
  assert.match(interpret, /interpretWestVirginia/);
  assert.match(request, /\\bwest virginia\\b\|\\bin wv\\b/);
  assert.doesNotMatch(request, /\\bwv\\b/);
});

test("West Virginia ask does not invent one contractor census", () => {
  assert.equal(interpretWestVirginia("wv"), null);
  assert.equal(interpretWestVirginia("WV"), null);
  assert.equal(interpretWestVirginia("contractors wv"), null);
  assert.equal(interpretWestVirginia("how many contractors in Virginia"), null);
  const howMany = interpretWestVirginia("how many contractors in West Virginia");
  assert.equal(howMany?.mode, "fail_closed");
  assert.match(howMany?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.match(howMany?.definition.body ?? "", /not added/);
  assert.match(howMany?.definition.body ?? "", /Missing is not zero/);
  assert.doesNotMatch(howMany?.definition.body ?? "", /\b23\b/);
  assert.equal(howMany?.count, null);
  assert.equal(howMany?.aggregate, null);
  const inWv = interpretWestVirginia("elevator inspectors in wv");
  assert.match(inWv?.definition.body ?? "", /23/);
  assert.match(inWv?.definition.body ?? "", /17/);
  assert.match(inWv?.definition.body ?? "", /not a contractor license/);
  assert.doesNotMatch(inWv?.definition.body ?? "", /\b40\b/);
  const rank = interpretWestVirginia("best contractor in West Virginia");
  assert.match(rank?.definition.body ?? "", /does not rank/);
  const city = interpretWestVirginia("contractors in Charleston, West Virginia");
  assert.match(city?.definition.body ?? "", /geography only/);
  const hvac = interpretWestVirginia("hvac technicians in West Virginia");
  assert.match(hvac?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.match(hvac?.definition.body ?? "", /not a contractor license/);
});
