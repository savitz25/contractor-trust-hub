/**
 * ASK-SEARCH-CONTRACTOR-001 focused tests (no live DB required for unit checks).
 */
import {
  categoriesFromOccupationCodes,
  isUnsupportedAskTrade,
} from "../lib/network-discovery/trades";
import {
  buildCanonicalProfileUrl,
  buildContractorNetworkId,
  mapContractorToDiscovery,
} from "../lib/network-discovery/map";
import { selectContractorPilot, PILOT_TARGET } from "../lib/network-discovery/cohort";
import { contentFingerprint } from "../lib/network-discovery/fingerprint";
import { validateDiscoveryEntity, validateDiscoveryExport } from "../lib/network-discovery/validate";
import { auditContractorQueryReadiness } from "../lib/network-discovery/query-readiness";
import type { ContractorSourceRow, NetworkDiscoveryEntity } from "../lib/network-discovery/types";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else console.log("PASS:", msg);
}

assert(categoriesFromOccupationCodes(["CCC", "RR"]).includes("roofing"), "CCC/RR → roofing");
assert(categoriesFromOccupationCodes(["CFC"]).includes("plumbing"), "CFC → plumbing");
assert(categoriesFromOccupationCodes(["CAC"]).includes("hvac"), "CAC → hvac");
assert(!categoriesFromOccupationCodes(["CMC"]).includes("hvac"), "CMC mechanical is not auto-HVAC");
assert(categoriesFromOccupationCodes(["CGC"]).includes("general_contractor"), "CGC → general_contractor");
assert(!categoriesFromOccupationCodes(["CBC"]).length, "CBC not forced to general_contractor");
assert(!categoriesFromOccupationCodes(["CRC"]).length, "CRC not forced to general_contractor");
assert(categoriesFromOccupationCodes(["ELE"]).includes("electrical"), "NJ ELE → electrical");
assert(categoriesFromOccupationCodes(["HIC"]).includes("general_contractor"), "NJ HIC → general_contractor");
assert(!categoriesFromOccupationCodes(["HIC"]).includes("roofing"), "NJ HIC is not inferred roofing");
assert(!categoriesFromOccupationCodes(["SOLAR"]).length, "name-assist solar is not exported");
assert(isUnsupportedAskTrade("home inspector"), "home inspector unsupported");
assert(isUnsupportedAskTrade("kitchen_remodeling"), "kitchen remodeling unsupported");
assert(isUnsupportedAskTrade("painting"), "painting unsupported");

assert(buildContractorNetworkId("abc-uuid") === "contractor:abc-uuid", "network id uses company UUID");
assert(
  buildCanonicalProfileUrl("acme-roofing") ===
    "https://www.contractortrusthub.com/contractors/acme-roofing",
  "canonical host/path"
);

const sample: ContractorSourceRow = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "acme-roofing-miami",
  displayName: "Acme Roofing",
  legalName: "Acme Roofing LLC",
  occupationCodes: ["CCC"],
  licenseStatuses: ["active"],
  licenseStates: ["FL"],
  licenseCities: ["Miami"],
  licenseCounties: ["Miami-Dade"],
  sourceSystems: ["fl_dbpr"],
  homeState: "FL",
  physicalState: "FL",
  primaryCity: "Miami",
  primaryCounty: "Miami-Dade",
  postalCode: "33101",
  licenseCount: 2,
};
const ent = mapContractorToDiscovery(sample)!;
assert(ent.entity_type === "contractor", "entity_type contractor not roofer");
assert(ent.categories?.includes("roofing"), "roofing category");
assert(ent.state === "FL", "physical/license state FL");
assert(ent.city === "Miami", "physical city");
assert(ent.county === "Miami-Dade", "physical county");
assert(
  !ent.service_areas || ent.service_areas.length === 0,
  "physical office is not emitted as a service-area graph"
);
assert(
  ent.canonical_search_url === "https://www.contractortrusthub.com/florida/miami-dade/roofers",
  "FL county/trade browse URL"
);
assert(!ent.canonical_search_url?.includes("?"), "search URL has no query identity");
assert(/DBPR construction license on file/i.test(ent.regulatory_status_summary || ""), "regulatory wording source-backed");
assert(!/best|trusted|recommended|clean|safe/i.test(ent.regulatory_status_summary || ""), "no quality adjectives");
assert(validateDiscoveryEntity(ent).length === 0, "sample validates");
assert(!("phone" in ent) && !("premium" in ent) && !("trust_score" in ent), "no forbidden fields");
assert(!("review_count" in ent) && !("overall_rating" in ent) && !("paid_rank" in ent), "no popularity/payment fields");

const inspectorQ = auditContractorQueryReadiness([ent]);
assert((inspectorQ["home inspectors Miami"] as { count: number }).count === 0, "home inspectors Miami = 0");
assert((inspectorQ["roofers Miami FL"] as { matches: number }).matches === 1, "roofers Miami matches sample");

const njPlumber: ContractorSourceRow = {
  ...sample,
  id: "22222222-2222-2222-2222-222222222222",
  slug: "bergen-plumbing",
  displayName: "Bergen Plumbing",
  occupationCodes: ["PLB"],
  sourceSystems: ["nj_dca"],
  homeState: "NJ",
  physicalState: "NJ",
  primaryCity: "Hackensack",
  primaryCounty: "Bergen",
  licenseCities: ["Hackensack"],
  licenseCounties: ["Bergen"],
  licenseStates: ["NJ"],
};
const njEnt = mapContractorToDiscovery(njPlumber)!;
assert(njEnt.categories?.includes("plumbing"), "NJ PLB → plumbing");
assert(
  njEnt.canonical_search_url === "https://www.contractortrusthub.com/verify",
  "NJ has no county browse — Verify, no query string"
);
assert(
  (auditContractorQueryReadiness([njEnt])["plumbers Bergen County NJ"] as { matches: number }).matches === 1,
  "Bergen plumbing query uses physical county"
);

const paNjLicense: ContractorSourceRow = {
  ...njPlumber,
  id: "33333333-3333-3333-3333-333333333333",
  slug: "pa-office-nj-hic",
  displayName: "PA Office HIC",
  occupationCodes: ["HIC"],
  physicalState: "PA",
  homeState: "PA",
  primaryCity: "Philadelphia",
  primaryCounty: "Philadelphia",
  licenseStates: ["NJ"],
};
const paEnt = mapContractorToDiscovery(paNjLicense)!;
assert(paEnt.state === "PA", "physical state is not rewritten to license jurisdiction");
assert(
  !mapContractorToDiscovery({ ...sample, physicalState: "RE", homeState: "FL", licenseStates: ["RE"] })!.state ||
    mapContractorToDiscovery({ ...sample, physicalState: "RE", homeState: "FL", licenseStates: ["RE"] })!.state === "FL",
  "invalid extract state RE is not published"
);
assert(paEnt.categories?.includes("general_contractor"), "HIC maps to general_contractor");
const njGcQ = auditContractorQueryReadiness([paEnt]);
assert(
  (njGcQ["general contractors New Jersey"] as { matches: number }).matches === 1,
  "NJ-licensed PA office matches NJ GC via license_state wording, not physical NJ"
);
assert(
  (njGcQ["contractors Middlesex County NJ"] as { matches: number }).matches === 0,
  "PA physical county is not treated as Middlesex service coverage"
);

const many: NetworkDiscoveryEntity[] = [];
for (let i = 0; i < 250; i++) {
  const row: ContractorSourceRow = {
    ...sample,
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    slug: `co-${i}`,
    displayName: `Co ${i}`,
    occupationCodes: i % 2 === 0 ? ["CCC"] : ["CFC"],
  };
  many.push(mapContractorToDiscovery(row)!);
}
const a = selectContractorPilot(many);
const b = selectContractorPilot(many);
assert(a.length === PILOT_TARGET, `cohort size ${PILOT_TARGET}`);
assert(a.map((e) => e.network_entity_id).join() === b.map((e) => e.network_entity_id).join(), "cohort deterministic");
assert(contentFingerprint(a) === contentFingerprint(b), "fingerprint stable");
assert(validateDiscoveryExport(a).ok, "cohort export validates");
const ids = new Set(a.map((e) => e.network_entity_id));
assert(ids.size === a.length, "no identity collisions");
assert(
  !selectContractorPilot.toString().includes("premium") &&
    !selectContractorPilot.toString().includes("trust_score") &&
    !selectContractorPilot.toString().includes("review"),
  "cohort function does not rank by Premium/payment/popularity"
);

const twoLicensesSameCompany = mapContractorToDiscovery({
  ...sample,
  occupationCodes: ["CCC", "CFC"],
  licenseCount: 2,
})!;
assert(twoLicensesSameCompany.network_entity_id === ent.network_entity_id, "multi-license keeps company identity");
assert(
  twoLicensesSameCompany.categories?.includes("roofing") &&
    twoLicensesSameCompany.categories?.includes("plumbing"),
  "multi-trade is categories[] on one contractor"
);

if (failed) {
  console.error(`ASK-SEARCH-CONTRACTOR-001 FAILED (${failed})`);
  process.exit(1);
}
console.log("ASK-SEARCH-CONTRACTOR-001 unit assertions passed.");
