import { query } from "@/lib/db";
import { asLicenseStatus } from "@/lib/contractors/format";
import type { SearchResult } from "@/lib/contractors/types";
import { getStateBySlug } from "@/lib/states/config";
import { occupationCodesForProject, licenseMapNotes } from "./license-map";
import { formatLocationLabel, resolvePlanLocation } from "./location";
import { getProjectType } from "./project-types";
import type { PlanInput, PlanMatchResult, PlanMatchedContractor } from "./types";

const MIN_SUNBIZ_CONFIDENCE = 0.9;
const DEFAULT_LIMIT = 12;
/** Prefer local specialty results; only broaden when below this count. */
const MIN_LOCAL_STRONG = 3;
const MIN_PRIMARY_LOCAL = 2;

type LocTier = "zip" | "city" | "county" | "state";

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

  const reasons: string[] = [];
  if (r.occupation_code) {
    const isPrimary = primaryCodes.includes(r.occupation_code.toUpperCase());
    reasons.push(
      isPrimary
        ? `License class ${r.occupation_code} (primary for this project type)`
        : `License class ${r.occupation_code} (related / secondary for this project type)`
    );
  }
  if (r.status_normalized) {
    reasons.push(`Status ${r.status_normalized} in board extract`);
  }
  if (tier === "zip") reasons.push("Location: ZIP matches board address");
  else if (tier === "city") reasons.push("Location: city matches board address");
  else if (tier === "county") reasons.push("Location: county matches board address");
  else reasons.push("Location: statewide (no tighter local match required)");

  if (r.entity_status) {
    reasons.push(`Sunbiz entity ${r.entity_status} (high-confidence link)`);
  }

  return {
    ...base,
    matchReasons: reasons,
    locationTier: tier,
  };
}

export type MatchOptions = {
  primaryOccupationCodes?: string[];
  secondaryOccupationCodes?: string[];
  minPrimaryResults?: number;
  strictMatching?: boolean;
  matchWhy?: string;
};

/**
 * Match verified contractors for a project plan.
 * Accuracy over volume: tiered location, primary specialty first, honest statewide fallback.
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
    `Preferring active/current ${codes.primary.join(" / ")} licenses for ${project.label}.`,
    options.matchWhy || licenseMapNotes(input.projectType),
    "Ordered by location relevance and license class fit — not ratings, reviews, or paid placement.",
  ];

  if (loc.countySource === "zip5") {
    matchNotes.push(`County inferred from ZIP ${loc.zip} (high-confidence ZIP map).`);
  } else if (loc.countySource === "zip3") {
    matchNotes.push(
      `County inferred from ZIP prefix ${loc.zip?.slice(0, 3)} (approximate ΓÇö multi-county prefixes exist).`
    );
  }

  const hasLocation = !!(loc.zip || loc.city || loc.county);

  try {
    let contractors: PlanMatchedContractor[] = [];
    let locationScope: PlanMatchResult["locationScope"] = "none";

    if (!hasLocation) {
      matchNotes.push(
        "No ZIP or city provided ΓÇö results are statewide for the relevant license classes only."
      );
      contractors = await queryContractors({
        licenseSource: state.licenseSource,
        entitySource: state.entitySource,
        stateCode: state.code,
        occupationCodes: codes.primary,
        location: null,
        requireLocation: false,
        limit: DEFAULT_LIMIT,
      });
      locationScope = "statewide";
    } else {
      // 1) Local + primary specialty only
      let localPrimary = await queryContractors({
        licenseSource: state.licenseSource,
        entitySource: state.entitySource,
        stateCode: state.code,
        occupationCodes: codes.primary,
        location: loc,
        requireLocation: true,
        limit: DEFAULT_LIMIT,
      });

      // 2) If thin local primary, allow secondary codes still local
      let localAll = localPrimary;
      if (
        localPrimary.length < minPrimaryLocal &&
        codes.secondary.length > 0 &&
        !(options.strictMatching && localPrimary.length > 0)
      ) {
        matchNotes.push(
          `Few local ${codes.primary.join("/")} licenses ΓÇö also including related classes ${codes.secondary.join(" / ")} in the same area.`
        );
        const withSecondary = await queryContractors({
          licenseSource: state.licenseSource,
          entitySource: state.entitySource,
          stateCode: state.code,
          occupationCodes: codes.all,
          location: loc,
          requireLocation: true,
          limit: DEFAULT_LIMIT,
        });
        localAll = mergeUnique(localPrimary, withSecondary, DEFAULT_LIMIT);
      }

      const localCount = localAll.filter((c) => c.locationTier !== "state").length;
      contractors = localAll;
      locationScope = localCount > 0 ? "local" : "none";

      // 3) Statewide only if local is thin ΓÇö never invent unrelated trades
      if (localCount < MIN_LOCAL_STRONG) {
        const need = Math.max(DEFAULT_LIMIT - contractors.length, 0);
        if (need > 0 || localCount === 0) {
          matchNotes.push(
            localCount === 0
              ? "No strong location matches for this trade ΓÇö showing statewide results with the same license classes only."
              : `Only ${localCount} strong local match${localCount === 1 ? "" : "es"} ΓÇö adding statewide options for the same license classes (not unrelated trades).`
          );
          const statewide = await queryContractors({
            licenseSource: state.licenseSource,
            entitySource: state.entitySource,
            stateCode: state.code,
            occupationCodes: codes.primary.length ? codes.primary : codes.all,
            location: null,
            requireLocation: false,
            limit: Math.max(need, DEFAULT_LIMIT),
          });
          const seen = new Set(contractors.map((c) => c.id));
          const extra = statewide
            .filter((c) => !seen.has(c.id))
            .map((c) => ({
              ...c,
              locationTier: "state" as const,
              matchReasons: c.matchReasons.map((r) =>
                r.startsWith("Location:")
                  ? "Location: statewide fallback (weaker than ZIP/city/county match)"
                  : r
              ),
            }));
          contractors = [...contractors, ...extra].slice(0, DEFAULT_LIMIT);
          locationScope = localCount > 0 ? "regional" : "statewide";
        }
      }
    }

    // Re-sort: local tiers first, then primary occupation, name
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
          ". Try a broader location, another project type, or Verify search by name.",
        locationScope: "none",
        localCount: 0,
        thinResult: true,
      };
    }

    if (thinResult && hasLocation) {
      matchNotes.push(
        "Local coverage is thin for this combination ΓÇö treat statewide listings carefully and confirm address on each Trust Report."
      );
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
    return (a.displayName || "").localeCompare(b.displayName || "");
  });
}

async function queryContractors(opts: {
  licenseSource: string;
  entitySource: string;
  stateCode: string;
  occupationCodes: string[];
  location: {
    zip: string | null;
    city: string | null;
    county: string | null;
    countyCodes: string[];
  } | null;
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

  // Location tier expression parts (0=zip, 1=city, 2=county, 3=state)
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
    // Exact county name only (avoid Lee matching Leesburg)
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

  const anyLoc = [...zipPreds, ...cityPreds, ...countyPreds];
  if (opts.requireLocation) {
    if (anyLoc.length === 0) return [];
    where += ` AND (${anyLoc.join(" OR ")})`;
  }

  const locTierSql = `
    CASE
      WHEN ${zipPreds.length ? `(${zipPreds.join(" OR ")})` : "FALSE"} THEN 0
      WHEN ${cityPreds.length ? `(${cityPreds.join(" OR ")})` : "FALSE"} THEN 1
      WHEN ${countyPreds.length ? `(${countyPreds.join(" OR ")})` : "FALSE"} THEN 2
      ELSE 3
    END
  `;

  // Occupation preference among requested codes (array order)
  const occOrderCases = opts.occupationCodes
    .map((code, idx) => {
      params.push(code);
      const p = params.length;
      return `WHEN l.occupation_code = $${p} THEN ${idx}`;
    })
    .join(" ");

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
          SELECT 1 FROM discipline_actions d WHERE d.contractor_id = c.id
        ) AS has_discipline,
        (${locTierSql})::int AS loc_tier,
        CASE l.occupation_code ${occOrderCases} ELSE 50 END AS occ_rank
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
        CASE l.occupation_code ${occOrderCases} ELSE 50 END ASC,
        CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
        CASE WHEN e.status IS NOT NULL THEN 0 ELSE 1 END,
        c.display_name
    ) sub
    ORDER BY loc_tier ASC, occ_rank ASC, display_name ASC
    LIMIT $${limitParam}
    `,
    params
  );

  const primarySet = opts.occupationCodes.slice(0, 3);
  return rows.map((r) => mapRow(r, primarySet));
}
