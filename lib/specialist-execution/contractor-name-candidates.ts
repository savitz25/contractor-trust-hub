/**
 * TH-SEARCH-R1-019B: callable, source-backed contractor NAME-CANDIDATE operation.
 *
 * Separately versioned from `trusthub-specialist-execution-v2` on purpose: consumers pin
 * that contract's schemaFingerprint fail-closed, so adding a name field there would
 * invalidate every existing cohort/identifier caller. This operation is opt-in and leaves
 * the v2 request allowlist, defaults and fingerprints untouched.
 *
 * A candidate is a relevant public record -- never a confirmed regulatory identity.
 */
import { createHash } from "node:crypto";
import { isDbCapacityError, isDbConnectTimeout, isDbQueryTimeout } from "@/lib/db";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import { deriveNameMatchEvidence, prepareNameTerms } from "@/lib/contractors/name-search-core";
import {
  queryContractorNameCandidates,
  type NameCandidateDb,
  type NameCandidateDbRow,
  type NameCandidateScope,
} from "@/lib/contractors/name-candidates-query";
import { absoluteUrl } from "@/lib/site";
import { EVIDENCE_STATES, getLiveStates, licenseSourcesFor, verifyPathFor, type EvidenceState } from "@/lib/states/config";

export const NAME_CANDIDATES_CONTRACT = "contractor-name-candidates-v1" as const;
export const NAME_CANDIDATES_CONTRACT_VERSION = "1.0.0" as const;
export const NAME_CANDIDATES_OPERATION = "name_candidates" as const;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 120;
export const NAME_DEFAULT_LIMIT = 10;
export const NAME_MAX_LIMIT = 25;
/** Rows reachable through this operation for one name + scope; beyond it, use the native continuation. */
export const NAME_SOURCE_CAP = 200;

/** Shared recorded-address meaning. The card face does not repeat it; Trace and this field still carry it. */
export const NAME_CANDIDATE_RECORDED_ADDRESS_MEANING =
  "Recorded address on the profile. Separate from the credential jurisdiction; not service territory or current availability.";

export type NameCandidatesResultState =
  | "COMPLETED_WITH_CANDIDATES"
  | "COMPLETED_NO_CANDIDATES"
  | "PARTIAL_TRUNCATED"
  | "UNSUPPORTED_SCOPE"
  | "INVALID_QUERY"
  | "SOURCE_FAILURE";

const SCHEMA_DESCRIPTOR = {
  request: ["contract", "operation", "name", "jurisdiction", "page", "limit"],
  response: ["contract", "contractVersion", "schemaFingerprint", "hub", "operation", "resultState", "name", "scope", "grain", "candidates", "pagination", "continuation", "completeness", "ordering", "limitations", "timing"],
  candidate: ["stableKey", "sourceGrain", "displayName", "entityType", "match", "identifiers", "credential", "credentialJurisdiction", "recordedLocation", "source", "publicationState", "action", "destinations"],
  resultStates: ["COMPLETED_WITH_CANDIDATES", "COMPLETED_NO_CANDIDATES", "PARTIAL_TRUNCATED", "UNSUPPORTED_SCOPE", "INVALID_QUERY", "SOURCE_FAILURE"],
  matchMethods: ["EXACT_SOURCE_NAME", "NORMALIZED_NAME", "DOCUMENTED_ALIAS", "PREFIX_OR_TOKEN"],
};
export const NAME_CANDIDATES_SCHEMA_FINGERPRINT = createHash("sha256").update(JSON.stringify(SCHEMA_DESCRIPTOR)).digest("hex");

const GRAIN = "One card per public ContractorTrustHub profile (existing non-thin profile with a slug), shown with one representative source credential row. Profiles are credential-grain in several sources, so cards are not a count of distinct contracting companies.";
const ORDERING = "Neutral string-relation rank (display-name prefix, DBA prefix, legal-name prefix, then contains), then normalized display name, then profile slug. Never provider quality, never recommendation.";

function envelope() {
  return {
    contract: NAME_CANDIDATES_CONTRACT,
    contractVersion: NAME_CANDIDATES_CONTRACT_VERSION,
    schemaFingerprint: NAME_CANDIDATES_SCHEMA_FINGERPRINT,
    hub: "contractor" as const,
    operation: NAME_CANDIDATES_OPERATION,
  };
}

export type NormalizedNameCandidatesRequest = {
  /** Exactly the supplied name after whitespace collapse. Never truncated. */
  name: string;
  jurisdiction: string | null;
  page: number;
  limit: number;
};

/** Full validation BEFORE any normalization that could change meaning. Nothing is truncated. */
export function normalizeNameCandidatesRequest(value: unknown): NormalizedNameCandidatesRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_request");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["contract", "operation", "name", "jurisdiction", "page", "limit"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error("unsupported_field");
  if (input.contract !== undefined && input.contract !== NAME_CANDIDATES_CONTRACT) throw new Error("invalid_contract");
  // Explicit mode: the operation is never inferred from free text.
  if (input.operation !== NAME_CANDIDATES_OPERATION) throw new Error("invalid_operation");

  const raw = input.name;
  if (typeof raw !== "string") throw new Error("invalid_name");
  if ([...raw].some((ch) => { const code = ch.charCodeAt(0); return code < 32 || code === 127 || ch === "<" || ch === ">"; })) throw new Error("invalid_name");
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) throw new Error("invalid_name");
  // Punctuation/wildcard-only input must never become a match-all pattern.
  if (!/[\p{L}\p{N}]/u.test(name)) throw new Error("invalid_name");
  // Every meaningful word stays required; a name with no letter or digit of any script cannot be searched.
  if (prepareNameTerms(name).terms.length === 0) throw new Error("invalid_name");

  let jurisdiction: string | null = null;
  if (input.jurisdiction !== undefined && input.jurisdiction !== null && input.jurisdiction !== "") {
    if (typeof input.jurisdiction !== "string" || input.jurisdiction.length > 40) throw new Error("invalid_jurisdiction");
    const text = input.jurisdiction.trim();
    if (/^[A-Za-z]{2}$/.test(text)) jurisdiction = text.toUpperCase();
    else {
      const named = Object.values(EVIDENCE_STATES).find((state) => state.name.toLowerCase() === text.toLowerCase());
      if (!named) throw new Error("invalid_jurisdiction");
      jurisdiction = named.code;
    }
  }

  const page = input.page === undefined ? 1 : input.page;
  const limit = input.limit === undefined ? NAME_DEFAULT_LIMIT : input.limit;
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1) throw new Error("invalid_page");
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > NAME_MAX_LIMIT) throw new Error("invalid_limit");
  if ((page - 1) * limit >= NAME_SOURCE_CAP) throw new Error("invalid_page");
  return { name, jurisdiction, page, limit };
}

type ScopeDescriptor = NameCandidateScope & { label: string; sourceLabel: string; slug: string };

/** Exactly the scopes native Verify name search serves -- a state page alone is not name coverage. */
export function nameSearchableScopes(): ScopeDescriptor[] {
  return getLiveStates().map((state) => ({
    code: state.code, slug: state.slug, label: state.name, sourceLabel: state.boardLabel, sources: licenseSourcesFor(state),
  }));
}

function notSearchableByName(): Array<{ code: string; label: string; reason: string }> {
  const live = new Set(getLiveStates().map((state) => state.code));
  return Object.values(EVIDENCE_STATES)
    .filter((state) => !live.has(state.code))
    .map((state) => ({ code: state.code, label: state.name, reason: "Configured in ContractorTrustHub but not served by native Verify name search; not searched by this operation." }));
}

function verifyContinuation(state: Pick<EvidenceState, "slug" | "name">, name: string) {
  const path = verifyPathFor(state.slug);
  return {
    type: "VERIFY" as const,
    jurisdiction: state.slug.toUpperCase(),
    href: absoluteUrl(`${path}${path.includes("?") ? "&" : "?"}q=${encodeURIComponent(name)}`),
    label: `Search this name in ContractorTrustHub Verify (${state.name})`,
  };
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toCandidate(row: NameCandidateDbRow, name: string, scopes: ScopeDescriptor[]) {
  const evidence = deriveNameMatchEvidence(name, {
    display_name: row.display_name, legal_name: row.legal_name, dba_name: row.dba_name,
    licensee_name_raw: row.licensee_name_raw, dba_name_raw: row.dba_name_raw,
  });
  // Independent proof the predicate ran: a row whose own returned names do not explain the
  // match is never shown as a candidate.
  if (!evidence) throw new Error("name_predicate_evidence_missing");
  const scope = scopes.find((s) => s.code === row.scope_code);
  if (!scope) throw new Error("name_candidate_scope_unrecognized");
  const profileUrl = absoluteUrl(`/contractors/${encodeURIComponent(row.slug)}`);
  const credentialNumber = row.license_number ?? row.external_key;
  const verified = iso(row.last_verified_at);
  const updated = iso(row.updated_at);
  return {
    stableKey: `contractor:profile:${row.slug}`,
    sourceGrain: "ContractorTrustHub public profile with a representative state credential row",
    displayName: row.display_name,
    // Entity type is not source-backed at this grain; never inferred from the name.
    entityType: null,
    match: { field: evidence.field, value: evidence.value, method: evidence.method, matchedWords: evidence.matchedWords, explanation: evidence.explanation },
    identifiers: [
      ...(row.external_key ? [{ label: "ContractorTrustHub credential key", value: row.external_key, meaning: "Stable source credential key for the representative row." }] : []),
      ...(row.license_number && row.license_number !== row.external_key ? [{ label: "State credential number", value: row.license_number, meaning: "Credential number as published by the source board." }] : []),
    ],
    credential: {
      number: credentialNumber,
      class: row.occupation_description ?? getOccupationInfo(row.occupation_code).label,
      occupationCode: row.occupation_code,
      status: row.status_normalized,
      sourceNativeStatus: row.primary_status,
      statusMeaning: "Indexed status of the representative credential row as of the source clock. Not a live board check, not regulatory approval, and not proof of any trade authorization beyond the listed class.",
    },
    credentialJurisdiction: { code: scope.code, label: scope.label, sourceSystem: row.source_system, sourceLabel: scope.sourceLabel },
    recordedLocation: {
      city: row.primary_city, county: row.primary_county, state: row.home_state,
      meaning: NAME_CANDIDATE_RECORDED_ADDRESS_MEANING,
    },
    source: {
      system: row.source_system,
      clock: verified
        ? { value: verified, label: "ContractorTrustHub last-verified time for the indexed credential row (licenses.last_verified_at); not an official board effective date." }
        : { value: updated, label: "ContractorTrustHub row-updated time (licenses.updated_at); not an official board effective date." },
    },
    publicationState: "PUBLIC_PROFILE" as const,
    action: { type: "PROFILE" as const, href: profileUrl, label: "Open ContractorTrustHub profile" },
    destinations: [
      { type: "PUBLIC_PROFILE" as const, url: profileUrl },
      ...(credentialNumber ? [{ type: "CONTRACTORTRUSTHUB_VERIFY" as const, url: verifyContinuation({ slug: scope.slug, name: scope.label }, credentialNumber).href }] : []),
    ],
  };
}

const BASE_LIMITATIONS = [
  "Candidates are relevant public records matched by name. A name match is not a confirmed identity, regulatory approval, or endorsement.",
  "Distinct profiles that share a name stay separate; nothing is merged on name similarity.",
  "Recorded address and credential jurisdiction are different facts; neither establishes service territory.",
  "Only existing public, non-thin ContractorTrustHub profiles are returned; this operation does not expand publication.",
  "No credential-status filter is applied: inactive, expired or unknown-status public profiles remain discoverable by name.",
];

export type NameCandidatesResponse = ReturnType<typeof envelope> & Record<string, unknown> & { resultState: NameCandidatesResultState };

function failureKind(error: unknown): "timeout" | "unavailable" | "invalid_response" {
  if (isDbQueryTimeout(error)) return "timeout";
  if (isDbConnectTimeout(error) || isDbCapacityError(error)) return "unavailable";
  const message = error instanceof Error ? error.message : "";
  if (message === "name_candidates_out_of_time") return "timeout";
  if (message === "name_predicate_evidence_missing" || message === "name_candidate_scope_unrecognized") return "invalid_response";
  return "unavailable";
}

export async function executeContractorNameCandidates(raw: unknown, db?: NameCandidateDb): Promise<NameCandidatesResponse> {
  const input = normalizeNameCandidatesRequest(raw);
  const prepared = prepareNameTerms(input.name);
  const allScopes = nameSearchableScopes();
  const nameEcho = {
    supplied: input.name,
    normalized: prepared.key,
    // Every word here is enforced by the final predicate -- initials and later words included.
    requiredWords: prepared.terms,
    optionalWordsDropped: prepared.optionalWordsDropped,
    predicate: "ONE source name field (display, legal/licensee, DBA, or a credential row's source names) contains every required word after identical normalization of both sides: apostrophes removed, ASCII punctuation as word breaks, letters and digits of any script kept, case folded. A word of 3+ characters may begin a source word; a shorter word must equal one. Applied before any row limit; independent of the access path.",
  };

  const scopes = input.jurisdiction ? allScopes.filter((scope) => scope.code === input.jurisdiction) : allScopes;
  if (input.jurisdiction && scopes.length === 0) {
    return {
      ...envelope(), resultState: "UNSUPPORTED_SCOPE", errorCode: "jurisdiction_not_name_searchable",
      name: { ...nameEcho, predicateApplied: false },
      scope: {
        mode: "explicit_jurisdiction", requestedJurisdiction: input.jurisdiction, searched: [],
        supported: allScopes.map((scope) => ({ code: scope.code, label: scope.label })), notSearchableByName: notSearchableByName(),
        meaning: `${input.jurisdiction} is not a jurisdiction served by ContractorTrustHub name search. The constraint was kept; no other jurisdiction was substituted and nothing was searched.`,
      },
      grain: GRAIN, candidates: [],
      pagination: { page: input.page, limit: input.limit, returned: 0, hasMore: false, nextPage: null, sourceCap: NAME_SOURCE_CAP, truncated: false, total: null, totalMeaning: "Not searched." },
      continuation: null, completeness: null, ordering: ORDERING, limitations: BASE_LIMITATIONS, timing: { queryMs: 0, queries: 0 },
    };
  }

  const scopeBase = {
    mode: input.jurisdiction ? "explicit_jurisdiction" : "all_name_searchable_jurisdictions",
    requestedJurisdiction: input.jurisdiction,
    notSearchableByName: notSearchableByName(),
  };
  const offset = (input.page - 1) * input.limit;
  const started = Date.now();
  let result: Awaited<ReturnType<typeof queryContractorNameCandidates>>;
  let candidates: ReturnType<typeof toCandidate>[];
  try {
    // The last window is clamped so no request can ever return rows beyond the advertised cap.
    result = await queryContractorNameCandidates({ name: input.name, scopes, limit: Math.min(input.limit, NAME_SOURCE_CAP - offset), offset }, db);
    candidates = result.rows.map((row) => toCandidate(row, input.name, scopes));
  } catch (error) {
    const kind = failureKind(error);
    // A timeout or unavailable dependency is never a miss.
    return {
      ...envelope(), resultState: "SOURCE_FAILURE", errorCode: `source_${kind}`, failureKind: kind,
      name: { ...nameEcho, predicateApplied: false },
      scope: { ...scopeBase, searched: scopes.map((scope) => ({ code: scope.code, label: scope.label, sources: scope.sources, state: "FAILED" })), meaning: "The source did not complete. No jurisdiction is reported as searched-and-missed." },
      grain: GRAIN, candidates: [],
      pagination: { page: input.page, limit: input.limit, returned: 0, hasMore: false, nextPage: null, sourceCap: NAME_SOURCE_CAP, truncated: false, total: null, totalMeaning: "Unknown: the source did not complete." },
      continuation: {
        type: "RETRY_OR_VERIFY",
        meaning: "The source did not complete. Retry, or search the same name in ContractorTrustHub Verify for a jurisdiction.",
        scoped: scopes.map((scope) => verifyContinuation({ slug: scope.slug, name: scope.label }, input.name)),
      },
      completeness: null, ordering: ORDERING, limitations: BASE_LIMITATIONS, timing: { queryMs: Date.now() - started, queries: 1 },
    };
  }
  const queryMs = Date.now() - started;

  const reachedCap = offset + candidates.length >= NAME_SOURCE_CAP;
  const truncated = result.hasMore && reachedCap;
  const hasMore = result.hasMore && !reachedCap;
  // Strong matches were read but "contains every word" matches were not finished in the time budget.
  const tokenTierIncomplete = result.tiers.token === "NOT_COMPLETED";
  const resultState: NameCandidatesResultState = truncated || tokenTierIncomplete ? "PARTIAL_TRUNCATED" : candidates.length > 0 ? "COMPLETED_WITH_CANDIDATES" : "COMPLETED_NO_CANDIDATES";
  const pastEnd = candidates.length === 0 && input.page > 1;

  return {
    ...envelope(), resultState,
    name: { ...nameEcho, predicateApplied: true },
    scope: {
      ...scopeBase,
      searched: scopes.map((scope) => ({ code: scope.code, label: scope.label, sources: scope.sources, state: "COMPLETED" })),
      meaning: input.jurisdiction
        ? `Only ${scopes[0].label} credential sources were searched. The jurisdiction is the credential's issuing state, not the company's recorded address.`
        : `Every jurisdiction served by ContractorTrustHub name search was searched in one statement (${scopes.map((scope) => scope.code).join(", ")}). Jurisdictions listed under notSearchableByName were not searched. This is not nationwide coverage.`,
    },
    grain: GRAIN,
    candidates,
    pagination: {
      page: input.page, limit: input.limit, returned: candidates.length, hasMore, nextPage: hasMore ? input.page + 1 : null,
      sourceCap: NAME_SOURCE_CAP, truncated: truncated || tokenTierIncomplete, total: null,
      totalMeaning: pastEnd ? "This page is past the last matching row; no total is asserted." : "No exact total is asserted. hasMore is proven by a one-row probe beyond this page.",
    },
    // A usable continuation always exists when rows remain: nextPage below the cap, native Verify beyond it.
    continuation: hasMore
      ? { type: "NEXT_PAGE", request: { contract: NAME_CANDIDATES_CONTRACT, operation: NAME_CANDIDATES_OPERATION, name: input.name, ...(input.jurisdiction ? { jurisdiction: input.jurisdiction } : {}), page: input.page + 1, limit: input.limit } }
      : truncated
        ? {
          type: "REFINE_SEARCH",
          reachesRowsBeyondCap: false,
          meaning: "These links open ContractorTrustHub Verify for the same name. Verify shows its own first page; it does NOT continue past this operation's cap. To reach other records, supply a more specific name or a jurisdiction.",
          scoped: scopes.map((scope) => verifyContinuation({ slug: scope.slug, name: scope.label }, input.name)),
        }
        : tokenTierIncomplete
          ? {
            type: "RETRY_OR_VERIFY",
            meaning: "Names that equal or begin with the supplied name are listed. Names that contain the supplied words elsewhere were not finished in time. Retry, or search the same name in ContractorTrustHub Verify for a jurisdiction.",
            scoped: scopes.map((scope) => verifyContinuation({ slug: scope.slug, name: scope.label }, input.name)),
          }
          : null,
    completeness: {
      // rank 0-3: a source name equals or starts with the supplied name. rank 4: contains every word.
      strongNameMatches: result.tiers.strong,
      wordMatchesElsewhereInName: result.tiers.token,
      meaning: tokenTierIncomplete
        ? "PARTIAL: more candidates may exist whose name contains the supplied words but does not begin with them. This is not a miss and not a complete list."
        : result.tiers.token === "NOT_NEEDED"
          ? "This page is filled by names that equal or begin with the supplied name; weaker matches sort after them and are reached by later pages."
          : "Both tiers completed for this page.",
    },
    ordering: ORDERING,
    limitations: [
      ...BASE_LIMITATIONS,
      ...(tokenTierIncomplete ? ["The search for names that contain the supplied words away from the start did not finish within the time budget. The candidates shown are real matches; the list is partial."] : []),
      ...(truncated ? [`More matching profiles exist beyond this operation's ${NAME_SOURCE_CAP}-row cap and are not reachable through it. Supply a more specific name or a jurisdiction.`] : []),
    ],
    timing: { queryMs, queries: result.queries },
  };
}

export function nameCandidatesRequestError(error: unknown): NameCandidatesResponse {
  const code = error instanceof Error ? error.message : "invalid_request";
  return {
    ...envelope(), resultState: "INVALID_QUERY", errorCode: code, candidates: [],
    limitations: ["The request was not executed. No cohort or fallback search was substituted."],
  };
}

export function nameCandidatesCapability() {
  return {
    ...envelope(),
    request: { required: ["operation", "name"], optional: ["contract", "jurisdiction", "page", "limit"], nameLength: [NAME_MIN_LENGTH, NAME_MAX_LENGTH], defaultLimit: NAME_DEFAULT_LIMIT, maxLimit: NAME_MAX_LIMIT, sourceCap: NAME_SOURCE_CAP },
    resultStates: SCHEMA_DESCRIPTOR.resultStates,
    matchMethods: SCHEMA_DESCRIPTOR.matchMethods,
    nameSearchableJurisdictions: nameSearchableScopes().map((scope) => ({ code: scope.code, label: scope.label, sources: scope.sources })),
    notSearchableByName: notSearchableByName(),
    grain: GRAIN, completeness: null, ordering: ORDERING, limitations: BASE_LIMITATIONS,
    engine: "Shared with native ContractorTrustHub Verify name search (lib/contractors/name-search-core.ts).",
  };
}
