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

test("exact CCB identifiers beat geography and do not become Florida lookups", () => {
  const r = ask("Check Oregon CCB license 123456.");
  assert.equal(r.mode, "entity");
  assert.equal(r.interpretation.identifier, "123456");
  assert.equal(r.href, "/oregon");
  assert.doesNotMatch(r.href || "", /verify/);
  assert.match(r.failMessage || "", /official Oregon CCB search/i);
});

test("Oregon complaint, discipline, and final-order questions stay separate and search-only", () => {
  const complaints = ask("Are there complaints on this CCB license?");
  assert.equal(complaints.supported, false);
  assert.match(complaints.failMessage || "", /complaint is not discipline|not a clean history|search/i);
  const discipline = ask("Does this Oregon contractor have disciplinary history?");
  assert.equal(discipline.supported, false);
  assert.match(discipline.failMessage || "", /discipline/i);
  assert.doesNotMatch(discipline.failMessage || "", /zero complaints/i);
  const order = ask("Was this trade license subject to a final order?");
  assert.equal(order.supported, false);
  assert.match(order.failMessage || "", /final order is not a conviction/i);
});

test("active CCB license identities count uses distinct IDs", () => {
  const r = ask("How many active CCB license identities are in Oregon?");
  assert.equal(r.mode, "count");
  assert.equal(r.count?.value, 45501);
});

test("licensed-in-Oregon questions do not invent a clean history", () => {
  const r = ask("Is this contractor licensed in Oregon?");
  assert.equal(r.href, "/oregon");
  const elec = ask("Is this electrical contractor licensed in Oregon?");
  assert.equal(elec.href, "/oregon");
});
