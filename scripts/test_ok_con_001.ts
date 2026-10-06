import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { interpretOklahoma } from "../lib/ask/oklahoma";
import { researchRoute } from "../lib/ask/request";
import { OK_SNAPSHOT as data } from "../lib/oklahoma-intelligence/snapshot";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

test("Oklahoma CIB classes stay separate and rosters stay unacquired", () => {
  assert.equal(data.statewideGeneralContractorLicense, "NOT_ISSUED");
  assert.equal(data.bulkRosters, "NOT_ACQUIRED");
  assert.equal(data.classes.length, 11);
  assert.equal(new Set(data.classes.map((row) => row.roster)).size, 1);
  assert.equal(data.classes.every((row) => row.roster === "NOT_ACQUIRED"), true);
  assert.equal(data.bondRequirementUsd, 5000);
  assert.equal(data.liabilityRequirementUsd, 50000);
  assert.equal(data.observedBondOrInsurance, "NOT_ACQUIRED");
  assert.equal(data.permitsIssuedByCib, false);
  assert.equal(data.graphWrites, 0);
  assert.equal(data.newCanonicalEntities, 0);
  assert.equal(data.enforcementCorpus, "NOT_ACQUIRED");
  const ids = data.classes.map((row) => row.id);
  assert.equal(ids.includes("electrical-contractor"), true);
  assert.equal(ids.includes("plumbing-journeyman"), true);
  assert.equal(ids.includes("roofing"), true);
  assert.equal(ids.includes("plumbing-apprentice"), false);
});

test("Oklahoma page does not invent a general-contractor census", () => {
  const page = readFileSync("app/oklahoma/page.tsx", "utf8");
  assert.match(page, /not currently required to have a state license/);
  assert.match(page, /NOT_ACQUIRED/);
  assert.match(page, /bondRequirementUsd/);
  assert.match(page, /liabilityRequirementUsd/);
  assert.match(page, /not observed coverage/);
  assert.match(page, /Oklahoma City, Tulsa/);
  assert.doesNotMatch(page, /AggregateRating|Trust Score|ratingValue/);
  assert.equal(existsSync("app/oklahoma/tulsa"), false);
  assert.equal(existsSync("app/oklahoma/oklahoma-city"), false);
  assert.equal(existsSync("app/oklahoma/norman"), false);
  assert.equal((readFileSync("lib/seo/sitemap-data.ts", "utf8").match(/\/oklahoma/g) ?? []).length, 1);
});

test("Oklahoma Ask fails closed and does not capture other builders' states", () => {
  const general = interpretOklahoma("general contractor in Oklahoma");
  assert.match(general?.definition.body ?? "", /not currently required to have a state license/);
  assert.equal(general?.count, null);
  const census = interpretOklahoma("how many electrical contractors in Oklahoma");
  assert.equal(census?.mode, "fail_closed");
  assert.match(census?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.equal(census?.count, null);
  const ranked = interpretOklahoma("best plumber in Tulsa");
  assert.equal(ranked?.mode, "fail_closed");
  assert.match(ranked?.failMessage ?? "", /does not rank/);
  assert.match(ranked?.failMessage ?? "", /Trust Score/);
  const bond = interpretOklahoma("Oklahoma contractor insurance");
  assert.match(bond?.definition.body ?? "", /requirement/);
  assert.match(bond?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.match(interpretOklahoma("plumber in Norman")?.definition.body ?? "", /geography only/);
  assert.equal(interpretOklahoma("contractor Arkansas"), null);
  assert.equal(interpretOklahoma("contractor Missouri"), null);
  assert.equal(interpretOklahoma("contractor Utah"), null);
  assert.equal(interpretOklahoma("contractor Mississippi"), null);
  assert.equal(normalizedPublishedStatePath("/Oklahoma"), "/oklahoma");
  assert.equal(normalizedPublishedStatePath("/oklahoma/tulsa"), null);
  assert.equal(
    researchRoute("electrical contractor in oklahoma", { mode: "discovery", request: { state: "TX" } } as never),
    "/ask",
  );
});
