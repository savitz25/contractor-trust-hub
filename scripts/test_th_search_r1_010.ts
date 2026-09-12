import assert from "node:assert/strict";
import test from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { buildContractorResearchQuery } from "../lib/ask/plan";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { interpretRecovery } from "../lib/ask/recovery";
import {
  RECOVERY_SOURCES,
  isOfficialRecoveryDestination,
} from "../lib/ask/recovery-sources";
import { executeContractorResearchQuery } from "../lib/ask/execute";
import { readAskRequest, researchRoute } from "../lib/ask/request";
import { planContractorSearch } from "../lib/search/contractor-discovery";
import { RecoveryAnswer } from "../components/ask/RecoveryAnswer";
import { renderToStaticMarkup } from "react-dom/server";
const intel = loadContractorHubIntel();
test('New York certificate verification remains in its existing source-specific operation',()=>{const r=interpretAskQuery('Check this New York certificate 26-697KD-CR',intel);assert.equal(r.supported,false);assert.equal(r.interpretation.identifier,'26-697KD-CR');assert.equal(r.recovery,undefined);assert.match(r.failMessage??'',/does not run an interactive/);});
test('licensed policy wording and cleared trade do not become a cohort',()=>{assert.equal(interpretRecovery('Are general contractors licensed statewide in Texas?')?.requestedTask,'REGULATORY_EXPLANATION');assert.equal(interpretRecovery('Does Texas license general contractors statewide?',{trade:'-'})?.capabilityState,'NEEDS_CLARIFICATION');});
test('other live internal Verify jurisdictions never fall back to Florida',()=>{const r=interpretRecovery('How do I verify a plumber in New Jersey?')!;assert.equal(r.actions[0].destination,'/verify?state=nj');});
for (const [q, task, state] of [
  ["how do I verify a contractor license in Florida?", "VERIFY_GUIDANCE", "FL"],
  [
    "Does Texas license general contractors statewide?",
    "REGULATORY_EXPLANATION",
    "TX",
  ],
  ["hire a contractor for tomorrow", "TRANSACTION", null],
  ["elevator contractor Alaska", "UNSUPPORTED_JURISDICTION_RESEARCH", "AK"],
  [
    "general contractors in Los Angeles California",
    "UNSUPPORTED_JURISDICTION_RESEARCH",
    "CA",
  ],
] as const)
  test(`original recovery: ${q}`, () => {
    const r = interpretAskQuery(q, intel);
    assert.equal(r.recovery?.requestedTask, task);
    assert.equal(r.recovery?.requestedState, state);
    assert.ok(r.recovery?.actions.length);
    assert.equal(buildContractorResearchQuery(r).executable, false);
  });

for (const q of [
  "How can I check a Florida contractor?",
  "check a Florida contractor license",
  "Where can I verify a Florida license?",
  "Please verify a Florida contractor license",
])
  test(`guidance paraphrase: ${q}`, async () => {
    const r = interpretAskQuery(q, intel),
      p = buildContractorResearchQuery(r);
    assert.equal(r.recovery?.requestedTask, "VERIFY_GUIDANCE");
    assert.equal(r.recovery?.actions[0].destination, "/verify?state=fl");
    const e = await executeContractorResearchQuery(p);
    assert.equal(e.contractorCount, null);
    assert.equal(e.results.length, 0);
    assert.match(e.sqlContract, /No query/);
  });
test("unqualified license guidance requests jurisdiction, never default Florida", () => {
  const r = interpretRecovery("Where can I verify this license?")!;
  assert.equal(r.requestedState, null);
  assert.equal(r.capabilityState, "NEEDS_CLARIFICATION");
  assert.deepEqual(
    r.actions.map((a) => a.kind),
    ["CLARIFY"],
  );
});
for (const q of ["verify CCC1332036", "How do I check CCC1332036 in Florida?"])
  test(`credential precedence: ${q}`, () => {
    const r = interpretAskQuery(q, intel),
      p = buildContractorResearchQuery(r);
    assert.equal(r.interpretation.identifier, "CCC1332036");
    assert.equal(p.identity.identifier, "CCC1332036");
    assert.equal(p.recovery, null);
    assert.equal(p.executable, true);
  });
for (const q of [
  "Do I need a state GC license in Texas?",
  "Who licenses general contractors in Texas?",
  "Does Texas license general contractors statewide?",
])
  test(`Texas policy paraphrase: ${q}`, () => {
    const r = interpretRecovery(q)!;
    assert.equal(r.requestedTask, "REGULATORY_EXPLANATION");
    assert.match(
      r.answer,
      /does not require a statewide general-contractor license/,
    );
    assert.equal(r.requestedTrade, "general");
    assert.equal(r.actions[0].sourceId, "texasGc");
    assert.doesNotMatch(r.actions[0].destination, /LicenseSearch/);
  });
test("Texas HVAC discovery and GC policy remain separate; conflicting override clarifies", () => {
  assert.equal(interpretRecovery("HVAC contractors in Texas"), null);
  const r = interpretRecovery(
    "Does Texas license general contractors statewide?",
    { trade: "hvac" },
  )!;
  assert.equal(r.capabilityState, "NEEDS_CLARIFICATION");
  assert.doesNotMatch(r.answer, /does not require/);
  assert.equal(r.actions[0].kind, "CLARIFY");
});
for (const q of [
  "hire a contractor for tomorrow",
  "book a roofer",
  "schedule an electrician",
  "can you send me a plumber?",
  "I need someone today",
])
  test(`transaction boundary: ${q}`, () => {
    const r = interpretRecovery(q)!;
    assert.equal(r.requestedTask, "TRANSACTION");
    assert.match(
      r.answer,
      /does not hire, dispatch, schedule, or guarantee contractor availability/,
    );
    assert.ok(r.actions.some((a) => a.kind === "CLARIFY"));
  });
for (const [q, trade, county] of [
  ["book a roofer in Broward County", "roofing", "Broward"],
  ["I need a roofer in Broward tomorrow", "roofing", "Broward"],
  ["need a plumber today in Palm Beach", "plumbing", "Palm Beach"],
] as const)
  test(`transaction research continuation: ${q}`, () => {
    const r = interpretRecovery(q, {
      status: "expired",
      evidence: "dbpr_discipline",
      sort: "credential",
    })!;
    assert.equal(r.requestedTrade, trade);
    assert.equal(r.requestedState, "FL");
    const a = r.actions.find((a) => a.kind === "INTERNAL_RESEARCH")!;
    assert.ok(a);
    const u = new URL(a.destination, "https://www.contractortrusthub.com");
    assert.equal(u.searchParams.get("status"), "expired");
    assert.equal(u.searchParams.get("evidence"), "dbpr_discipline");
    assert.equal(u.searchParams.get("sort"), "credential");
    const { query, overrides, error } = readAskRequest(
      Object.fromEntries(u.searchParams),
    );
    assert.equal(error, null);
    assert.equal(interpretRecovery(query, overrides), null);
    const p = planContractorSearch(query, overrides);
    assert.equal(p.mode, "discovery");
    if (p.mode === "discovery") {
      assert.equal(p.request.trade, trade);
      assert.equal(p.geographyRequirement?.executionGeography?.county, county);
    }
  });
test("booking typo cannot bypass R1-009 correction consent", () => {
  const r = interpretRecovery("book a roofer in browrd county fl")!;
  const u = new URL(
    r.actions[0].destination,
    "https://www.contractortrusthub.com",
  );
  const p = planContractorSearch(u.searchParams.get("q")!);
  assert.equal(p.mode, "discovery");
  if (p.mode === "discovery") {
    assert.equal(p.geographyRequirement?.executionGeography, undefined);
    assert.equal(p.geographyRequirement?.resolution, "CORRECTION_SUGGESTED");
  }
});
test("California preserves Los Angeles and offers separate Verify, not a broad cohort", () => {
  const r = interpretRecovery("general contractors in Los Angeles California")!;
  assert.equal(r.requestedGeography?.requestedCity, "Los Angeles");
  assert.equal(r.requestedState, "CA");
  assert.equal(r.requestedTrade, "general");
  assert.match(r.answer, /cannot apply this Los Angeles, California filter/);
  assert.deepEqual(
    r.actions.map((a) => a.destination),
    [
      "/verify?state=ca",
      "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx",
    ],
  );
  assert.ok(
    r.actions.every((a) => !a.destination.includes("geoAction=broaden")),
  );
});
test("CA unsupported explicit broadening cannot manufacture a supported cohort", () => {
  const r = interpretRecovery("general contractors in Los Angeles California", {
    geoAction: "broaden",
    geoChoice: "ca",
  })!;
  assert.equal(r.capabilityState, "COHORT_UNAVAILABLE");
  assert.equal(r.requestedGeography?.requestedCity, "Los Angeles");
  assert.equal(
    buildContractorResearchQuery(interpretAskQuery(r.originalQuery, intel), {
      geoAction: "broaden",
      geoChoice: "ca",
    }).executable,
    false,
  );
});
for (const q of [
  "elevator contractor Alaska",
  "elevator contractors in Alaska",
])
  test(`Alaska equipment-specific official recovery: ${q}`, () => {
    const r = interpretRecovery(q)!;
    assert.equal(r.requestedTrade, "elevator");
    assert.equal(r.requestedState, "AK");
    assert.equal(
      r.actions[0].destination,
      "https://labor.alaska.gov/lss/elevators.htm",
    );
    assert.equal(r.actions[0].kind, "OFFICIAL_SOURCE");
    assert.match(r.actions[0].cannotEstablish, /not proof of a contractor/);
    assert.ok(!r.actions.some((a) => /state=(fl|nj)/.test(a.destination)));
  });
test("no verified source for the requested trade means clarification, not a guessed regulator", () => {
  const r = interpretRecovery("roofers in Alaska")!;
  assert.equal(r.requestedTrade, "roofing");
  assert.equal(r.requestedState, "AK");
  assert.equal(r.actions[0].kind, "CLARIFY");
  assert.equal(r.sourceIds.length, 0);
});
test("Florida electrical guidance does not assert CILB electrical coverage", () => {
  const r = interpretRecovery(
    "How do I verify an electrical contractor in Florida?",
  )!;
  assert.equal(r.requestedTrade, "electrical");
  assert.equal(r.actions[0].sourceId, "florida");
  assert.match(
    r.limitations.join(" "),
    /does not establish electrical-board coverage/,
  );
});
test("ordinary discovery, names, definitions, NY and IL keep their operations", () => {
  for (const q of [
    "roofers in Broward County",
    "plumbers in New Jersey",
    "HVAC contractors in Austin Texas",
    "HVAC contractors in Dallas Texas",
    "HVAC contractors in Texas",
    "How many active roofing businesses in Illinois?",
    "How many registered public work contractors in New York?",
    "Hire Right Roofing LLC",
  ])
    assert.equal(interpretRecovery(q), null, q);
  assert.equal(
    interpretAskQuery("best contractors in Florida", intel).supported,
    false,
  );
});
test("native and canonical routes use the same recovery selection before retrieval", () => {
  for (const q of [
    "hire a contractor for tomorrow",
    "elevator contractor Alaska",
    "Does Texas license general contractors statewide?",
    "How do I verify a Florida contractor?",
  ]) {
    assert.equal(researchRoute(q, planContractorSearch(q)), "/ask");
    assert.equal(
      buildContractorResearchQuery(interpretAskQuery(q, intel)).mode,
      "guidance",
    );
  }
});
test("actual recovery renderer finishes without provider cards, false totals or lookup claims", () => {
  const r = interpretRecovery("How do I verify a Florida contractor?")!;
  const html = renderToStaticMarkup(RecoveryAnswer({ recovery: r }));
  assert.match(html, /How to check a contractor credential/);
  assert.match(html, /href="\/verify\?state=fl"/);
  assert.match(html, /Trace this answer/);
  assert.match(html, /not a provider status date/);
  assert.doesNotMatch(html, /<article|0 contractors|No contractors found|NaN/);
});
test("official destination manifest has exact official hosts/purpose and no arbitrary deep links", () => {
  const expected = {
    florida: "www.myfloridalicense.com",
    texas: "www.tdlr.texas.gov",
    texasGc: "www.austintexas.gov",
    california: "www.cslb.ca.gov",
    alaskaElevator: "labor.alaska.gov",
  };
  for (const [id, s] of Object.entries(RECOVERY_SOURCES)) {
    const u = new URL(s.url);
    assert.equal(u.protocol, "https:");
    assert.equal(u.hostname, expected[id as keyof typeof expected]);
    assert.ok(s.purpose && s.limitation && s.checkedAt && s.deepLink);
    assert.equal(u.username + u.password + u.hash, "");
    assert.doesNotMatch(s.url, /localhost|vercel|token|secret|tracking/i);
    assert.ok(isOfficialRecoveryDestination(s.url));
  }
  for (const url of [
    "https://evil.example/",
    "/verify",
    "https://www.cslb.ca.gov.evil.example/",
    "https://www.tdlr.texas.gov/LicenseSearch/?redirect=https://evil.example",
  ])
    assert.equal(isOfficialRecoveryDestination(url), false);
});
test("input limits and malformed params still fail before guidance", () => {
  assert.equal(
    interpretRecovery("How do I verify a Florida contractor?".repeat(8)),
    null,
  );
  assert.ok(
    readAskRequest({ q: ["check a Florida contractor", "book a roofer"] })
      .error,
  );
  assert.ok(
    readAskRequest({ q: "check a Florida contractor", geoAction: "anything" })
      .error,
  );
});
