import { createHash } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { FLORIDA_COUNTIES } from "@/lib/discovery/counties";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { absoluteUrl } from "@/lib/site";
import {
  CONTRACTOR_STATE_CAPABILITIES,
  getExecutionCapability,
  getTradeCapability,
  publicCapabilityMatrix,
  type ContractorResearchFamily,
  type StateExecutionCapability,
  type TradeCapability,
} from "./state-capabilities";
import {
  isSummitCountyRequest,
  NJ_COUNTIES,
  publicNjMunicipalityMappings,
  resolveNjCounty,
  resolveNjMunicipality,
} from "./nj-geography";

export const SPECIALIST_EXECUTION_VERSION = "trusthub-specialist-execution-v2" as const;
export const CONTRACT_VERSION = "2.1.0" as const;
export const CONTRACTOR_RESULT_LIMIT = 24;
const MAX_LIMIT = 50;
// Page size, not page number, is the response-volume boundary. Statewide
// credential cohorts legitimately exceed 100 pages at the safe 50-row cap.
const MAX_PAGE = 100_000;

export type ContractorResultState =
  | "SUPPORTED_RESULTS" | "ZERO_MATCHING_ROWS" | "CLARIFICATION_REQUIRED"
  | "INVALID_GEOGRAPHY" | "UNSUPPORTED_STATE_CAPABILITY" | "UNSUPPORTED_TRADE_CAPABILITY"
  | "PUBLICATION_RESTRICTED" | "INVALID_QUERY" | "BACKEND_UNAVAILABLE" | "TIMEOUT"
  | "EXACT_IDENTITY";
export type GeographyIntent = "RECORDED_CREDENTIAL_GEOGRAPHY" | "SERVICE_TERRITORY";

export type ContractorExecutionRequest = {
  contract?: typeof SPECIALIST_EXECUTION_VERSION;
  queryType?: "cohort" | "identifier" | "identity" | "capability";
  trade?: ContractorResearchFamily | string;
  credentialClass?: string;
  state?: string;
  geography?: { stateCode?: string; county?: string; city?: string; zip?: string; intent?: GeographyIntent };
  county?: string;
  city?: string;
  zip?: string;
  geographyIntent?: GeographyIntent;
  confirmStatewide?: boolean;
  credentialStatus?: "active_current" | "expired" | "all";
  identifier?: string;
  page?: number;
  limit?: number;
};

type NormalizedGeography = {
  state: "FL" | "NJ";
  county: { slug: string; label: string; code: string | null } | null;
  city: string | null;
  zip: string | null;
  intent: GeographyIntent;
  meaning: string;
  authoritativeSource: string | null;
  requiresStatewideConfirmation: boolean;
  fallbackApplied: boolean;
};

export type NormalizedContractorExecutionRequest = {
  state: "FL" | "NJ" | string;
  capability: StateExecutionCapability | null;
  tradeRaw: string | null;
  /** Backwards-compatible normalized family id used by ATH-CAP-PILOT-001. */
  trade: string | null;
  tradeCapability: TradeCapability | null;
  credentialClass: string | null;
  geography: NormalizedGeography | null;
  /** Backwards-compatible aliases. */
  county: NormalizedGeography["county"];
  city: string | null;
  credentialStatus: "active_current" | "expired" | "all";
  identifier: string | null;
  queryType: "cohort" | "identifier" | "identity" | "capability";
  confirmStatewide: boolean;
  page: number;
  limit: number;
};

export type ContractorExecutionRow = {
  name: string;
  credentialNumber: string;
  credentialKey: string | null;
  trade: string;
  occupationCode: string;
  credentialClass: string | null;
  status: string | null;
  sourceNativeStatus: string | null;
  recordedGeography: { city: string | null; county: string | null; state: string | null };
  source: { system: string; label: string; observedAt: string | null };
  publicationState: "PUBLIC_PROFILE";
  whyShown: string;
  regulatoryHistory: { available: boolean; meaning: string };
  destination: string;
  destinations: Array<{ type: "PUBLIC_PROFILE" | "CONTRACTORTRUSTHUB_VERIFY" | "OFFICIAL_BOARD_VERIFICATION"; url: string }>;
};

export type ContractorExecutionResponse = ReturnType<typeof baseEnvelope> & {
  resultState: "SUPPORTED_RESULTS" | "ZERO_MATCHING_ROWS" | "EXACT_IDENTITY";
  status: "supported";
  queryInterpretation: {
    state: string; trade: string | null; occupationCodes: string[]; identifier: string | null;
    geography: NormalizedGeography; credentialStatus: string; ordering: string;
  };
  resultType: "credential_rows" | "exact_credential";
  rows: ContractorExecutionRow[];
  total: number;
  pagination: { page: number; limit: number; totalPages: number; hasNextPage: boolean };
  availableRefinements: Array<{ field: string; values: string[] }>;
  provenance: { source: string; sourceSystem: string; sourceClockField: "licenses.updated_at"; queryGrain: string; publicationSemantics: string };
  limitations: string[];
};

export type ContractorCapabilityResponse = ReturnType<typeof baseEnvelope> & {
  resultState: "CLARIFICATION_REQUIRED" | "INVALID_GEOGRAPHY" | "UNSUPPORTED_STATE_CAPABILITY" | "UNSUPPORTED_TRADE_CAPABILITY" | "PUBLICATION_RESTRICTED";
  status: "clarification_required" | "unsupported_capability" | "invalid_geography" | "publication_restricted";
  errorCode: string;
  queryInterpretation: Record<string, unknown>;
  capabilityChoices: Array<{ id: string; label: string; supported: boolean; request?: ContractorExecutionRequest; destination?: string; limitation?: string }>;
  provenance: Record<string, unknown>;
  limitations: string[];
};

const SCHEMA_DESCRIPTOR = {
  request: ["contract", "queryType", "state", "trade", "credentialClass", "geography", "credentialStatus", "identifier", "confirmStatewide", "page", "limit"],
  response: ["contract", "contractVersion", "schemaFingerprint", "contractFingerprint", "hub", "resultState", "queryInterpretation", "rows", "total", "pagination", "availableRefinements", "provenance", "limitations"],
  resultStates: ["SUPPORTED_RESULTS", "ZERO_MATCHING_ROWS", "CLARIFICATION_REQUIRED", "INVALID_GEOGRAPHY", "UNSUPPORTED_STATE_CAPABILITY", "UNSUPPORTED_TRADE_CAPABILITY", "PUBLICATION_RESTRICTED", "INVALID_QUERY", "BACKEND_UNAVAILABLE", "TIMEOUT", "EXACT_IDENTITY"],
};
const CONTRACT_DESCRIPTOR = {
  family: SPECIALIST_EXECUTION_VERSION, version: CONTRACT_VERSION, states: ["FL", "NJ"],
  publicationGate: "existing_non_thin_profile_with_slug",
  ordering: "normalized_name_then_credential_then_source_record",
  geography: "recorded_credential_address_never_service_territory",
};
function fingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export const CONTRACTOR_SCHEMA_FINGERPRINT = fingerprint(SCHEMA_DESCRIPTOR);
export const CONTRACTOR_CONTRACT_FINGERPRINT = fingerprint(CONTRACT_DESCRIPTOR);
function baseEnvelope() {
  return { contract: SPECIALIST_EXECUTION_VERSION, contractVersion: CONTRACT_VERSION, schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT, contractFingerprint: CONTRACTOR_CONTRACT_FINGERPRINT, hub: "contractor" as const };
}
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean && clean.length <= max ? clean : null;
}
function normalizeState(value: unknown): string {
  if (value === undefined || value === null || value === "") return "FL";
  const state = cleanText(value, 20);
  if (!state) throw new Error("invalid_state");
  const upper = state.toUpperCase();
  if (upper === "FLORIDA") return "FL";
  if (upper === "NEW JERSEY") return "NJ";
  if (!/^[A-Z]{2}$/.test(upper)) throw new Error("invalid_state");
  return upper;
}

function normalizeFloridaGeography(city: string | null, countyRaw: string | null, intent: GeographyIntent): NormalizedGeography {
  const cityCounty = city?.toLowerCase() === "boca raton" ? { slug: "palm-beach", label: "Palm Beach" } : null;
  const county = countyRaw
    ? FLORIDA_COUNTIES.find((row) => row.slug === countyRaw.toLowerCase() || row.name.toLowerCase() === countyRaw.toLowerCase().replace(/ county$/, ""))
    : cityCounty ? FLORIDA_COUNTIES.find((row) => row.slug === cityCounty.slug) : null;
  if (countyRaw && !county) throw new Error("invalid_geography:unsupported_florida_county");
  if (city && !cityCounty && !countyRaw) throw new Error("clarification_required:city_requires_supported_county_mapping");
  if (cityCounty && county && cityCounty.slug !== county.slug) throw new Error("invalid_geography:city_county_mismatch");
  return {
    state: "FL", county: county ? { slug: county.slug, label: county.name, code: county.matchCodes?.[0] ?? null } : null,
    city, zip: null, intent,
    meaning: county ? `${city ? `${city} is deterministically mapped to ` : ""}${county.name} County recorded credential/address geography; not service territory or current availability.` : "Florida credential jurisdiction and recorded address geography; not service territory.",
    authoritativeSource: cityCounty ? "ContractorTrustHub accepted Florida city/county mapping" : null,
    requiresStatewideConfirmation: false, fallbackApplied: false,
  };
}

function normalizeNewJerseyGeography(city: string | null, countyRaw: string | null, zip: string | null, intent: GeographyIntent, confirmStatewide: boolean): NormalizedGeography {
  if (countyRaw && isSummitCountyRequest(countyRaw)) throw new Error("invalid_geography:summit_is_city_in_union_county");
  const county = countyRaw ? resolveNjCounty(countyRaw) : null;
  if (countyRaw && !county) throw new Error("invalid_geography:county_not_in_new_jersey");
  const municipality = city ? resolveNjMunicipality(city) : null;
  if (municipality && county && municipality.county !== county) throw new Error("invalid_geography:city_county_mismatch");
  const unsupportedLocalGrain = Boolean((city && !municipality) || zip);
  if (unsupportedLocalGrain && !confirmStatewide) {
    return { state: "NJ", county: county ? { slug: county.toLowerCase().replace(/\s+/g, "-"), label: county, code: null } : null, city, zip, intent,
      meaning: "The requested local geography is not yet authoritative for cohort filtering. Statewide New Jersey credential research is available only after explicit confirmation.",
      authoritativeSource: null, requiresStatewideConfirmation: true, fallbackApplied: false };
  }
  const resolvedCounty = municipality?.county ?? county;
  return {
    state: "NJ",
    county: resolvedCounty ? { slug: resolvedCounty.toLowerCase().replace(/\s+/g, "-"), label: resolvedCounty, code: null } : null,
    city: municipality ? municipality.city : confirmStatewide ? null : city, zip: confirmStatewide ? null : zip, intent,
    meaning: confirmStatewide && unsupportedLocalGrain
      ? "Explicitly confirmed statewide New Jersey credential research; the unsupported local filter was not silently applied. Recorded credential geography is not service territory."
      : municipality ? `${municipality.city}, New Jersey is authoritatively mapped to ${municipality.county} County recorded credential/address geography; not service territory.`
        : resolvedCounty ? `${resolvedCounty} County, New Jersey recorded credential/address geography; not service territory.`
          : "Statewide New Jersey DCA credential jurisdiction; credential-holder address may be outside New Jersey and does not prove service territory.",
    authoritativeSource: municipality?.source ?? null, requiresStatewideConfirmation: false,
    fallbackApplied: confirmStatewide && unsupportedLocalGrain,
  };
}

export function normalizeContractorExecutionRequest(value: unknown): NormalizedContractorExecutionRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_request");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["contract", "queryType", "trade", "credentialClass", "state", "geography", "county", "city", "zip", "geographyIntent", "confirmStatewide", "credentialStatus", "identifier", "page", "limit"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error("unsupported_field");
  if (input.contract !== undefined && input.contract !== SPECIALIST_EXECUTION_VERSION) throw new Error("invalid_contract");
  const geoRaw = input.geography;
  if (geoRaw !== undefined && (!geoRaw || typeof geoRaw !== "object" || Array.isArray(geoRaw))) throw new Error("invalid_geography");
  const geo = (geoRaw ?? {}) as Record<string, unknown>;
  if (Object.keys(geo).some((key) => !new Set(["stateCode", "county", "city", "zip", "intent"]).has(key))) throw new Error("unsupported_geography_field");
  const state = normalizeState(input.state ?? geo.stateCode);
  if (geo.stateCode && normalizeState(geo.stateCode) !== state) throw new Error("invalid_geography:state_conflict");
  const capability = getExecutionCapability(state);
  if (!capability || (state !== "FL" && state !== "NJ")) throw new Error("unsupported_state");
  const queryTypeRaw = input.queryType ?? (input.identifier ? "identifier" : "cohort");
  if (!new Set(["cohort", "identifier", "identity", "capability"]).has(String(queryTypeRaw))) throw new Error("invalid_query_type");
  const status = input.credentialStatus ?? "active_current";
  if (!new Set(["active_current", "expired", "all"]).has(String(status))) throw new Error("unsupported_status");
  const city = cleanText(geo.city ?? input.city, 80);
  const county = cleanText(geo.county ?? input.county, 80);
  const zip = cleanText(geo.zip ?? input.zip, 20);
  const intent = (geo.intent ?? input.geographyIntent ?? "RECORDED_CREDENTIAL_GEOGRAPHY") as GeographyIntent;
  if (!new Set(["RECORDED_CREDENTIAL_GEOGRAPHY", "SERVICE_TERRITORY"]).has(intent)) throw new Error("invalid_geography_intent");
  const confirmStatewide = input.confirmStatewide === true;
  const geography = state === "FL" ? normalizeFloridaGeography(city, county, intent) : state === "NJ" ? normalizeNewJerseyGeography(city, county, zip, intent, confirmStatewide) : null;
  const tradeRaw = cleanText(input.trade, 64)?.toLowerCase() ?? null;
  const tradeCapability = getTradeCapability(state, tradeRaw);
  const credentialClass = cleanText(input.credentialClass, 32)?.toUpperCase() ?? null;
  const identifier = cleanText(input.identifier, 80);
  const page = Number(input.page ?? 1);
  const limit = Number(input.limit ?? CONTRACTOR_RESULT_LIMIT);
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) throw new Error("invalid_page");
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error("invalid_limit");
  return { state, capability, tradeRaw, trade: tradeCapability?.id ?? tradeRaw, tradeCapability, credentialClass, geography, county: geography?.county ?? null, city: geography?.city ?? null,
    credentialStatus: status as NormalizedContractorExecutionRequest["credentialStatus"], identifier,
    queryType: queryTypeRaw as NormalizedContractorExecutionRequest["queryType"], confirmStatewide, page, limit };
}

function stateChoices() {
  return Object.values(CONTRACTOR_STATE_CAPABILITIES).map((capability) => ({ id: capability.state.code, label: `${capability.state.name} credential research`, supported: true,
    request: { state: capability.state.code, queryType: "capability" as const }, destination: absoluteUrl(capability.verifyDestination), limitation: capability.state.coverageNote }));
}
function njTradeChoices() {
  return CONTRACTOR_STATE_CAPABILITIES.NJ.trades.map((trade) => ({ id: trade.id, label: trade.label, supported: true,
    request: { state: "NJ", trade: trade.id, queryType: "cohort" as const },
    destination: absoluteUrl("/verify?state=nj"), limitation: trade.limitation }));
}
function capabilityResponse(input: NormalizedContractorExecutionRequest, resultState: ContractorCapabilityResponse["resultState"], status: ContractorCapabilityResponse["status"], errorCode: string, limitations: string[], choices: ContractorCapabilityResponse["capabilityChoices"] = []): ContractorCapabilityResponse {
  return { ...baseEnvelope(), resultState, status, errorCode,
    queryInterpretation: { state: input.state, trade: input.tradeRaw, credentialClass: input.credentialClass, identifier: input.identifier, geography: input.geography, credentialStatus: input.credentialStatus },
    capabilityChoices: choices,
    provenance: input.capability ? { sourceSystems: input.capability.sourceSystems, board: input.capability.state.boardLabel, publicationSemantics: "Existing public non-thin profile gate only; no publication expansion." } : { capabilityState: "state_not_implemented", supportedStates: ["FL", "NJ"] },
    limitations };
}

function semanticCapabilityResult(input: NormalizedContractorExecutionRequest): ContractorCapabilityResponse | null {
  if (!input.capability || (input.state !== "FL" && input.state !== "NJ")) {
    return capabilityResponse(input, "UNSUPPORTED_STATE_CAPABILITY", "unsupported_capability", "unsupported_state_capability", [`${input.state} is not an implemented specialist-execution state in this release. No other state source is substituted.`], stateChoices());
  }
  if (!input.geography) throw new Error("invalid_geography");
  if (input.geography.intent === "SERVICE_TERRITORY") {
    return capabilityResponse(input, "UNSUPPORTED_TRADE_CAPABILITY", "unsupported_capability", "unsupported_service_territory", ["ContractorTrustHub can research credentials and recorded regulatory geography, but those records do not prove service territory or current availability."], [
      { id: "statewide", label: `Research statewide ${input.capability.state.name} credentials`, supported: true, request: { state: input.state, trade: input.tradeCapability?.id, confirmStatewide: true } },
      { id: "verify", label: "Verify an exact business or credential", supported: true, destination: absoluteUrl(input.capability.verifyDestination) },
    ]);
  }
  if (input.geography.requiresStatewideConfirmation) {
    return capabilityResponse(input, "CLARIFICATION_REQUIRED", "clarification_required", "statewide_fallback_confirmation_required", ["The requested local geography cannot be applied at an authoritative grain. Confirm statewide research instead; no silent broadening occurred."], [
      { id: "statewide", label: `Show statewide ${input.capability.state.name} credential records`, supported: true, request: { state: input.state, trade: input.tradeCapability?.id ?? input.tradeRaw ?? undefined, confirmStatewide: true } },
    ]);
  }
  if (input.state === "NJ" && (!input.tradeRaw || input.tradeRaw === "contractor" || input.tradeRaw === "contractors") && !input.identifier && !input.credentialClass) {
    return capabilityResponse(input, "CLARIFICATION_REQUIRED", "clarification_required", "new_jersey_credential_class_required", ["New Jersey has HIC registration and separate specialty credentials, not one statewide General contractor population."], njTradeChoices());
  }
  if (input.state === "NJ" && input.tradeRaw === "general") {
    return capabilityResponse(input, "UNSUPPORTED_TRADE_CAPABILITY", "unsupported_capability", "no_new_jersey_statewide_general_contractor_class", ["The accepted New Jersey source architecture has no single statewide General contractor license class. HIC is not relabeled General."], njTradeChoices());
  }
  if (input.tradeRaw && !input.tradeCapability) {
    return capabilityResponse(input, "UNSUPPORTED_TRADE_CAPABILITY", "unsupported_capability", "unsupported_trade_capability", [`The requested trade is not mapped to a verified source-native class for ${input.capability.state.name}.`], input.state === "NJ" ? njTradeChoices() : []);
  }
  if (input.credentialClass) {
    const sourceClass = input.capability.trades.find((trade) => trade.occupationCodes.includes(input.credentialClass!));
    if (!sourceClass) return capabilityResponse(input, "UNSUPPORTED_TRADE_CAPABILITY", "unsupported_capability", "unsupported_credential_class", [`${input.credentialClass} is not an accepted source-native class for ${input.capability.state.name}.`], input.state === "NJ" ? njTradeChoices() : []);
  }
  if (!input.tradeCapability && !input.identifier && !input.credentialClass) {
    return capabilityResponse(input, "CLARIFICATION_REQUIRED", "clarification_required", "trade_or_identifier_required", ["Choose a source-backed credential class or provide an exact credential identifier."], input.state === "NJ" ? njTradeChoices() : []);
  }
  return null;
}

function buildWhere(input: NormalizedContractorExecutionRequest) {
  if (!input.capability || !input.geography) throw new Error("unsupported_state_capability");
  const params: unknown[] = [input.capability.sourceSystems];
  const terms = ["l.source_system = ANY($1::text[])", "c.is_thin_profile = FALSE", "c.slug IS NOT NULL AND c.slug <> ''"];
  if (input.state === "FL") { params.push("FL"); terms.push(`(c.home_state = $${params.length} OR l.state = $${params.length})`); }
  const occupationCodes = input.credentialClass ? [input.credentialClass] : input.tradeCapability?.occupationCodes ?? [];
  if (occupationCodes.length) { params.push(occupationCodes); terms.push(`UPPER(TRIM(l.occupation_code)) = ANY($${params.length}::text[])`); }
  if (input.credentialStatus === "active_current") terms.push("l.status_normalized IN ('active', 'current')");
  if (input.credentialStatus === "expired") terms.push("l.status_normalized IN ('expired', 'inactive')");
  if (input.geography.county) {
    if (input.state === "NJ") { params.push(input.geography.county.label.toLowerCase()); terms.push(`LOWER(REGEXP_REPLACE(TRIM(COALESCE(l.county_name, '')), '\\s+county$', '', 'i')) = $${params.length}`); terms.push("l.state = 'NJ'"); }
    else { params.push(input.geography.county.code ?? input.geography.county.label); terms.push(input.geography.county.code ? `l.county_code = $${params.length}` : `l.county_name ILIKE $${params.length}`); }
  }
  if (input.geography.city) { params.push(input.geography.city.toLowerCase()); terms.push(`LOWER(TRIM(COALESCE(l.city, ''))) = $${params.length}`); }
  if (input.identifier) { params.push(input.identifier.toUpperCase().replace(/[\s-]+/g, "")); terms.push(`(UPPER(REGEXP_REPLACE(COALESCE(l.external_key, ''), '[\\s-]+', '', 'g')) = $${params.length} OR UPPER(REGEXP_REPLACE(COALESCE(l.license_number, ''), '[\\s-]+', '', 'g')) = $${params.length})`); }
  return { sql: terms.join(" AND "), params, occupationCodes };
}

export async function executeContractorSpecialistQuery(raw: unknown): Promise<ContractorExecutionResponse | ContractorCapabilityResponse> {
  const input = normalizeContractorExecutionRequest(raw);
  if (input.state === "FL" && input.tradeRaw === "electrical") throw new Error("unsupported_florida_electrical_source");
  const semantic = semanticCapabilityResult(input);
  if (semantic) return semantic;
  if (!input.capability || !input.geography || (input.state !== "FL" && input.state !== "NJ")) throw new Error("unsupported_state_capability");
  const built = buildWhere(input);
  const offset = (input.page - 1) * input.limit;
  const count = await queryOne<{ total: string }>(`SELECT COUNT(*)::text AS total FROM licenses l JOIN contractors c ON c.id = l.contractor_id WHERE ${built.sql}`, built.params, { statementTimeoutMs: 10_000 });
  const params = [...built.params, input.limit, offset];
  const rows = await query<{ slug: string; display_name: string; license_number: string | null; external_key: string | null; occupation_code: string | null; occupation_description: string | null; status_normalized: string | null; primary_status: string | null; city: string | null; county: string | null; state: string | null; updated_at: Date | string | null }>(
    `SELECT c.slug, c.display_name, l.license_number, l.external_key, l.occupation_code, l.occupation_description, l.status_normalized, l.primary_status, l.city, l.county_name AS county, l.state, l.updated_at
     FROM licenses l JOIN contractors c ON c.id = l.contractor_id WHERE ${built.sql}
     ORDER BY LOWER(c.display_name), UPPER(COALESCE(l.license_number, l.external_key, '')), l.id
     LIMIT $${built.params.length + 1}::int OFFSET $${built.params.length + 2}::int`, params, { statementTimeoutMs: 15_000 });
  const total = Number(count?.total ?? 0);
  const resultState: ContractorExecutionResponse["resultState"] = input.identifier && total === 1 ? "EXACT_IDENTITY" : total === 0 ? "ZERO_MATCHING_ROWS" : "SUPPORTED_RESULTS";
  return {
    ...baseEnvelope(), resultState, status: "supported",
    queryInterpretation: { state: input.state, trade: input.tradeCapability?.label ?? input.credentialClass, occupationCodes: built.occupationCodes, identifier: input.identifier, geography: input.geography, credentialStatus: input.credentialStatus, ordering: "Normalized public name, then exact credential identifier, then stable source record. Neutral regulatory ordering; not recommendation." },
    resultType: input.identifier ? "exact_credential" : "credential_rows",
    rows: rows.map((row) => {
      const credentialNumber = row.license_number ?? row.external_key ?? "";
      const profileUrl = absoluteUrl(`/contractors/${encodeURIComponent(row.slug)}`);
      const verifyUrl = absoluteUrl(`${input.capability!.verifyDestination}${input.capability!.verifyDestination.includes("?") ? "&" : "?"}q=${encodeURIComponent(credentialNumber)}`);
      return {
        name: row.display_name, credentialNumber, credentialKey: row.external_key,
        trade: row.occupation_description ?? getOccupationInfo(row.occupation_code).label,
        occupationCode: row.occupation_code ?? "", credentialClass: row.occupation_description,
        status: row.status_normalized, sourceNativeStatus: row.primary_status,
        recordedGeography: { city: row.city, county: row.county, state: row.state },
        source: { system: input.capability!.sourceSystems[0], label: input.capability!.state.boardShortLabel, observedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null },
        publicationState: "PUBLIC_PROFILE" as const,
        whyShown: `${row.occupation_description ?? row.occupation_code ?? "Credential"} row from ${input.capability!.state.boardShortLabel} matching the selected credential class and status.`,
        regulatoryHistory: { available: false, meaning: "Not exposed by this credential-row contract; open the canonical profile for separately publication-gated regulatory evidence." },
        destination: profileUrl,
        destinations: [
          { type: "PUBLIC_PROFILE" as const, url: profileUrl },
          { type: "CONTRACTORTRUSTHUB_VERIFY" as const, url: verifyUrl },
          { type: "OFFICIAL_BOARD_VERIFICATION" as const, url: input.capability!.state.boardUrl },
        ],
      };
    }),
    total,
    pagination: { page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit), hasNextPage: input.page * input.limit < total },
    availableRefinements: [
      { field: "trade", values: input.capability.trades.map((trade) => trade.id) },
      { field: "credentialStatus", values: ["active_current", "expired", "all"] },
      ...(input.state === "FL" ? [{ field: "county", values: FLORIDA_COUNTIES.map((county) => county.slug) }] : [{ field: "county", values: [...NJ_COUNTIES] }]),
    ],
    provenance: { source: input.capability.state.boardLabel, sourceSystem: input.capability.sourceSystems[0], sourceClockField: "licenses.updated_at", queryGrain: `${input.capability.state.code} source-native credential row joined to an existing public non-thin ContractorTrustHub identity`, publicationSemantics: "Research-row inclusion reuses the existing non-thin public profile relationship; this endpoint creates no identity or profile." },
    limitations: [
      "Rows are neutral regulatory research results, not rankings, recommendations, or proof of workmanship.",
      "Recorded credential/address geography is not service territory or current availability.",
      `Credential status and source clock reflect the indexed ${input.capability.state.boardShortLabel} source and should be confirmed with the official board.`,
      "Only existing public, non-thin ContractorTrustHub profiles are returned; this contract does not expand publication.",
      ...(input.state === "NJ" ? ["New Jersey has no single statewide General contractor license class; HIC and each specialty remain separate."] : []),
    ],
  };
}

export function contractorUnsupportedElectricalResponse(raw: unknown): ContractorCapabilityResponse & {
  requestedTrade: "electrical";
  resolvedGeography: { state: "FL"; county: "Palm Beach" | null; city: string | null; meaning: string };
  supportedAlternatives: ContractorCapabilityResponse["capabilityChoices"];
  limitation: string;
  provenance: { source: string; capabilityState: "source_not_present" };
} {
  const input = normalizeContractorExecutionRequest(raw);
  if (input.state !== "FL" || input.tradeRaw !== "electrical") throw new Error("not_electrical_request");
  const response = capabilityResponse(input, "UNSUPPORTED_TRADE_CAPABILITY", "unsupported_capability", "unsupported_florida_electrical_source", ["The accepted Florida CILB construction source does not contain Florida electrical credentials; no New Jersey or other-state class is substituted."], CONTRACTOR_STATE_CAPABILITIES.FL.trades.slice(0, 6).map((trade) => ({ id: trade.id, label: trade.label, supported: true, request: { state: "FL", trade: trade.id } })));
  return Object.assign(response, {
    requestedTrade: "electrical" as const,
    resolvedGeography: { state: "FL" as const, county: input.geography?.county?.label === "Palm Beach" ? "Palm Beach" as const : null, city: input.geography?.city ?? null, meaning: `${input.geography?.meaning ?? "Recorded geography"} It does not prove service territory.` },
    supportedAlternatives: response.capabilityChoices,
    limitation: response.limitations[0],
    provenance: { source: "Florida DBPR CILB construction extract", capabilityState: "source_not_present" as const },
  });
}

export function contractorRequestErrorResponse(error: unknown, raw: unknown) {
  const message = error instanceof Error ? error.message : "invalid_query";
  const [kind, detail] = message.split(":", 2);
  const invalidGeography = kind === "invalid_geography";
  const clarification = kind === "clarification_required";
  const unsupportedState = message === "unsupported_state";
  const state = raw && typeof raw === "object" && !Array.isArray(raw)
    ? String((raw as Record<string, unknown>).state ?? "FL").toUpperCase()
    : "FL";
  const correction = detail === "summit_is_city_in_union_county"
    ? { city: "Summit", county: "Union", state: "NJ", explanation: "Summit is a city in Union County; New Jersey has no Summit County." }
    : null;
  return {
    ...baseEnvelope(),
    resultState: unsupportedState ? "UNSUPPORTED_STATE_CAPABILITY" : invalidGeography ? "INVALID_GEOGRAPHY" : clarification ? "CLARIFICATION_REQUIRED" : "INVALID_QUERY",
    status: unsupportedState ? "unsupported_capability" : invalidGeography ? "invalid_geography" : clarification ? "clarification_required" : "invalid_query",
    errorCode: detail ?? message,
    queryInterpretation: { state, correction },
    capabilityChoices: unsupportedState ? stateChoices() : correction ? [{ id: "summit_city", label: "Use Summit, Union County, New Jersey", supported: true, request: { state: "NJ", city: "Summit", county: "Union" } }] : [],
    provenance: { capabilityState: "request_not_executed" },
    limitations: [invalidGeography ? "The submitted geography was not executed or silently broadened." : "The request was not executed."],
  };
}

export function contractorCapabilityContract() {
  return {
    ...baseEnvelope(), entityClasses: ["contractor_profile", "credential_record"],
    identifiers: ["exact state credential number", "exact external credential key"],
    requiredSlots: ["supported state", "source-backed trade/class or identifier"],
    supportedStates: publicCapabilityMatrix(),
    supportedGeography: ["statewide credential jurisdiction", "validated recorded county", "authoritatively mapped recorded city"],
    geographyMeaning: "Recorded credential/address geography; never service territory or current availability.",
    evidenceFamilies: ["credential", "public regulatory-history indicator"], canReturnRows: true,
    resultFields: ["name", "credentialNumber", "credentialClass", "status", "recordedGeography", "source", "publicationState", "destination"],
    resultStates: SCHEMA_DESCRIPTOR.resultStates, refinements: ["state", "trade", "credentialStatus", "validated county"],
    limitations: ["No ranking", "No quality inference", "No service-territory inference", "No publication expansion", "No statewide New Jersey General contractor class", "Florida electrical remains unavailable from the accepted CILB source"],
    publicationSemantics: "Existing public non-thin profile gate only; Verify-only and held rows are never promoted by this endpoint.",
    destinationTypes: ["PUBLIC_PROFILE", "CONTRACTORTRUSTHUB_VERIFY", "OFFICIAL_BOARD_VERIFICATION", "NO_PUBLIC_DESTINATION"],
    authoritativeCityMappings: publicNjMunicipalityMappings(),
  };
}
