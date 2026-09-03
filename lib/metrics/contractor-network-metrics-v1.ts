/**
 * contractor-network-metrics-v1
 * Specialist-owned public metric contract. Grains never mix.
 */

export const CONTRACTOR_NETWORK_METRICS_VERSION = "contractor-network-metrics-v1" as const;

export type MetricGrain =
  | "license_credential_record"
  | "license_credential_record_active_current"
  | "live_researched_state"
  | "research_graph_license_record"
  | "research_graph_contractor_identity"
  | "contractor_entity_link"
  | "discipline_action_row"
  | "regulatory_source_observation"
  | "regulatory_source_occurrence"
  | "permit_source_record"
  | "municipal_permit_or_certificate_source_record"
  | "current_municipality"
  | "published_county_intelligence_page"
  | "public_contact_observation"
  | "acquired_partial_license_master_row";

export type PublicationStatus =
  | "PUBLIC"
  | "PUBLIC_RESEARCH_GRAPH"
  | "PUBLIC_PARTIAL"
  | "INTERNAL"
  | "REJECTED";

export type MetricTrace = {
  counts: string;
  doesNotCount: string;
  contributingSourceSystems: string[];
  geographicCoverage: string;
  currentActiveRule?: string;
  sourceDates: string;
  generationDate: string;
};

export type ContractorNetworkMetric = {
  key: string;
  label: string;
  value: number;
  unit: "count";
  grain: MetricGrain;
  denominator: string;
  description: string;
  coverage: string;
  contributingSourceSystems: string[];
  sourceAsOf: string | null;
  generatedAt: string;
  trace: MetricTrace;
  publicationStatus: PublicationStatus;
};

export type EvidenceFamilyMetric = {
  key: string;
  label: string;
  sourceSystem: string;
  sourceDataset: string;
  rows: number;
  grain: "discipline_action_row";
};

export type ContractorNetworkMetricsV1 = {
  schemaVersion: typeof CONTRACTOR_NETWORK_METRICS_VERSION;
  generatedAt: string;
  newestDocumentedSourceAsOf: string | null;
  newestDocumentedSourceAsOfNote: string;
  sourceFingerprint: string;
  liveCohort: {
    liveStates: number;
    liveStateCodes: string[];
    liveSourceSystems: string[];
    licensesBySource: Record<string, number>;
    cohortRule: string;
    activeCurrentRule: string;
  };
  californiaReconciliation: {
    productionCslbCredentialRows: number;
    acquiredTruncatedLicenseMasterRows: number;
    acquiredCoverage: "ACQUIRED_PARTIAL_STREAM_TRUNCATED";
    joinLiveCredentialCohort: false;
    decision: string;
  };
  newJerseyReconciliation: {
    dcaCredentialRows: number;
    constructionSourceRecords: number;
    constructionGrain: "municipal_permit_or_certificate_source_record";
    constructionMarketOnly: true;
    currentMunicipalities: number;
    publishedCountyPages: number;
    publicWorksRegulatorySourceRows: number;
    vendorCandidatesAreNotLicensedContractors: true;
  };
  metrics: ContractorNetworkMetric[];
  evidenceFamilies: EvidenceFamilyMetric[];
  researchGraphExtras: {
    entityLinks: number;
    regulatoryObservations: number;
    regulatoryOccurrences: number;
  };
  licensingStatus: {
    liveCohort: {
      active: number;
      current: number;
      inactive: number;
      expired: number;
      suspended: number;
      revoked: number;
      unlicensed: number;
      other: number;
    };
  };
  tradeFamilies: {
    canonicalNormalizationExisted: boolean;
    note: string;
    families: Array<{
      id: string;
      label: string;
      href: string;
      credentialRows: number;
      activeCurrentRows: number;
      contributingSources: string[];
      occupationCodes: string[];
      origin: string[];
    }>;
  };
};

export function metricByKey(
  manifest: ContractorNetworkMetricsV1,
  key: string
): ContractorNetworkMetric {
  const found = manifest.metrics.find((m) => m.key === key);
  if (!found) throw new Error(`metric missing: ${key}`);
  return found;
}
