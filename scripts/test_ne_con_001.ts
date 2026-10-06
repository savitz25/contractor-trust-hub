import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { interpretNebraska } from "../lib/ask/nebraska";
import { NE_SNAPSHOT as data } from "../lib/nebraska-intelligence/snapshot";
import { pageMetadata } from "../lib/seo/page-meta";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

test("Nebraska registration is not a roster or a quality endorsement", () => {
  assert.equal(data.roster, "NOT_ACQUIRED");
  assert.equal(data.qualityEndorsement, false);
  assert.equal(data.annualFeeUsd, 40);
  assert.equal(data.feeIsCurrentCompliance, false);
  assert.equal(data.workersCompObservations, "NOT_ACQUIRED");
  assert.equal(data.electricalCensus, "NOT_ACQUIRED");
  assert.equal(data.plumbingCensus, "NOT_ACQUIRED");
  assert.equal(data.tradesCombinedIntoContractorCensus, false);
  assert.equal(data.graphWrites, 0);
});

test("Nebraska page publishes one statewide route", () => {
  const page = readFileSync("app/nebraska/page.tsx", "utf8");
  const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");
  const meta = pageMetadata({
    title: "Nebraska contractor registration research",
    description: "Registration requirement.",
    path: "/nebraska",
  });
  assert.equal(meta.alternates?.canonical, "https://www.contractortrusthub.com/nebraska");
  assert.match(page, /path: "\/nebraska"/);
  assert.doesNotMatch(page, /\/nebraska\/(?:omaha|lincoln)/);
  assert.equal((sitemap.match(/path: "\/nebraska"/g) || []).length, 1);
  assert.match(sitemap, /path: "\/kansas"/);
  assert.match(sitemap, /path: "\/idaho"/);
  assert.match(sitemap, /path: "\/new-mexico"/);
  assert.equal(normalizedPublishedStatePath("/Nebraska"), "/nebraska");
  assert.equal(normalizedPublishedStatePath("/nebraska"), null);
  assert.equal(normalizedPublishedStatePath("/nebraska/omaha"), null);
});

test("Nebraska ask keeps registration off other states and off a fake census", () => {
  assert.match(interpretNebraska("contractors in Nebraska")?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.match(interpretNebraska("contractors in Nebraska")?.definition.body ?? "", /does not ensure quality/);
  assert.match(interpretNebraska("how many contractors in NE")?.definition.body ?? "", /\$40/);
  assert.match(interpretNebraska("Nebraska workers comp")?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.match(interpretNebraska("electrician in Nebraska")?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.match(interpretNebraska("best contractor in Omaha Nebraska")?.definition.body ?? "", /does not rank/);
  assert.equal(interpretNebraska("contractor Omaha"), null);
  assert.equal(interpretNebraska("contractor in Nevada"), null);
  assert.equal(interpretNebraska("contractor Kansas"), null);
  assert.equal(interpretNebraska("contractor Iowa"), null);
  assert.equal(interpretNebraska("contractor New Mexico"), null);
  assert.equal(interpretNebraska("contractor Idaho"), null);
  assert.equal(interpretNebraska("contractor in ID"), null);
});
