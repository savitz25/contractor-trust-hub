import assert from "node:assert/strict";
import test from "node:test";
import { planContractorSearch } from "../lib/search/contractor-discovery";
import { interpretAskQuery } from "../lib/ask/interpret";
import { buildContractorResearchQuery, planToOverrides } from "../lib/ask/plan";
import { askWhere, executeContractorResearchQuery } from "../lib/ask/execute";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { extractGeographyRequirement } from "../lib/ask/geography";
import { readAskRequest, researchRoute } from "../lib/ask/request";
import { askHref, type AskUrlOverrides } from "../lib/ask/url";
import {
  normalizeContractorExecutionRequest,
  executeContractorSpecialistQuery,
  buildWhere,
} from "../lib/specialist-execution/contractor-v2";
const intel = loadContractorHubIntel();
const ask = (q: string, o: AskUrlOverrides = {}) =>
  buildContractorResearchQuery(interpretAskQuery(q, intel), o);
function discovery(q: string, o: AskUrlOverrides = {}) {
  const p = planContractorSearch(q, o);
  assert.equal(p.mode, "discovery");
  if (p.mode !== "discovery") throw Error("expected discovery");
  return p;
}
const typo = "roofers in browrd county fl";
for (const city of ["Austin", "Dallas", "Houston", "El Paso"])
  test(`${city} city survives before capability selection`, () => {
    const p = discovery(`HVAC contractors in ${city} Texas`);
    assert.equal(p.request.geography?.city, city);
    assert.equal(p.request.state, "TX");
    assert.equal(p.geographyRequirement?.executionGeography, undefined);
    assert.equal(p.geographyRequirement?.executionOutcome, "UNSUPPORTED");
    assert.equal(p.geographyRequirement?.canBroaden, true);
  });
test("ordinary explicit city/state forms use one extraction", () => {
  for (const q of [
    "HVAC contractors in Austin, TX",
    "HVAC contractors Dallas TX",
  ]) {
    const r = extractGeographyRequirement(q);
    assert.equal(r?.requestedState, "TX");
    assert.ok(r?.requestedCity);
  }
});
test("Browrd typo cannot authorize Florida execution", async () => {
  const p = ask(typo);
  assert.equal(p.executable, false);
  const r = await executeContractorResearchQuery(p);
  assert.equal(r.blocked, true);
  assert.equal(r.contractorCount, null);
  assert.deepEqual(r.results, []);
  assert.equal(
    discovery(typo).geographyRequirement?.executionGeography,
    undefined,
  );
});
test("accepted correction equals exact county query, including real SQL", () => {
  const exact = ask("roofers in Broward County"),
    corrected = ask(typo, { geoAction: "correct", geoChoice: "broward" });
  assert.equal(corrected.executable, true);
  assert.deepEqual(askWhere(corrected), askWhere(exact));
  assert.equal(corrected.geographyRequirement?.acceptedCorrection, true);
  assert.equal(corrected.geographyRequirement?.requestedCounty, "Browrd");
  assert.equal(corrected.geography.countySlug, "broward");
});
test("invalid or cross-state correction cannot execute", () => {
  for (const geoChoice of [
    "palm-beach",
    "tx",
    "broward%",
    "broward,or(state.eq.FL)",
  ])
    assert.equal(
      ask(typo, { geoAction: "correct", geoChoice }).executable,
      false,
    );
  assert.equal(
    ask(typo, { geoAction: "broaden", geoChoice: "fl" }).executable,
    false,
  );
});
test("explicit broadening preserves original city, trade and status with TX native class", () => {
  const p = discovery("HVAC contractors in Austin Texas", {
    geoAction: "broaden",
    geoChoice: "tx",
    status: "expired",
    page: "2",
  });
  assert.equal(
    p.geographyRequirement?.executionOutcome,
    "USER_APPROVED_RELAXATION",
  );
  assert.equal(p.geographyRequirement?.requestedCity, "Austin");
  assert.equal(p.request.geography?.city, undefined);
  assert.equal(p.request.trade, "hvac");
  assert.equal(p.request.credentialStatus, "expired");
  const n = normalizeContractorExecutionRequest(p.request);
  assert.deepEqual(n.tradeCapability?.occupationCodes, ["TAC"]);
  assert.deepEqual(n.capability?.sourceSystems, ["tx_tdlr"]);
  assert.doesNotMatch(buildWhere(n).sql, /city/);
});
test("broadening cannot change state or unsupported trade", () => {
  assert.equal(
    discovery("HVAC contractors in Austin Texas", {
      geoAction: "broaden",
      geoChoice: "fl",
    }).geographyRequirement?.executionGeography,
    undefined,
  );
  const p = discovery("plumbers in Austin Texas", {
    geoAction: "broaden",
    geoChoice: "tx",
  });
  assert.equal(p.geographyRequirement?.executionOutcome, "UNSUPPORTED");
  assert.equal(p.geographyRequirement?.canBroaden, false);
});
test("business names do not become geography or correction", () => {
  for (const q of [
    "Austin Roofing LLC",
    "research Broward Roofing LLC",
    "Broward Builders Inc",
    "Texas HVAC Services Inc",
  ]) {
    assert.equal(extractGeographyRequirement(q), null);
    assert.notEqual(planContractorSearch(q).mode, "discovery");
  }
});
test("ambiguous, unknown, radius and multiple places remain unresolved", () => {
  for (const q of [
    "HVAC contractors in Springfield",
    "roofers near me",
    "roofers within 10 miles of Broward County",
    "roofers in Austin Texas Florida",
    "roofers in Austin Texas and Dallas Texas",
  ]) {
    const p = discovery(q);
    assert.equal(p.geographyRequirement?.executionGeography, undefined, q);
  }
  assert.equal(ask("roofers in Zzzyx County Florida").executable, false);
  assert.notEqual(
    extractGeographyRequirement("roofers in Bradford County Florida")
      ?.requestedCounty,
    "Broward",
  );
});
test("other filters and requested text survive action URLs and pagination", () => {
  const o = {
    geoAction: "correct",
    geoChoice: "broward",
    trade: "roofing",
    status: "expired",
    evidence: "dbpr_discipline",
    sort: "credential",
    page: "3",
  };
  const u = new URL(askHref(typo, o), "https://www.contractortrusthub.com");
  const r = readAskRequest(Object.fromEntries(u.searchParams));
  assert.deepEqual(r.overrides, o);
  assert.equal(r.query, typo);
  const p = ask(r.query, r.overrides);
  assert.equal(p.trade.familyId, "roofing");
  assert.equal(p.credentialStatus, "expired");
  assert.equal(p.evidenceFamily, "dbpr_discipline");
  assert.equal(p.sort.field, "credential");
  assert.equal(planToOverrides(p).geoAction, "correct");
  assert.equal(p.geography.countySlug, "broward");
});
test("full input/duplicate/action/page validation before parsing", () => {
  for (const params of [
    { q: "roofers in Broward County" + " ".repeat(180) + "TX" },
    { q: ["a", "b"] },
    { q: typo, geoAction: "autocorrect" },
    { q: typo, page: "1.5" },
    { q: "roofers\u0000 in FL" },
  ])
    assert.ok(readAskRequest(params).error);
});
test("native/canonical route policy shares full interpreted geography", () => {
  for (const q of [
    typo,
    "roofers in Broward County",
    "HVAC contractors in Austin Texas",
    "plumbers in New Jersey",
  ]) {
    const r = readAskRequest({ q });
    const p = planContractorSearch(r.query, r.overrides);
    assert.equal(
      researchRoute(q, p),
      q.includes("Texas") || q.includes("Jersey") ? "/search" : "/ask",
    );
  }
  for (const q of [
    "Illinois roofing snapshot",
    "New York public-work certificates",
    "compare Broward and Palm Beach",
  ])
    assert.equal(researchRoute(q, planContractorSearch(q)), "/ask");
});
test("FL predicates apply county/city before pagination and retain source identity", () => {
  for (const q of [
    "roofers in Broward County",
    "HVAC contractors in Palm Beach County",
  ]) {
    const p = ask(q);
    assert.equal(p.executable, true);
    assert.match(askWhere(p)!.where, /l.county_code/);
  }
  const p = ask("roofers in Miami Florida");
  assert.match(askWhere(p)!.where, /LOWER\(TRIM\(l.city\)\)/);
  assert.match(askWhere(p)!.where, /l.state = 'FL'/);
  assert.ok(askWhere(p)!.params.includes("miami"));
});
test("NJ Master Plumber is PLB, not Florida plumbing classes", () => {
  const p = discovery("plumbers in New Jersey");
  const n = normalizeContractorExecutionRequest(p.request);
  assert.deepEqual(n.capability?.sourceSystems, ["nj_dca"]);
  assert.deepEqual(n.tradeCapability?.occupationCodes, ["PLB"]);
  assert.equal(p.geographyRequirement?.executionOutcome, "APPLIED");
});
test("exact credential routing remains intact", () => {
  for (const q of ["CCC1332036", "13VH01234567"]) {
    const p = planContractorSearch(q);
    assert.equal(p.mode, "verify");
  }
  assert.equal(ask("CCC1332036").identity.identifier, "CCC1332036");
});
// Independent fixture oracle: published, source-native observation rows; never production writes.
const fixtures = [
  {
    slug: "broward",
    display_name: "Fixture Roofing One",
    license_number: "CCC100001",
    occupation_code: "CCC",
    occupation_description: "Certified Roofing",
    source_system: "fl_dbpr",
    city: "Miami",
    county: "Broward",
    county_code: "16",
    state: "FL",
    status_normalized: "active",
    is_thin_profile: false,
  },
  {
    slug: "palm",
    display_name: "Fixture HVAC Two",
    license_number: "CAC100002",
    occupation_code: "CAC",
    occupation_description: "Air conditioning",
    source_system: "fl_dbpr",
    city: "West Palm Beach",
    county: "Palm Beach",
    county_code: "60",
    state: "FL",
    status_normalized: "active",
    is_thin_profile: false,
  },
  {
    slug: "wrong-city",
    display_name: "Fixture Roofing Three",
    license_number: "CCC100003",
    occupation_code: "CCC",
    occupation_description: "Certified Roofing",
    source_system: "fl_dbpr",
    city: "Orlando",
    county: "Orange",
    county_code: "48",
    state: "FL",
    status_normalized: "active",
    is_thin_profile: false,
  },
  {
    slug: "held",
    display_name: "Fixture Held",
    license_number: "CCC100004",
    occupation_code: "CCC",
    occupation_description: "Roofing",
    source_system: "fl_dbpr",
    city: "Miami",
    county: "Broward",
    county_code: "16",
    state: "FL",
    status_normalized: "active",
    is_thin_profile: true,
  },
  {
    slug: "nj-plumber",
    display_name: "Fixture NJ Plumber",
    license_number: "PLB100005",
    occupation_code: "PLB",
    occupation_description: "Master Plumber",
    source_system: "nj_dca",
    city: "Summit",
    county: "Union",
    county_code: null,
    state: "NJ",
    status_normalized: "active",
    is_thin_profile: false,
  },
  {
    slug: "tx-ac",
    display_name: "Fixture Texas AC",
    license_number: "TAC100006",
    occupation_code: "TAC",
    occupation_description: "A/C Contractor",
    source_system: "tx_tdlr",
    city: null,
    county: null,
    county_code: null,
    state: "TX",
    status_normalized: "active",
    is_thin_profile: false,
  },
];
function fixtureDb(
  expected: typeof fixtures,
  sqlAssertions: (sql: string, params: unknown[]) => void = () => {},
) {
  const calls: string[] = [];
  return {
    calls,
    db: {
      queryOne: async (sql: string, params: unknown[]) => {
        calls.push(sql);
        sqlAssertions(sql, params);
        return { total: String(expected.length) };
      },
      query: async (sql: string, params: unknown[]) => {
        calls.push(sql);
        sqlAssertions(sql, params);
        return expected
          .slice(
            Number(params.at(-1)),
            Number(params.at(-1)) + Number(params.at(-2)),
          )
          .map((r) => ({
            ...r,
            external_key: r.license_number,
            primary_status: "Active",
            updated_at: "2026-01-01T00:00:00Z",
          }));
      },
    } as unknown as Parameters<typeof executeContractorSpecialistQuery>[1],
  };
}
test("actual V2 execution uses source/class/county predicates before limit and builds truthful rows", async () => {
  const f = fixtureDb([fixtures[0]], (sql, params) => {
    assert.match(sql, /c.is_thin_profile = FALSE/);
    assert.match(sql, /l.county_code = \$/);
    assert.ok(params.includes("16"));
    assert.deepEqual(params[0], ["fl_dbpr"]);
  });
  const r = await executeContractorSpecialistQuery(
    { state: "FL", trade: "roofing", county: "Broward" },
    f.db,
  );
  assert.equal(r.resultState, "SUPPORTED_RESULTS");
  if ("rows" in r) {
    assert.equal(r.total, 1);
    assert.equal(r.rows[0].recordedGeography.county, "Broward");
    assert.equal(r.rows[0].credentialNumber, fixtures[0].license_number);
    assert.doesNotMatch(r.rows[0].whyShown, /Austin|serves/);
  }
  assert.equal(f.calls.length, 2);
});
test("actual V2 city equality is executed with state, not a statewide window", async () => {
  const f = fixtureDb([fixtures[0]], (sql, params) => {
    assert.match(sql, /LOWER\(TRIM\(COALESCE\(l.city/);
    assert.match(sql, /home_state.*OR l.state/);
    assert.ok(params.includes("miami"));
    assert.ok(params.includes("FL"));
  });
  const r = await executeContractorSpecialistQuery(
    { state: "FL", trade: "roofing", city: "Miami" },
    f.db,
  );
  assert.equal(r.resultState, "SUPPORTED_RESULTS");
});
test("actual NJ and TX positive execution remains useful and source-native", async () => {
  for (const [state, trade, row] of [
    ["NJ", "plumbing", fixtures[4]],
    ["TX", "hvac", fixtures[5]],
  ] as const) {
    const f = fixtureDb([row], (_, params) => {
      assert.deepEqual(params[0], [row.source_system]);
      assert.ok(
        params.some((p) => Array.isArray(p) && p.includes(row.occupation_code)),
      );
    });
    const r = await executeContractorSpecialistQuery({ state, trade }, f.db);
    assert.equal(r.resultState, "SUPPORTED_RESULTS");
    if ("rows" in r) {
      assert.equal(r.rows[0].source.system, row.source_system);
      assert.equal(r.rows[0].recordedGeography.state, state);
    }
  }
});
test("unsupported local scope blocks source calls; valid zero differs from source failure", async () => {
  const f = fixtureDb([]);
  const blocked = await executeContractorSpecialistQuery(
    { state: "TX", trade: "hvac", city: "Austin" },
    f.db,
  );
  assert.equal(blocked.resultState, "CLARIFICATION_REQUIRED");
  assert.equal(f.calls.length, 0);
  const zero = await executeContractorSpecialistQuery(
    { state: "FL", trade: "roofing", city: "Fixtureville" },
    f.db,
  );
  assert.equal(zero.resultState, "ZERO_MATCHING_ROWS");
  const failed = {
    queryOne: async () => {
      throw Error("fixture source unavailable");
    },
    query: async () => [],
  } as unknown as Parameters<typeof executeContractorSpecialistQuery>[1];
  await assert.rejects(
    executeContractorSpecialistQuery({ state: "FL", trade: "roofing" }, failed),
    /fixture source unavailable/,
  );
});
test("pagination retains source scope and count independently of displayed row count", async () => {
  const f = fixtureDb([fixtures[0], fixtures[2]], (sql, params) => {
    assert.deepEqual(params[0], ["fl_dbpr"]);
    assert.match(sql, /occupation_code/);
  });
  const r = await executeContractorSpecialistQuery(
    { state: "FL", trade: "roofing", page: 2, limit: 1 },
    f.db,
  );
  if (!("rows" in r)) throw Error("missing rows");
  assert.equal(r.total, 2);
  assert.equal(r.rows.length, 1);
  assert.equal(r.pagination.page, 2);
});

test('form resubmission field contract avoids duplicated select parameters',async()=>{const {readFileSync}=await import('node:fs');const form=readFileSync('components/ask/AskForm.tsx','utf8');assert.match(form,/\["page","geo","trade","status","evidence"\]\.includes/);assert.match(form,/defaultValue=\{overrides.status/);assert.ok(readAskRequest({q:typo,geoAction:'correct',geoChoice:'broward',trade:'roofing',status:'all'}).error===null);assert.ok(readAskRequest({q:typo,status:['all','']}).error);});

test('cleared status means all and Texas source attribution remains TDLR only',()=>{const p=discovery('HVAC contractors in Texas',{status:'-'});assert.equal(p.request.credentialStatus,'all');const n=normalizeContractorExecutionRequest(p.request);assert.equal(n.capability?.state.boardShortLabel,'TDLR');assert.doesNotMatch(n.capability?.state.boardLabel??'',/plumbing|TSBPE/i);});

test('structured source entry cannot discard malformed or oversized city',()=>{for(const city of ['Austin'.repeat(20),42,'Austin\u0000'])assert.throws(()=>normalizeContractorExecutionRequest({state:'TX',trade:'hvac',city}),/invalid_text_field/);});
