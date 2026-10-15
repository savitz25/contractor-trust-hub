import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/south-dakota/page.tsx", import.meta.url), "utf8");
const evidence = JSON.parse(
  readFileSync(new URL("../data/evidence/south-dakota-contractor-v1.json", import.meta.url), "utf8"),
);

describe("South Dakota Contractor publication", () => {
  it("publishes canonical indexable metadata and official source links", () => {
    assert.ok(page.includes('path: "/south-dakota"'));
    assert.ok(page.includes("dlr.sd.gov/plumbing/documents/List_of_licensed_plumbers.pdf"));
    assert.ok(page.includes("dlr.sd.gov/plumbing/documents/list_of_specialty_licensees.pdf"));
    assert.ok(page.includes("dlr.sd.gov/plumbing/documents/list_of_small_wastewater.pdf"));
    assert.ok(page.includes("dor.sd.gov/businesses/taxes/contractors-excise-tax/"));
  });

  it("keeps credential source classes and clocks separate", () => {
    assert.equal(evidence.populations[0].sourceClock, "2026-07-31");
    assert.equal(evidence.populations[0].rowsByClass.reduce((n: number, row: { rows: number }) => n + row.rows, 0), 2798);
    assert.equal(evidence.populations[1].sourceClock, "2026-02-04");
    assert.equal(evidence.populations[1].rowsByClass.reduce((n: number, row: { rows: number }) => n + row.rows, 0), 909);
    assert.equal(evidence.populations[2].rows, 562);
    assert.equal(evidence.notAcquired.length, 5);
    assert.ok(page.includes("NOT_ACQUIRED"));
    assert.ok(page.includes("current status field"));
    assert.ok(page.includes("combined contractor total"));
  });

  it("does not publish rating or business-census markup", () => {
    assert.ok(!page.includes("AggregateRating"));
    assert.ok(!page.includes("Trust Score"));
    assert.ok(page.includes("count of all construction businesses"));
  });
});
