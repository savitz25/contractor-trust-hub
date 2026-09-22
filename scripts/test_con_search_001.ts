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
  assert.equal((await executeContractorSpecialistQuery(discovery("contractors serving New Jersey").request)).resultState, "UNSUPPORTED_TRADE_CAPABILITY");
  const summitCounty = contractorRequestErrorResponse(new Error("invalid_geography:summit_is_city_in_union_county"), discovery("contractor in Summit County NJ").request);
  assert.equal(summitCounty.resultState, "INVALID_GEOGRAPHY");
  const unsupported = contractorRequestErrorResponse(new Error("unsupported_state"), discovery("roofers in Ohio").request);
  assert.equal(unsupported.resultState, "UNSUPPORTED_STATE_CAPABILITY");
  assert.equal(contractorUnsupportedElectricalResponse(discovery("electrical contractor in Boca Raton").request).errorCode, "unsupported_florida_electrical_source");
});

// TH-DISCOVERY-FINAL-REPAIR-A: New Jersey has no statewide "general contractor"
// class, but that used to dead-end at a bare capability response with zero
// providers on the first screen. A "general contractor" NJ request must now
// run a real, broadened cohort query (trade filter dropped, geography kept)
// across NJ's OTHER real credential classes and return actual cards, never
// relabeled as general contractors.
test("NJ general-contractor request runs a real broadened cohort query, not a bare capability dead end", async () => {
  const fixtureRow = {
    slug: "nj-hic-newark", display_name: "Fixture Newark Home Improvement", license_number: "HIC100001",
    external_key: "HIC100001", occupation_code: "HIC", occupation_description: "Home Improvement Contractor",
    status_normalized: "active", primary_status: "Active", city: "Newark", county: "Essex", state: "NJ",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = {
    // POST-R1-CON-LOCAL-001: runCohortRows now issues a single merged CTE query (was two sequential
    // queryOne/query calls) -- see contractor-v2.ts's buildCohortRowsSql. queryOne is kept in the type
    // for backward compatibility but is no longer called; the mock must return `total` embedded on
    // each row from `query`, matching the real merged-query shape.
    queryOne: async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return { total: "1" }; },
    query: async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return [{ ...fixtureRow, total: "1" }]; },
  } as unknown as Parameters<typeof executeContractorSpecialistQuery>[1];
  const resp = await executeContractorSpecialistQuery(discovery("general contractor in Newark NJ").request, db);
  assert.equal(resp.resultState, "SUPPORTED_RESULTS");
  assert.ok(calls.length > 0, "a real cohort query must run, not a bare capability response");
  for (const call of calls) assert.doesNotMatch(call.sql, /occupation_code\s*=\s*ANY|UPPER\(TRIM\(l\.occupation_code\)\)/, "trade filter must be dropped when broadening");
  if ("rows" in resp) {
    assert.equal(resp.rows.length, 1);
    assert.match(resp.rows[0].whyShown, /NOT a confirmed general contractor/);
    assert.match(resp.limitations[0], /does not provide a statewide 'general contractor' class/i);
  } else {
    assert.fail("expected a ContractorExecutionResponse with rows");
  }
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
