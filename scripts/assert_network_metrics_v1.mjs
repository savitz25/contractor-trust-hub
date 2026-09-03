/**
 * ATH-METRICS-001A grain / staleness gates.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicationMetricInputs } from "./publication_metric_inputs.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const failures = [];
const assert = (c, m) => {
  if (!c) failures.push(m);
};

const v1 = JSON.parse(read("data/home/contractor-network-metrics-v1.json"));
const intel = JSON.parse(read("data/home/contractor-hub-intel-v2.json"));
const hero = read("components/home/HomeIntelHero.tsx");
const load = read("lib/home/load-intel-v2.ts");
const byKey = Object.fromEntries(v1.metrics.map((m) => [m.key, m]));

const pub = publicationMetricInputs();
const expectedSources = pub.liveSourceSystems;

assert(v1.schemaVersion === "contractor-network-metrics-v1", "schema");
assert(JSON.stringify(v1.liveCohort.liveSourceSystems) === JSON.stringify(expectedSources), "metric sources match publication config");
for (const src of expectedSources) {
  assert(v1.liveCohort.licensesBySource[src] > 0, `live source present in denominator: ${src}`);
}
assert(byKey.live_credential_records.value === expectedSources.reduce((n, s) => n + v1.liveCohort.licensesBySource[s], 0), "live cred sum");
assert(byKey.nj_construction_source_records.grain === "municipal_permit_or_certificate_source_record", "NJ grain");
assert(byKey.nj_construction_source_records.value !== byKey.live_credential_records.value, "permits/construction != credentials");
assert(byKey.public_contact_observations.value !== byKey.research_graph_contractor_identities.value, "contacts != entities");
assert(byKey.published_county_intelligence_pages.value === pub.publishedCountyIntelligencePageCount, "county pages match FL+NJ catalogs");
assert(byKey.published_county_intelligence_pages.value !== byKey.live_researched_states.value, "counties != states");
assert(byKey.published_ca_city_local_intelligence_pages.value === pub.caCityLocalPages.length, "CA city local pages match publication gates");
assert(byKey.published_ca_city_local_intelligence_pages.value !== byKey.published_county_intelligence_pages.value, "CA city pages are not county pages");
assert(!pub.caCityLocalPages.some((p) => p.includes("county")), "CA local gates are city pages, not county OS pages");
assert(v1.californiaReconciliation.joinLiveCredentialCohort === false, "CA fail closed");
assert(byKey.ca_acquired_cslb_license_master_rows_truncated.sourceAsOf === "2026-09-02", "CA sourceAsOf");
assert(byKey.nj_construction_source_records.sourceAsOf === "2026-08-07", "NJ sourceAsOf");
assert(byKey.live_credential_records.sourceAsOf === null, "live creds do not fake official date");
assert(v1.generatedAt.startsWith("2026-"), "generatedAt");
assert(byKey.nj_construction_source_records.sourceAsOf !== v1.generatedAt.slice(0, 10), "sourceAsOf != generatedAt");
assert(intel.publicCoverage.credentialRecords === byKey.live_credential_records.value, "homepage intel-v2 matches v1 credentials");
assert(intel.publicCoverage.activeCurrentCredentialRecords === byKey.live_active_current_credential_records.value, "homepage matches v1 active");
assert(load.includes("projectIntelV2FromNetworkMetrics"), "homepage consumes v1");
assert(hero.includes("Network rollup generated"), "hero generated clock");
assert(!hero.includes("Last official update"), "no ambiguous official update");

if (failures.length) {
  console.error("ATH-METRICS-001A FAIL");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("ATH-METRICS-001A PASS network metric grain and staleness gates");
