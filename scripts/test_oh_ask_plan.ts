import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { researchRoute } from "../lib/ask/request";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { planContractorSearch } from "../lib/search/contractor-discovery";
import { normalizedPublishedStatePath } from "../lib/seo/published-state-path";
import { OHIO_SNAPSHOT } from "../lib/ohio-intelligence/snapshot";

const intel = loadContractorHubIntel();
const ask = (q: string) => interpretAskQuery(q, intel);

test("Ohio licensed census fails closed and does not pretend OCILB is a GC license", () => {
  const r = ask("licensed contractors Ohio");
  assert.equal(r.supported, false);
  assert.equal(r.href, "/ohio");
  assert.match(r.failMessage || "", /does not have one universal statewide contractor license/i);
  assert.match(r.failMessage || "", new RegExp(String(OHIO_SNAPSHOT.ocilb.OH_OCILB_DISTINCT_LICENSE_HOLDERS)));
  assert.doesNotMatch(r.failMessage || "", /12,461 unique/);
});

test("general contractor Ohio does not treat OCILB as universal GC licensing", () => {
  const r = ask("general contractor Ohio");
  assert.match(r.failMessage || "", /does not have a universal statewide general-contractor license/i);
});

test("residential contractor Ohio does not treat Chapter 4740 as residential GC licensing", () => {
  const r = ask("residential contractor Ohio");
  assert.match(r.failMessage || "", /exclude a residential building/i);
});

test("exact OCILB credential outranks geography", () => {
  const r = ask("EL.10514 Ohio");
  assert.equal(r.interpretation.identifier, "EL.10514");
  assert.equal(r.href, "/ohio");
  assert.match(r.failMessage || "", /individual/i);
});

test("trade credentials stay distinct", () => {
  assert.match(ask("electrical contractor Ohio").failMessage || "", /EL\./);
  assert.match(ask("HVAC contractor Ohio").failMessage || "", /HV\./);
  assert.match(ask("hydronics contractor Ohio").failMessage || "", /HY\./);
  assert.match(ask("plumbing contractor Ohio").failMessage || "", /PL\./);
  assert.match(ask("refrigeration contractor Ohio").failMessage || "", /RE\./);
});

test("fire alarm does not automatically demand OCILB EL", () => {
  const r = ask("fire alarm contractor Ohio");
  assert.match(r.failMessage || "", /not necessarily an OCILB electrical contractor/i);
  assert.match(r.failMessage || "", /State Fire Marshal/i);
});

test("fire protection installer and designer stay separate", () => {
  const inst = ask("fire protection installer Ohio");
  assert.match(inst.failMessage || "", /State Fire Marshal/);
  const des = ask("fire alarm designer Ohio");
  assert.match(des.failMessage || "", /not contractor licenses/i);
});

test("Columbus and Cleveland stay statewide", () => {
  const col = ask("contractor Columbus");
  assert.equal(col.href, "/ohio");
  assert.doesNotMatch(col.href || "", /columbus/);
  const cle = ask("contractor Cleveland");
  assert.equal(cle.href, "/ohio");
});

test("best contractor Ohio fails closed", () => {
  const r = ask("best contractor Ohio");
  assert.match(r.failMessage || "", /Trust Score|does not rank/i);
});

test("Ohio stay on /ask", () => {
  const plan = planContractorSearch("licensed contractor Ohio");
  assert.equal(researchRoute("licensed contractor Ohio", plan), "/ask");
  assert.equal(researchRoute("EL.10514", plan), "/ask");
  assert.equal(researchRoute("contractor Columbus", plan), "/ask");
});

test("mixed-case /Ohio normalizes", () => {
  assert.equal(normalizedPublishedStatePath("/Ohio"), "/ohio");
  assert.equal(normalizedPublishedStatePath("/OHIO"), "/ohio");
  assert.equal(normalizedPublishedStatePath("/oHiO"), "/ohio");
  assert.equal(normalizedPublishedStatePath("/ohio"), null);
  assert.equal(normalizedPublishedStatePath("/Ohio/columbus"), null);
});
