import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { interpretArkansas } from "../lib/ask/arkansas";
import { AR_SNAPSHOT as data } from "../lib/arkansas-intelligence/snapshot";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

test("Arkansas CLB classes stay on their own clocks", () => {
  assert.equal(data.combinedContractorDenominator, null);
  assert.equal(data.activeRoster, "NOT_ACQUIRED");
  assert.equal(data.qualifyingPartySplit, "NOT_SPLIT");
  assert.equal(data.personCompanySplit, "NOT_SPLIT");
  assert.equal(data.graphWrites, 0);
  assert.equal(data.newCanonicalEntities, 0);
  assert.equal(data.sha256, "b71798b59a6ae508544470ef179d8eb7475731c54ffb93f9d941989ceb27e64e");
  const byId = Object.fromEntries(data.classes.map((row) => [row.id, row.count]));
  assert.equal(byId.commercial, 8244);
  assert.equal(byId["commercial-subcontractor"], 783);
  assert.equal(byId["residential-building"], 2762);
  assert.equal(byId["home-improvement"], 5822);
  assert.equal(byId.remodeler, 1868);
  assert.equal(byId.roofer, 750);
  assert.equal(data.classes.find((row) => row.id === "remodeler")?.clock.includes("2023"), true);
  assert.equal(data.classes.find((row) => row.id === "roofer")?.clock.includes("2024"), true);
  const issued2025 = data.classes
    .filter((row) => row.clock.includes("2025"))
    .reduce((sum, row) => sum + row.count, 0);
  assert.notEqual(issued2025, 8244 + 783 + 2762 + 5822 + 1868 + 750);
});

test("Arkansas page publishes one statewide route", () => {
  const page = readFileSync("app/arkansas/page.tsx", "utf8");
  const sitemap = readFileSync("lib/seo/sitemap-data.ts", "utf8");
  assert.match(page, /path: "\/arkansas"/);
  assert.match(page, /NOT_ACQUIRED/);
  assert.doesNotMatch(page, /AggregateRating|Trust Score|ratingValue/);
  assert.doesNotMatch(page, /\/arkansas\/(?:little-rock|fayetteville|fort-smith)/);
  assert.equal((sitemap.match(/path: "\/arkansas"/g) || []).length, 1);
  assert.match(sitemap, /path: "\/missouri"/);
  assert.equal(normalizedPublishedStatePath("/Arkansas"), "/arkansas");
  assert.equal(normalizedPublishedStatePath("/arkansas"), null);
  assert.equal(normalizedPublishedStatePath("/arkansas/little-rock"), null);
});

test("Arkansas ask does not invent one contractor census", () => {
  assert.match(interpretArkansas("commercial contractor Arkansas")?.definition.body ?? "", /8,244/);
  assert.match(interpretArkansas("commercial contractor Arkansas")?.definition.body ?? "", /2025/);
  assert.match(interpretArkansas("how many contractors in Arkansas")?.definition.body ?? "", /cannot be combined/);
  assert.match(interpretArkansas("how many contractors in Arkansas")?.definition.body ?? "", /1,868/);
  assert.match(interpretArkansas("residential roofer Arkansas")?.definition.body ?? "", /750/);
  assert.match(interpretArkansas("best contractor in Little Rock Arkansas")?.definition.body ?? "", /does not rank/);
  assert.match(interpretArkansas("electrician in Arkansas")?.definition.body ?? "", /NOT_ACQUIRED/);
  assert.match(interpretArkansas("home improvement Little Rock Arkansas")?.definition.body ?? "", /geography only/);
  assert.equal(interpretArkansas("contractor Fayetteville"), null);
  assert.equal(interpretArkansas("contractor in Arizona"), null);
  assert.equal(interpretArkansas("contractor Oklahoma"), null);
  assert.equal(interpretArkansas("contractor Missouri"), null);
  assert.equal(interpretArkansas("contractor Utah"), null);
});
