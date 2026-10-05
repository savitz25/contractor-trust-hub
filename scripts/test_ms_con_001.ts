import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { interpretMississippi } from "../lib/ask/mississippi";
import { MS_MAILING_STATES, MS_SNAPSHOT as data, MS_STATUS_BY_CLASS } from "../lib/mississippi-intelligence/snapshot";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";

test("Mississippi MSBOC grains partition the saved export and are not reloaded", () => {
  assert.equal(data.licensed + data.licensedExpired + data.unlicensed + data.unlicensedExpired + data.revoked + data.suspended, data.uniqueKeys);
  assert.equal(data.typeCommercial + data.typeResidential + data.typeResidentialInactiveLabel + data.typeCommercialInactiveLabel, data.uniqueKeys);
  assert.equal(data.occupationRes + data.occupationMc + data.occupationSc + data.occupationCom, data.uniqueKeys);
  assert.equal(MS_STATUS_BY_CLASS.reduce((sum, row) => sum + row.rows, 0), data.uniqueKeys);
  assert.equal(data.listRows - data.uniqueKeys, data.duplicateKeysDropped);
  assert.equal(data.mailingMs + data.mailingBlank + data.mailingOther, data.listRows);
  assert.equal(MS_MAILING_STATES.reduce((sum, row) => sum + row.rows, 0), data.listRows);
  assert.equal(data.netNewEntities, 0);
  assert.equal(data.graphWrites, 0);
  assert.equal(data.databaseReread, false);
  assert.equal(data.classCodeColumn, "NOT_IN_THIS_EXPORT");
  assert.equal(data.qualifierColumn, "NOT_IN_THIS_EXPORT");
  assert.equal(data.violationsCorpus, "NOT_ACQUIRED");
  assert.notEqual(data.licensed, data.uniqueKeys);
  assert.notEqual(data.listRows, data.uniqueKeys);
});

test("Mississippi page keeps commercial, residential, and status apart", () => {
  const page = readFileSync("app/mississippi/page.tsx", "utf8");
  assert.match(page, /3,425/);
  assert.match(page, /8,242/);
  assert.match(page, /data\.listRows/);
  assert.match(page, /not a live census/);
  assert.match(page, /not downloaded again/);
  assert.match(page, /violationsCorpus/);
  assert.match(page, /secondaryBoards/);
  assert.doesNotMatch(page, /AggregateRating|Trust Score|ratingValue|38,709|38709/);
  assert.equal(existsSync("app/mississippi/jackson"), false);
  assert.equal(existsSync("app/mississippi/gulfport"), false);
  assert.equal(existsSync("app/mississippi/biloxi"), false);
  assert.equal((readFileSync("lib/seo/sitemap-data.ts", "utf8").match(/\/mississippi/g) ?? []).length, 1);
});

test("Mississippi Ask fails closed on rank and does not invent one contractor total", () => {
  const licensed = interpretMississippi("active licensed contractors in Mississippi");
  assert.equal(licensed?.count, null);
  assert.match(licensed?.definition.body ?? "", /3,425/);
  assert.match(licensed?.definition.body ?? "", /not a live census/);
  const ranked = interpretMississippi("best contractor Mississippi");
  assert.equal(ranked?.mode, "fail_closed");
  assert.match(ranked?.failMessage ?? "", /does not rank/);
  assert.equal(interpretMississippi("contractor Missouri"), null);
  assert.equal(interpretMississippi("contractor South Carolina"), null);
  assert.match(interpretMississippi("MSBOC qualifying party")?.definition.body ?? "", /not in this saved export/);
  assert.match(interpretMississippi("contractor Gulfport")?.definition.body ?? "", /geography only/);
  assert.equal(normalizedPublishedStatePath("/Mississippi"), "/mississippi");
  assert.equal(normalizedPublishedStatePath("/mississippi/jackson"), null);
});
