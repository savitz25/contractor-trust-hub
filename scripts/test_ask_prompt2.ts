import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { phraseInText } from "../lib/ask/ontology";
import { buildContractorResearchQuery } from "../lib/ask/plan";
import { suggestTypos } from "../lib/ask/typos";
import { detectContradiction, detectUnsupportedConcept } from "../lib/ask/unsupported";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";

const intel = loadContractorHubIntel();

function planFor(q: string, overrides = {}) {
  const interpreted = interpretAskQuery(q, intel);
  return { interpreted, plan: buildContractorResearchQuery(interpreted, overrides) };
}

test("P2 entity: active Broward roofing maps trade/geo/status and is executable", () => {
  const { interpreted, plan } = planFor("Show me active roofing contractors in Broward County.");
  assert.equal(interpreted.mode, "entity");
  assert.equal(plan.trade.familyId, "roofing");
  assert.deepEqual(plan.trade.occupationCodes, ["CCC", "RC"]);
  assert.equal(plan.geography.countySlug, "broward");
  assert.equal(plan.geography.evidenceType, "mailing_address");
  assert.equal(plan.credentialStatus, "active_current");
  assert.equal(plan.executable, true);
  assert.match(plan.geography.method, /not service territory/i);
});

test("P2 entity: active Palm Beach general", () => {
  const { plan } = planFor("Show active general contractors in Palm Beach County.");
  assert.equal(plan.trade.familyId, "general");
  assert.deepEqual(plan.trade.occupationCodes, ["CGC", "RG"]);
  assert.equal(plan.geography.countySlug, "palm-beach");
});

test("P2 entity: Florida HVAC does not include mechanical classes", () => {
  const { plan } = planFor("Show Florida HVAC contractors.");
  assert.equal(plan.trade.familyId, "hvac");
  assert.deepEqual(plan.trade.occupationCodes, ["CAC", "RA"]);
  assert.equal(plan.geography.state, "FL");
});

test("P2 entity: Florida roofing + DBPR discipline keeps both filters", () => {
  const { interpreted, plan } = planFor(
    "Show me active roofing contractors in Broward County with DBPR discipline records."
  );
  assert.equal(interpreted.mode, "entity");
  assert.equal(plan.trade.familyId, "roofing");
  assert.equal(plan.evidenceFamily, "dbpr_discipline");
  assert.equal(plan.geography.countySlug, "broward");
});

test("P2 evidence families parse without becoming complaints", () => {
  assert.equal(interpretAskQuery("Show Florida contractors with DBPR discipline.", intel).mode, "evidence");
  assert.equal(interpretAskQuery("Show contractors with Florida stop-work records.", intel).mode, "evidence");
  assert.equal(interpretAskQuery("Show Florida unlicensed activity records.", intel).mode, "evidence");
  assert.equal(interpretAskQuery("Show Florida recovery fund records.", intel).mode, "evidence");
});

test("P2 count and aggregate", () => {
  const count = interpretAskQuery("How many active roofing credentials are indexed?", intel);
  assert.equal(count.mode, "count");
  const agg = interpretAskQuery("Which trades have the most active/current credentials?", intel);
  assert.equal(agg.mode, "aggregate");
  assert.ok(agg.aggregate && agg.aggregate.length > 0);
});

test("P2 comparison is Broward vs Palm Beach coverage/address, not permits", () => {
  const { interpreted, plan } = planFor("Compare contractor research in Broward and Palm Beach.");
  assert.equal(interpreted.mode, "comparison");
  assert.deepEqual(plan.compareCountySlugs, ["broward", "palm-beach"]);
  assert.match(interpreted.comparison?.limitation ?? "", /Permit counts are not compared/);
});

test("P2 fail closed: complaints, BBB, rate, best, cheapest, insured, service area, permits", () => {
  assert.equal(interpretAskQuery("Contractors with the most complaints in Broward.", intel).mode, "fail_closed");
  assert.equal(interpretAskQuery("BBB complaints in Florida.", intel).mode, "fail_closed");
  assert.equal(interpretAskQuery("Which trade has the highest discipline rate?", intel).mode, "fail_closed");
  assert.equal(interpretAskQuery("Who is the best contractor in America?", intel).mode, "fail_closed");
  assert.equal(interpretAskQuery("cheapest roofer in Broward", intel).mode, "fail_closed");
  assert.equal(interpretAskQuery("insured contractors in Florida", intel).mode, "fail_closed");
  assert.equal(interpretAskQuery("contractors who serve my neighborhood", intel).mode, "fail_closed");
  assert.equal(interpretAskQuery("compare permit volume in Broward and Palm Beach", intel).mode, "fail_closed");
});

test("P2 semantic safety: active ≠ HVAC, florida ≠ stray FL token, grain notes, no clean record", () => {
  assert.equal(phraseInText("show me active roofing contractors", "ac"), false);
  assert.equal(phraseInText("florida roofing", "fl"), false);
  const { plan } = planFor("Show me active roofing contractors in Broward County.");
  assert.notEqual(plan.grain, "none");
  assert.match(plan.notes.join(" "), /does not establish their complete service area/);
  assert.equal(detectUnsupportedConcept("no complaints clean record")?.key, undefined);
});

test("P2 contradictions: active+expired and two counties without compare", () => {
  assert.match(detectContradiction("active expired roofing contractors", 0, false) ?? "", /Active\/current and Expired/);
  const r = interpretAskQuery("Broward contractors in Palm Beach", intel);
  assert.equal(r.mode, "fail_closed");
  assert.match(r.failMessage ?? "", /more than one county/);
});

test("P2 typos suggest and do not silently rewrite", () => {
  const s = suggestTypos("browerd roofng genral contractor");
  assert.ok(s.some((x) => x.to.includes("broward") || x.label.toLowerCase().includes("broward")));
});

test("P2 snapshot fingerprint is unchanged by Ask plan construction", () => {
  assert.equal(intel.schemaVersion, "contractor-hub-intel-v2");
  assert.equal(intel.sourceFingerprint.length, 64);
  assert.equal(intel.publicCoverage.credentialRecords, 644421);
  assert.equal(intel.publicCoverage.activeCurrentCredentialRecords, 499997);
});

test("P2 filter override can clear evidence without rewriting the sentence", () => {
  const { plan } = planFor("Show me active roofing contractors in Broward County with DBPR discipline records.", {
    evidence: "-",
  });
  assert.equal(plan.evidenceFamily, null);
  assert.equal(plan.trade.familyId, "roofing");
  assert.equal(plan.geography.countySlug, "broward");
});
