import assert from "node:assert/strict";
import test from "node:test";
import { interpretAskQuery } from "./interpret";
import { buildContractorResearchQuery } from "./plan";
import { extractGeographyRequirement } from "./geography";
import { interpretRecovery } from "./recovery";
import { planContractorSearch } from "../search/contractor-discovery";
import { researchRoute } from "./request";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";

// TH-DISCOVERY-PARITY-001A: named Builder-2 audit FAIL/DANGEROUS strings for
// Contractor. All must reach a real, executable discovery plan (FL/NJ/TX are the
// only states with acquired licensing data -- see supportedStates in the
// specialist-execution/v2 capability contract) or, for a genuine brand name, an
// entity/identity lookup -- never the generic "we could not map that question" dead
// end this ticket's structural fixes target.
const intel = loadContractorHubIntel();

function plan(q: string) {
  const interpreted = interpretAskQuery(q, intel);
  return { interpreted, plan: buildContractorResearchQuery(interpreted) };
}

test("DANGEROUS: 'licensed electrician Miami-Dade' resolves a real FL county plan, trade stays labeled Electrical (never silently relabeled general)", () => {
  const { interpreted, plan: p } = plan("licensed electrician Miami-Dade");
  assert.match(interpreted.interpretation.trade, /Electrical/);
  assert.equal(p.executable, true);
  assert.equal(p.geography.state, "FL");
});

test("'roofing contractor near Jacksonville' resolves Duval County, FL (city->county alias)", () => {
  const { plan: p } = plan("roofing contractor near Jacksonville");
  assert.equal(p.executable, true);
  assert.equal(p.geography.state, "FL");
  assert.equal(p.trade.familyId, "roofing");
});

test("'kitchen remodeling company Denver' recognizes the trade synonym (building) even though CO has no acquired data", () => {
  const { interpreted } = plan("kitchen remodeling company Denver");
  assert.match(interpreted.interpretation.trade, /Building contractor/);
  assert.notEqual(interpreted.mode, "fail_closed");
});

test("'handyman near Plano Texas' recognizes the trade synonym (general)", () => {
  const { interpreted } = plan("handyman near Plano Texas");
  assert.match(interpreted.interpretation.trade, /General contractor/);
  assert.notEqual(interpreted.mode, "fail_closed");
});

test("'contractors around Tacoma' defaults to the broadest real trade class (general), not a dead end", () => {
  const { interpreted } = plan("contractors around Tacoma");
  assert.match(interpreted.interpretation.trade, /General contractor/);
  assert.notEqual(interpreted.mode, "fail_closed");
});

test("'home builder San Bernardino County' recognizes the trade synonym (building)", () => {
  const { interpreted } = plan("home builder San Bernardino County");
  assert.match(interpreted.interpretation.trade, /Building contractor/);
  assert.notEqual(interpreted.mode, "fail_closed");
});

test("'concrete driveway contractor' (no geography at all) still recognizes a real trade -- geography is optional, not a prerequisite", () => {
  const { interpreted } = plan("concrete driveway contractor");
  assert.match(interpreted.interpretation.trade, /General contractor/);
  assert.notEqual(interpreted.mode, "fail_closed");
});

test("'general contractor in Newark NJ': geography parsing itself now resolves NJ/Newark correctly (verified via extractGeographyRequirement)", () => {
  // TH-DISCOVERY-PARITY-001A: the PARSING gap this ticket targets is fixed --
  // extractGeographyRequirement("general contractor in Newark NJ") now correctly
  // resolves { requestedState: "NJ", requestedCity: "Newark", resolution: "EXACT" }
  // (previously this bare "TRADE PLACE" phrase never extracted a place at all). The
  // remaining reason buildContractorResearchQuery still nulls out plan.geography here
  // is a SEPARATE, deeper limitation: NJ's specialist-execution/v2 capability contract
  // does not list "general" among NJ's supported trade families at all, so the
  // capability check short-circuits geography with the trade rather than preserving
  // the real requested geography and broadening the TRADE with a clear label (the
  // doctrine's "unsupported requested trade -> show broader contractors, labeled"
  // requirement). Fixing that requires state-aware trade-broadening logic in
  // plan.ts/decideGeography this pass did not have DB access to safely verify --
  // flagged in the ticket report as a follow-up, not silently worked around here.
  const geo = extractGeographyRequirement("general contractor in Newark NJ");
  assert.equal(geo?.requestedState, "NJ");
  assert.equal(geo?.requestedCity, "Newark");
  assert.equal(geo?.resolution, "EXACT");
});

test("Roto-Rooter Colorado Springs is recognized as a brand-name identity lookup, not an unmapped dead end", () => {
  const { interpreted } = plan("Roto-Rooter Colorado Springs");
  assert.equal(interpreted.mode, "entity");
  assert.equal(interpreted.supported, true);
  assert.equal(interpreted.interpretation.entityQuery, "Roto-Rooter Colorado Springs");
});

// Section 9: fresh generalization corpus, deliberately distinct from the eight named
// audit strings above, spanning multiple trades/phrasing/geographies.
const FRESH_CASES: ReadonlyArray<readonly [string, RegExp]> = [
  ["plumber near Tampa Florida", /Plumbing/],
  ["find me a roofer in Orlando", /Roofing/],
  ["HVAC contractor Sarasota", /HVAC/],
  ["general contractors in Naples Florida", /General contractor/],
  ["looking for a home builder in Pensacola", /Building contractor/],
  ["kitchen remodeling contractor Clearwater", /Building contractor/],
  ["handyman in Tallahassee", /General contractor/],
  ["concrete contractor near Gainesville", /General contractor/],
  ["mechanical contractor Hialeah", /Mechanical/],
  ["pool contractor in Fort Lauderdale", /Pool/],
  ["solar contractor near Miami", /Solar/],
  ["plumbing contractor Broward County", /Plumbing/],
  ["driveway contractor Palm Beach County", /General contractor/],
  ["electrician near Trenton New Jersey", /Electrical/],
  ["plumber Newark New Jersey", /Plumbing/],
  ["home improvement contractor Jersey City", /Building contractor|General contractor/],
  ["can you find a roofer near Jacksonville Florida", /Roofing/],
  ["show me general contractors in Miami-Dade County", /General contractor/],
  ["I need a handyman near Orlando", /General contractor/],
  ["help me find a home builder near Tampa", /Building contractor/],
];

test(`fresh generalization corpus: ${FRESH_CASES.length} trade+place cases recognize a real trade family, never a dead end`, () => {
  for (const [q, tradePattern] of FRESH_CASES) {
    const { interpreted } = plan(q);
    assert.notEqual(interpreted.mode, "fail_closed", `expected a real trade match for "${q}", got fail_closed (${interpreted.failMessage ?? ""})`);
    assert.match(interpreted.interpretation.trade, tradePattern, `wrong/missing trade for "${q}": got "${interpreted.interpretation.trade}"`);
  }
});

test("aggregate/evidence wording still routes to evidence mode, not swallowed by the broadened trade default", () => {
  const r = interpretAskQuery("Show contractors with Florida stop-work records.", intel);
  assert.equal(r.mode, "evidence");
});

test("a personalized/deictic place reference is not silently treated as a real place", () => {
  const r = interpretAskQuery("contractor serving my address", intel);
  assert.equal(r.supported, false);
});

test("quality/ranking claims stay correctly refused, not swallowed by the broadened trade default", () => {
  const r = interpretAskQuery("best roofer in Broward", intel);
  assert.equal(r.supported, false);
});

// TH-DISCOVERY-PARITY-001A-REVIEW section 5: Vercel finding on PR #81 -- the bare
// "TRADE PLACE" extraction could leave a generic provider descriptor ("contractors",
// "companies", "business", "services", "firm", "provider") as the REMAINDER after
// stripping a single-word trade phrase ("roofing" from "roofing contractors"), and
// treat that leftover descriptor as if it were a place name, inventing a bogus
// AMBIGUOUS city and making an ordinary location-less query non-executable.
const LOCATION_LESS_TRADE_CASES: ReadonlyArray<readonly [string, RegExp]> = [
  ["roofing contractors", /Roofing/],
  ["plumbing contractors", /Plumbing/],
  ["electrical contractors", /Electrical/],
  ["general contractors", /General contractor/],
  ["HVAC companies", /HVAC/],
  ["remodeling companies", /Building contractor/],
];

test(`location-less trade phrases (${LOCATION_LESS_TRADE_CASES.length} cases) remain provider discovery with NO fabricated place`, () => {
  for (const [q, tradePattern] of LOCATION_LESS_TRADE_CASES) {
    const { interpreted } = plan(q);
    assert.notEqual(interpreted.mode, "fail_closed", `expected discovery for "${q}", got fail_closed (${interpreted.failMessage ?? ""})`);
    assert.match(interpreted.interpretation.trade, tradePattern, `wrong/missing trade for "${q}"`);
    assert.equal(interpreted.interpretation.location, "Not specified", `must not invent a fake place for "${q}"`);
  }
});

// TH-DISCOVERY-PARITY-001A-REVIEW section 7: a genuinely unsupported STATE (no
// contractor-license directory data acquired at all) must not end with an empty
// wall -- Results-First requires an honestly-labeled BROADER TrustHub directory
// fallback, generically, not hard-coded to only CO/WA/CA.
// NOTE: California is deliberately excluded from this generic list -- it has its
// own, more specific pre-existing recovery (real identity Verify + official CSLB
// search), asserted separately below, since that is a genuinely better answer than
// the generic broader-directory fallback for a state with SOME real capability.
const UNSUPPORTED_STATE_CASES = [
  ["contractor in Denver Colorado", "Colorado"],
  ["contractor around Tacoma Washington", "Washington"],
  ["roofers in Alaska", "Alaska"],
];

test(`unsupported-state fallback (${UNSUPPORTED_STATE_CASES.length} cases, generic) shows a real, honestly-labeled broader directory instead of a dead end`, () => {
  for (const [q, stateLabel] of UNSUPPORTED_STATE_CASES) {
    const r = interpretRecovery(q);
    assert.ok(r, `expected a recovery response for "${q}"`);
    assert.equal(r!.capabilityState, "COHORT_UNAVAILABLE", `expected COHORT_UNAVAILABLE for "${q}"`);
    assert.match(r!.answer, /REQUESTED STATE COVERAGE/, `expected the two-part disclosure for "${q}"`);
    assert.match(r!.answer, /BROADER TRUSTHUB CONTRACTOR DIRECTORY/, `expected a labeled broader directory for "${q}"`);
    assert.match(r!.answer, new RegExp(`NOT ${stateLabel}-specific`), `must prominently disclaim the broader results are not ${stateLabel}-specific`);
    assert.ok(r!.actions.some((a) => a.kind === "INTERNAL_RESEARCH" && a.destination.startsWith("/florida/")), `expected a real, currently-covered TrustHub directory destination for "${q}"`);
  }
});

test("California keeps its own dedicated identity-verify recovery, not the generic broader-directory fallback (it has a genuinely better real alternative)", () => {
  const r = interpretRecovery("general contractors in Los Angeles California")!;
  assert.equal(r.capabilityState, "COHORT_UNAVAILABLE");
  assert.doesNotMatch(r.answer, /BROADER TRUSTHUB CONTRACTOR DIRECTORY/);
  assert.deepEqual(r.actions.map((a) => a.destination), [
    "/verify?state=ca",
    "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx",
  ]);
});

// Section 6: "general contractor in Newark NJ" must route to the /search (non-FL)
// discovery engine with geography AND trade preserved, not dead-end or drop NJ.
test("NJ general-contractor query preserves geography through the real routing decision (routes to /search, not a dead end)", () => {
  const q = "general contractor in Newark NJ";
  const discoveryPlan = planContractorSearch(q, {});
  assert.equal(discoveryPlan.mode, "discovery");
  if (discoveryPlan.mode === "discovery") {
    assert.equal(discoveryPlan.request.state, "NJ");
    assert.equal(discoveryPlan.request.trade, "general");
    assert.equal(discoveryPlan.request.geography?.city, "Newark");
  }
  assert.equal(researchRoute(q, discoveryPlan), "/search");
});

// Section 8: exact trade safety re-test -- the DANGEROUS finding must never
// resurface. A general/remodeling contractor must never be presented AS an
// electrician; the interpreted trade must stay labeled Electrical throughout.
test("DANGEROUS re-test: 'licensed electrician Miami-Dade' never relabels a broader contractor as an electrician", () => {
  const { interpreted, plan: p } = plan("licensed electrician Miami-Dade");
  assert.match(interpreted.interpretation.trade, /^Electrical\b/);
  assert.doesNotMatch(interpreted.interpretation.trade, /General contractor|Building contractor/);
  assert.equal(p.executable, true);
  assert.equal(p.geography.state, "FL");
});
