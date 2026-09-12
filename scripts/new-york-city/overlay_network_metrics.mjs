/**
 * Overlay NYC local intelligence page onto committed network metrics
 * without a production Supabase recount.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const prev = JSON.parse(readFileSync(join(root, "data/home/contractor-network-metrics-v1.json"), "utf8"));
const prevIntel = JSON.parse(readFileSync(join(root, "data/home/contractor-hub-intel-v2.json"), "utf8"));
const { computeContractorNetworkMetrics } = await import(
  pathToFileURL(join(root, "lib/metrics/compute-contractor-network-metrics.ts")).href
);
const { projectIntelV2FromNetworkMetrics } = await import(
  pathToFileURL(join(root, "lib/metrics/project-intel-v2.ts")).href
);

const byKey = Object.fromEntries(prev.metrics.map((m) => [m.key, m]));
const licensesBySource = { ...prev.liveCohort.licensesBySource };
for (const src of byKey.research_graph_license_records.contributingSourceSystems) {
  if (licensesBySource[src] == null) licensesBySource[src] = 1;
}
const input = {
  generatedAt: new Date().toISOString(),
  liveStateCodes: prev.liveCohort.liveStateCodes,
  liveSourceSystems: prev.liveCohort.liveSourceSystems,
  licensesBySource,
  liveActiveCurrentCredentialRecords: byKey.live_active_current_credential_records.value,
  researchGraphLicenseRecords: byKey.research_graph_license_records.value,
  researchGraphContractorIdentities: byKey.research_graph_contractor_identities.value,
  contractorEntityLinks: prev.researchGraphExtras.entityLinks,
  publicContactObservations: byKey.public_contact_observations.value,
  disciplineActionRows: byKey.regulatory_discipline_action_rows.value,
  regulatoryObservations: prev.researchGraphExtras.regulatoryObservations,
  regulatoryOccurrences: prev.researchGraphExtras.regulatoryOccurrences,
  indexedPermitSourceRecords: byKey.indexed_permit_source_records.value,
  evidenceFamilies: prev.evidenceFamilies,
  liveStatus: prev.licensingStatus.liveCohort,
  tradeFamilies: prev.tradeFamilies,
  caProductionCslbRows: prev.californiaReconciliation.productionCslbCredentialRows,
  caAcquiredTruncatedRows: prev.californiaReconciliation.acquiredTruncatedLicenseMasterRows,
  caAcquiredAsOf: byKey.ca_acquired_cslb_license_master_rows_truncated.sourceAsOf,
  njConstructionSourceRecords: byKey.nj_construction_source_records.value,
  njConstructionSourceAsOf: byKey.nj_construction_source_records.sourceAsOf,
  njCurrentMunicipalities: byKey.nj_current_municipalities.value,
  njMunicipalityAsOf: byKey.nj_current_municipalities.sourceAsOf,
  njPublishedCountyPages: prev.newJerseyReconciliation.publishedCountyPages,
  njPublicWorksRegulatoryRows: prev.newJerseyReconciliation.publicWorksRegulatorySourceRows,
  floridaCountyIntelligencePages:
    byKey.published_county_intelligence_pages.value - prev.newJerseyReconciliation.publishedCountyPages,
  caCityLocalPages: byKey.published_ca_city_local_intelligence_pages.value,
  nycLocalPages: 1,
};

const manifest = computeContractorNetworkMetrics(input);
writeFileSync(join(root, "data/home/contractor-network-metrics-v1.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const intelV2 = projectIntelV2FromNetworkMetrics(manifest);
intelV2.licensingStatus.graph = prevIntel.licensingStatus.graph;
writeFileSync(join(root, "data/home/contractor-hub-intel-v2.json"), `${JSON.stringify(intelV2, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      fingerprint: manifest.sourceFingerprint,
      nycPages: manifest.metrics.find((m) => m.key === "published_nyc_local_intelligence_pages")?.value,
      liveCredentials: manifest.liveCohort.licensesBySource,
    },
    null,
    2,
  ),
);
