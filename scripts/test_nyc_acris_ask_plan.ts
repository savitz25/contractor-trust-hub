import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { NEW_YORK_SNAPSHOT } from "../lib/new-york-intelligence/snapshot";

const intel = loadContractorHubIntel();
function ask(q: string) {
  return interpretAskQuery(q, intel);
}

test("ACRIS document questions stay on the NYC page without ownership claims", () => {
  const a = ask("recent deed records for this NYC property");
  assert.equal(a.href, "/new-york/new-york-city");
  assert.match(a.failMessage || "", /not a title search/i);
  const b = ask("what property documents were recorded for this BBL?");
  assert.equal(b.href, "/new-york/new-york-city");
  assert.match(b.failMessage || "", /not a title search/i);
  assert.doesNotMatch(b.failMessage || "", /DOB NOW approved-permit/i);
});

test("sale and ownership questions fail closed", () => {
  const sold = ask("was this NYC property sold?");
  assert.match(sold.failMessage || "", /arm’s-length sale|arm's-length sale/i);
  const owns = ask("who owns this NYC property?");
  assert.match(owns.failMessage || "", /current beneficial ownership/i);
});

test("mortgage and lender questions do not attach NMLS", () => {
  const m = ask("does this NYC property have a mortgage?");
  assert.match(m.failMessage || "", /not current loan balance/i);
  const l = ask("who is the lender on this NYC mortgage?");
  assert.match(l.failMessage || "", /NMLS/i);
});

test("permits, HIC, and public-work paths remain distinct", () => {
  const p = ask("what permits exist at this NYC property?");
  assert.match(p.failMessage || "", /DOB NOW|permit/i);
  const hic = ask("home improvement contractor license in NYC");
  assert.match(hic.failMessage || "", /DCWP/i);
  const pw = ask("public work contractor in New York");
  assert.equal(pw.href, "/new-york");
  const count = ask("How many public-work registry certificates are in the New York snapshot?");
  assert.equal(count.count?.value, NEW_YORK_SNAPSHOT.registry.parsed_rows);
});

test("property-sales ranking is unsupported", () => {
  const a = ask("best contractor based on property sales");
  assert.equal(a.supported, false);
  assert.match(a.failMessage || "", /does not rank/i);
});
