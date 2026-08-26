/**
 * INTEL-001/002/003 architecture tests. No live database required.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGGREGATION_RULES,
  ARCHITECTURE_LAYERS,
  CONTACT_RULES,
  FLORIDA_CILB_OCCUPATIONS,
  FLORIDA_DBPR_COUNTY_CODES,
  INTELLIGENCE_TRADE_BUCKETS,
  METRIC_DICTIONARY,
  OCCUPATION_NON_EQUIVALENCE,
  PUBLIC_ADVERSE_ATTRIBUTION,
  PUBLIC_FL_DISCIPLINE_PREDICATE,
  PUBLIC_SUNBIZ_MIN_CONFIDENCE,
  SHARED_QUALIFIER_IS_NOT_ATTRIBUTION,
  SOURCE_ATTRIBUTION_RULES,
  STATEWIDE_VS_COUNTY_RULE,
  SUNBIZ_METHOD_CLASS,
  classifyFloridaCountyCode,
  isContractorTradeOccupation,
  mayPublishAdverse,
  mergeContactObservations,
  metricIsPublic,
  normalizeIdentityState,
  publicPublicationState,
} from "../lib/intelligence/index";
import { FLORIDA_TRADES } from "../lib/discovery/trades";
import { FLORIDA_COUNTIES } from "../lib/discovery/counties";
import { getOccupationInfo } from "../lib/contractors/occupations";
import { categoriesFromOccupationCodes } from "../lib/network-discovery/trades";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("PASS:", msg);
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

assert(ARCHITECTURE_LAYERS.length === 9, "nine architecture layers");
assert(METRIC_DICTIONARY.active_license.entityCounted === "credential", "active license counts credentials");
assert(METRIC_DICTIONARY.active_contractor.entityCounted === "business", "active contractor counts businesses");
assert(METRIC_DICTIONARY.active_license.publicEligibility === "public", "active licenses may be public");
assert(METRIC_DICTIONARY.active_contractor.publicEligibility === "not_yet_calculable", "distinct businesses not yet public");
assert(METRIC_DICTIONARY.person.publicEligibility === "not_yet_calculable", "distinct persons not calculable");
assert(METRIC_DICTIONARY.qualifier.publicEligibility === "not_yet_calculable", "qualifiers not calculable");
assert(!metricIsPublic("unresolved_evidence"), "unresolved evidence is internal");
assert(METRIC_DICTIONARY.active_license.notes.includes("credentials, not businesses"), "104444 note is credentials");

assert(FLORIDA_CILB_OCCUPATIONS.RR.officialName === "Registered Residential Contractor", "RR is registered residential");
assert(FLORIDA_CILB_OCCUPATIONS.RC.officialName === "Registered Roofing Contractor", "RC is registered roofing");
assert(FLORIDA_CILB_OCCUPATIONS.CVC.officialName === "Certified Solar Contractor", "CVC is certified solar");
assert(FLORIDA_CILB_OCCUPATIONS.CSC.officialName === "Certified Sheet Metal Contractor", "CSC is sheet metal not solar");
assert(OCCUPATION_NON_EQUIVALENCE.RR_is_not_roofing.roofingCode === "RC", "RR ≠ roofing");
assert(!isContractorTradeOccupation("FRO"), "FRO is not a trade license");
assert(!isContractorTradeOccupation("QB"), "QB is not a credential");
assert(!isContractorTradeOccupation("CRS1"), "CRS1 is education");
assert(isContractorTradeOccupation("CGC"), "CGC is a trade license");
assert(INTELLIGENCE_TRADE_BUCKETS.roofing.includes("CCC") && INTELLIGENCE_TRADE_BUCKETS.roofing.includes("RC"), "roofing bucket CCC+RC");
assert(!INTELLIGENCE_TRADE_BUCKETS.roofing.includes("RR"), "roofing bucket excludes RR");
assert(INTELLIGENCE_TRADE_BUCKETS.solar.includes("CVC"), "solar bucket CVC");
assert(INTELLIGENCE_TRADE_BUCKETS.residential.includes("RR"), "RR is residential");

assert(getOccupationInfo("RR").label === "Registered Residential Contractor", "UI label RR");
assert(getOccupationInfo("RC").label === "Registered Roofing Contractor", "UI label RC");
const roofers = FLORIDA_TRADES.find((t) => t.slug === "roofers");
assert(roofers?.occupationCodes.includes("RC") && !roofers.occupationCodes.includes("RR"), "browse roofers uses RC not RR");
const solar = FLORIDA_TRADES.find((t) => t.slug === "solar");
assert(solar?.occupationCodes.includes("CVC"), "browse solar CVC");
assert(categoriesFromOccupationCodes(["CCC", "RC"]).includes("roofing"), "Ask category CCC/RC roofing");
assert(!categoriesFromOccupationCodes(["RR"]).includes("roofing"), "Ask category RR is not roofing");

assert(FLORIDA_DBPR_COUNTY_CODES["16"] === "Broward", "county 16 Broward");
assert(FLORIDA_DBPR_COUNTY_CODES["23"] === "Miami-Dade", "county 23 Miami-Dade");
assert(FLORIDA_DBPR_COUNTY_CODES["74"] === "Volusia", "county 74 Volusia");
assert(classifyFloridaCountyCode("710")?.kind === "out_of_state", "701-799 out of state");
assert(classifyFloridaCountyCode("16")?.kind === "florida_county", "16 is a Florida county");
assert(FLORIDA_COUNTIES.length === 67, "discovery lists 67 counties");
assert(FLORIDA_COUNTIES.some((c) => c.slug === "volusia" && c.matchCodes?.includes("74")), "Volusia matchCode 74");
assert(STATEWIDE_VS_COUNTY_RULE.includes("do not have to equal"), "statewide ≠ sum of operating counties");

assert(SUNBIZ_METHOD_CLASS.exact_name_city.attribution === "REVIEW_REQUIRED", "city-only Sunbiz is review");
assert(SUNBIZ_METHOD_CLASS.exact_name_city.publicLegalEntity === false, "city-only Sunbiz not public legal entity");
assert(SUNBIZ_METHOD_CLASS.exact_name_address.attribution === "HIGH_CONFIDENCE", "address Sunbiz high confidence");
assert(PUBLIC_SUNBIZ_MIN_CONFIDENCE === 0.95, "public Sunbiz min 0.95");
assert(PUBLIC_ADVERSE_ATTRIBUTION.length === 1 && PUBLIC_ADVERSE_ATTRIBUTION[0] === "CONFIRMED", "adverse public = CONFIRMED only");
assert(normalizeIdentityState("EXACT") === "CONFIRMED", "EXACT maps to CONFIRMED");
assert(normalizeIdentityState("UNRESOLVED") === "UNRESOLVED", "UNRESOLVED stays unresolved");
assert(!mayPublishAdverse({ attribution: "CONFIRMED", publicationState: "INTERNAL" }), "INTERNAL not public even if exact");
assert(!mayPublishAdverse({ attribution: "REVIEW_REQUIRED", publicationState: "PUBLIC" }), "review required not public adverse");
assert(mayPublishAdverse({ attribution: "CONFIRMED", publicationState: "PUBLIC" }), "confirmed+public may publish");
assert(publicPublicationState("HIGH_CONFIDENCE", "fl_dbpr_discipline") === "INTERNAL", "discipline high-confidence stays internal");
assert(SHARED_QUALIFIER_IS_NOT_ATTRIBUTION === true, "shared qualifier is not attribution");
assert(PUBLIC_FL_DISCIPLINE_PREDICATE.includes("PUBLIC"), "FL public discipline predicate");
assert(
  SOURCE_ATTRIBUTION_RULES.every((r) => r.inheritAcrossSharedQualifier === false),
  "no source inherits across shared qualifier"
);

const dfs = SOURCE_ATTRIBUTION_RULES.find((r) => r.sourceFamily === "fl_dfs_stop_work");
assert(dfs?.unresolved.includes("NO_OFFICIAL_IDENTITY_IDENTIFIER"), "DFS unresolved without official id");
assert(dfs?.highConfidence.includes("Prohibited"), "DFS name/location auto-link prohibited");

const ula = SOURCE_ATTRIBUTION_RULES.find((r) => r.sourceFamily === "fl_dbpr_unlicensed_activity");
assert(ula?.unresolved.includes("no license number"), "ULA has no license number");

assert(CONTACT_RULES.allowMultiplePerKind === true, "multiple contacts per kind");
assert(CONTACT_RULES.primaryDoesNotDeleteSecondary === true, "primary does not delete secondary");
const contacts = mergeContactObservations(
  [
    {
      kind: "email",
      value: "a@example.com",
      sourceSystem: "fl_dbpr",
      attributedEntityId: "b1",
      attributedEntityKind: "business",
      isPrimary: true,
    },
  ],
  {
    kind: "email",
    value: "b@example.com",
    sourceSystem: "fl_sunbiz",
    attributedEntityId: "b1",
    attributedEntityKind: "business",
    isPrimary: true,
  }
);
assert(contacts.length === 2, "second email retained");
assert(contacts.filter((c) => c.isPrimary).length === 1, "only one primary after merge");
assert(contacts.some((c) => c.value === "a@example.com" && !c.isPrimary), "former primary kept as secondary");

assert(
  AGGREGATION_RULES.find((r) => r.id === "operating_county")?.public === false,
  "operating county not public yet"
);
assert(
  AGGREGATION_RULES.find((r) => r.id === "statewide_active_credentials")?.how.includes("Do not add 'current'"),
  "current is not active"
);

const queries = readFileSync(join(root, "lib/contractors/queries.ts"), "utf8");
assert(queries.includes("PUBLIC_FL_DISCIPLINE_PREDICATE"), "profile/search uses public discipline gate");
assert(!queries.includes("FROM discipline_actions\n    WHERE contractor_id = $1\n    ORDER BY"), "ungated profile discipline query removed");

const landing = readFileSync(join(root, "lib/discovery/landing-cache.ts"), "utf8");
assert(!landing.includes("104444"), "landing does not hard-code 104444");
assert(landing.includes("COUNT(*)"), "landing stats are queried");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nFlorida intelligence foundation assertions passed.");
