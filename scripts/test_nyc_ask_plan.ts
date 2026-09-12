import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { NYC_SNAPSHOT } from "../lib/new-york-city-intelligence/snapshot";
import { NEW_YORK_SNAPSHOT } from "../lib/new-york-intelligence/snapshot";

const intel = loadContractorHubIntel();
function ask(q: string) {
  return interpretAskQuery(q, intel);
}

test("NYC HIC license questions route to the NYC page, not NYSDOL", () => {
  const a = ask("home improvement contractor license in NYC");
  assert.equal(a.href, "/new-york/new-york-city");
  assert.equal(a.supported, false);
  assert.match(a.failMessage || "", /DCWP/i);
  const b = ask("is this contractor licensed in New York City?");
  assert.equal(b.href, "/new-york/new-york-city");
});

test("public-work New York stays statewide", () => {
  const a = ask("How many public-work registry certificates are in the New York snapshot?");
  assert.equal(a.href, "/new-york");
  assert.equal(a.count?.value, NEW_YORK_SNAPSHOT.registry.parsed_rows);
  const b = ask("public work contractor in New York");
  assert.equal(b.href, "/new-york");
});

test("NYC complaints keep DCWP limitations", () => {
  const a = ask("NYC contractor complaints");
  assert.equal(a.href, "/new-york/new-york-city");
  assert.match(a.failMessage || "", /complaint is not a violation/i);
  assert.notEqual(a.count?.value, NYC_SNAPSHOT.complaints.parsed_rows);
  const named = ask("complaints against ABC Construction in NYC");
  assert.equal(named.count, null);
  assert.match(named.failMessage || "", /exact/i);
});

test("ranking and roofing borough questions do not become recommendations", () => {
  const rank = ask("best contractor in Manhattan");
  assert.equal(rank.supported, false);
  assert.equal(rank.count, null);
  assert.notEqual(rank.href, "/new-york/manhattan");
  assert.match(`${rank.failMessage || ""} ${(rank.changeHints || []).join(" ")}`, /rank|recommend/i);
  const roof = ask("roofing contractor in Brooklyn");
  assert.equal(roof.href, "/new-york/new-york-city");
  assert.match(roof.failMessage || "", /not automatically/i);
});

test("licensed in New York without NYC/HIC context does not auto-pick DCWP", () => {
  const a = ask("contractor licensed in New York");
  assert.notEqual(a.href, "/new-york/new-york-city");
});
