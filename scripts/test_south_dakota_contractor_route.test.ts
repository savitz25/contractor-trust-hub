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

  it("represents every externally linked regulatory source in the evidence manifest", () => {
    const urls = [...page.matchAll(/https:\/\/[^"'\s<>]+/g)].map((match) => match[0]);
    const represented = new Set<string>([
      ...evidence.populations.map((population: { sourceUrl: string }) => population.sourceUrl),
      ...evidence.regulatorySources.map((source: { sourceUrl: string }) => source.sourceUrl),
    ]);
    assert.deepEqual(
      urls.filter((url) => !represented.has(url)),
      [],
    );
    assert.ok(urls.includes("https://dlr.sd.gov/plumbing/licensing.aspx"));
    assert.ok(urls.includes("https://dlr.sd.gov/electrical/default.aspx"));
    assert.ok(urls.includes("https://dor.sd.gov/businesses/taxes/contractors-excise-tax/"));
    for (const source of evidence.regulatorySources) {
      assert.equal(source.retrievedAt, "2026-10-14");
      assert.equal(typeof source.fact, "string");
      assert.ok(source.fact.length > 0);
      assert.ok(page.includes(source.sourceUrl));
    }
    assert.equal(page.includes("universal general-contractor competency license"), false);
    assert.equal(page.includes("not a competency license"), false);
    assert.equal(page.includes("administers statewide electrical credentials"), false);
    assert.ok(page.includes("licenses all electricians within the state"));
    assert.equal(evidence.notAcquired.includes("current electrical credential roster"), true);
    assert.equal(evidence.notAcquired.includes("statewide contractor excise-tax license roster"), true);
    assert.equal(evidence.notAcquired.includes("general-contractor business census"), true);
    assert.equal(evidence.notAcquired.includes("disciplinary action corpus"), true);
  });
});
