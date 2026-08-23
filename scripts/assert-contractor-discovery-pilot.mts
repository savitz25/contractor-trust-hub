/**
 * ASK-SEARCH-CONTRACTOR-001 / 001.1 focused tests (no live DB required).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  categoriesFromOccupationCodes,
  isUnsupportedAskTrade,
} from "../lib/network-discovery/trades";
import {
  buildCanonicalProfileUrl,
  buildContractorNetworkId,
  mapContractorToDiscovery,
} from "../lib/network-discovery/map";
import { selectContractorPilot, PILOT_TARGET, stratumKey } from "../lib/network-discovery/cohort";
import { contentFingerprint } from "../lib/network-discovery/fingerprint";
import { validateDiscoveryEntity, validateDiscoveryExport } from "../lib/network-discovery/validate";
import { auditContractorQueryReadiness } from "../lib/network-discovery/query-readiness";
import {
  FLORIDA_DISCOVERY_POLICY,
  FLORIDA_OCCUPATION_LOCK,
  FLORIDA_READY_CATEGORIES,
  FORBIDDEN_MATCH_REASONS,
  NEW_JERSEY_DISCOVERY_POLICY,
  floridaBrowseTradeSlug,
  isFloridaReadyDiscovery,
} from "../lib/network-discovery/florida-policy";
import type { ContractorSourceRow, NetworkDiscoveryEntity } from "../lib/network-discovery/types";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else console.log("PASS:", msg);
}

const here = dirname(fileURLToPath(import.meta.url));
const cohortSrc = readFileSync(join(here, "../lib/network-discovery/cohort.ts"), "utf8");
const qaGeo = [
  "miami",
  "broward",
  "palm beach",
  "palmbeach",
  "tampa",
  "jacksonville",
  "orlando",
  "monmouth",
  "bergen",
  "middlesex",
];
assert(
  qaGeo.every((g) => !cohortSrc.toLowerCase().includes(g)),
  "cohort algorithm has no QA city/county geography"
);
assert(
  !cohortSrc.includes("REQUIRED_QUERY_FIXTURES") && !cohortSrc.includes("matchesQuery"),
  "cohort does not import or reserve query fixtures"
);

assert(categoriesFromOccupationCodes(["CCC", "RR"]).includes("roofing"), "CCC/RR → roofing");
assert(categoriesFromOccupationCodes(["CFC"]).includes("plumbing"), "CFC → plumbing");
assert(categoriesFromOccupationCodes(["CAC"]).includes("hvac"), "CAC → hvac");
assert(!categoriesFromOccupationCodes(["CMC"]).includes("hvac"), "CMC mechanical is not auto-HVAC");
assert(FLORIDA_OCCUPATION_LOCK.CMC === null, "policy lock: CMC not HVAC");
assert(categoriesFromOccupationCodes(["CGC"]).includes("general_contractor"), "CGC → general_contractor");
assert(!categoriesFromOccupationCodes(["CBC"]).length, "CBC not forced to general_contractor");
assert(!categoriesFromOccupationCodes(["CRC"]).length, "CRC not forced to general_contractor");
assert(FLORIDA_OCCUPATION_LOCK.CBC === null && FLORIDA_OCCUPATION_LOCK.CRC === null, "policy lock: CBC/CRC held");
assert(categoriesFromOccupationCodes(["ELE"]).includes("electrical"), "NJ ELE → electrical");
assert(categoriesFromOccupationCodes(["HIC"]).includes("general_contractor"), "NJ HIC → general_contractor");
assert(!categoriesFromOccupationCodes(["HIC"]).includes("roofing"), "NJ HIC is not inferred roofing");
assert(!categoriesFromOccupationCodes(["SOLAR"]).length, "name-assist solar is not exported");
assert(isUnsupportedAskTrade("home inspector"), "home inspector unsupported");
assert(isUnsupportedAskTrade("kitchen_remodeling"), "kitchen remodeling unsupported");
assert(isUnsupportedAskTrade("painting"), "painting unsupported");
assert(isUnsupportedAskTrade("flooring"), "flooring unsupported");
assert(!floridaBrowseTradeSlug("electrical"), "no Florida browse route for electrical");
assert(!floridaBrowseTradeSlug("solar"), "no Florida browse route for solar");
assert(floridaBrowseTradeSlug("roofing") === "roofers", "FL roofing browse slug");

assert(FLORIDA_DISCOVERY_POLICY.readiness === "READY", "Florida bounded policy READY");
assert(FLORIDA_DISCOVERY_POLICY.service_geography === "UNSUPPORTED", "no FL service graph");
assert(
  (FLORIDA_READY_CATEGORIES as readonly string[]).join() ===
    "roofing,plumbing,hvac,pool,general_contractor",
  "frozen FL READY categories"
);
assert(NEW_JERSEY_DISCOVERY_POLICY.readiness === "SOFT", "NJ remains SOFT");
assert(NEW_JERSEY_DISCOVERY_POLICY.trades.roofing === "UNSUPPORTED", "NJ roofing unsupported");
assert(NEW_JERSEY_DISCOVERY_POLICY.county_browse === false, "NJ county browse not mature");

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
assert(isFloridaReadyDiscovery(ent), "Miami roofer satisfies frozen FL READY policy");
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
const miamiReasons = ((inspectorQ["roofers Miami FL"] as { sample: { reasons: string[] }[] }).sample[0]
  ?.reasons || []) as string[];
assert(miamiReasons.includes("exact_physical_city"), "city query uses exact_physical_city when city matches");
assert(
  FORBIDDEN_MATCH_REASONS.every((r) => !miamiReasons.includes(r)),
  "no service-geography match reasons"
);

const homestead: ContractorSourceRow = {
  ...sample,
  id: "44444444-4444-4444-4444-444444444444",
  slug: "homestead-roofing",
  displayName: "Homestead Roofing",
  primaryCity: "Homestead",
  licenseCities: ["Homestead"],
  primaryCounty: "Miami-Dade",
  licenseCounties: ["Miami-Dade"],
};
const homesteadEnt = mapContractorToDiscovery(homestead)!;
const homesteadQ = auditContractorQueryReadiness([homesteadEnt]);
const hReasons = ((homesteadQ["roofers Miami FL"] as { sample: { reasons: string[] }[] }).sample[0]
  ?.reasons || []) as string[];
assert(
  (homesteadQ["roofers Miami FL"] as { matches: number }).matches === 1,
  "Miami-Dade non-Miami city still observationally matches the Miami query at county precision"
);
assert(!hReasons.includes("exact_physical_city"), "shared county is not labeled exact_physical_city");
assert(hReasons.includes("exact_physical_county"), "county-only evidence uses exact_physical_county");

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
assert(!isFloridaReadyDiscovery(njEnt), "NJ entity is not Florida READY");
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
    homeState: i % 3 === 0 ? "NJ" : "FL",
    physicalState: i % 3 === 0 ? "NJ" : "FL",
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
  new Set(a.map(stratumKey)).size > 1,
  "natural strata include more than one state|trade bucket"
);
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
  console.error(`ASK-SEARCH-CONTRACTOR-001.1 FAILED (${failed})`);
  process.exit(1);
}
console.log("ASK-SEARCH-CONTRACTOR-001.1 unit assertions passed.");
