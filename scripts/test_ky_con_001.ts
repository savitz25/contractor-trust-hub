import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { KY_SNAPSHOT } from "../lib/kentucky-intelligence/snapshot";
import { interpretKentucky } from "../lib/ask/kentucky";
import { interpretAskQuery } from "../lib/ask/interpret";
import { researchRoute } from "../lib/ask/request";
import { planContractorSearch } from "../lib/search/contractor-discovery";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

const ask = (q: string) => interpretAskQuery(q, {} as Parameters<typeof interpretAskQuery>[1]);

test("Kentucky DHBC classes stay separate and match the recorded production load", () => {
  assert.equal(KY_SNAPSHOT.statewideGeneralContractorLicense, "DOES_NOT_EXIST");
  assert.deepEqual(
    KY_SNAPSHOT.classes.map((row) => [row.code, row.status, row.rows]),
    [
      ["ELEC", "Active", 3884],
      ["HVAC", "Active", 2699],
      ["PLB", "Active", 1777],
    ],
  );
  assert.equal(KY_SNAPSHOT.classes.reduce((n, row) => n + row.rows, 0), KY_SNAPSHOT.recordedLicenseRows);
  assert.equal(KY_SNAPSHOT.recordedLicenseRows, 8360);
  assert.equal(KY_SNAPSHOT.fireCredentials, "NOT_ACQUIRED");
  assert.equal(KY_SNAPSHOT.manufacturedHousing, "NOT_ACQUIRED");
  assert.equal(KY_SNAPSHOT.discipline, "NOT_ACQUIRED");
  assert.equal(KY_SNAPSHOT.openRecordsRequest, "NOT_FILED");
  assert.equal(KY_SNAPSHOT.graphWrites, 0);
  assert.equal(KY_SNAPSHOT.newCanonicalCompanies, 0);
  assert.match(KY_SNAPSHOT.productRecordNote, /Not re-extracted/);
});

test("Kentucky page and Ask do not invent a contractor census or a city route", () => {
  const page = readFileSync("app/kentucky/page.tsx", "utf8");
  assert.match(page, /does not issue a statewide general contractor license/);
  assert.match(page, /Not a company census/);
  assert.doesNotMatch(page, /AggregateRating|Trust Score/);
  assert.equal(existsSync("app/kentucky/louisville"), false);
  assert.equal(existsSync("app/kentucky/lexington"), false);
  assert.equal(normalizedPublishedStatePath("/Kentucky"), "/kentucky");
  assert.equal(normalizedPublishedStatePath("/kentucky/louisville"), null);
  for (const query of ["contractor Kentucky", "electrical contractor Kentucky", "HVAC contractor in ky", "plumber Louisville"]) {
    const result = ask(query);
    assert.equal(result.count, null, query);
    assert.equal(result.aggregate, null, query);
    assert.match(result.href ?? "", /^\/kentucky|^\/verify/, query);
  }
  assert.equal(ask("how many Kentucky contractors").mode, "fail_closed");
  assert.equal(ask("best contractor Kentucky").mode, "fail_closed");
  assert.match(ask("KY-DHBC:CE62402").href ?? "", /verify\?state=ky/);
  assert.match(ask("contractor Louisiana").href ?? "", /louisiana/);
  assert.equal(researchRoute("contractor Kentucky", planContractorSearch("contractor Kentucky")), "/ask");
  assert.equal(interpretKentucky("contractor Louisiana"), null);
});
