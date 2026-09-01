import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  CONTRACTOR_CONTRACT_FINGERPRINT,
  CONTRACTOR_SCHEMA_FINGERPRINT,
  CONTRACT_VERSION,
  contractorCapabilityContract,
  contractorRequestErrorResponse,
  contractorUnsupportedElectricalResponse,
  executeContractorSpecialistQuery,
  normalizeContractorExecutionRequest,
} from "../lib/specialist-execution/contractor-v2";
import { CONTRACTOR_STATE_CAPABILITIES, getTradeCapability } from "../lib/specialist-execution/state-capabilities";
import { NJ_COUNTIES, resolveNjCounty, resolveNjMunicipality } from "../lib/specialist-execution/nj-geography";

const source = fs.readFileSync("lib/specialist-execution/contractor-v2.ts", "utf8");
const route = fs.readFileSync("app/api/specialist-execution/v2/route.ts", "utf8");
const stateSource = fs.readFileSync("lib/specialist-execution/state-capabilities.ts", "utf8");

test("contract family/version/fingerprints are deterministic", () => {
  const contract = contractorCapabilityContract();
  assert.equal(contract.contract, "trusthub-specialist-execution-v2"); // 1
  assert.equal(CONTRACT_VERSION, "2.1.0"); // 2
  assert.match(CONTRACTOR_SCHEMA_FINGERPRINT, /^[a-f0-9]{64}$/); // 3
  assert.match(CONTRACTOR_CONTRACT_FINGERPRINT, /^[a-f0-9]{64}$/); // 4
  assert.equal(contract.schemaFingerprint, contractorCapabilityContract().schemaFingerprint); // 5
  assert.equal(contract.contractFingerprint, contractorCapabilityContract().contractFingerprint); // 6
});

test("state/source selection is exact", () => {
  assert.deepEqual(CONTRACTOR_STATE_CAPABILITIES.NJ.sourceSystems, ["nj_dca"]); // 7
  assert.deepEqual(CONTRACTOR_STATE_CAPABILITIES.FL.sourceSystems, ["fl_dbpr"]); // 8
  assert.doesNotMatch(stateSource.match(/NJ: \{[\s\S]*?\n  \},/)?.[0] ?? "", /fl_dbpr/); // 9
  assert.doesNotMatch(stateSource.match(/FL: \{[\s\S]*?\n  \},/)?.[0] ?? "", /nj_dca/); // 10
  assert.throws(() => normalizeContractorExecutionRequest({ state: "NY", trade: "roofing" }), /unsupported_state/); // 11
});

test("New Jersey class matrix is source-native", () => {
  assert.deepEqual(getTradeCapability("NJ", "home improvement contractor")?.occupationCodes, ["HIC"]); // 12
  assert.deepEqual(getTradeCapability("NJ", "electrical")?.occupationCodes, ["ELE"]); // 13
  assert.deepEqual(getTradeCapability("NJ", "plumbing")?.occupationCodes, ["PLB"]); // 14
  assert.deepEqual(getTradeCapability("NJ", "hvac")?.occupationCodes, ["HVAC"]); // 15
  assert.equal(getTradeCapability("NJ", "general"), null); // 16
  assert.notDeepEqual(getTradeCapability("NJ", "home_improvement")?.occupationCodes, ["GEN"]); // 17
});

test("generic and General NJ requests never invent a population", async () => {
  const generic = await executeContractorSpecialistQuery({ state: "NJ" });
  assert.equal(generic.resultState, "CLARIFICATION_REQUIRED"); // 18
  assert.equal("errorCode" in generic && generic.errorCode, "new_jersey_credential_class_required"); // 19
  assert.ok("capabilityChoices" in generic && generic.capabilityChoices.some((choice) => choice.id === "home_improvement")); // 20
  const general = await executeContractorSpecialistQuery({ state: "NJ", trade: "general" });
  assert.equal(general.resultState, "UNSUPPORTED_TRADE_CAPABILITY"); // 21
  assert.equal("errorCode" in general && general.errorCode, "no_new_jersey_statewide_general_contractor_class"); // 22
  assert.match(JSON.stringify(general), /HIC is not relabeled General/); // 23
});

test("New Jersey statewide and authoritative Summit geography normalize safely", () => {
  const statewide = normalizeContractorExecutionRequest({ state: "NJ", trade: "home_improvement" });
  assert.equal(statewide.geography?.county, null); // 24
  assert.match(statewide.geography?.meaning ?? "", /credential jurisdiction/); // 25
  const summit = normalizeContractorExecutionRequest({ state: "NJ", trade: "electrical", city: "Summit" });
  assert.equal(summit.city, "Summit"); // 26
  assert.equal(summit.county?.label, "Union"); // 27
  assert.equal(resolveNjMunicipality("Summit")?.municipalityCode, "2018"); // 28
  assert.equal(resolveNjCounty("Union County"), "Union"); // 29
  assert.equal(NJ_COUNTIES.length, 21); // 30
});

test("invalid and conflicting New Jersey geography fails closed", () => {
  assert.throws(() => normalizeContractorExecutionRequest({ state: "NJ", trade: "home_improvement", county: "Summit County" }), /summit_is_city/); // 31
  assert.throws(() => normalizeContractorExecutionRequest({ state: "NJ", trade: "home_improvement", county: "Miami-Dade" }), /county_not_in_new_jersey/); // 32
  assert.throws(() => normalizeContractorExecutionRequest({ state: "NJ", trade: "home_improvement", city: "Summit", county: "Essex" }), /city_county_mismatch/); // 33
  const response = contractorRequestErrorResponse(new Error("invalid_geography:summit_is_city_in_union_county"), { state: "NJ" });
  assert.equal(response.resultState, "INVALID_GEOGRAPHY"); // 34
  assert.equal(response.queryInterpretation.correction?.county, "Union"); // 35
});

test("statewide fallback is explicit", async () => {
  const unconfirmed = await executeContractorSpecialistQuery({ state: "NJ", trade: "home_improvement", city: "Princeton" });
  assert.equal(unconfirmed.resultState, "CLARIFICATION_REQUIRED"); // 36
  assert.equal("errorCode" in unconfirmed && unconfirmed.errorCode, "statewide_fallback_confirmation_required"); // 37
  assert.match(JSON.stringify(unconfirmed), /no silent broadening occurred/i); // 38
  const confirmed = normalizeContractorExecutionRequest({ state: "NJ", trade: "home_improvement", city: "Princeton", confirmStatewide: true });
  assert.equal(confirmed.geography?.fallbackApplied, true); // 39
  assert.equal(confirmed.geography?.city, null); // 40
});

test("service territory is never inferred", async () => {
  const response = await executeContractorSpecialistQuery({ state: "NJ", trade: "plumbing", geography: { stateCode: "NJ", intent: "SERVICE_TERRITORY" } });
  assert.equal(response.resultState, "UNSUPPORTED_TRADE_CAPABILITY"); // 41
  assert.equal("errorCode" in response && response.errorCode, "unsupported_service_territory"); // 42
  assert.match(JSON.stringify(response), /do not prove service territory/); // 43
});

test("publication gate, row privacy, ordering, and exact lookup remain deterministic", () => {
  assert.match(source, /c\.is_thin_profile = FALSE/); // 44
  assert.match(source, /c\.slug IS NOT NULL/); // 45
  assert.doesNotMatch(source, /profileId:/); // 46
  assert.match(source, /ORDER BY LOWER\(c\.display_name\)/); // 47
  assert.doesNotMatch(source, /ORDER BY[^\n]*(rating|review|paid|score)/i); // 48
  assert.match(source, /REGEXP_REPLACE\(COALESCE\(l\.external_key/); // 49
  assert.match(source, /REGEXP_REPLACE\(COALESCE\(l\.license_number/); // 50
});

test("pagination is bounded and stable by contract", () => {
  assert.throws(() => normalizeContractorExecutionRequest({ state: "NJ", trade: "HIC", limit: 51 }), /invalid_limit/); // 51
  assert.equal(normalizeContractorExecutionRequest({ state: "NJ", trade: "HIC", page: 2, limit: 10 }).page, 2); // 52
  assert.equal(normalizeContractorExecutionRequest({ state: "NJ", trade: "HIC" }).limit, 24); // 53
  assert.match(source, /LIMIT \$\$\{built\.params\.length \+ 1\}/); // 54
  assert.equal(normalizeContractorExecutionRequest({ state: "NJ", trade: "HIC", page: 5023, limit: 5 }).page, 5023);
  assert.match(source, /pageOutOfRange \? "INVALID_QUERY"/);
});

test("Florida accepted behavior remains locked", async () => {
  assert.deepEqual(normalizeContractorExecutionRequest({ state: "FL", trade: "roofing", county: "broward" }).trade, "roofing"); // 55
  assert.equal(normalizeContractorExecutionRequest({ state: "FL", trade: "hvac" }).trade, "hvac"); // 56
  assert.equal(normalizeContractorExecutionRequest({ state: "FL", trade: "plumbing" }).trade, "plumbing"); // 57
  await assert.rejects(executeContractorSpecialistQuery({ state: "FL", trade: "electrical", city: "Boca Raton" }), /unsupported_florida_electrical_source/); // 58
  assert.equal(contractorUnsupportedElectricalResponse({ state: "FL", trade: "electrical", city: "Boca Raton" }).errorCode, "unsupported_florida_electrical_source"); // 59
});

test("route and contract expose safe state distinctions without writes", () => {
  assert.match(route, /GET\(request: Request\)/); // 60
  assert.match(route, /POST\(request: Request\)/); // 61
  assert.match(route, /status: responseStatus/); // 62
  assert.doesNotMatch(source, /\b(INSERT|UPDATE|DELETE)\b/); // 63
  assert.doesNotMatch(source, /Trust Score|recommendation ranking|paid ordering/i); // 64
  assert.match(JSON.stringify(contractorCapabilityContract()), /No publication expansion/); // 65
});
