import { query } from "@/lib/db";
import { asLicenseStatus } from "@/lib/contractors/format";
import type { SearchResult } from "@/lib/contractors/types";
import { getStateBySlug, occupationLabel } from "@/lib/states/config";
import { PUBLIC_REGULATORY_SQL } from "@/lib/regulatory/publication";
import { occupationCodesForProject, licenseMapNotes } from "./license-map";
import { formatLocationLabel, resolvePlanLocation } from "./location";
import { getProjectType } from "./project-types";
import type {
  PlanInput,
  PlanMatchResult,
  PlanMatchedContractor,
  ProjectTypeId,
} from "./types";

const MIN_SUNBIZ_CONFIDENCE = 0.9;
const DEFAULT_LIMIT = 12;
/**
 * Prefer quality local specialty results. Do not jump statewide while we already
 * have a couple of strong local primary matches.
 */
const MIN_LOCAL_STRONG = 2;
/** Expand secondary codes only when local primary is empty (not merely thin). */
const MIN_PRIMARY_LOCAL = 1;

type LocTier = "zip" | "city" | "county" | "state";
type LocationMatchMode = "zip" | "city" | "county" | "any";

type ResolvedLoc = {
  zip: string | null;
  city: string | null;
  county: string | null;
  countyCodes: string[];
};

function mapRow(
  r: {
    id: string;
    slug: string;
    display_name: string;
    legal_name: string | null;
    dba_name: string | null;
    primary_city: string | null;
    primary_county: string | null;
    home_state: string | null;
    external_key: string | null;
    occupation_code: string | null;
    status_normalized: string | null;
    last_verified_at: Date | null;
    entity_status: string | null;
    entity_name: string | null;
    has_discipline: boolean;
    loc_tier: number;
  },
  primaryCodes: string[]
): PlanMatchedContractor {
  const base: SearchResult = {
    id: r.id,
    slug: r.slug,
    displayName: r.display_name,
    legalName: r.legal_name,
    dbaName: r.dba_name,
    city: r.primary_city,
    county: r.primary_county,
    state: r.home_state,
    primaryLicenseKey: r.external_key,
    occupationCode: r.occupation_code,
    licenseStatus: asLicenseStatus(r.status_normalized),
    entityStatus: r.entity_status,
    entityName: r.entity_name,
    hasDiscipline: r.has_discipline,
    lastVerifiedAt: r.last_verified_at ? r.last_verified_at.toISOString() : null,
  };

  const tier: LocTier =
    r.loc_tier === 0
      ? "zip"
      : r.loc_tier === 1
        ? "city"
        : r.loc_tier === 2
          ? "county"
          : "state";

  const code = (r.occupation_code || "").toUpperCase();
  const isPrimary = !!code && primaryCodes.includes(code);
  const occPlain = occupationLabel(r.occupation_code);
  const statusPlain = r.status_normalized
    ? r.status_normalized.charAt(0).toUpperCase() + r.status_normalized.slice(1)
    : null;

  const reasons: string[] = [];
  if (code) {
    reasons.push(
      isPrimary
        ? `${occPlain} (${code}) — preferred class for this project type`
        : `${occPlain} (${code}) — related class used only when preferred classes are scarce`
    );
  }
  if (statusPlain) {
    reasons.push(`License status: ${statusPlain} in Florida DBPR board extract`);
  }
  if (tier === "zip") reasons.push("Location: board ZIP matches the project ZIP");
  else if (tier === "city") reasons.push("Location: board city matches the project city");
  else if (tier === "county")
    reasons.push("Location: board county matches the project area (wider than ZIP)");
  else reasons.push("Location: statewide listing — weaker than a local address match");

  if (r.entity_status) {
    reasons.push(`Sunbiz entity ${r.entity_status} (high-confidence link only)`);
  }

  const locationChip =
    tier === "zip"
      ? "ZIP match"
      : tier === "city"
        ? "City match"
        : tier === "county"
          ? "County match"
          : "Statewide";

  const matchChips = [
    code ? `${code}${isPrimary ? " · preferred" : " · related"}` : "License class",
    locationChip,
    statusPlain || "Status on file",
  ];

  return {
    ...base,
    matchReasons: reasons,
    locationTier: tier,
    matchChips,
    matchFit: isPrimary ? "preferred" : "related",
  };
}

export type MatchOptions = {
  primaryOccupationCodes?: string[];
  secondaryOccupationCodes?: string[];
  minPrimaryResults?: number;
  strictMatching?: boolean;
  matchWhy?: string;
};

function projectEmptyHint(projectType: ProjectTypeId): string {
  switch (projectType) {
    case "roofing":
      return "We only show certified or registered roofing licenses (CCC / RC) — not general contractors as roofing substitutes. RR is registered residential, not roofing.";
    case "kitchen_remodel":
      return "We look for residential and building contractor licenses that typically coordinate kitchen remodels.";
    case "bathroom_remodel":
      return "We look for residential remodel and plumbing licenses suited to bathroom work.";
    case "general_contracting":
    case "full_home_renovation":
    case "addition":
      return "We look for residential, building, and general contractor licenses for whole-home style work.";
    default:
      return "We only show active licenses in the classes mapped to this project type.";
  }
}

/**
 * Match verified contractors for a project plan.
 * Accuracy over volume: ZIP-first location cascade, primary specialty first, honest statewide fallback.
 * Studios may override occupation codes via MatchOptions.
 */
export async function matchContractorsForPlan(
  input: PlanInput,
  options: MatchOptions = {}
): Promise<PlanMatchResult> {
  const state = getStateBySlug((input.state || "fl").toLowerCase());
  if (!state || !state.live) {
    return {
      contractors: [],
      matchNotes: ["Verification data is currently available for Florida only."],
      locationLabel: formatLocationLabel(input),
      emptyReason: "State not available for matching yet.",
      locationScope: "none",
      localCount: 0,
      thinResult: true,
    };
  }

  const project = getProjectType(input.projectType);
  const mapped = occupationCodesForProject(input.projectType);
  const primary = (
    options.primaryOccupationCodes?.length
      ? options.primaryOccupationCodes
      : mapped.primary
  ).map((c) => c.toUpperCase());
  const secondary = (
    options.secondaryOccupationCodes !== undefined
      ? options.secondaryOccupationCodes
      : mapped.secondary
  ).map((c) => c.toUpperCase());
  const codes = {
    primary,
    secondary: options.strictMatching
      ? secondary
      : secondary.filter((c) => !primary.includes(c)),
    all: [
      ...primary,
      ...secondary.filter((c) => !primary.includes(c)),
    ],
  };
  const minPrimaryLocal = options.minPrimaryResults ?? MIN_PRIMARY_LOCAL;

  const loc = resolvePlanLocation({
    zip: input.zip,
    city: input.city,
    county: input.county,
  });

  const locationLabel = formatLocationLabel({
    city: loc.city,
    county: loc.county,
    zip: loc.zip,
    state: state.code,
  });

  const matchNotes: string[] = [
    `Preferring active/current ${codes.primary.join(" / ")} licenses for ${project.label} (order = best fit first).`,
    options.matchWhy || licenseMapNotes(input.projectType),
    "Ordered by location tightness, then license-class fit — not ratings, reviews, or paid placement.",
  ];

  if (loc.countySource === "zip5") {
    matchNotes.push(`County inferred from ZIP ${loc.zip} (high-confidence ZIP map).`);
  } else if (loc.countySource === "zip3") {
    matchNotes.push(
      `County inferred from ZIP prefix ${loc.zip?.slice(0, 3)} (approximate — multi-county prefixes exist).`
    );
  }

  const hasLocation = !!(loc.zip || loc.city || loc.county);
  const resolved: ResolvedLoc = {
    zip: loc.zip,
    city: loc.city,
    county: loc.county,
    countyCodes: loc.countyCodes || [],
  };

  try {
    let contractors: PlanMatchedContractor[] = [];
    let locationScope: PlanMatchResult["locationScope"] = "none";

    if (!hasLocation) {
      matchNotes.push(
        "No ZIP or city provided — results are statewide for the preferred license classes only."
      );
      contractors = await queryContractors({
        licenseSource: state.licenseSource,
        entitySource: state.entitySource,
        stateCode: state.code,
        occupationCodes: codes.primary,
        primaryCodes: codes.primary,
        location: null,
        locationMatch: "any",
        requireLocation: false,
        limit: DEFAULT_LIMIT,
      });
      locationScope = "statewide";
    } else {
      // ZIP → city → county cascade for primary classes (do not OR everything immediately)
      let localPrimary: PlanMatchedContractor[] = [];
      const cascadeSteps: string[] = [];

      if (resolved.zip) {
        localPrimary = await queryContractors({
          licenseSource: state.licenseSource,
          entitySource: state.entitySource,
          stateCode: state.code,
          occupationCodes: codes.primary,
          primaryCodes: codes.primary,
          location: resolved,
          locationMatch: "zip",
          requireLocation: true,
          limit: DEFAULT_LIMIT,
        });
        if (localPrimary.length > 0) cascadeSteps.push(`ZIP ${resolved.zip}`);
      }

      if (localPrimary.length < MIN_LOCAL_STRONG && resolved.city) {
        const cityHits = await queryContractors({
          licenseSource: state.licenseSource,
          entitySource: state.entitySource,
          stateCode: state.code,
          occupationCodes: codes.primary,
          primaryCodes: codes.primary,
          location: resolved,
          locationMatch: "city",
          requireLocation: true,
          limit: DEFAULT_LIMIT,
        });
        const before = localPrimary.length;
        localPrimary = mergeUnique(localPrimary, cityHits, DEFAULT_LIMIT);
        if (localPrimary.length > before) cascadeSteps.push(`city ${resolved.city}`);
      }

      if (
        localPrimary.length < MIN_LOCAL_STRONG &&
        (resolved.county || resolved.countyCodes.length > 0)
      ) {
        const countyHits = await queryContractors({
          licenseSource: state.licenseSource,
          entitySource: state.entitySource,
          stateCode: state.code,
          occupationCodes: codes.primary,
          primaryCodes: codes.primary,
          location: resolved,
          locationMatch: "county",
          requireLocation: true,
          limit: DEFAULT_LIMIT,
        });
        const before = localPrimary.length;
        localPrimary = mergeUnique(localPrimary, countyHits, DEFAULT_LIMIT);
        if (localPrimary.length > before) {
          cascadeSteps.push(
            resolved.county ? `county ${resolved.county}` : "county (code match)"
          );
        }
      }

      // Last local attempt: full local OR (zip/city/county) if cascade still empty
      // (handles sparse ZIP fill with county on different field combinations)
      if (localPrimary.length === 0) {
        localPrimary = await queryContractors({
          licenseSource: state.licenseSource,
          entitySource: state.entitySource,
          stateCode: state.code,
          occupationCodes: codes.primary,
          primaryCodes: codes.primary,
          location: resolved,
          locationMatch: "any",
          requireLocation: true,
          limit: DEFAULT_LIMIT,
        });
        if (localPrimary.length > 0) cascadeSteps.push("combined local fields");
      }

      if (cascadeSteps.length > 0) {
        matchNotes.push(`Location cascade used: ${cascadeSteps.join(" > ")}.`);
      }

      let localAll = localPrimary;
      // Secondary: empty preferred local, or thin local unless strictMatching with some hits
      if (
        localPrimary.length < minPrimaryLocal &&
        codes.secondary.length > 0 &&
        !(options.strictMatching && localPrimary.length > 0)
      ) {
        matchNotes.push(
          `No local ${codes.primary.join("/")} matches — including related classes ${codes.secondary.join(" / ")} in the same area only.`
        );
        const withSecondary = await queryContractors({
          licenseSource: state.licenseSource,
          entitySource: state.entitySource,
          stateCode: state.code,
          occupationCodes: codes.all,
          primaryCodes: codes.primary,
          location: resolved,
          locationMatch: "any",
          requireLocation: true,
          limit: DEFAULT_LIMIT,
        });
        localAll = mergeUnique(localPrimary, withSecondary, DEFAULT_LIMIT);
      }

      const localCount = localAll.filter((c) => c.locationTier !== "state").length;
      contractors = localAll;
      locationScope = localCount > 0 ? "local" : "none";

      // Statewide only if local is still thin — same preferred classes only
      if (localCount < MIN_LOCAL_STRONG) {
        const need = Math.max(DEFAULT_LIMIT - contractors.length, 0);
        if (need > 0 || localCount === 0) {
          matchNotes.push(
            localCount === 0
              ? "No strong location matches for preferred license classes — showing statewide results with the same classes only."
              : `Only ${localCount} strong local match${localCount === 1 ? "" : "es"} — adding statewide options for the same preferred classes (not unrelated trades).`
          );
          const statewide = await queryContractors({
            licenseSource: state.licenseSource,
            entitySource: state.entitySource,
            stateCode: state.code,
            occupationCodes: codes.primary,
            primaryCodes: codes.primary,
            location: null,
            locationMatch: "any",
            requireLocation: false,
            limit: Math.max(need, DEFAULT_LIMIT),
          });
          const seen = new Set(contractors.map((c) => c.id));
          const extra = statewide
            .filter((c) => !seen.has(c.id))
            .map((c) => ({
              ...c,
              locationTier: "state" as const,
              matchFit: c.matchFit,
              matchChips: (c.matchChips || []).map((chip) =>
                chip === "ZIP match" || chip === "City match" || chip === "County match"
                  ? "Statewide"
                  : chip
              ),
              matchReasons: c.matchReasons.map((reason) =>
                reason.startsWith("Location:")
                  ? "Location: statewide fallback (weaker than ZIP/city/county match)"
                  : reason
              ),
            }));
          contractors = [...contractors, ...extra].slice(0, DEFAULT_LIMIT);
          locationScope = localCount > 0 ? "regional" : "statewide";
        }
      }
    }

    contractors = sortMatched(contractors, codes.primary).slice(0, DEFAULT_LIMIT);

    const thinResult =
      contractors.length === 0 ||
      (hasLocation &&
        contractors.filter((c) => c.locationTier !== "state").length < MIN_LOCAL_STRONG);

    if (contractors.length === 0) {
      return {
        contractors: [],
        matchNotes,
        locationLabel,
        emptyReason:
          "No active/current licenses in our extract for this project type" +
          (hasLocation ? " near that location" : "") +
          ". " +
          projectEmptyHint(input.projectType) +
          " Try a nearby ZIP, browse Florida by trade, or Verify search by name.",
        locationScope: "none",
        localCount: 0,
        thinResult: true,
      };
    }

    if (thinResult && hasLocation) {
      matchNotes.push(
        "Local coverage is thin for this combination — treat statewide listings carefully and confirm address and license class on each Trust Report."
      );
      matchNotes.push(projectEmptyHint(input.projectType));
    }

    return {
      contractors,
      matchNotes,
      locationLabel,
      locationScope,
      localCount: contractors.filter((c) => c.locationTier !== "state").length,
      thinResult,
    };
  } catch (e) {
    console.error("[plan/match]", e);
    return {
      contractors: [],
      matchNotes: [
        ...matchNotes,
        "Matching temporarily unavailable (database connection). You can still use Verify search.",
      ],
      locationLabel,
      emptyReason:
        "We could not query contractor records right now. Try again shortly or use Verify.",
      locationScope: "none",
      localCount: 0,
      thinResult: true,
    };
  }
}

function mergeUnique(
  a: PlanMatchedContractor[],
  b: PlanMatchedContractor[],
  limit: number
): PlanMatchedContractor[] {
  const seen = new Set<string>();
  const out: PlanMatchedContractor[] = [];
  for (const row of [...a, ...b]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function sortMatched(
  rows: PlanMatchedContractor[],
  primaryCodes: string[]
): PlanMatchedContractor[] {
  const tierOrder: Record<LocTier, number> = {
    zip: 0,
    city: 1,
    county: 2,
    state: 3,
  };
  return [...rows].sort((a, b) => {
    const ta = tierOrder[a.locationTier] ?? 9;
    const tb = tierOrder[b.locationTier] ?? 9;
    if (ta !== tb) return ta - tb;
    const pa = a.occupationCode && primaryCodes.includes(a.occupationCode.toUpperCase()) ? 0 : 1;
    const pb = b.occupationCode && primaryCodes.includes(b.occupationCode.toUpperCase()) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const oa = a.occupationCode
      ? primaryCodes.indexOf(a.occupationCode.toUpperCase())
      : 99;
    const ob = b.occupationCode
      ? primaryCodes.indexOf(b.occupationCode.toUpperCase())
      : 99;
    const ra = oa === -1 ? 50 : oa;
    const rb = ob === -1 ? 50 : ob;
    if (ra !== rb) return ra - rb;
    return (a.displayName || "").localeCompare(b.displayName || "");
  });
}

async function queryContractors(opts: {
  licenseSource: string;
  entitySource: string;
  stateCode: string;
  occupationCodes: string[];
  /** True primary codes for labeling (may be subset of occupationCodes). */
  primaryCodes: string[];
  location: ResolvedLoc | null;
  locationMatch: LocationMatchMode;
  requireLocation: boolean;
  limit: number;
}): Promise<PlanMatchedContractor[]> {
  if (opts.occupationCodes.length === 0) return [];

  const params: unknown[] = [
    opts.licenseSource,
    opts.stateCode,
    opts.entitySource,
    MIN_SUNBIZ_CONFIDENCE,
    opts.occupationCodes,
  ];

  let where = `
    l.source_system = $1
    AND c.is_thin_profile = FALSE
    AND (c.home_state = $2 OR l.state = $2)
    AND l.occupation_code = ANY($5::text[])
    AND l.status_normalized IN ('active', 'current')
  `;

  const zipPreds: string[] = [];
  const cityPreds: string[] = [];
  const countyPreds: string[] = [];

  if (opts.location?.zip) {
    params.push(opts.location.zip);
    const i = params.length;
    zipPreds.push(`LEFT(TRIM(COALESCE(l.postal_code, '')), 5) = $${i}`);
  }

  if (opts.location?.city) {
    params.push(opts.location.city.toLowerCase());
    const i = params.length;
    cityPreds.push(`LOWER(TRIM(COALESCE(l.city, ''))) = $${i}`);
    cityPreds.push(`LOWER(TRIM(COALESCE(c.primary_city, ''))) = $${i}`);
  }

  if (opts.location?.county) {
    params.push(opts.location.county.toLowerCase());
    const i = params.length;
    countyPreds.push(`LOWER(TRIM(COALESCE(l.county_name, ''))) = $${i}`);
    countyPreds.push(`LOWER(TRIM(COALESCE(c.primary_county, ''))) = $${i}`);
    countyPreds.push(
      `LOWER(REPLACE(TRIM(COALESCE(l.county_name, '')), ' ', '-')) = REPLACE($${i}, ' ', '-')`
    );
    countyPreds.push(
      `LOWER(REPLACE(TRIM(COALESCE(c.primary_county, '')), ' ', '-')) = REPLACE($${i}, ' ', '-')`
    );
  }

  for (const code of opts.location?.countyCodes || []) {
    params.push(code);
    const i = params.length;
    countyPreds.push(`TRIM(COALESCE(l.county_code, '')) = $${i}`);
  }

  const mode = opts.locationMatch;
  const activePreds =
    mode === "zip"
      ? zipPreds
      : mode === "city"
        ? cityPreds
        : mode === "county"
          ? countyPreds
          : [...zipPreds, ...cityPreds, ...countyPreds];

  if (opts.requireLocation) {
    if (activePreds.length === 0) return [];
    where += ` AND (${activePreds.join(" OR ")})`;
  }

  // Tier ranking always uses the most precise available signal among matched fields
  const locTierSql = `
    CASE
      WHEN ${zipPreds.length ? `(${zipPreds.join(" OR ")})` : "FALSE"} THEN 0
      WHEN ${cityPreds.length ? `(${cityPreds.join(" OR ")})` : "FALSE"} THEN 1
      WHEN ${countyPreds.length ? `(${countyPreds.join(" OR ")})` : "FALSE"} THEN 2
      ELSE 3
    END
  `;

  const occOrderCases = opts.occupationCodes
    .map((code, idx) => {
      params.push(code);
      const p = params.length;
      return `WHEN l.occupation_code = $${p} THEN ${idx}`;
    })
    .join(" ");

  // Prefer true primary codes even when secondary is in the query set
  const primaryRankSql =
    opts.primaryCodes.length > 0
      ? `CASE l.occupation_code ${opts.primaryCodes
          .map((code, idx) => {
            params.push(code);
            const p = params.length;
            return `WHEN l.occupation_code = $${p} THEN ${idx}`;
          })
          .join(" ")} ELSE 50 END`
      : "50";

  const occRankSql =
    opts.occupationCodes.length > 0
      ? `CASE l.occupation_code ${occOrderCases} ELSE 50 END`
      : "50";

  params.push(opts.limit);
  const limitParam = params.length;

  const rows = await query<{
    id: string;
    slug: string;
    display_name: string;
    legal_name: string | null;
    dba_name: string | null;
    primary_city: string | null;
    primary_county: string | null;
    home_state: string | null;
    external_key: string | null;
    occupation_code: string | null;
    status_normalized: string | null;
    last_verified_at: Date | null;
    entity_status: string | null;
    entity_name: string | null;
    has_discipline: boolean;
    loc_tier: number;
  }>(
    `
    SELECT * FROM (
      SELECT DISTINCT ON (c.id)
        c.id,
        c.slug,
        c.display_name,
        c.legal_name,
        c.dba_name,
        c.primary_city,
        c.primary_county,
        c.home_state,
        l.external_key,
        l.occupation_code,
        l.status_normalized,
        l.last_verified_at,
        e.status AS entity_status,
        e.legal_name AS entity_name,
        EXISTS (
          SELECT 1 FROM discipline_actions d
          WHERE d.contractor_id = c.id AND ${PUBLIC_REGULATORY_SQL}
        ) AS has_discipline,
        (${locTierSql})::int AS loc_tier,
        (${primaryRankSql})::int AS primary_rank,
        (${occRankSql})::int AS occ_rank
      FROM licenses l
      JOIN contractors c ON c.id = l.contractor_id
      LEFT JOIN LATERAL (
        SELECT ent.status, ent.legal_name
        FROM contractor_entities ce
        JOIN entities ent ON ent.id = ce.entity_id
        WHERE ce.contractor_id = c.id
          AND ce.role = 'sunbiz_entity'
          AND ent.source_system = $3
          AND ce.confidence IS NOT NULL
          AND ce.confidence >= $4
        ORDER BY ce.confidence DESC NULLS LAST
        LIMIT 1
      ) e ON TRUE
      WHERE ${where}
      ORDER BY
        c.id,
        (${locTierSql}) ASC,
        (${primaryRankSql}) ASC,
        (${occRankSql}) ASC,
        CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
        CASE WHEN e.status IS NOT NULL THEN 0 ELSE 1 END,
        c.display_name
    ) sub
    ORDER BY loc_tier ASC, primary_rank ASC, occ_rank ASC, display_name ASC
    LIMIT $${limitParam}
    `,
    params
  );

  return rows.map((r) => mapRow(r, opts.primaryCodes));
}
