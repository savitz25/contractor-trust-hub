import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTRACTOR_SEARCH_GOLDEN_QUESTIONS, GOLDEN_SCORE } from "../lib/ask/golden-questions";
import { interpretAskQuery } from "../lib/ask/interpret";
import { buildContractorResearchQuery, ASK_PAGE_SIZE, ASK_MAX_PAGE } from "../lib/ask/plan";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { CONTRACTOR_SEARCH_CAPABILITIES } from "../lib/specialist-search/capabilities";
import { SPECIALIST_SEARCH_ANALYTICS_EVENTS, SPECIALIST_SEARCH_VERSION } from "../lib/specialist-search/contract";
import { suggestAskCompletions } from "../lib/ask/suggest";
import { planContractorSearch } from "../lib/search/contractor-discovery";

const intel = loadContractorHubIntel();

test("Specialist Search V1 portable contract and safe capability states are stable", () => {
  assert.equal(SPECIALIST_SEARCH_VERSION, "trusthub-specialist-search-v1");
  assert.deepEqual(CONTRACTOR_SEARCH_CAPABILITIES.map((x) => x.supportState), ["KNOWN", "PARTIAL", "PARTIAL", "NOT_ACQUIRED", "UNKNOWN", "PARTIAL"]);
  assert.equal(SPECIALIST_SEARCH_ANALYTICS_EVENTS.length, 7);
});

test("golden corpus has at least 50 classified questions and no accepted FAIL", () => {
  assert.ok(CONTRACTOR_SEARCH_GOLDEN_QUESTIONS.length >= 50);
  assert.equal(GOLDEN_SCORE.fail, 0);
  assert.equal(Object.values(GOLDEN_SCORE).reduce((a, b) => a + b, 0), CONTRACTOR_SEARCH_GOLDEN_QUESTIONS.length);
});

test("every golden PASS reaches a deterministic Ask or state-specialist plan", () => {
  for (const row of CONTRACTOR_SEARCH_GOLDEN_QUESTIONS.filter((x) => x.expected === "PASS")) {
    const ask = interpretAskQuery(row.query, intel);
    const statePlan = planContractorSearch(row.query);
    assert.ok(ask.supported || statePlan.mode === "discovery" || statePlan.mode === "verify", row.query);
  }
});

test("exact identity precedes broad research and public facts remain source-backed", () => {
  for (const query of ["CCC1332036", "license CCC1332036", "CGC1520610"]) {
    const interpreted = interpretAskQuery(query, intel);
    const plan = buildContractorResearchQuery(interpreted);
    assert.equal(plan.mode, "entity");
    assert.ok(plan.identity.identifier);
    assert.equal(plan.executable, true);
  }
  const company = buildContractorResearchQuery(interpretAskQuery("Restorations Florida LLC", intel));
  assert.equal(company.identity.entityQuery, "Restorations Florida LLC");
});

test("unsupported quality, complaint, service-area and permit claims fail safely", () => {
  for (const query of ["best roofer in Broward", "contractors with no complaints", "contractor serving my address", "roofers with permit records"]) {
    const result = interpretAskQuery(query, intel);
    assert.equal(result.supported, false);
    assert.match(result.failMessage || "", /not|does not|available|cannot/i);
  }
});

test("execution is bounded and advanced enums reject arbitrary values", () => {
  const plan = buildContractorResearchQuery(interpretAskQuery("active roofers in Broward County", intel), { page: "99999", trade: "DROP TABLE", evidence: "secret", status: "anything" });
  assert.equal(plan.page, ASK_MAX_PAGE);
  assert.equal(plan.limit, ASK_PAGE_SIZE);
  assert.equal(plan.trade.familyId, "roofing");
  assert.equal(plan.evidenceFamily, null);
});

test("analytics contract contains no raw query or exact identity dimensions", () => {
  const source = JSON.stringify(SPECIALIST_SEARCH_ANALYTICS_EVENTS);
  assert.doesNotMatch(source, /rawQuery|profileId|credential|email/i);
});

test("short AC synonym does not create an HVAC suggestion from the word active", () => {
  assert.equal(suggestAskCompletions("active roofers in Broward").some((x) => x.label.includes("Air Conditioning")), false);
});

test("New York public-work registry is not a HIC roster and does not rank", () => {
  const pw = interpretAskQuery("public work contractors registered in New York", intel);
  assert.equal(pw.supported, true);
  assert.equal(pw.href, "/new-york");
  assert.equal(pw.count?.value, 14665);
  assert.match(pw.count?.caveat || "", /not a residential HIC/i);
  const hic = interpretAskQuery("is my New York home-improvement contractor licensed?", intel);
  assert.equal(hic.supported, false);
  assert.match(hic.failMessage || "", /not a statewide home-improvement/i);
  const mold = interpretAskQuery("New York mold remediation contractor", intel);
  assert.equal(mold.supported, false);
  assert.match(mold.failMessage || "", /Mold Program/i);
  const asb = interpretAskQuery("New York asbestos contractor", intel);
  assert.equal(asb.supported, false);
  assert.match(asb.failMessage || "", /certificate of competence/i);
  const debar = interpretAskQuery("is this contractor debarred?", intel);
  assert.equal(debar.supported, false);
  assert.match(debar.failMessage || "", /not a criminal conviction/i);
  const best = interpretAskQuery("best contractor in New York", intel);
  assert.equal(best.supported, false);
  assert.match(best.failMessage || "", /does not rank/i);
});
