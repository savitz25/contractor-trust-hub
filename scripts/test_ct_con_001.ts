import assert from "node:assert/strict";
import test from "node:test";
import { interpretConnecticut } from "../lib/ask/connecticut";
import { interpretAskQuery } from "../lib/ask/interpret";

test("Connecticut routing covers classes, enforcement, and city context", () => {
  for (const q of [
    "contractor Connecticut", "Connecticut contractor license", "Connecticut home improvement contractor", "HIC Connecticut",
    "new home construction contractor Connecticut", "electrician Connecticut", "electrical contractor Connecticut",
    "plumber Connecticut", "plumbing contractor Connecticut", "HVAC contractor Connecticut", "heating contractor Connecticut",
    "fire protection contractor Connecticut", "contractor discipline Connecticut", "contractor enforcement Connecticut",
    "home improvement complaint Connecticut", "contractor Hartford", "contractor New Haven", "contractor Stamford", "contractor Bridgeport",
  ]) {
    assert.match(interpretConnecticut(q)?.href ?? "", /^\/connecticut/);
  }
});

test("exact number and bare-number boundary", () => {
  const exact = interpretConnecticut("HIC.0601454 Connecticut");
  assert.equal(exact?.interpretation.identifier, "HIC.0601454");
  assert.match(exact?.href ?? "", /credential=HIC\.0601454/);
  const bare = interpretConnecticut("0601454 Connecticut");
  assert.equal(bare?.interpretation.identifier, null);
  assert.match(bare?.definition?.body ?? "", /bare number is ambiguous/i);
  assert.equal(interpretConnecticut("0601454"), null);
  assert.equal(interpretConnecticut("Michigan contractor"), null);
});

test("network ranking refusals still precede Connecticut routing", () => {
  for (const q of ["best Connecticut contractor", "safest Connecticut electrician", "recommended Connecticut contractor", "recommend Connecticut contractor", "top-rated Connecticut plumber", "highest-rated Connecticut contractor", "#1 Connecticut contractor", "number one Connecticut contractor", "most trustworthy Connecticut contractor", "most trusted Connecticut contractor", "Trust Score Connecticut contractor", "AggregateRating Connecticut contractor", "ratingValue Connecticut contractor", "paid ranking Connecticut contractor", "sponsored ranking Connecticut contractor"]) {
    const result = interpretAskQuery(q, {} as Parameters<typeof interpretAskQuery>[1]);
    assert.equal(result.mode, "fail_closed", q);
  }
});
