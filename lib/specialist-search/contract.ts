/** Portable Trust Hub Specialist Search V1 contract. Domain adapters supply facts. */
export const SPECIALIST_SEARCH_VERSION = "trusthub-specialist-search-v1" as const;

export type SearchCapabilityState =
  | "KNOWN"
  | "UNKNOWN"
  | "PARTIAL"
  | "NOT_ACQUIRED"
  | "REQUEST_ONLY"
  | "UNSUPPORTED";

export type SpecialistSearchRequest = {
  version: typeof SPECIALIST_SEARCH_VERSION;
  rawQuery: string;
  intent: "IDENTITY" | "DISCOVERY" | "EVIDENCE" | "EXPLAIN" | "UNKNOWN";
  entityType: string | null;
  identifiers: Array<{ type: string; value: string }>;
  geography: { state: string | null; county: string | null; city: string | null };
  classifications: string[];
  statusFilters: string[];
  evidenceFilters: string[];
  advancedFilters: Record<string, string | boolean>;
  page: number;
  pageSize: number;
};

export type SpecialistSearchInterpretation = {
  normalizedIntent: SpecialistSearchRequest["intent"];
  parsedEntities: string[];
  parsedIdentifiers: SpecialistSearchRequest["identifiers"];
  parsedGeography: SpecialistSearchRequest["geography"];
  parsedClassifications: string[];
  parsedStatuses: string[];
  parsedEvidence: string[];
  unresolvedTerms: string[];
  supported: boolean;
  limitations: string[];
};

export type SpecialistSearchCapability = {
  key: string;
  label: string;
  supportState: SearchCapabilityState;
  coverage: string;
  sourceSystems: string[];
  limitations: string[];
};

export type SpecialistSearchResult = {
  entityId: string;
  displayName: string;
  canonicalHref: string;
  entityClass: string | null;
  identitySummary: string;
  credentialSummary: string;
  geographySummary: string;
  matchReasons: string[];
  evidenceAvailable: SpecialistSearchCapability[];
  evidenceSummary: string;
  sourceAsOf: string | null;
  trace: {
    sourceSystems: string[];
    identityRule: string;
    geographyRule: string;
    statusRule: string;
    limitations: string[];
  };
};

export const SPECIALIST_SEARCH_ANALYTICS_EVENTS = [
  "specialist_search_submit",
  "specialist_search_interpreted",
  "specialist_search_results",
  "specialist_search_zero_results",
  "specialist_search_refine",
  "specialist_search_trace_open",
  "specialist_search_profile_open",
] as const;
