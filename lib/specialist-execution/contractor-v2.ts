import { query, queryOne } from "@/lib/db";
import { FLORIDA_COUNTIES } from "@/lib/discovery/counties";
import { TRADE_ONTOLOGY, type TradeFamilyId } from "@/lib/ask/ontology";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { absoluteUrl } from "@/lib/site";

export const SPECIALIST_EXECUTION_VERSION = "trusthub-specialist-execution-v2" as const;
export const CONTRACTOR_RESULT_LIMIT = 24;
const MAX_LIMIT = 50;
const MAX_PAGE = 100;

export type ContractorExecutionRequest = {
  trade?: TradeFamilyId;
  state?: "FL";
  county?: string;
  city?: string;
  credentialStatus?: "active_current" | "expired" | "all";
  identifier?: string;
  page?: number;
  limit?: number;
};

export type ContractorExecutionRow = {
  profileId: string;
  name: string;
  credentialNumber: string;
  credentialKey: string | null;
  trade: string;
  occupationCode: string;
  status: string | null;
  recordedGeography: { city: string | null; county: string | null; state: string | null };
  source: { system: "fl_dbpr"; label: "Florida DBPR"; observedAt: string | null };
  regulatoryHistory: { available: boolean; meaning: string };
  destination: string;
};

export type ContractorExecutionResponse = {
  contract: typeof SPECIALIST_EXECUTION_VERSION;
  hub: "contractor";
  queryInterpretation: {
    trade: string | null;
    occupationCodes: string[];
    identifier: string | null;
    geography: { state: "FL"; county: string | null; city: string | null; meaning: string };
    credentialStatus: string;
  };
  resultType: "credential_rows" | "exact_credential" | "unsupported";
  rows: ContractorExecutionRow[];
  total: number;
  pagination: { page: number; limit: number; totalPages: number };
  availableRefinements: Array<{ field: string; values: string[] }>;
  provenance: { source: "Florida DBPR"; sourceSystem: "fl_dbpr"; sourceClockField: "licenses.updated_at" };
  limitations: string[];
};

type NormalizedRequest = Required<Pick<ContractorExecutionRequest, "state" | "credentialStatus" | "page" | "limit">> &
  Pick<ContractorExecutionRequest, "trade"> & {
    county: { slug: string; label: string; code: string | null } | null;
    city: string | null;
    identifier: string | null;
  };

const CITY_TO_COUNTY: Record<string, { slug: string; label: string }> = {
  "boca raton": { slug: "palm-beach", label: "Palm Beach" },
};

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean && clean.length <= max ? clean : null;
}

export function normalizeContractorExecutionRequest(value: unknown): NormalizedRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_request");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["trade", "state", "county", "city", "credentialStatus", "identifier", "page", "limit"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error("unsupported_field");
  const state = input.state === undefined ? "FL" : input.state;
  if (state !== "FL") throw new Error("unsupported_state");
  const trade = cleanText(input.trade, 32);
  if (trade && !TRADE_ONTOLOGY.some((row) => row.id === trade)) throw new Error("unsupported_trade");
  const status = input.credentialStatus ?? "active_current";
  if (!new Set(["active_current", "expired", "all"]).has(String(status))) throw new Error("unsupported_status");
  const city = cleanText(input.city, 80);
  const requestedCounty = cleanText(input.county, 80);
  const cityCounty = city ? CITY_TO_COUNTY[city.toLowerCase()] : null;
  let county = requestedCounty
    ? FLORIDA_COUNTIES.find((row) => row.slug === requestedCounty.toLowerCase() || row.name.toLowerCase() === requestedCounty.toLowerCase())
    : cityCounty
      ? FLORIDA_COUNTIES.find((row) => row.slug === cityCounty.slug)
      : null;
  if (requestedCounty && !county) throw new Error("unsupported_county");
  if (city && !cityCounty && !requestedCounty) throw new Error("city_requires_supported_county_mapping");
  if (cityCounty && county && cityCounty.slug !== county.slug) throw new Error("geography_conflict");
  const identifier = cleanText(input.identifier, 80);
  const page = Number(input.page ?? 1);
  const limit = Number(input.limit ?? CONTRACTOR_RESULT_LIMIT);
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) throw new Error("invalid_page");
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error("invalid_limit");
  return {
    state,
    trade: trade as TradeFamilyId | undefined,
    county: county ? { slug: county.slug, label: county.name, code: county.matchCodes?.[0] ?? null } : null,
    city,
    credentialStatus: status as NormalizedRequest["credentialStatus"],
    identifier,
    page,
    limit,
  };
}

function buildWhere(input: NormalizedRequest): { sql: string; params: unknown[]; occupationCodes: string[] } {
  const params: unknown[] = ["fl_dbpr", "FL"];
  const terms = [
    "l.source_system = $1",
    "c.is_thin_profile = FALSE",
    "c.slug IS NOT NULL AND c.slug <> ''",
    "(c.home_state = $2 OR l.state = $2)",
  ];
  const family = input.trade ? TRADE_ONTOLOGY.find((row) => row.id === input.trade) : null;
  const occupationCodes = family?.exactClasses ?? [];
  if (occupationCodes.length) {
    params.push(occupationCodes);
    terms.push(`l.occupation_code = ANY($${params.length}::text[])`);
  }
  if (input.credentialStatus === "active_current") terms.push("l.status_normalized IN ('active', 'current')");
  if (input.credentialStatus === "expired") terms.push("l.status_normalized = 'expired'");
  if (input.county) {
    params.push(input.county.code ?? input.county.label);
    terms.push(input.county.code ? `l.county_code = $${params.length}` : `l.county_name ILIKE $${params.length}`);
  }
  if (input.identifier) {
    params.push(input.identifier.toUpperCase().replace(/\s+/g, ""));
    terms.push(`(UPPER(REPLACE(COALESCE(l.external_key, ''), ' ', '')) = $${params.length} OR UPPER(REPLACE(COALESCE(l.license_number, ''), ' ', '')) = $${params.length})`);
  }
  return { sql: terms.join(" AND "), params, occupationCodes };
}

export async function executeContractorSpecialistQuery(raw: unknown): Promise<ContractorExecutionResponse> {
  const input = normalizeContractorExecutionRequest(raw);
  const built = buildWhere(input);
  if (!input.trade && !input.identifier) throw new Error("trade_or_identifier_required");
  const offset = (input.page - 1) * input.limit;
  const count = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM licenses l JOIN contractors c ON c.id = l.contractor_id WHERE ${built.sql}`,
    built.params,
    { statementTimeoutMs: 10_000 }
  );
  const params = [...built.params, input.limit, offset];
  const rows = await query<{
    profile_id: string; slug: string; display_name: string; license_number: string | null; external_key: string | null;
    occupation_code: string | null; status_normalized: string | null; city: string | null; county: string | null;
    state: string | null; updated_at: Date | string | null;
  }>(`SELECT c.id AS profile_id, c.slug, c.display_name, l.license_number, l.external_key, l.occupation_code,
      l.status_normalized, COALESCE(l.city, c.primary_city) AS city, COALESCE(l.county_name, c.primary_county) AS county,
      COALESCE(l.state, c.home_state) AS state, l.updated_at
    FROM licenses l JOIN contractors c ON c.id = l.contractor_id
    WHERE ${built.sql}
    ORDER BY LOWER(c.display_name), UPPER(COALESCE(l.license_number, l.external_key, '')), l.id
    LIMIT $${built.params.length + 1}::int OFFSET $${built.params.length + 2}::int`, params, { statementTimeoutMs: 15_000 });
  const total = Number(count?.total ?? 0);
  const family = input.trade ? TRADE_ONTOLOGY.find((row) => row.id === input.trade) : null;
  const geographyMeaning = input.county
    ? `${input.city ? `${input.city} is deterministically mapped to ` : ""}${input.county.label} County recorded credential/address geography; not service territory or local authorization.`
    : "Florida credential/address geography in the indexed source; not service territory.";
  return {
    contract: SPECIALIST_EXECUTION_VERSION,
    hub: "contractor",
    queryInterpretation: {
      trade: family?.label ?? null,
      occupationCodes: built.occupationCodes,
      identifier: input.identifier,
      geography: { state: "FL", county: input.county?.label ?? null, city: input.city, meaning: geographyMeaning },
      credentialStatus: input.credentialStatus,
    },
    resultType: input.identifier ? "exact_credential" : "credential_rows",
    rows: rows.map((row) => ({
      profileId: row.profile_id,
      name: row.display_name,
      credentialNumber: row.license_number ?? row.external_key ?? "",
      credentialKey: row.external_key,
      trade: getOccupationInfo(row.occupation_code).label,
      occupationCode: row.occupation_code ?? "",
      status: row.status_normalized,
      recordedGeography: { city: row.city, county: row.county, state: row.state },
      source: { system: "fl_dbpr", label: "Florida DBPR", observedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null },
      regulatoryHistory: {
        available: false,
        meaning: "Not exposed by this credential-row contract; open the canonical profile for separately publication-gated regulatory evidence.",
      },
      destination: absoluteUrl(`/contractors/${encodeURIComponent(row.slug)}`),
    })),
    total,
    pagination: { page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) },
    availableRefinements: [
      { field: "trade", values: TRADE_ONTOLOGY.map((row) => row.id) },
      { field: "credentialStatus", values: ["active_current", "expired", "all"] },
      { field: "county", values: FLORIDA_COUNTIES.map((row) => row.slug) },
    ],
    provenance: { source: "Florida DBPR", sourceSystem: "fl_dbpr", sourceClockField: "licenses.updated_at" },
    limitations: [
      "Rows are neutral regulatory research results, not rankings, recommendations, or proof of workmanship.",
      "Recorded county/address geography is not service territory.",
      "Credential status and source clock reflect the indexed source and should be confirmed with Florida DBPR.",
      "Only existing public, non-thin ContractorTrustHub profiles are returned; this contract does not expand publication.",
    ],
  };
}

export function contractorCapabilityContract() {
  return {
    contract: SPECIALIST_EXECUTION_VERSION,
    hub: "contractor",
    entityClasses: ["contractor_profile", "credential_record"],
    identifiers: ["Florida DBPR credential number", "exact external credential key"],
    requiredSlots: ["trade or identifier", "state=FL"],
    supportedGeography: ["Florida", "configured Florida county", "Boca Raton → Palm Beach County"],
    geographyMeaning: "Recorded credential/address geography; never service territory.",
    filters: ["trade", "credentialStatus", "county"],
    evidenceFamilies: ["credential", "public regulatory-history indicator"],
    canReturnRows: true,
    resultFields: ["name", "credentialNumber", "trade", "status", "recordedGeography", "source", "destination"],
    refinements: ["trade", "credentialStatus", "county"],
    limitations: ["No ranking", "No quality inference", "No service-territory inference", "No publication expansion"],
    publicationSemantics: "Existing public non-thin profile gate only.",
    destinationTemplates: ["https://www.contractortrusthub.com/contractors/{slug}"],
  };
}
