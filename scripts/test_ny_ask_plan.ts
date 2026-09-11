import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { NEW_YORK_SNAPSHOT } from "../lib/new-york-intelligence/snapshot";

const intel = loadContractorHubIntel();

function ask(q: string) {
  return interpretAskQuery(q, intel);
}

test("explicit NY registry aggregate succeeds from the accepted snapshot", () => {
  const a = ask("How many public-work registry certificates are in the New York snapshot?");
  const b = ask("How many NY public-work registry certificates?");
  assert.equal(a.mode, "count");
  assert.equal(a.supported, true);
  assert.equal(a.interpretation.location, "New York");
  assert.equal(a.href, "/new-york");
  assert.equal(a.count?.value, NEW_YORK_SNAPSHOT.registry.parsed_rows);
  assert.equal(a.count?.value, 14665);
  assert.equal(b.mode, "count");
  assert.equal(b.supported, true);
  assert.equal(b.count?.value, a.count?.value);
  assert.equal(b.href, "/new-york");
});

test("named-company and certificate questions do not become the statewide total", () => {
  const named = ask("Is ABC Construction LLC registered in New York?");
  assert.equal(named.supported, false);
  assert.equal(named.mode, "fail_closed");
  assert.notEqual(named.count?.value, 14665);
  assert.equal(named.count, null);
  assert.equal(named.href, "/new-york");
  assert.match(named.failMessage || "", /not the statewide/i);
  const cert = ask("Check this New York certificate 26-697KD-CR");
  assert.equal(cert.supported, false);
  assert.equal(cert.count, null);
  assert.equal(cert.interpretation.identifier, "26-697KD-CR");
  assert.match(cert.failMessage || "", /does not run an interactive/i);
});

test("complaints, ranking, and discovery do not become the unfiltered total", () => {
  const complaints = ask("Complaints against registered contractors in New York");
  assert.equal(complaints.supported, false);
  assert.equal(complaints.count, null);
  assert.notEqual(complaints.href, "/new-york");
  assert.match(complaints.failMessage || "", /complaint/i);
  const ranking = ask("Best registered public-work contractors in New York");
  assert.equal(ranking.supported, false);
  assert.equal(ranking.count, null);
  assert.match(ranking.failMessage || "", /does not rank/i);
  const discovery = ask("Show registered public-work contractors in New York");
  assert.equal(discovery.supported, false);
  assert.equal(discovery.count, null);
  assert.equal(discovery.href, "/new-york");
  assert.match(discovery.failMessage || "", /not a live browsable/i);
  const filtered = ask("How many New York public-work certificates have outstanding wage assessments?");
  assert.equal(filtered.supported, false);
  assert.equal(filtered.count, null);
  assert.match(filtered.failMessage || "", /filtered/i);
});

test("debarment routing does not assume New York", () => {
  const ny = ask("Is this contractor debarred in New York?");
  assert.equal(ny.supported, false);
  assert.equal(ny.href, "/new-york");
  assert.match(ny.failMessage || "", /EDList/i);
  const fl = ask("Florida debarment list");
  assert.notEqual(fl.href, "/new-york");
  assert.doesNotMatch(fl.failMessage || "", /EDList/);
  const nj = ask("New Jersey debarment");
  assert.notEqual(nj.href, "/new-york");
  assert.doesNotMatch(nj.failMessage || "", /EDList/);
  const unspecified = ask("is this contractor debarred?");
  assert.equal(unspecified.supported, false);
  assert.equal(unspecified.href, null);
  assert.match(unspecified.failMessage || "", /does not assume New York/i);
});

test("existing exact-credential and VA/CO phrasing remain unchanged", () => {
  const ccc = ask("CCC1332036");
  assert.equal(ccc.mode, "entity");
  assert.equal(ccc.supported, true);
  assert.match(ccc.href || "", /verify/);
  const va = ask("Virginia contractor licenses");
  assert.notEqual(va.href, "/new-york");
  const co = ask("Colorado electrical contractors");
  assert.notEqual(co.href, "/new-york");
});
