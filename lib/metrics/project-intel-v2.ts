import type { ContractorHubIntelV2, EvidenceFamily } from "../home/intel-v2";
import { CONTRACTOR_HUB_INTEL_VERSION } from "../home/intel-v2";
import { metricByKey, type ContractorNetworkMetricsV1 } from "./contractor-network-metrics-v1";

export function projectIntelV2FromNetworkMetrics(m: ContractorNetworkMetricsV1): ContractorHubIntelV2 {
  const live = metricByKey(m, "live_credential_records");
  const active = metricByKey(m, "live_active_current_credential_records");
  const graphLicenses = metricByKey(m, "research_graph_license_records");
  const identities = metricByKey(m, "research_graph_contractor_identities");
  const contacts = metricByKey(m, "public_contact_observations");
  const actions = metricByKey(m, "regulatory_discipline_action_rows");
  const permits = metricByKey(m, "indexed_permit_source_records");
  const families: EvidenceFamily[] = m.evidenceFamilies.map((f) => ({
    key: f.key,
    label: f.label,
    sourceSystem: f.sourceSystem,
    sourceDataset: f.sourceDataset,
    rows: f.rows,
  }));
  const graphKeys = graphLicenses.contributingSourceSystems;
  return {
    schemaVersion: CONTRACTOR_HUB_INTEL_VERSION,
    generatedAt: m.generatedAt,
    sourceFingerprint: m.sourceFingerprint,
    publicCoverage: {
      liveStates: m.liveCohort.liveStates,
      liveStateCodes: m.liveCohort.liveStateCodes,
      liveSourceSystems: m.liveCohort.liveSourceSystems,
      credentialRecords: live.value,
      activeCurrentCredentialRecords: active.value,
      cohortRule: m.liveCohort.cohortRule,
      activeCurrentRule: m.liveCohort.activeCurrentRule,
    },
    researchGraph: {
      contractorIdentityRows: identities.value,
      licenseRows: graphLicenses.value,
      populatedLicenseSourceSystems: graphKeys.length,
      populatedLicenseSourceSystemKeys: graphKeys,
      licenseSourceSystems: graphKeys.length,
      licenseSourceSystemKeys: graphKeys,
      entityLinks: m.researchGraphExtras.entityLinks,
      publicContactObservations: contacts.value,
      note: "Research-graph totals are not currently public live coverage and are not a U.S. contractor census.",
    },
    regulatoryEvidence: {
      totalActionRows: actions.value,
      canonicalObservations: m.researchGraphExtras.regulatoryObservations,
      occurrences: m.researchGraphExtras.regulatoryOccurrences,
      byEvidenceFamily: families,
      grainNote:
        "totalActionRows is discipline_actions. Observations and occurrences are different grains and are not added to the action total.",
    },
    licensingStatus: {
      denominator: "research_graph_licenses",
      graph: m.licensingStatus.liveCohort,
      liveCohort: m.licensingStatus.liveCohort,
    },
    permits: {
      sourceRecords: permits.value,
      grain: "permit_source_records indexed — not jobs completed and not nationwide contractor volume",
    },
    tradeFamilies: m.tradeFamilies,
  };
}
