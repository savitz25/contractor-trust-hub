import assert from "node:assert/strict";
import test from "node:test";
import { contractorCapabilityContract, contractorUnsupportedElectricalResponse, executeContractorSpecialistQuery, normalizeContractorExecutionRequest } from "../lib/specialist-execution/contractor-v2";

test("contract declares typed V2 capability without ranking", () => {
  const contract = contractorCapabilityContract();
  assert.equal(contract.contract, "trusthub-specialist-execution-v2");
  assert.equal(contract.canReturnRows, true);
  assert.ok(contract.limitations.includes("No ranking"));
  assert.match(contract.publicationSemantics, /public non-thin/);
});

test("electrical Boca Raton resolves deterministically to Palm Beach recorded geography", () => {
  const input = normalizeContractorExecutionRequest({ trade: "electrical", state: "FL", city: "Boca Raton" });
  assert.equal(input.trade, "electrical");
  assert.equal(input.county?.slug, "palm-beach");
  assert.equal(input.city, "Boca Raton");
});

test("Florida electrical fails closed because the accepted source does not contain it", async () => {
  await assert.rejects(
    executeContractorSpecialistQuery({ trade: "electrical", state: "FL", city: "Boca Raton" }),
    /unsupported_florida_electrical_source/
  );
  const response = contractorUnsupportedElectricalResponse({ trade: "electrical", state: "FL", city: "Boca Raton" });
  assert.equal(response.status, "unsupported_capability");
  assert.equal(response.errorCode, "unsupported_florida_electrical_source");
  assert.equal(response.resolvedGeography.county, "Palm Beach");
  assert.match(response.resolvedGeography.meaning, /not prove service territory/);
  assert.ok(response.supportedAlternatives.length >= 4);
  assert.equal(response.provenance.capabilityState, "source_not_present");
});

test("accepted taxonomy is parsed without pretending every family is source-executable", () => {
  for (const trade of ["general", "building", "roofing", "hvac", "plumbing", "electrical", "residential", "pool_spa", "mechanical", "solar", "specialty"]) {
    assert.equal(normalizeContractorExecutionRequest({ trade, state: "FL" }).trade, trade);
  }
});

test("unknown fields and geography fail closed", () => {
  assert.throws(() => normalizeContractorExecutionRequest({ trade: "roofing", ranking: "best" }), /unsupported_field/);
  assert.throws(() => normalizeContractorExecutionRequest({ trade: "roofing", city: "Orlando" }), /city_requires_supported_county_mapping/);
  assert.throws(() => normalizeContractorExecutionRequest({ trade: "roofing", state: "NY" }), /unsupported_state/);
});

test("pagination is bounded", () => {
  assert.throws(() => normalizeContractorExecutionRequest({ trade: "roofing", limit: 51 }), /invalid_limit/);
  assert.equal(normalizeContractorExecutionRequest({ trade: "roofing", page: 2, limit: 10 }).page, 2);
});
