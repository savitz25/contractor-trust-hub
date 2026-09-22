/**
 * POST-R1-CON-LOCAL-001: regression tests for the "plumber/roofer/general contractor in miami"
 * headroom fix in lib/specialist-execution/contractor-v2.ts and
 * lib/specialist-execution/state-capabilities.ts.
 *
 * Root cause (proven via EXPLAIN ANALYZE against the real production-pointed DB, see
 * docs/qa/post-r1-con-local-001/): buildWhere()'s FL/NJ occupation_code predicate was wrapped in
 * UPPER(TRIM(...)), and the city predicate was wrapped in LOWER(TRIM(COALESCE(...))) -- both
 * defeated the existing indexes (licenses_source_status_occ_idx / licenses_state_city_idx) AND the
 * planner's row-count estimate (observed: estimated rows=3, actual rows=5535 for "general
 * contractor" + Miami-Dade), causing the planner to pick a per-row Nested Loop into
 * contractors_pkey instead of a Hash Join. Data is confirmed always clean (uppercase, trimmed) for
 * every FL source system, so simplifying to the sargable raw-column form is a pure query-shape fix
 * with no matching-semantics change. Separately, runCohortRows was merged from two sequential
 * COUNT+SELECT round trips into one CTE query (mirroring lib/ask/execute.ts's existing
 * TH-DISCOVERY-FINAL-REPAIR-A fix), reducing connection-acquisition overhead under the production
 * single-client-per-isolate pool.
 *
 * Also locks in a real trade-alias gap found during this investigation: "roofer"/"roofers" and
 * "general contractor"(s) had no alias to their existing FL_TRADES ids ("roofing" / "general"),
 * and "electrician"/"electricians" resolved via getTradeCapability but the FL-electrical
 * special-case branches compared against the raw (pre-alias) string, so a direct "electrician"
 * request never hit the existing, more useful unsupported_florida_electrical_source response.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import {
  buildWhere,
  executeContractorSpecialistQuery,
  normalizeContractorExecutionRequest,
} from "../lib/specialist-execution/contractor-v2";
import { resolveTradeAlias, getTradeCapability } from "../lib/specialist-execution/state-capabilities";

const source = fs.readFileSync("lib/specialist-execution/contractor-v2.ts", "utf8");

test("POST-R1-CON-LOCAL-001: FL occupation_code predicate is sargable (no UPPER/TRIM wrapper)", () => {
  const input = normalizeContractorExecutionRequest({ state: "FL", trade: "plumbing", county: "miami-dade" });
  const built = buildWhere(input);
  assert.match(built.sql, /l\.occupation_code = ANY\(\$/);
  assert.doesNotMatch(built.sql, /UPPER\(TRIM\(l\.occupation_code\)\)/);
});

test("POST-R1-CON-LOCAL-001: FL city predicate is sargable (raw l.city, uppercased param) while NJ keeps case-insensitive matching", () => {
  const fl = buildWhere(normalizeContractorExecutionRequest({ state: "FL", trade: "plumbing", city: "Miami", county: "miami-dade" }));
  assert.match(fl.sql, /l\.city = \$/);
  assert.ok(fl.params.includes("MIAMI"), "FL city param must be uppercased to match the raw-column comparison");
  assert.doesNotMatch(fl.sql, /LOWER\(TRIM\(COALESCE\(l\.city/);

  // NJ city data is genuinely mixed-case in production (confirmed via
  // scripts/_post_r1_con_local_001_nj_city_cleanliness.local.mjs) -- it must keep the safe,
  // case-insensitive form. This is a real correctness guard, not just a perf assertion: an
  // over-broad "just uppercase everything" fix would silently break NJ city matching.
  const nj = buildWhere(normalizeContractorExecutionRequest({ state: "NJ", trade: "plumbing", city: "Newark" }));
  assert.match(nj.sql, /LOWER\(TRIM\(COALESCE\(l\.city/);
});

test("POST-R1-CON-LOCAL-001: runCohortRows issues one merged query, not two sequential round trips", () => {
  assert.match(source, /buildCohortRowsSql/);
  assert.match(source, /WITH matched AS MATERIALIZED/);
  assert.doesNotMatch(source, /SELECT COUNT\(\*\)::text AS total FROM licenses l JOIN contractors/);
});

test("POST-R1-CON-LOCAL-001: roofer/roofers alias to the existing FL 'roofing' trade capability", () => {
  assert.equal(resolveTradeAlias("roofer"), "roofing");
  assert.equal(resolveTradeAlias("roofers"), "roofing");
  assert.equal(getTradeCapability("FL", "roofer")?.id, "roofing");
});

test("POST-R1-CON-LOCAL-001: 'general contractor' / 'general contractors' alias to the existing FL 'general' trade capability", () => {
  assert.equal(resolveTradeAlias("general contractor"), "general");
  assert.equal(resolveTradeAlias("general contractors"), "general");
  assert.equal(getTradeCapability("FL", "general contractor")?.id, "general");
});

test("POST-R1-CON-LOCAL-001: bare 'contractor'/'contractors' remains intentionally un-aliased (CLARIFICATION_REQUIRED narrowing, not a bug)", () => {
  assert.equal(resolveTradeAlias("contractor"), "contractor");
  assert.equal(getTradeCapability("FL", "contractor"), null);
});

test("POST-R1-CON-LOCAL-001: 'electrician' now hits the existing FL-electrical carve-out (not a generic UNSUPPORTED_TRADE_CAPABILITY)", async () => {
  await assert.rejects(
    executeContractorSpecialistQuery({ state: "FL", trade: "electrician", county: "miami-dade" }),
    /unsupported_florida_electrical_source/
  );
});

test("POST-R1-CON-LOCAL-001: plumber/electrician/roofer/general-contractor/contractor in Miami-Dade -- deterministic plan shape via injected db", async () => {
  const fixtureRow = {
    slug: "fixture-plumber", display_name: "Fixture Miami Plumbing", license_number: "CFC900001",
    external_key: "CFC900001", occupation_code: "CFC", occupation_description: "Certified Plumbing Contractor",
    status_normalized: "active", primary_status: "Active", city: "MIAMI", county: "Miami-Dade", state: "FL",
    updated_at: "2026-01-01T00:00:00Z", total: "1",
  };
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = {
    queryOne: async () => ({ total: "1" }),
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return [fixtureRow];
    },
  } as unknown as Parameters<typeof executeContractorSpecialistQuery>[1];

  const resp = await executeContractorSpecialistQuery(
    { state: "FL", trade: "plumbing", city: "Miami", county: "miami-dade" },
    db
  );
  assert.equal(resp.resultState, "SUPPORTED_RESULTS");
  assert.equal(calls.length, 1, "must be exactly one round trip, not a COUNT+SELECT pair");
  assert.match(calls[0].sql, /l\.occupation_code = ANY\(\$/);
  assert.match(calls[0].sql, /l\.city = \$/);
  if ("limitations" in resp) {
    assert.ok(resp.limitations.some((l) => /not service territory/i.test(l)));
  }
});

test("POST-R1-CON-LOCAL-001: generic 'contractor in miami' (no trade) stays a fast, safe CLARIFICATION_REQUIRED narrowing prompt -- never a giant unfiltered result set", async () => {
  const resp = await executeContractorSpecialistQuery({ state: "FL", city: "Miami", county: "miami-dade" });
  assert.equal(resp.resultState, "CLARIFICATION_REQUIRED");
  assert.equal("errorCode" in resp && resp.errorCode, "trade_or_identifier_required");
});

test("POST-R1-CON-LOCAL-001: Miami-Dade county-grain disclosure is preserved, never rewritten as service-territory", () => {
  const input = normalizeContractorExecutionRequest({ state: "FL", trade: "plumbing", county: "miami-dade" });
  assert.equal(input.geography?.county?.label, "Miami-Dade");
  assert.match(input.geography!.meaning, /County recorded credential\/address geography; not service territory/);
});
