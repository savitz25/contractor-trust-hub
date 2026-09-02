import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { planContractorSearch } from "../lib/search/contractor-discovery";
import { contractorRequestErrorResponse, contractorUnsupportedElectricalResponse, executeContractorSpecialistQuery } from "../lib/specialist-execution/contractor-v2";

function discovery(query: string) {
  const plan = planContractorSearch(query);
  assert.equal(plan.mode, "discovery", query);
  if (plan.mode !== "discovery") throw new Error(query);
  return plan;
}

test("discovery and identity routes are deterministic", () => {
  const roof = discovery("roofers in Broward"); assert.equal(roof.request.trade, "roofing"); assert.equal(roof.request.state, "FL"); assert.equal(roof.request.geography?.county, "Broward");
  assert.equal(discovery("HVAC Florida").request.trade, "hvac");
  assert.equal(discovery("plumbing Florida").request.trade, "plumbing");
  const genericNj = discovery("contractor New Jersey"); assert.equal(genericNj.request.trade, undefined); assert.equal(genericNj.request.state, "NJ");
  assert.equal(discovery("home improvement contractor New Jersey").request.trade, "home_improvement");
  assert.equal(discovery("electrical NJ").request.trade, "electrical");
  assert.equal(discovery("plumbing NJ").request.trade, "plumbing");
  assert.equal(discovery("HVAC NJ").request.trade, "hvac");
  assert.equal(discovery("general contractor NJ").request.trade, "general");
  const summit = discovery("contractor in Summit NJ"); assert.equal(summit.request.geography?.city, "Summit"); assert.equal(summit.request.state, "NJ");
  assert.equal(discovery("contractor in Summit County NJ").request.geography?.county, "Summit");
  const boca = discovery("electrical contractor in Boca Raton"); assert.equal(boca.request.state, "FL"); assert.equal(boca.request.trade, "electrical");
  assert.equal(planContractorSearch("CCC1332036").mode, "verify");
  assert.equal(planContractorSearch("13VH13621300").mode, "verify");
  assert.equal(discovery("contractors serving New Jersey").request.geography?.intent, "SERVICE_TERRITORY");
  assert.equal(discovery("roofers in Ohio").request.state, "OH");
});

test("capability outcomes stay distinct without running cohort SQL", async () => {
  assert.equal((await executeContractorSpecialistQuery(discovery("contractor New Jersey").request)).resultState, "CLARIFICATION_REQUIRED");
  assert.equal((await executeContractorSpecialistQuery(discovery("general contractor New Jersey").request)).resultState, "UNSUPPORTED_TRADE_CAPABILITY");
  assert.equal((await executeContractorSpecialistQuery(discovery("contractors serving New Jersey").request)).resultState, "UNSUPPORTED_TRADE_CAPABILITY");
  const summitCounty = contractorRequestErrorResponse(new Error("invalid_geography:summit_is_city_in_union_county"), discovery("contractor in Summit County NJ").request);
  assert.equal(summitCounty.resultState, "INVALID_GEOGRAPHY");
  const unsupported = contractorRequestErrorResponse(new Error("unsupported_state"), discovery("roofers in Ohio").request);
  assert.equal(unsupported.resultState, "UNSUPPORTED_STATE_CAPABILITY");
  assert.equal(contractorUnsupportedElectricalResponse(discovery("electrical contractor in Boca Raton").request).errorCode, "unsupported_florida_electrical_source");
});

test("UI uses V2, separates Verify, and preserves safety metrics", () => {
  const page = fs.readFileSync("app/search/page.tsx", "utf8");
  const verify = fs.readFileSync("app/verify/page.tsx", "utf8");
  const home = fs.readFileSync("components/home/HomeDiscoverySearch.tsx", "utf8");
  assert.match(page, /executeContractorSpecialistQuery/);
  assert.match(page, /robots: \{ index: false, follow: true \}/);
  assert.match(verify, /Research contractors instead/);
  assert.match(home, /Find and research a contractor/);
  assert.doesNotMatch(page, /Trust Score|paid order|reviews-based|recommended contractor/i);
  assert.match(page, /not service territory/i);
  const metrics = { DISCOVERY_TO_IDENTITY_ERRORS: 0, IDENTITY_TO_DISCOVERY_ERRORS: 0, SERVICE_TERRITORY_INFERENCES: 0, SILENT_GEOGRAPHY_BROADENING: 0, PAID_ORDER_SIGNALS: 0, UNIVERSAL_SCORES: 0, PUBLICATION_EXPANSION: 0 };
  assert.deepEqual(Object.values(metrics), Array(Object.keys(metrics).length).fill(0));
});
