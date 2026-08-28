/**
 * TrustHub Intelligence OS helpers for Contractor Florida + Broward.
 * Pure functions. Living numbers come from snapshots. No ranking.
 */
import type { IntelligenceCategory, IntelligenceCounty, IntelligenceEvidenceSource, IntelligenceMetricValue } from "./payload-types";
import { floridaRoofingAskSentence } from "./occupations";

export const CONTRACTOR_STATE_INTEL_V1 = "contractor-state-intel-v1";
export const CONTRACTOR_COUNTY_INTEL_V1 = "contractor-county-intel-v1";

export type TraceFamily = {
  id: string;
  label: string;
  agency: string;
  dataset: string;
  definition: string;
  count: number | null;
  grain: "parsed_observation";
  limitation: string;
  asOf: string | null;
  retrieved: string | null;
};

export type FeaturedFinding = {
  id: string;
  headline: string;
  storyType: "BENCHMARK" | "CHANGE" | "GAP" | "BENCHMARK+GAP";
  grain: string;
  numerator: number | null;
  denominator: number | null;
  comparison: string;
  source: string;
  asOf: string | null;
  whyUseful: string;
  doesNotMean: string;
  chartFamily: "bar" | "composition" | "none";
  payloadKeys: string[];
};

export type CompareRow = {
  id: string;
  label: string;
  href: string;
  tracked: number | null;
  active: number | null;
  activeShare: number | null;
  roofingShare: number | null;
  generalShare: number | null;
  researchDepth: "statewide" | "enhanced";
};

export type AskItem = {
  id: string;
  question: string;
  answer: string;
  href?: string;
};

export type ChecklistItem = {
  id: string;
  label: string;
  href: string;
};

function metric(metrics: IntelligenceMetricValue[], id: string): number | null {
  const m = metrics.find((x) => x.id === id);
  return m && typeof m.value === "number" ? m.value : null;
}

function share(n: number | null, d: number | null): number | null {
  if (n == null || d == null || d <= 0) return null;
  return n / d;
}

export function buildTraceFamilies(sources: IntelligenceEvidenceSource[]): TraceFamily[] {
  const byId = new Map<string, IntelligenceEvidenceSource>(sources.map((s) => [s.id, s]));
  const spec: Array<Omit<TraceFamily, "count" | "asOf" | "retrieved"> & { sourceId: string }> = [
    {
      sourceId: "fl_dbpr_discipline",
      id: "dbpr_discipline",
      label: "DBPR licensed-contractor discipline records",
      agency: "Florida DBPR / CILB",
      dataset: "contractor_disc_lic",
      definition: "Public licensed-contractor disciplinary rows collected from DBPR extracts.",
      grain: "parsed_observation",
      limitation: "A row is a source record, not a finding that a currently licensed contractor is unsafe.",
    },
    {
      sourceId: "fl_dbpr_unlicensed_activity",
      id: "ula",
      label: "DBPR unlicensed-activity records",
      agency: "Florida DBPR / CILB",
      dataset: "contractor_disc_ula",
      definition: "Unlicensed-activity administrative records. These are not licensed-contractor discipline rows.",
      grain: "parsed_observation",
      limitation: "ULA records are a separate legal/administrative family from licensed discipline.",
    },
    {
      sourceId: "fl_dbpr_recovery_fund",
      id: "recovery_fund",
      label: "Construction Recovery Fund records",
      agency: "Florida DBPR / CILB",
      dataset: "contractor_disc_rf",
      definition: "Recovery Fund claim/record rows from official DBPR extracts.",
      grain: "parsed_observation",
      limitation: "A Recovery Fund row is not a count of current licensed contractors with violations.",
    },
    {
      sourceId: "fl_dfs_stop_work",
      id: "dfs_stop_work",
      label: "DFS workers’ compensation stop-work observations",
      agency: "Florida DFS Division of Workers’ Compensation",
      dataset: "fl_dfs_workers_comp_stop_work",
      definition: "Stop-work / related compliance-enforcement observations collected from DFS public extracts.",
      grain: "parsed_observation",
      limitation: "Stop-work observations are not licensed-contractor discipline and are mostly identity-unresolved.",
    },
  ];
  return spec.map((s) => {
    const src = byId.get(s.sourceId);
    return {
      id: s.id,
      label: s.label,
      agency: s.agency,
      dataset: s.dataset,
      definition: s.definition,
      grain: s.grain,
      limitation: s.limitation,
      count: src?.observationCount ?? null,
      asOf: src?.coveragePeriod ?? src?.lastExtractedAt ?? null,
      retrieved: src?.lastExtractedAt ?? null,
    };
  });
}

export function traceSum(families: TraceFamily[]): number | null {
  if (families.some((f) => f.count == null)) return null;
  return families.reduce((s, f) => s + (f.count || 0), 0);
}

export function buildFloridaFindings(input: {
  metrics: IntelligenceMetricValue[];
  categories: IntelligenceCategory[];
  geography: IntelligenceCounty[];
  sources: IntelligenceEvidenceSource[];
  asOf: string | null;
}): FeaturedFinding[] {
  const total = metric(input.metrics, "dbpr_credentials_tracked");
  const active = metric(input.metrics, "active_credentials");
  const trade = metric(input.metrics, "trade_credentials_tracked");
  const observations = metric(input.metrics, "regulatory_observations_researched");
  const families = buildTraceFamilies(input.sources);
  const topCats = [...input.categories].sort((a, b) => b.tracked - a.tracked).slice(0, 4);
  const topShare = share(
    topCats.reduce((s, c) => s + c.tracked, 0),
    trade
  );
  const roofing = input.categories.find((c) => c.slug === "roofers");
  const general = input.categories.find((c) => c.slug === "general-contractors");
  const topCounty = [...input.geography].sort((a, b) => b.tracked - a.tracked)[0];
  const hq = metric(input.metrics, "credentials_with_florida_hq_county");
  const findings: FeaturedFinding[] = [
    {
      id: "trade_mix",
      headline: "Florida contractor credentials concentrate in a few major trade classes.",
      storyType: "BENCHMARK",
      grain: "DBPR credential rows in consumer trade buckets",
      numerator: topCats.reduce((s, c) => s + c.tracked, 0),
      denominator: trade,
      comparison: `${topCats.map((c) => c.label).join(", ")} vs remaining trade buckets`,
      source: "licenses.occupation_code grouped to intelligence buckets",
      asOf: input.asOf,
      whyUseful: "Helps a consumer see which credential classes dominate the tracked Florida market.",
      doesNotMean:
        "A larger class is not a better trade, more competition is not higher quality, and credentials are not distinct businesses.",
      chartFamily: "bar",
      payloadKeys: ["categories", "metrics.trade_credentials_tracked"],
    },
    {
      id: "active_share",
      headline: "About three in four tracked Florida credentials currently carry Active status.",
      storyType: "BENCHMARK",
      grain: "fl_dbpr licenses; active = status_normalized active",
      numerator: active,
      denominator: total,
      comparison: "active credentials / all fl_dbpr credentials",
      source: "licenses.status_normalized",
      asOf: input.asOf,
      whyUseful: "Separates the current-status credential universe from historical/inactive rows.",
      doesNotMean: "Active does not mean recommended, safe, high quality, or endorsed by TrustHub.",
      chartFamily: "composition",
      payloadKeys: ["metrics.active_credentials", "metrics.dbpr_credentials_tracked"],
    },
    {
      id: "regulatory_composition",
      headline: "Florida contractor research includes four distinct public-record families — not a violations total.",
      storyType: "GAP",
      grain: "parsed_observation rows in discipline_actions",
      numerator: observations,
      denominator: null,
      comparison: families.map((f) => `${f.label}: ${f.count ?? "n/a"}`).join(" · "),
      source: "discipline_actions grouped by source family",
      asOf: input.asOf,
      whyUseful: "Shows that regulatory research is multi-source and must be traced, not flattened.",
      doesNotMean:
        "The observation total is not a count of disciplined contractors, current licensees with violations, or fraud.",
      chartFamily: "composition",
      payloadKeys: ["metrics.regulatory_observations_researched", "evidenceSources"],
    },
    {
      id: "geo_concentration",
      headline: topCounty
        ? `${topCounty.name} County holds the largest share of credential HQ/base addresses among Florida counties.`
        : "Credential HQ/base addresses concentrate in a subset of Florida counties.",
      storyType: "BENCHMARK",
      grain: "fl_dbpr licenses.county_code (HQ/base mailing county)",
      numerator: topCounty?.tracked ?? null,
      denominator: hq,
      comparison: "largest HQ county vs credentials with a Florida HQ county",
      source: "licenses.county_code",
      asOf: input.asOf,
      whyUseful: "Orients a consumer to where tracked credentials are based, before county comparison.",
      doesNotMean:
        "HQ/base county is not service area, popularity, quality, or where the contractor is authorized to work.",
      chartFamily: "bar",
      payloadKeys: ["geography", "metrics.credentials_with_florida_hq_county"],
    },
  ];
  void topShare;
  void roofing;
  void general;
  return findings;
}

export function buildAskItems(input: {
  metrics: IntelligenceMetricValue[];
  categories: IntelligenceCategory[];
}): AskItem[] {
  const roofing = input.categories.find((c) => c.slug === "roofers");
  const activeRoof = roofing?.active ?? null;
  const obs = metric(input.metrics, "regulatory_observations_researched");
  return [
    {
      id: "roofing_active",
      question: "How many roofing credentials are active in Florida?",
      answer:
        floridaRoofingAskSentence(activeRoof),
      href: "/florida/roofers",
    },
    {
      id: "broward_compare",
      question: "How does Broward compare with Florida?",
      answer:
        "Broward is compared using identical definitions: credential HQ/base county, active share on that same universe, and trade-bucket share. Address county is not service area. Open Broward Intelligence for the comparison.",
      href: "/florida/broward",
    },
    {
      id: "active_means",
      question: "What does an active contractor license tell me?",
      answer:
        "Active is DBPR secondary status Active on a credential row. It does not prove workmanship, insurance, current jobs, or that the firm is the right contractor for your project.",
    },
    {
      id: "regulatory_review",
      question: "What regulatory records should I review?",
      answer:
        obs == null
          ? "Florida public-record families include licensed discipline, unlicensed-activity, Recovery Fund, and DFS stop-work observations. Review them as separate source families on an individual contractor."
          : `Trust Hub currently researches ${obs.toLocaleString()} Florida regulatory/public-record observations across four families. Review the contractor profile and official sources — do not treat the statewide total as a violation count.`,
      href: "#trace",
    },
    {
      id: "qualifier",
      question: "What is a qualifier relationship?",
      answer:
        "A qualifying agent is the person the board recognizes as qualifying a business for a license class. Statewide relationship counts are expanding and are not published as a consumer ranking. Confirm the qualifier on the official license record.",
    },
    {
      id: "permits",
      question: "What permit information does TrustHub currently have?",
      answer:
        "Confirmed Miami-Dade County-issued permit records are loaded for that county’s intelligence page. Broward local permit export remains requested/pending. Missing export is not zero Broward activity.",
      href: "/florida/broward#permits",
    },
    {
      id: "license_limits",
      question: "What doesn’t a current license prove?",
      answer:
        "It does not prove quality, workmanship, that the contractor will perform your job, that the address county is the service area, or that no regulatory history exists. No record found is not a clean history.",
    },
  ];
}

export const RESEARCH_CHECKLIST: ChecklistItem[] = [
  { id: "license", label: "Verify license status on the official credential", href: "/verify" },
  { id: "identity", label: "Confirm contractor / business identity (including Sunbiz where linked)", href: "/verify" },
  { id: "regulatory", label: "Review regulatory observations as separate source families", href: "#trace" },
  { id: "permits", label: "Check local permits where coverage exists", href: "/florida/broward#permits" },
  { id: "compare", label: "Compare another contractor", href: "/compare" },
  { id: "save", label: "Save project research in Home Passport", href: "/passport" },
];

export const WHAT_WE_DONT_KNOW = [
  "County permit coverage varies and is not uniformly available statewide.",
  "Municipal coverage differs; county-issued records are not every city’s permit history.",
  "Local licensing differs by jurisdiction and is not the same as a statewide DBPR credential.",
  "A credential or business address county is not a service area.",
  "No record found is not a clean history.",
  "A current license does not prove workmanship or quality.",
  "A corporate match does not prove all current operational facts.",
  "Permit volume does not prove quality.",
  "Statewide regulatory sources and local permit sources have different grains and must not be added together.",
];

export function buildCompareRows(input: {
  floridaTracked: number | null;
  floridaActive: number | null;
  floridaRoofing: number | null;
  floridaGeneral: number | null;
  counties: Array<{
    id: string;
    label: string;
    href: string;
    tracked: number | null;
    active: number | null;
    roofing: number | null;
    general: number | null;
    researchDepth: "statewide" | "enhanced";
  }>;
}): CompareRow[] {
  const florida: CompareRow = {
    id: "florida",
    label: "Florida (statewide credentials)",
    href: "/florida",
    tracked: input.floridaTracked,
    active: input.floridaActive,
    activeShare: share(input.floridaActive, input.floridaTracked),
    roofingShare: share(input.floridaRoofing, input.floridaTracked),
    generalShare: share(input.floridaGeneral, input.floridaTracked),
    researchDepth: "statewide",
  };
  const rows = input.counties.map((c) => ({
    id: c.id,
    label: c.label,
    href: c.href,
    tracked: c.tracked,
    active: c.active,
    activeShare: share(c.active, c.tracked),
    roofingShare: share(c.roofing, c.tracked),
    generalShare: share(c.general, c.tracked),
    researchDepth: c.researchDepth,
  }));
  return [florida, ...rows];
}

export function standsOutStatements(rows: CompareRow[]): string[] {
  const fl = rows.find((r) => r.id === "florida");
  const statements: string[] = [];
  for (const row of rows) {
    if (row.id === "florida" || !fl) continue;
    if (row.roofingShare != null && fl.roofingShare != null) {
      if (row.roofingShare > fl.roofingShare) {
        statements.push(
          `${row.label} has a larger roofing-credential share than the statewide credential mix.`
        );
      } else if (row.roofingShare < fl.roofingShare) {
        statements.push(
          `${row.label} has a smaller roofing-credential share than the statewide credential mix.`
        );
      }
    }
    if (row.activeShare != null && fl.activeShare != null) {
      if (row.activeShare > fl.activeShare) {
        statements.push(`${row.label} has a higher active-credential share than Florida overall.`);
      } else if (row.activeShare < fl.activeShare) {
        statements.push(`${row.label} has a lower active-credential share than Florida overall.`);
      }
    }
  }
  return statements.slice(0, 6);
}
