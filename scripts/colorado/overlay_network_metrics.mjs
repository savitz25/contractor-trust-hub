/**
 * Overlay CO-CON-001 EC/PC credential counts onto committed network metrics
 * without a production Supabase recount. Does not add the 1.6M DORA master.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const snap = JSON.parse(readFileSync(join(root, "lib/colorado-intelligence/accepted-snapshot.json"), "utf8"));
const prev = JSON.parse(readFileSync(join(root, "data/home/contractor-network-metrics-v1.json"), "utf8"));
const { computeContractorNetworkMetrics } = await import(
  pathToFileURL(join(root, "lib/metrics/compute-contractor-network-metrics.ts")).href
);
const { projectIntelV2FromNetworkMetrics } = await import(
  pathToFileURL(join(root, "lib/metrics/project-intel-v2.ts")).href
);

const byKey = Object.fromEntries(prev.metrics.map((m) => [m.key, m]));
const ecAll = snap.business_credentials.EC.all_rows;
const pcAll = snap.business_credentials.PC.all_rows;
const ecActive = snap.business_credentials.EC.active_exact;
const pcActive = snap.business_credentials.PC.active_exact;
const coLive = ecAll + pcAll;
const coActive = ecActive + pcActive;

const licensesBySource = {
  ...prev.liveCohort.licensesBySource,
  co_dora: coLive,
};
const priorGraphKeys = [
  "ct_dcp",
  "id_dopl",
  "mn_dli",
  "nv_nscb",
  "ok_cib",
  "tn_blc",
  "va_dpor",
];
for (const src of priorGraphKeys) {
  if (licensesBySource[src] == null) licensesBySource[src] = 1;
}

const evidenceFamilies = [
  ...prev.evidenceFamilies,
  {
    key: "co_dora_discipline",
    label: "Colorado DORA contractor-relevant discipline observations",
    sourceSystem: "co_dora",
    sourceDataset: "7s5z-vewr",
    rows: snap.discipline.contractor_relevant_rows,
    grain: "discipline_action_row",
  },
];

const input = {
  generatedAt: new Date().toISOString(),
  liveStateCodes: [...prev.liveCohort.liveStateCodes, "CO"],
  liveSourceSystems: [...prev.liveCohort.liveSourceSystems, "co_dora"].sort(),
  licensesBySource,
  liveActiveCurrentCredentialRecords: byKey.live_active_current_credential_records.value + coActive,
  researchGraphLicenseRecords: byKey.research_graph_license_records.value + coLive,
  researchGraphContractorIdentities: byKey.research_graph_contractor_identities.value,
  contractorEntityLinks: prev.researchGraphExtras.entityLinks,
  publicContactObservations: byKey.public_contact_observations.value,
  disciplineActionRows: byKey.regulatory_discipline_action_rows.value + snap.discipline.contractor_relevant_rows,
  regulatoryObservations: prev.researchGraphExtras.regulatoryObservations,
  regulatoryOccurrences: prev.researchGraphExtras.regulatoryOccurrences,
  indexedPermitSourceRecords: byKey.indexed_permit_source_records.value,
  evidenceFamilies,
  liveStatus: {
    ...prev.licensingStatus.liveCohort,
    active: prev.licensingStatus.liveCohort.active + coActive,
  },
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
  floridaCountyIntelligencePages: byKey.published_county_intelligence_pages.value - prev.newJerseyReconciliation.publishedCountyPages,
  caCityLocalPages: byKey.published_ca_city_local_intelligence_pages.value,
};

const next = computeContractorNetworkMetrics(input);
writeFileSync(join(root, "data/home/contractor-network-metrics-v1.json"), `${JSON.stringify(next, null, 2)}\n`);
writeFileSync(join(root, "data/home/contractor-hub-intel-v2.json"), `${JSON.stringify(projectIntelV2FromNetworkMetrics(next), null, 2)}\n`);
console.log("overlay", {
  fingerprint: next.sourceFingerprint,
  liveStates: next.liveCohort.liveStates,
  co_dora: coLive,
  live_credentials: next.metrics.find((m) => m.key === "live_credential_records").value,
});
