import type { OccupationKind } from "./occupations";
import type { ResearchCoverageLevel } from "./coverage";
import type { IntelligenceEducationModule } from "./education";
import type { MetricReadiness } from "./readiness";
import type { MetricPublicEligibility, SourceFamily } from "./types";

export type IntelligenceMetricValue = {
  id: string;
  label: string;
  value: number | null;
  entityCounted: "credential" | "parsed_observation" | "occupation_bucket" | "florida_county";
  definition: string;
  querySource: string;
  readiness: MetricReadiness;
  geographicScope: "florida_statewide" | "florida_county_hq";
  asOf: string | null;
  disclosure: string;
  publicEligibility: MetricPublicEligibility;
};

export type IntelligenceCategorySplit = {
  code: string;
  officialName: string;
  kind: OccupationKind;
  tracked: number;
  active: number;
};

export type IntelligenceCategory = {
  id: string;
  slug: string;
  label: string;
  href: string;
  tracked: number;
  active: number;
  occupationCodes: string[];
  splits: IntelligenceCategorySplit[];
  disclosure: string;
};

export type IntelligenceCounty = {
  code: string;
  slug: string;
  name: string;
  href: string;
  tracked: number;
  active: number;
  /** CCC+RC HQ/base credentials. RR is residential, not roofing. */
  roofing: number;
  /** CGC+RG HQ/base credentials. */
  general: number;
  coverageLevel: ResearchCoverageLevel;
  metricKind: "hq";
};

export type IntelligenceEvidenceSource = {
  id: SourceFamily;
  agency: string;
  label: string;
  whatItContains: string;
  coveragePeriod: string;
  observationCount: number | null;
  attributionStatus: string;
  limitation: string;
  lastExtractedAt: string | null;
  sourceUrl: string | null;
  cadence: string;
};

export type IntelligenceCoverageItem = {
  id: string;
  label: string;
  status: "included" | "expanding";
  note: string;
};

export type FloridaIntelligencePayload = {
  state: "florida";
  version: string;
  generatedAt: string;
  asOf: string | null;
  timedOut: boolean;
  canonicalFingerprint: string;
  metrics: IntelligenceMetricValue[];
  categories: IntelligenceCategory[];
  geography: IntelligenceCounty[];
  evidenceSources: IntelligenceEvidenceSource[];
  coverage: IntelligenceCoverageItem[];
  education: IntelligenceEducationModule[];
};
