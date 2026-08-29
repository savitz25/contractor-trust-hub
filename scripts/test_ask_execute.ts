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
