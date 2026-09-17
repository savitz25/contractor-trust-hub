import assert from "node:assert/strict";
import { test } from "node:test";
import { interpretAskQuery } from "../lib/ask/interpret";
import { researchRoute } from "../lib/ask/request";
import { loadContractorHubIntel } from "../lib/home/load-intel-v2";
import { planContractorSearch } from "../lib/search/contractor-discovery";
import { NORTH_CAROLINA_SNAPSHOT } from "../lib/north-carolina-intelligence/snapshot";

const intel = loadContractorHubIntel();
const ask = (q: string) => interpretAskQuery(q, intel);

test("North Carolina licensed census fails closed search-only", () => {
  const r = ask("licensed contractor North Carolina");
  assert.equal(r.supported, false);
  assert.equal(r.href, "/north-carolina");
  assert.match(r.failMessage || "", /40,000/);
  assert.match(r.failMessage || "", /OPEN_SEARCH_ONLY|search-only/i);
  assert.doesNotMatch(r.failMessage || "", /38,523 active/i);
});

test("exact NCLBGC license outranks geography", () => {
  const r = ask("NCLBGC L.53462");
  assert.equal(r.interpretation.identifier, "L.53462");
  assert.equal(r.href, "/north-carolina");
  assert.match(r.failMessage || "", /qualifier is not the licensed business/i);
});

test("roofing is not S(Roofing)-only", () => {
  const r = ask("roofing contractor North Carolina");
  assert.match(r.failMessage || "", /Building and Residential/i);
  assert.match(r.failMessage || "", /S\(Roofing\)/);
});

test("specialty roofing classification is explicit", () => {
  const r = ask("specialty roofing license North Carolina");
  assert.match(r.failMessage || "", /S\(Roofing\)/);
});

test("limitation is not quality", () => {
  const unlimited = ask("unlimited contractor North Carolina");
  assert.match(unlimited.failMessage || "", /not a quality rank/i);
  const limited = ask("limited contractor North Carolina");
  assert.match(limited.failMessage || "", /\$750,000/);
});

test("electrical and plumbing route to specialty boards", () => {
  const elec = ask("electrical contractor North Carolina");
  assert.match(elec.failMessage || "", /NCBEEC/);
  const plum = ask("plumber North Carolina");
  assert.match(plum.failMessage || "", /Plumbing, Heating/);
  const hvac = ask("HVAC contractor North Carolina");
  assert.match(hvac.failMessage || "", /PHFS/);
  const fire = ask("fire sprinkler contractor North Carolina");
  assert.match(fire.failMessage || "", /PHFS/);
});

test("discipline and unlicensed stay separate", () => {
  const d = ask("contractor disciplinary action North Carolina");
  assert.match(d.failMessage || "", /2022/);
  const c = ask("complaints contractor North Carolina");
  assert.match(c.failMessage || "", /complaint is not discipline/i);
  const u = ask("unlicensed contractor North Carolina");
  assert.match(u.failMessage || "", /not an NCLBGC licensee/i);
});

test("debarment is procurement not license discipline", () => {
  const r = ask("debarred contractor North Carolina");
  assert.match(r.failMessage || "", /2021-06-01/);
  assert.match(r.failMessage || "", /236/);
});

test("Charlotte and Raleigh do not create local routes", () => {
  const ch = ask("contractor Charlotte");
  assert.equal(ch.href, "/north-carolina");
  assert.doesNotMatch(ch.href || "", /charlotte/);
  const ral = ask("contractor Raleigh");
  assert.equal(ral.href, "/north-carolina");
  assert.doesNotMatch(ral.href || "", /raleigh/);
});

test("best contractor fails closed", () => {
  const r = ask("best contractor North Carolina");
  assert.match(r.failMessage || "", /Trust Score|does not rank/i);
});

test("North Carolina stay on /ask", () => {
  const plan = planContractorSearch("licensed contractor North Carolina");
  assert.equal(researchRoute("licensed contractor North Carolina", plan), "/ask");
  assert.equal(researchRoute("NCLBGC L.53462", plan), "/ask");
});
