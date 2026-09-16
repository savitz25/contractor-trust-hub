import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { OREGON_SNAPSHOT } from "../lib/oregon-intelligence/snapshot";

const intel = loadContractorHubIntel();
const ask = (q: string) => interpretAskQuery(q, intel);

test("Oregon CCB distinct license IDs are the count headline", () => {
  const r = ask("How many CCB licenses are in the Oregon snapshot?");
  assert.equal(r.mode, "count");
  assert.equal(r.href, "/oregon");
  assert.equal(r.count?.value, OREGON_SNAPSHOT.ccb.DISTINCT_NONEMPTY_LICENSE_IDS);
  assert.equal(r.count?.value, 45501);
  assert.notEqual(r.count?.value, 56172);
});

test("Oregon company totals, ranking, complaints, and Portland fail closed", () => {
  const companies = ask("How many unique companies are licensed in Oregon?");
  assert.equal(companies.supported, false);
  assert.match(companies.failMessage || "", /not unique companies/i);
  const ranking = ask("Best contractor in Oregon");
  assert.equal(ranking.supported, false);
  assert.match(ranking.failMessage || "", /does not rank/i);
  const complaints = ask("complaints against a contractor in Oregon");
  assert.equal(complaints.supported, false);
  assert.match(complaints.failMessage || "", /not zero|search/i);
  const portland = ask("Best contractor serving Portland");
  assert.equal(portland.supported, false);
  assert.match(portland.failMessage || "", /does not rank|Portland|Multnomah|statewide/i);
});

test("BCD business credentials are not added to CCB", () => {
  const r = ask("How many BCD business contractor credentials are in Oregon?");
  assert.equal(r.mode, "count");
  assert.equal(r.count?.value, 5562);
  assert.notEqual(r.count?.value, 45501);
});
