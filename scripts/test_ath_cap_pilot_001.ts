import assert from "node:assert/strict";
import test from "node:test";
import { contractorCapabilityContract, normalizeContractorExecutionRequest } from "../lib/specialist-execution/contractor-v2";

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

test("accepted trade taxonomy includes general through specialty", () => {
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
