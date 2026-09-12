import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { NYC_DOB_SNAPSHOT } from "../lib/new-york-city-dob-intelligence/snapshot";
import { NEW_YORK_SNAPSHOT } from "../lib/new-york-intelligence/snapshot";

const intel = loadContractorHubIntel();
function ask(q: string) {
  return interpretAskQuery(q, intel);
}

test("property permit questions stay on the NYC page without contractor attribution", () => {
  const a = ask("what work was permitted at this NYC property?");
  assert.equal(a.href, "/new-york/new-york-city");
  assert.match(a.failMessage || "", /BBL/);
  const b = ask("permits at 123 Main Street Brooklyn");
  assert.equal(b.href, "/new-york/new-york-city");
  assert.match(b.failMessage || "", /not automatic|BBL/i);
});

test("permit actor roles are not relabeled as contractor", () => {
  const a = ask("who pulled the permit in NYC?");
  assert.equal(a.href, "/new-york/new-york-city");
  assert.match(a.failMessage || "", /Applicant is not contractor/i);
});

test("named contractor permit questions need an exact DOB actor id", () => {
  const a = ask("does this contractor have permits in NYC?");
  assert.equal(a.supported, false);
  assert.match(a.failMessage || "", /exact/i);
});

test("roof permit is DOB work-type research, not DCWP HIC count", () => {
  const a = ask("roof permit in Brooklyn");
  assert.equal(a.href, "/new-york/new-york-city");
  assert.notEqual(a.count?.value, 13385);
  assert.match(a.failMessage || "", /permit/i);
});

test("HIC license and public-work paths remain distinct", () => {
  const hic = ask("home improvement contractor license in NYC");
  assert.equal(hic.href, "/new-york/new-york-city");
  assert.match(hic.failMessage || "", /DCWP/i);
  const pw = ask("public work contractor in New York");
  assert.equal(pw.href, "/new-york");
  const count = ask("How many public-work registry certificates are in the New York snapshot?");
  assert.equal(count.count?.value, NEW_YORK_SNAPSHOT.registry.parsed_rows);
});

test("permit ranking is unsupported", () => {
  const a = ask("best contractor based on permits in NYC");
  assert.equal(a.supported, false);
  assert.match(a.failMessage || "", /does not rank/i);
  assert.notEqual(a.count?.value, NYC_DOB_SNAPSHOT.dob_now.parsed_rows);
});
