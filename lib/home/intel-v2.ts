/**
 * contractor-hub-intel-v2 — homepage intelligence contract.
 * Public/live coverage is never mixed with the broader research graph.
 */
export const CONTRACTOR_HUB_INTEL_VERSION = "contractor-hub-intel-v2" as const;

export type EvidenceFamily = {
  key: string;
  label: string;
  sourceSystem: string;
  sourceDataset: string;
  rows: number;
};

export type StatusBreakdown = {
  active: number;
  current: number;
  inactive: number;
  expired: number;
  suspended: number;
  revoked: number;
  unlicensed: number;
  other: number;
};

export type TradeFamilySnapshot = {
  id: string;
  label: string;
  href: string;
  credentialRows: number;
  activeCurrentRows: number;
  contributingSources: string[];
  occupationCodes: string[];
  origin: string[];
};

export type ContractorHubIntelV2 = {
  schemaVersion: typeof CONTRACTOR_HUB_INTEL_VERSION;
  generatedAt: string;
  sourceFingerprint: string;
  publicCoverage: {
    liveStates: number;
    liveStateCodes: string[];
    liveSourceSystems: string[];
    credentialRecords: number;
    activeCurrentCredentialRecords: number;
    cohortRule: string;
    activeCurrentRule: string;
  };
  researchGraph: {
    contractorIdentityRows: number;
    licenseRows: number;
    /** COUNT(DISTINCT licenses.source_system) with populated rows. Not the live public cohort. */
    populatedLicenseSourceSystems: number;
    populatedLicenseSourceSystemKeys: string[];
    /** @deprecated use populatedLicenseSourceSystems */
    licenseSourceSystems: number;
    licenseSourceSystemKeys: string[];
    entityLinks: number;
    publicContactObservations: number;
    note: string;
  };
  regulatoryEvidence: {
    totalActionRows: number;
    canonicalObservations: number;
    occurrences: number;
    byEvidenceFamily: EvidenceFamily[];
    grainNote: string;
  };
  licensingStatus: {
    denominator: "research_graph_licenses" | "public_live_licenses";
    graph: StatusBreakdown;
    liveCohort: StatusBreakdown;
  };
  permits: {
    sourceRecords: number;
    grain: string;
  };
  tradeFamilies: {
    canonicalNormalizationExisted: boolean;
    note: string;
    families: TradeFamilySnapshot[];
  };
};

export function formatIntelCount(n: number): string {
  return Math.round(Number(n)).toLocaleString("en-US");
}
