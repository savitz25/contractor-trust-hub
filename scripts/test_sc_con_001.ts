import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { SC_CLB_CATEGORIES, SC_RBC_CATEGORIES, SC_SNAPSHOT } from "../lib/south-carolina-intelligence/snapshot";
import { interpretSouthCarolina } from "../lib/ask/south-carolina";
import { interpretAskQuery } from "../lib/ask/interpret";
import { researchRoute } from "../lib/ask/request";
import { planContractorSearch } from "../lib/search/contractor-discovery";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

const ask = (q: string) => interpretAskQuery(q, {} as Parameters<typeof interpretAskQuery>[1]);

test("South Carolina boards stay separate and the printed totals are not repaired", () => {
  assert.equal(SC_CLB_CATEGORIES.reduce((sum, row) => sum + row.rows, 0), 49513);
  assert.equal(SC_SNAPSHOT.clbListedCategorySum, 49513);
  assert.equal(SC_SNAPSHOT.clbPrintedTotal, 49355);
  assert.equal(SC_SNAPSHOT.clbPrintedTotalEqualsListedRows, false);
  assert.equal(SC_SNAPSHOT.generalContractorRows, 11161);
  assert.equal(SC_SNAPSHOT.mechanicalContractorRows, 7988);
  assert.equal(SC_RBC_CATEGORIES.reduce((sum, row) => sum + row.rows, 0), 22136);
  assert.equal(SC_SNAPSHOT.rbcReadableCategorySum, 22136);
  assert.equal(SC_SNAPSHOT.rbcPrintedTotal, 23796);
  assert.equal(SC_SNAPSHOT.rbcPrintedTotalEqualsReadableRows, false);
  assert.equal(SC_SNAPSHOT.homeInspectorPrinted, "1,60");
  assert.equal(SC_SNAPSHOT.homeInspectorCount, null);
  assert.equal(SC_SNAPSHOT.licenseRoster, "NOT_ACQUIRED");
  assert.equal(SC_SNAPSHOT.licenseeListRequest, "NOT_FILED");
  assert.equal(SC_SNAPSHOT.graphWrites, 0);
  assert.equal(SC_SNAPSHOT.newCanonicalCompanies, 0);
  assert.equal(SC_SNAPSHOT.buildingCodesCouncilUsed, false);
});

test("South Carolina page and Ask do not invent one contractor census or a city route", () => {
  const page = readFileSync("app/south-carolina/page.tsx", "utf8");
  assert.match(page, /not one statewide contractor census/);
  assert.match(page, /Those two numbers are not equal/);
  assert.match(page, /1,60/);
  assert.doesNotMatch(page, /AggregateRating|Trust Score|1,660|73,151/);
  assert.equal(existsSync("app/south-carolina/charleston"), false);
  assert.equal(existsSync("app/south-carolina/columbia"), false);
  assert.equal(existsSync("app/south-carolina/greenville"), false);
  assert.equal(normalizedPublishedStatePath("/South-Carolina"), "/south-carolina");
  assert.equal(normalizedPublishedStatePath("/south-carolina/charleston"), null);
  const many = ask("how many South Carolina contractors");
  assert.equal(many.mode, "fail_closed");
  assert.equal(many.count, null);
  assert.doesNotMatch(`${many.failMessage}`, /49,355|23,796|11,161/);
  const guide = ask("contractor South Carolina");
  assert.equal(guide.count, null);
  assert.match(guide.definition?.body ?? "", /11,161/);
  assert.match(guide.definition?.body ?? "", /7,988/);
  assert.match(guide.definition?.body ?? "", /7,231/);
  assert.match(guide.href ?? "", /\/south-carolina/);
  assert.equal(ask("best contractor South Carolina").mode, "fail_closed");
  assert.match(ask("contractor Charleston South Carolina").definition?.body ?? "", /geography only/);
  assert.equal(interpretSouthCarolina("contractor Kentucky"), null);
  assert.match(ask("contractor Kentucky").href ?? "", /kentucky/);
  assert.equal(researchRoute("contractor South Carolina", planContractorSearch("contractor South Carolina")), "/ask");
});
