import type { ContractorExecutionRequest } from "@/lib/specialist-execution/contractor-v2";
import { getExecutionCapability } from "@/lib/specialist-execution/state-capabilities";

import {
  extractGeographyRequirement,
  decideGeography,
  type GeographyRequirement,
} from "../ask/geography";
import type { AskUrlOverrides } from "../ask/url";

export type ContractorSearchPlan =
  | { mode: "empty"; originalQuery: string }
  | {
      mode: "verify";
      originalQuery: string;
      identifier: string;
      state: string | null;
      verifyHref: string;
    }
  | {
      mode: "clarification";
      originalQuery: string;
      reason: "identity_or_discovery" | "invalid_query";
    }
  | {
      mode: "discovery";
      originalQuery: string;
      request: ContractorExecutionRequest;
      geographyRequirement: GeographyRequirement | null;
      interpretation: {
        trade: string | null;
        state: string | null;
        county: string | null;
        city: string | null;
        geographyIntent: "RECORDED_CREDENTIAL_GEOGRAPHY" | "SERVICE_TERRITORY";
      };
    };

import { CONTRACTOR_STATE_NAMES as STATES } from "./state-names";

const TRADE_PATTERNS: Array<[RegExp, string]> = [
  [/\bhome\s+improvement(?:\s+contractors?)?\b|\bhic\b/i, "home_improvement"],
  [/\broof(?:er|ers|ing)(?:\s+contractors?)?\b/i, "roofing"],
  [/\bhvacr?\b|\bair\s+conditioning(?:\s+contractors?)?\b/i, "hvac"],
  [/\bplumb(?:er|ers|ing)(?:\s+contractors?)?\b/i, "plumbing"],
  [/\belectric(?:al|ian|ians)(?:\s+contractors?)?\b/i, "electrical"],
  [/\bmechanical(?:\s+contractors?)?\b/i, "mechanical"],
  [
    /\bpool(?:\s*\/\s*spa|\s+and\s+spa|\s+spa)?(?:\s+contractors?)?\b/i,
    "pool_spa",
  ],
  [/\bbuilding(?:\s+contractors?)?\b/i, "building"],
  [/\bgeneral(?:\s+contractors?)?\b/i, "general"],
  [/\bresidential(?:\s+contractors?)?\b/i, "residential"],
  [/\bsolar(?:\s+contractors?)?\b/i, "solar"],
  [/\balarm(?:\s+contractors?)?\b/i, "alarm"],
  [/\btelecom(?:munications)?(?:\s+contractors?)?\b/i, "telecom"],
  [/\blocksmiths?\b/i, "locksmith"],
  [/\bhearth(?:\s+specialists?)?\b/i, "hearth"],
];

const FL_IDENTIFIER =
  /^(?:CCC|CBC|CGC|CAC|CMC|CFC|CRC|CPC|CVC|CUC|SCC|RC|RB|RG|RA|RM|RF|RR|RP|RV|RU|RX)\d{5,10}$/i;
const NJ_IDENTIFIER = /^13VH\d{8}$/i;

function normalizedQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function findState(query: string): string | null {
  const lower = query.toLowerCase();
  const named = Object.entries(STATES)
    .sort(([a], [b]) => b.length - a.length)
    .find(([name]) =>
      new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i").test(lower),
    );
  if (named) return named[1];
  const code = query.match(/(?:^|[\s,])([A-Z]{2})(?=$|[\s,.])/);
  return code && Object.values(STATES).includes(code[1]) ? code[1] : null;
}

function findTrade(query: string): string | null {
  return TRADE_PATTERNS.find(([pattern]) => pattern.test(query))?.[1] ?? null;
}

function mentionsGenericContractor(query: string): boolean {
  return /\bcontractors?\b/i.test(query);
}

function exactIdentifier(
  query: string,
): { identifier: string; state: string | null } | null {
  const compact = query.replace(/[\s-]+/g, "").toUpperCase();
  if (FL_IDENTIFIER.test(compact)) return { identifier: compact, state: "FL" };
  if (NJ_IDENTIFIER.test(compact)) return { identifier: compact, state: "NJ" };
  return null;
}

export function planContractorSearch(
  raw: string,
  overrides: AskUrlOverrides = {},
): ContractorSearchPlan {
  if (raw.length > 180 || /[\u0000-\u001f]/.test(raw))
    return {
      mode: "clarification",
      originalQuery: raw,
      reason: "invalid_query",
    };
  const query = normalizedQuery(raw);
  if (!query) return { mode: "empty", originalQuery: query };
  const identifier = exactIdentifier(query);
  if (identifier) {
    const params = new URLSearchParams({ q: identifier.identifier });
    if (identifier.state === "NJ") params.set("state", "nj");
    return {
      mode: "verify",
      originalQuery: query,
      identifier: identifier.identifier,
      state: identifier.state,
      verifyHref: `/verify?${params.toString()}`,
    };
  }

  if (/\b(?:llc|inc|corp|corporation|company|holdings)\b/i.test(query))
    return {
      mode: "clarification",
      originalQuery: query,
      reason: "identity_or_discovery",
    };
  const explicitTrade =
    overrides.trade && overrides.trade !== "-"
      ? (TRADE_PATTERNS.map(([, id]) => id).find(
          (id) => id === overrides.trade,
        ) ?? findTrade(query))
      : overrides.trade === "-"
        ? null
        : findTrade(query);
  const requirement = extractGeographyRequirement(query);
  // TH-DISCOVERY-RESET-001 (production certification fix): a generic mention of "contractor(s)"
  // with no specific trade word ("contractors in Miami") used to require clarification before
  // ever showing a result, even though real, browseable evidence exists under 'general' (building
  // contractor) for states that actually publish that class. Only default when the resolved
  // state's own capability config says so (generalClassAvailable) -- New Jersey, for one, has no
  // statewide General contractor license class at all (contractor-v2.ts already rejects a NJ
  // 'general' request with `no_new_jersey_statewide_general_contractor_class`), so defaulting
  // there would misrepresent what was actually searched rather than fix anything.
  const preliminaryState = requirement?.requestedState ?? findState(query);
  const defaultedToGeneral =
    !explicitTrade &&
    overrides.trade !== "-" &&
    mentionsGenericContractor(query) &&
    Boolean(preliminaryState && getExecutionCapability(preliminaryState)?.generalClassAvailable);
  const trade = explicitTrade ?? (defaultedToGeneral ? "general" : null);
  const geographyRequirement = decideGeography(requirement, trade, overrides);
  const effective = geographyRequirement?.executionGeography;
  const geo = {
    state: effective?.state ?? requirement?.requestedState ?? findState(query),
    county: effective
      ? (effective.county ?? null)
      : (requirement?.requestedCounty ?? null),
    city: effective
      ? (effective.city ?? null)
      : (requirement?.requestedCity ?? null),
  };
  const serviceTerritory =
    /\bserv(?:e|es|ing)\b|\bwork(?:s|ing)?\s+in\b|\bavailable\s+in\b|\bnear\s+me\b/i.test(
      query,
    );
  const contractorLanguage =
    /\bcontractor(?:s)?\b|\broof(?:er|ers|ing)\b|\bhvacr?\b|\bplumb(?:er|ers|ing)\b|\belectric(?:al|ian|ians)\b|\blocksmiths?\b/i.test(
      query,
    );
  const hasGeography = Boolean(
    requirement || geo.state || geo.county || geo.city,
  );
  if (!contractorLanguage && !trade)
    return {
      mode: "clarification",
      originalQuery: query,
      reason: "identity_or_discovery",
    };
  if (!hasGeography && !serviceTerritory)
    return {
      mode: "clarification",
      originalQuery: query,
      reason: "identity_or_discovery",
    };

  const geographyIntent = serviceTerritory
    ? "SERVICE_TERRITORY"
    : "RECORDED_CREDENTIAL_GEOGRAPHY";
  const request: ContractorExecutionRequest = {
    contract: "trusthub-specialist-execution-v2",
    queryType: "cohort",
    state: geo.state ?? undefined,
    trade: trade ?? undefined,
    geography: {
      stateCode: geo.state ?? undefined,
      county: geo.county ?? undefined,
      city: geo.city ?? undefined,
      intent: geographyIntent,
    },
    credentialStatus: overrides.status==="-"?"all": ["active_current", "expired", "all"].includes(
      overrides.status ?? "",
    )
      ? (overrides.status as "active_current" | "expired" | "all")
      : /\bexpired\b/i.test(query)
        ? "expired"
        : "active_current",
    page: 1,
    limit: 24,
  };
  return {
    mode: "discovery",
    originalQuery: query,
    request,
    geographyRequirement,
    interpretation: {
      trade,
      state: geo.state,
      county: geo.county,
      city: geo.city,
      geographyIntent,
    },
  };
}

export function isDiscoveryQuery(raw: string): boolean {
  return planContractorSearch(raw).mode === "discovery";
}
