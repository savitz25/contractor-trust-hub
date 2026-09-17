import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { PENNSYLVANIA_SNAPSHOT } from "../lib/pennsylvania-intelligence/snapshot";

const intel = loadContractorHubIntel();
const ask = (q: string) => interpretAskQuery(q, intel);

test("Pennsylvania has no universal licensed-contractor census", () => {
  const r = ask("licensed contractor Pennsylvania");
  assert.equal(r.supported, false);
  assert.equal(r.href, "/pennsylvania");
  assert.match(r.failMessage || "", /does not have a universal statewide general-contractor license/i);
});

test("HICPA bulk counts fail closed as search-only, not zero", () => {
  const r = ask("How many home improvement contractors are registered in Pennsylvania?");
  assert.equal(r.supported, false);
  assert.match(r.failMessage || "", /OPEN_SEARCH_ONLY|not zero/i);
});

test("exact PA HIC registration beats geography", () => {
  const r = ask("PA HIC 123456");
  assert.equal(r.interpretation.identifier, "PA123456");
  assert.equal(r.href, "/pennsylvania");
  assert.match(r.failMessage || "", /HICPA identity|active registrations only/i);
  assert.doesNotMatch(r.href || "", /verify/);
});

test("asbestos and lead stay separate from HICPA", () => {
  const asb = ask("asbestos contractor Pennsylvania");
  assert.equal(asb.href, "/pennsylvania");
  assert.match(asb.failMessage || "", /283/);
  assert.match(asb.failMessage || "", /not HICPA/i);
  const lead = ask("lead abatement contractor Pennsylvania");
  assert.match(lead.failMessage || "", /148/);
});

test("debarment is not a complaint and not name-attached", () => {
  const r = ask("debarred contractor Pennsylvania");
  assert.equal(r.href, "/pennsylvania");
  assert.match(r.failMessage || "", /6 rows/);
  assert.match(r.failMessage || "", /not a complaint/i);
  const pw = ask("Pennsylvania prevailing wage debarment");
  assert.match(pw.failMessage || "", /not historical clearance/i);
});

test("electrical and plumbing explain municipal licensing", () => {
  const elec = ask("electrician Pennsylvania");
  assert.match(elec.failMessage || "", /municipal/i);
  const plum = ask("plumber Pennsylvania");
  assert.match(plum.failMessage || "", /municipal/i);
});

test("Philadelphia and Pittsburgh do not create local routes", () => {
  const phl = ask("contractor Philadelphia");
  assert.equal(phl.href, "/pennsylvania");
  assert.doesNotMatch(phl.href || "", /philadelphia/);
  const pitt = ask("contractor Pittsburgh");
  assert.equal(pitt.href, "/pennsylvania");
  assert.doesNotMatch(pitt.href || "", /pittsburgh/);
});

test("Palm Beach is not captured as Pennsylvania", () => {
  const r = ask("Show me active roofing contractors in Palm Beach County.");
  assert.notEqual(r.href, "/pennsylvania");
  assert.doesNotMatch(r.failMessage || "", /HICPA/i);
});

test("ranking fails closed and HICPA snapshot counts stay null", () => {
  const best = ask("Best contractor in Pennsylvania");
  assert.equal(best.supported, false);
  assert.match(best.failMessage || "", /does not rank|Trust Score/i);
  assert.equal(PENNSYLVANIA_SNAPSHOT.hicpa.PA_HICPA_ROWS, null);
});
