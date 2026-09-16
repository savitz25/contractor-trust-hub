import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { buildContractorResearchQuery } from "../lib/ask/plan";
import { executeContractorResearchQuery } from "../lib/ask/execute";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";

const hasDb = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

test("P2 execute Broward active roofing against production graph", { skip: !hasDb }, async () => {
  const intel = loadContractorHubIntel();
  const interpreted = interpretAskQuery("Show me active roofing contractors in Broward County.", intel);
  const plan = buildContractorResearchQuery(interpreted);
  const exec = await executeContractorResearchQuery(plan);
  assert.equal(exec.ok, true);
  assert.equal(exec.blocked, false);
  assert.ok((exec.contractorCount ?? 0) > 0);
  assert.ok((exec.credentialCount ?? 0) >= (exec.contractorCount ?? 0));
  assert.notEqual(exec.contractorCount, exec.credentialCount);
  assert.ok(exec.results.length > 0);
  assert.ok(exec.results.length <= 24);
  const row = exec.results[0];
  assert.ok(row.displayName);
  assert.match(row.geographyNote, /not service territory/i);
  assert.doesNotMatch(row.whyMatched, /serves Broward/i);
  assert.equal(row.sourceLabel, "Florida DBPR");
});

test("TH-DISCOVERY-RESET-001B: electricians in Palm Beach County broadens to real, labeled contractor cards instead of zero rows", { skip: !hasDb }, async () => {
  const intel = loadContractorHubIntel();
  const interpreted = interpretAskQuery("electricians in Palm Beach County", intel);
  const plan = buildContractorResearchQuery(interpreted);
  const exec = await executeContractorResearchQuery(plan);
  assert.equal(exec.ok, true);
  assert.equal(exec.blocked, false);
  assert.match(exec.blockMessage ?? "", /ELECTRICAL-SPECIFIC RESULTS/);
  assert.match(exec.blockMessage ?? "", /does not publish an electrical occupation page/);
  assert.match(exec.blockMessage ?? "", /BROADER PALM BEACH COUNTY CONTRACTOR OPTIONS|BROADER FLORIDA CONTRACTOR OPTIONS/);
  assert.ok(exec.results.length > 0, "broader contractor cards must be visible on the first result screen, not behind a second click");
  const row = exec.results[0];
  // Broader inventory is not filtered to exclude real electricians -- it is simply not filtered FOR
  // electrical either. The guarantee under test is that the card never CLAIMS confirmed-electrician
  // status it does not have, regardless of the row's own true trade.
  assert.match(row.whyMatched, /not a confirmed electrician/i);
});

test("P2 execute stop-work does not list unpublished contractor joins", { skip: !hasDb }, async () => {
  const intel = loadContractorHubIntel();
  const interpreted = interpretAskQuery("Show contractors with Florida stop-work records.", intel);
  const plan = buildContractorResearchQuery(interpreted);
  const exec = await executeContractorResearchQuery(plan);
  assert.equal(exec.blocked, true);
  assert.equal(exec.results.length, 0);
  assert.ok((exec.evidenceSourceRows ?? 0) > 0);
  assert.match(exec.blockMessage ?? "", /not enabled|source rows/i);
});
