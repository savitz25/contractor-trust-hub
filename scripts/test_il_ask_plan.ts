import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { ILLINOIS_SNAPSHOT } from "../lib/illinois-intelligence/snapshot";

const intel = loadContractorHubIntel();
const ask = (q: string) => interpretAskQuery(q, intel);

test("Illinois active roofing business count is the distinct ID headline", () => {
  const r = ask("How many active roofing business licenses are in the Illinois snapshot?");
  assert.equal(r.mode, "count");
  assert.equal(r.supported, true);
  assert.equal(r.href, "/illinois");
  assert.equal(r.count?.value, ILLINOIS_SNAPSHOT.business_licenses.active_business_y_distinct_license_ids);
  assert.equal(r.count?.value, 4675);
  assert.notEqual(r.count?.value, 4891);
  assert.notEqual(r.count?.value, 33891);
});

test("Illinois contractor total, entity, and filtered questions do not receive unfiltered counts", () => {
  const all = ask("How many Illinois contractors are there?");
  assert.equal(all.supported, false);
  assert.equal(all.count, null);
  assert.match(all.failMessage || "", /roofing contractor credentials only/i);
  const named = ask("Is ABC Roofing LLC licensed in Illinois?");
  assert.equal(named.supported, false);
  assert.equal(named.count, null);
  const issued = ask("How many Illinois roofing licenses were issued in 2025?");
  assert.equal(issued.supported, false);
  assert.equal(issued.count, null);
  const chicago = ask("Illinois roofers serving Chicago");
  assert.equal(chicago.supported, false);
  assert.match(chicago.failMessage || "", /not service territory/i);
  const ranking = ask("Best roofer in Illinois");
  assert.equal(ranking.supported, false);
  assert.match(ranking.failMessage || "", /does not rank/i);
});

test("qualifying-party, source-row, and other-status counts never receive 4675", () => {
  const qp = ask("How many active roofing qualifying-party credentials are in Illinois?");
  assert.equal(qp.href, "/illinois");
  assert.notEqual(qp.count?.value, 4675);
  if (qp.supported) {
    assert.equal(qp.mode, "count");
    assert.equal(qp.count?.value, ILLINOIS_SNAPSHOT.qualifying_parties.active_distinct_license_ids);
    assert.equal(qp.count?.value, 12042);
    assert.match(qp.count?.grain || "", /qualifying-party/i);
  } else {
    assert.equal(qp.count, null);
  }
  const rows = ask("How many roofing source rows are in the Illinois snapshot?");
  assert.notEqual(rows.count?.value, 4675);
  if (rows.supported) {
    assert.equal(rows.count?.value, 33891);
    assert.match(rows.count?.grain || "", /source rows/i);
  } else {
    assert.equal(rows.count, null);
  }
  const suspended = ask("How many suspended roofing business licenses are in Illinois?");
  assert.equal(suspended.supported, false);
  assert.equal(suspended.count, null);
  const revoked = ask("How many revoked roofing business licenses are in Illinois?");
  assert.equal(revoked.supported, false);
  assert.equal(revoked.count, null);
  const inactive = ask("How many inactive roofing business licenses are in Illinois?");
  assert.equal(inactive.supported, false);
  assert.equal(inactive.count, null);
});

test("mixed-jurisdiction and NY/VA/FL regressions stay off Illinois totals", () => {
  const mixed = ask("Illinois contractor debarred in Florida");
  assert.equal(mixed.supported, false);
  assert.notEqual(mixed.href, "/illinois");
  const ny = ask("How many public-work registry certificates are in the New York snapshot?");
  assert.equal(ny.count?.value, 14665);
  const fl = ask("CCC1332036");
  assert.equal(fl.mode, "entity");
  assert.match(fl.href || "", /verify/);
});
