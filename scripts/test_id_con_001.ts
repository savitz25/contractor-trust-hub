import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { interpretIdaho } from "../lib/ask/idaho";
import { ID_SNAPSHOT as data, idBoard } from "../lib/idaho-intelligence/snapshot";
import { pageMetadata } from "../lib/seo/page-meta";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";
import { absoluteUrl } from "../lib/site";
import { PUBLISHED_STATES } from "../lib/states/published-coverage";

const BLENDED =
  data.contractorsBoard.fy2025.totalNumberOfLicenses +
  data.separateBoards.reduce((sum, board) => sum + board.fy2025TotalNumberOfLicenses, 0);

test("Idaho contractor boards stay on their own lines", () => {
  assert.equal(data.combinedContractorDenominator, null);
  assert.equal(data.namedRoster, "NOT_ACQUIRED");
  assert.equal(data.personVsBusiness, "NOT_SEPARATED");
  assert.equal(data.graphWrites, 0);
  assert.equal(data.newCanonicalEntities, 0);
  assert.equal(data.program, "contractor registration");
  assert.equal(data.source.bytes, 415599);
  assert.equal(data.source.sha256, "5fbe075577e262d5d3c634b0cac7d87a4f301370014e99967257b6a9182a3a4a");
  assert.equal(data.source.retrievedAt, "2026-10-06");
  assert.equal(data.source.currentColumn, "FY 2025");
  assert.equal(data.source.boardRowAsOfDate, "NOT_PRINTED");
  assert.equal(data.contractorsBoard.fy2025.totalNumberOfLicenses, 20597);
  assert.equal(data.contractorsBoard.fy2025.complaints, 485);
  assert.equal(data.contractorsBoard.fy2025.finalDisciplinaryActions, 15);
  assert.equal(data.contractorsBoard.fy2025.newApplicantsDeniedLicensure, 1);
  assert.equal(data.contractorsBoard.fy2025.applicantsRefusedRenewal, 0);
  assert.equal(data.contractorsBoard.earlierTotals.fy2022, 20788);
  assert.equal(data.contractorsBoard.earlierTotals.fy2023, 21775);
  assert.equal(data.contractorsBoard.earlierTotals.fy2024, 22773);
  assert.equal(idBoard("electrical").fy2025TotalNumberOfLicenses, 19173);
  assert.equal(idBoard("hvac").fy2025TotalNumberOfLicenses, 6991);
  assert.equal(idBoard("plumbing").fy2025TotalNumberOfLicenses, 8970);
  assert.equal(idBoard("public-works").fy2025TotalNumberOfLicenses, 3194);
  assert.equal(data.divisionWideActiveLicenseesJune30Fy2025, 255119);
  assert.equal(data.divisionWideIsNotAContractorCount, true);
  assert.equal(data.biennialTransitionBegan, "2025-10-14");
  assert.equal(data.biennialAdjustsFy2025Count, false);
  assert.equal(data.feesPublished, false);
  assert.equal(BLENDED, 58925);
  assert.notEqual(BLENDED, data.contractorsBoard.fy2025.totalNumberOfLicenses);
  assert.notEqual(data.divisionWideActiveLicenseesJune30Fy2025, data.contractorsBoard.fy2025.totalNumberOfLicenses);
});

test("Idaho page publishes one statewide route", () => {
  const page = readFileSync("app/idaho/page.tsx", "utf8");
  const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");
  const meta = pageMetadata({
    title: "Idaho contractor registration research",
    description: "Idaho Contractors Board registration evidence.",
    path: "/idaho",
  });
  assert.match(page, /path: "\/idaho"/);
  assert.match(page, /contractor registration/);
  assert.match(page, /Total Number of Licenses/);
  assert.match(page, /not relabeled/);
  assert.match(page, /personVsBusiness/);
  assert.match(page, /not separated/);
  assert.match(page, /not added/);
  assert.match(page, /complaintIsNotAFinding/);
  assert.match(page, /not an Idaho contractor count/);
  assert.match(page, /Boise is geography only/);
  assert.match(page, /namedRoster/);
  assert.match(page, /publicSearch/);
  assert.equal(data.personVsBusiness, "NOT_SEPARATED");
  assert.equal(data.namedRoster, "NOT_ACQUIRED");
  assert.equal(data.complaintIsNotAFinding, "A complaint is not a finding.");
  assert.match(data.publicSearch, /not a bulk census/);
  assert.doesNotMatch(page, /AggregateRating|Trust Score|ratingValue/);
  assert.doesNotMatch(page, /\/idaho\/boise/);
  assert.doesNotMatch(page, /58,925|58925/);
  assert.doesNotMatch(page, /\$\d/);
  assert.equal((sitemap.match(/path: "\/idaho"/g) || []).length, 1);
  assert.match(sitemap, /path: "\/new-mexico"/);
  assert.equal(normalizedPublishedStatePath("/Idaho"), "/idaho");
  assert.equal(normalizedPublishedStatePath("/idaho"), null);
  assert.equal(normalizedPublishedStatePath("/idaho/boise"), null);
  assert.equal(absoluteUrl("/idaho"), "https://www.contractortrusthub.com/idaho");
  assert.equal((meta.alternates as { canonical?: string }).canonical, "https://www.contractortrusthub.com/idaho");
  assert.deepEqual(meta.robots, { index: true, follow: true });
  assert.equal(PUBLISHED_STATES.some((state) => state.slug === "idaho" && state.code === "ID"), true);
  assert.equal(PUBLISHED_STATES.some((state) => state.slug === "kansas" && state.code === "KS"), true);
  assert.equal(PUBLISHED_STATES.some((state) => state.slug === "new-mexico" && state.code === "NM"), true);
  const interpret = readFileSync("lib/ask/interpret.ts", "utf8");
  const request = readFileSync("lib/ask/request.ts", "utf8");
  assert.match(interpret, /interpretIdaho/);
  assert.match(request, /\\bidaho\\b\|\\bin id\\b/);
  assert.doesNotMatch(request, /\\bid\\b/);
});

test("Idaho ask does not invent one contractor census", () => {
  assert.equal(interpretIdaho("id"), null);
  assert.equal(interpretIdaho("ID"), null);
  assert.equal(interpretIdaho("how many contractors in Kansas"), null);
  const howMany = interpretIdaho("how many contractors in Idaho");
  assert.equal(howMany?.mode, "fail_closed");
  assert.match(howMany?.definition.body ?? "", /20,597/);
  assert.match(howMany?.definition.body ?? "", /registration/);
  assert.match(howMany?.definition.body ?? "", /not added/);
  assert.match(howMany?.definition.body ?? "", /255,119/);
  assert.doesNotMatch(howMany?.definition.body ?? "", /58,925/);
  assert.equal(howMany?.count, null);
  assert.equal(howMany?.aggregate, null);
  const inId = interpretIdaho("contractors in id");
  assert.equal(inId?.mode, "guidance");
  const rank = interpretIdaho("best contractor in Idaho");
  assert.equal(rank?.mode, "fail_closed");
  assert.match(rank?.definition.body ?? "", /does not rank/);
  assert.equal(rank?.aggregate, null);
  const electrical = interpretIdaho("electricians in Boise Idaho");
  assert.match(electrical?.definition.body ?? "", /19,173/);
  assert.match(electrical?.definition.body ?? "", /geography only/);
  const plumbing = interpretIdaho("plumbers in Idaho");
  assert.match(plumbing?.definition.body ?? "", /8,970/);
  const hvac = interpretIdaho("hvac in Idaho");
  assert.match(hvac?.definition.body ?? "", /6,991/);
  const publicWorks = interpretIdaho("public works contractors in Idaho");
  assert.match(publicWorks?.definition.body ?? "", /3,194/);
  const complaints = interpretIdaho("complaints against Idaho contractors");
  assert.equal(complaints?.mode, "fail_closed");
  assert.match(complaints?.definition.body ?? "", /485/);
  assert.match(complaints?.definition.body ?? "", /not a finding/);
});
