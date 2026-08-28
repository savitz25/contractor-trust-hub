export const CONTRACTOR_HOME_INTEL_VERSION = "contractor-home-intel-v1" as const;

export type StoryType = "BENCHMARK" | "GAP" | "CHANGE";
export type CoverageStatus =
  | "strong"
  | "partial"
  | "limited"
  | "enhanced_in_selected_geographies"
  | "unavailable"
  | "not_yet_researched"
  | "requested_pending";

export type RegulatoryClass =
  | "statewide_license"
  | "statewide_registration"
  | "specialty_only"
  | "partial_extract";

export type ResearchDepth =
  | "enhanced_intelligence"
  | "statewide_verify"
  | "specialty_verify"
  | "partial_pilot"
  | "not_yet_researched";

export type TraceMetric = {
  id: string;
  label: string;
  display: string;
  value: number;
  grain: string;
  definition: string;
  method: string;
  payloadKey: string;
  officialAsOf: string;
  retrievedAt: string;
  includedStates: string[];
  limitations: string[];
  components: Array<{ label: string; value: string; payloadKey: string }>;
  sourceIds: string[];
};

export type FeaturedStory = {
  storyId: string;
  storyType: StoryType;
  title: string;
  summary: string;
  chart: {
    caption: string;
    series: Array<{ label: string; value: number; note?: string; states?: string[] }>;
    unit: "count";
    max: number;
  };
  whyItMatters: string;
  doesNotMean: string[];
  sourceIds: string[];
  officialAsOf: string;
  retrievedAt: string;
  payloadKeys: string[];
};

export type CoverageRow = {
  family: string;
  display: string;
  status: CoverageStatus;
  method: string;
  limitations: string[];
};

export type GeoState = {
  code: string;
  name: string;
  boardShort: string;
  boardLabel: string;
  boardUrl: string;
  depth: ResearchDepth;
  regulatoryClass: RegulatoryClass;
  statewideGc: boolean;
  scopeHint: string;
  coverageNote: string;
  canVerify: string;
  cannotInfer: string;
  href: string;
  hrefLabel: string;
};

export type AskItem = {
  id: string;
  question: string;
  answer: string;
  href: string;
  hrefLabel: string;
};

export type ToolLink = { id: string; label: string; href: string; note: string };
export type SourceRow = {
  id: string;
  state: string;
  agency: string;
  dataset: string;
  officialAsOf: string;
  retrievedAt: string;
  grain: string;
  coverage: string;
  limitation: string;
  url: string;
};

export type ContractorHomeIntel = {
  contractVersion: typeof CONTRACTOR_HOME_INTEL_VERSION;
  generatedAt: string;
  payloadFingerprint: string;
  score: null;
  ranking: null;
  changeCapability: { status: "UNSUPPORTED"; reason: string };
  stateOfRecord: TraceMetric[];
  findings: FeaturedStory[];
  evidenceDepth: CoverageRow[];
  gaps: string[];
  geography: GeoState[];
  tradeAxis: Array<{ label: string; note: string; href: string }>;
  ask: AskItem[];
  tools: ToolLink[];
  journey: Array<{ step: string; status: "connected" | "partial" | "unavailable" | "where_acquired" }>;
  sources: SourceRow[];
  limitations: string[];
  doesNotInfer: string[];
};
