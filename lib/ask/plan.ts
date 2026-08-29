/**
 * Structured research-query contract.
 * Natural-language interpretation and database execution are separate layers.
 * Free-text never becomes SQL.
 */
import { intelligenceFingerprint } from "@/lib/intelligence/fingerprint";
import type { AskResult } from "./types";
import { ASK_CLEARED, askHref, type AskUrlOverrides } from "./url";
export { askHref, type AskUrlOverrides };
import {
  CLASS_LABELS,
  EVIDENCE_ONTOLOGY,
  GEO_ONTOLOGY,
  TRADE_ONTOLOGY,
  TRADE_TO_DISCOVERY_SLUG,
  type TradeFamilyId,
} from "./ontology";

export const RESEARCH_QUERY_VERSION = "contractor-research-query-v1" as const;
export const ASK_PAGE_SIZE = 24;
export const ASK_MAX_PAGE = 40;

export type ResearchMode =
  | "entity"
  | "count"
  | "aggregate"
  | "comparison"
  | "evidence"
  | "definition"
  | "fail_closed";

export type GeographyEvidenceType = "mailing_address" | "credential_jurisdiction" | "unknown";

export type EvidenceFamilyId =
  | "dbpr_discipline"
  | "unlicensed_activity"
  | "stop_work"
  | "recovery_fund";

export type AskSortField = "name" | "credential" | "expiration" | "evidence_count" | "evidence_newest";

export type CredentialStatusFilter = "active_current" | "expired" | "all";

export type ContractorResearchQuery = {
  version: typeof RESEARCH_QUERY_VERSION;
  planId: string;
  mode: ResearchMode;
  rawQuery: string;
  geography: {
    state: "FL" | null;
    countySlug: string | null;
    countyLabel: string | null;
    evidenceType: GeographyEvidenceType;
    method: string;
  };
  compareCountySlugs: string[];
  trade: {
    familyId: TradeFamilyId | null;
    label: string | null;
    occupationCodes: string[];
    classLabels: string[];
    discoverySlug: string | null;
  };
  credentialStatus: CredentialStatusFilter;
  evidenceFamily: EvidenceFamilyId | null;
  sort: { field: AskSortField; direction: "asc" | "desc" };
  grain: "contractor_profile" | "credential_record" | "evidence_source_row" | "none";
  requestedMetric: "count" | "rate" | "most" | "newest" | null;
  limit: number;
  page: number;
  offset: number;
  executable: boolean;
  failMessage: string | null;
  changeHints: string[];
  notes: string[];
};

const SORT_FIELDS = new Set<AskSortField>([
  "name",
  "credential",
  "expiration",
  "evidence_count",
  "evidence_newest",
]);

const STATUS_FIELDS = new Set<CredentialStatusFilter>(["active_current", "expired", "all"]);

const EVIDENCE_FIELDS = new Set<EvidenceFamilyId>([
  "dbpr_discipline",
  "unlicensed_activity",
  "stop_work",
  "recovery_fund",
]);

const GEOGRAPHY_METHOD =
  "Indexed Florida DBPR mailing/business address county from licenses.county_name, licenses.county_code, and contractors.primary_county. This is not service territory.";

function cleared(v: string | null | undefined): boolean {
  return v === ASK_CLEARED;
}

function present(v: string | null | undefined): v is string {
  return Boolean(v && v !== ASK_CLEARED);
}

export function parseAskOverrides(sp: URLSearchParams | AskUrlOverrides): AskUrlOverrides {
  if (sp instanceof URLSearchParams) {
    return {
      geo: sp.get("geo"),
      trade: sp.get("trade"),
      status: sp.get("status"),
      evidence: sp.get("evidence"),
      sort: sp.get("sort"),
      page: sp.get("page"),
    };
  }
  return sp;
}

function tradeFromId(id: string | null): ContractorResearchQuery["trade"] {
  const fam = TRADE_ONTOLOGY.find((t) => t.id === id);
  if (!fam) {
    return { familyId: null, label: null, occupationCodes: [], classLabels: [], discoverySlug: null };
  }
  return {
    familyId: fam.id,
    label: fam.label,
    occupationCodes: [...fam.exactClasses],
    classLabels: fam.exactClasses.map((c) => CLASS_LABELS[c] || c),
    discoverySlug: TRADE_TO_DISCOVERY_SLUG[fam.id],
  };
}

function countyFromSlug(slug: string | null): { slug: string; label: string } | null {
  if (!slug) return null;
  const geo = GEO_ONTOLOGY.find((g) => g.id === slug && g.kind === "county");
  if (!geo) return null;
  return { slug: geo.id, label: geo.label };
}

function evidenceFromInterpreted(label: string): EvidenceFamilyId | null {
  const row = EVIDENCE_ONTOLOGY.find((e) => e.label === label || e.id === label);
  if (!row) return null;
  if (row.id === "dbpr_discipline") return "dbpr_discipline";
  if (row.id === "unlicensed_activity") return "unlicensed_activity";
  if (row.id === "stop_work") return "stop_work";
  if (row.id === "recovery_fund") return "recovery_fund";
  return null;
}

function tradeIdFromInterpreted(trade: string): TradeFamilyId | null {
  const fam = TRADE_ONTOLOGY.find(
    (t) => trade === t.label || trade.startsWith(`${t.label} (`) || trade.toLowerCase().includes(t.label.toLowerCase())
  );
  return fam?.id ?? null;
}

function countySlugFromInterpreted(location: string): string | null {
  const geo = GEO_ONTOLOGY.find((g) => g.kind === "county" && location.includes(g.label.split(",")[0]));
  return geo?.id ?? null;
}

function stateFromInterpreted(location: string): "FL" | null {
  if (/florida|\bfl\b|broward|palm beach|miami/i.test(location)) return "FL";
  return null;
}

export function buildContractorResearchQuery(
  interpreted: AskResult,
  overrides: AskUrlOverrides = {}
): ContractorResearchQuery {
  const pageRaw = Number(overrides.page || "1");
  const page = Number.isFinite(pageRaw) ? Math.min(ASK_MAX_PAGE, Math.max(1, Math.floor(pageRaw))) : 1;

  let tradeId = tradeIdFromInterpreted(interpreted.interpretation.trade);
  if (cleared(overrides.trade)) tradeId = null;
  else if (present(overrides.trade) && TRADE_TO_DISCOVERY_SLUG[overrides.trade as TradeFamilyId] !== undefined) {
    tradeId = overrides.trade as TradeFamilyId;
  }

  let countySlug = countySlugFromInterpreted(interpreted.interpretation.location);
  let forceFlorida = false;
  if (cleared(overrides.geo)) countySlug = null;
  else if (present(overrides.geo)) {
    if (overrides.geo === "fl") {
      countySlug = null;
      forceFlorida = true;
    } else countySlug = overrides.geo;
  }

  let status: CredentialStatusFilter = /active|current/i.test(interpreted.interpretation.credentialStatus)
    ? "active_current"
    : "all";
  if (cleared(overrides.status)) status = "all";
  else if (present(overrides.status) && STATUS_FIELDS.has(overrides.status as CredentialStatusFilter)) {
    status = overrides.status as CredentialStatusFilter;
  }

  let evidence = evidenceFromInterpreted(interpreted.interpretation.evidenceFamily);
  if (cleared(overrides.evidence)) evidence = null;
  else if (present(overrides.evidence) && EVIDENCE_FIELDS.has(overrides.evidence as EvidenceFamilyId)) {
    evidence = overrides.evidence as EvidenceFamilyId;
  }

  let sortField: AskSortField = "name";
  if (present(overrides.sort) && SORT_FIELDS.has(overrides.sort as AskSortField)) {
    sortField = overrides.sort as AskSortField;
  } else if (/most indexed|highest count|most/i.test(interpreted.interpretation.sort) && evidence) {
    sortField = "evidence_count";
  }

  const county = countyFromSlug(countySlug);
  const state = county || forceFlorida ? "FL" : stateFromInterpreted(interpreted.interpretation.location);
  const trade = tradeFromId(tradeId);
  const compareCountySlugs =
    interpreted.mode === "comparison" ? ["broward", "palm-beach"] : [];

  const mode = interpreted.mode as ResearchMode;
  const executable =
    interpreted.supported &&
    (mode === "entity" ||
      mode === "count" ||
      mode === "comparison" ||
      mode === "evidence" ||
      mode === "aggregate") &&
    state === "FL";

  const grain: ContractorResearchQuery["grain"] =
    mode === "count" && !county && !evidence ? "credential_record" : mode === "evidence" && !trade ? "evidence_source_row" : mode === "entity" || mode === "evidence" ? "contractor_profile" : mode === "count" ? "credential_record" : "none";

  const draft: Omit<ContractorResearchQuery, "planId"> = {
    version: RESEARCH_QUERY_VERSION,
    mode,
    rawQuery: interpreted.query,
    geography: {
      state,
      countySlug: county?.slug ?? null,
      countyLabel: county?.label ?? (state === "FL" ? "Florida (statewide in this extract)" : null),
      evidenceType: county || state === "FL" ? "mailing_address" : "unknown",
      method: county || state === "FL" ? GEOGRAPHY_METHOD : "No geography filter applied.",
    },
    compareCountySlugs,
    trade,
    credentialStatus: status,
    evidenceFamily: evidence,
    sort: {
      field: sortField,
      direction: sortField === "name" || sortField === "credential" ? "asc" : "desc",
    },
    grain,
    requestedMetric: interpreted.interpretation.sort.toLowerCase().includes("rate")
      ? "rate"
      : interpreted.mode === "count"
        ? "count"
        : /most/i.test(interpreted.interpretation.sort)
          ? "most"
          : null,
    limit: ASK_PAGE_SIZE,
    page,
    offset: (page - 1) * ASK_PAGE_SIZE,
    executable: Boolean(executable),
    failMessage: interpreted.failMessage,
    changeHints: interpreted.changeHints,
    notes: [
      ...interpreted.interpretation.notes,
      county
        ? "These results have a recorded county location/address in the indexed licensing record. That does not establish their complete service area."
        : "",
    ].filter(Boolean),
  };

  return { ...draft, planId: intelligenceFingerprint(draft).slice(0, 16) };
}

export function planToOverrides(plan: ContractorResearchQuery): AskUrlOverrides {
  return {
    geo: plan.geography.countySlug ?? (plan.geography.state === "FL" ? "fl" : undefined),
    trade: plan.trade.familyId ?? undefined,
    status: plan.credentialStatus,
    evidence: plan.evidenceFamily ?? undefined,
    sort: plan.sort.field,
    page: String(plan.page),
  };
}

export function chipHref(
  q: string,
  plan: ContractorResearchQuery,
  clear: "geo" | "trade" | "status" | "evidence"
): string {
  const o = planToOverrides(plan);
  o[clear] = ASK_CLEARED;
  o.page = "1";
  return askHref(q, o);
}
