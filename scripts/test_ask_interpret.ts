import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { phraseInText } from "../lib/ask/ontology";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";

const intel = loadContractorHubIntel();

test("short ontology tokens do not match inside longer words", () => {
  assert.equal(phraseInText("show me active roofing contractors", "ac"), false);
  assert.equal(phraseInText("active hvac contractors", "ac"), false);
  assert.equal(phraseInText("hvac ac contractor", "ac"), true);
  assert.equal(phraseInText("florida roofing", "fl"), false);
  assert.equal(phraseInText("fl roofing", "fl"), true);
});

test("entity query: active roofing in Broward", () => {
  const r = interpretAskQuery("Show me active roofing contractors in Broward County.", intel);
  assert.equal(r.supported, true);
  assert.equal(r.mode, "entity");
  assert.equal(r.href, "/florida/broward");
  assert.match(r.interpretation.location, /Broward/);
  assert.match(r.interpretation.trade, /Roofing/);
  assert.equal(r.count, null);
  assert.ok(r.interpretation.notes.some((n) => /not service territory/i.test(n)));
});

test("count query uses mapped family rows, not a Florida-only census", () => {
  const r = interpretAskQuery("How many active roofing contractors?", intel);
  assert.equal(r.supported, true);
  assert.equal(r.mode, "count");
  assert.equal(r.count?.value, intel.tradeFamilies.families.find((f) => f.id === "roofing")?.activeCurrentRows);
  assert.match(r.count?.caveat ?? "", /Not a Florida-only census/);
});

test("aggregate trade-family query is snapshot-backed", () => {
  const r = interpretAskQuery("Which contractor trades have the most active Florida-mapped credentials?", intel);
  assert.equal(r.supported, true);
  assert.equal(r.mode, "aggregate");
  assert.ok(r.aggregate && r.aggregate.length > 0);
  assert.deepEqual(
    r.aggregate.map((row) => row.value),
    r.aggregate.map((row) => row.value).slice().sort((a, b) => b - a)
  );
});

test("comparison is Broward vs Palm Beach coverage only, no permits", () => {
  const r = interpretAskQuery("Compare roofing credentials in Broward and Palm Beach.", intel);
  assert.equal(r.supported, true);
  assert.equal(r.mode, "comparison");
  assert.equal(r.comparison?.left.href, "/florida/broward");
  assert.equal(r.comparison?.right.href, "/florida/palm-beach");
  assert.match(r.comparison?.limitation ?? "", /Permit counts are not compared/);
  assert.equal(r.count, null);
});

test("evidence query uses indexed family rows and does not mean guilt", () => {
  const r = interpretAskQuery("Show contractors with Florida stop-work records.", intel);
  assert.equal(r.supported, true);
  assert.equal(r.mode, "evidence");
  const family = intel.regulatoryEvidence.byEvidenceFamily.find((f) => f.key === "fl_dfs_stop_work");
  assert.equal(r.count?.value, family?.rows);
  assert.match(r.count?.grain ?? "", /not contractors found guilty/i);
});

test("consumer complaints fail closed and do not substitute discipline", () => {
  const r = interpretAskQuery("Show me contractor complaints in Florida.", intel);
  assert.equal(r.supported, false);
  assert.equal(r.mode, "fail_closed");
  assert.equal(r.count, null);
  assert.match(r.failMessage ?? "", /does not currently have a comparable consumer-complaint dataset/i);
  assert.doesNotMatch(r.failMessage ?? "", /here are discipline records instead as complaints/i);
});

test("highest rate fails closed; most is not treated as a rate", () => {
  const rate = interpretAskQuery("Which trade has the highest rate of discipline?", intel);
  assert.equal(rate.supported, false);
  assert.equal(rate.mode, "fail_closed");
  assert.match(rate.failMessage ?? "", /rate/i);

  const most = interpretAskQuery("Which contractor trades have the most active Florida-mapped credentials?", intel);
  assert.equal(most.supported, true);
  assert.equal(most.mode, "aggregate");
});

test("unsupported query fails closed instead of inventing a count", () => {
  const r = interpretAskQuery("Who is the best contractor in America?", intel);
  assert.equal(r.supported, false);
  assert.equal(r.mode, "fail_closed");
  assert.equal(r.count, null);
});

test("definitional active/current question is interpreted, not invented", () => {
  const r = interpretAskQuery("What does an active/current credential mean?", intel);
  assert.equal(r.supported, true);
  assert.match(r.interpretation.notes.join(" "), /does not prove workmanship/i);
});

// TH-DISCOVERY-GEN-001: a resolved [PROVIDER CATEGORY] + [OPTIONAL GEOGRAPHY] must default to
// DISCOVERY. "plumber in Boca Raton" resolves a real trade (plumbing, a genuinely supported FL
// class) and a real city, but this file's own coarse GEO_ONTOLOGY only recognizes county names and
// a few fixed phrases, not arbitrary cities -- and lacking any of a handful of trigger words
// ("florida", "show", "find", "active"), it used to fall all the way through to the generic
// "could not map that question" dead end despite a fully valid trade. A resolved trade alone is
// now sufficient; geography (however phrased) never gates entry into entity/discovery mode here --
// the actual geography resolution and any broadening happens downstream in plan.ts/execute.ts.
for (const q of [
  "plumber in Boca Raton",
  "electrician in Boca Raton FL",
  "plumbers",
  "roofer",
  "HVAC contractor in Naples",
])
  test(`provider category + optional geography defaults to discovery: "${q}"`, () => {
    const r = interpretAskQuery(q, intel);
    assert.equal(r.supported, true, `expected "${q}" to be supported, got: ${r.failMessage}`);
    assert.equal(r.mode, "entity", `expected "${q}" to resolve to entity mode`);
  });
