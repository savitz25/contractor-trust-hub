import { query } from "@/lib/db";
import { asLicenseStatus } from "@/lib/contractors/format";
import type { SearchResult } from "@/lib/contractors/types";
import { getStateBySlug } from "@/lib/states/config";
import { getProjectType } from "./project-types";
import { countyFromFloridaZip, formatLocationLabel, normalizeZip } from "./location";
import type { PlanInput, PlanMatchResult } from "./types";

const MIN_SUNBIZ_CONFIDENCE = 0.9;
const DEFAULT_LIMIT = 12;

function mapRow(r: {
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
}): SearchResult {
  return {
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
}

/**
 * Match verified contractors for a project plan.
 * Prefers active licenses, relevant occupation codes, and location signals.
 * Fails openly when data is thin — no invented ratings.
 */
export async function matchContractorsForPlan(
  input: PlanInput
): Promise<PlanMatchResult> {
  const state = getStateBySlug((input.state || "fl").toLowerCase());
  if (!state || !state.live) {
    return {
      contractors: [],
      matchNotes: ["Verification data is currently available for Florida only."],
      locationLabel: formatLocationLabel(input),
      emptyReason: "State not available for matching yet.",
    };
  }

  const project = getProjectType(input.projectType);
  const zip = normalizeZip(input.zip);
  const county =
    input.county?.trim() ||
    (state.code === "FL" ? countyFromFloridaZip(zip) : null) ||
    null;
  const city = input.city?.trim() || null;

  const locationLabel = formatLocationLabel({
    city,
    county,
    zip,
    state: state.code,
  });

  const matchNotes: string[] = [
    `Matching active ${project.occupationCodes.join(" / ")} licenses where possible.`,
    "Results are ordered by license status, location relevance, and name — not ratings or reviews.",
  ];

  try {
    const rows = await queryContractors({
      licenseSource: state.licenseSource,
      entitySource: state.entitySource,
      stateCode: state.code,
      occupationCodes: project.occupationCodes,
      county,
      city,
      zip,
      limit: DEFAULT_LIMIT,
    });

    if (rows.length === 0 && (county || city || zip)) {
      // Broaden: trade + state only
      matchNotes.push(
        "Few location-specific matches — showing statewide results for this trade category."
      );
      const broader = await queryContractors({
        licenseSource: state.licenseSource,
        entitySource: state.entitySource,
        stateCode: state.code,
        occupationCodes: project.occupationCodes,
        county: null,
        city: null,
        zip: null,
        limit: DEFAULT_LIMIT,
      });
      return {
        contractors: broader,
        matchNotes,
        locationLabel,
        emptyReason:
          broader.length === 0
            ? "No contractors matched this trade in our current extract. Try Verify search or browse by county."
            : undefined,
      };
    }

    if (rows.length === 0) {
      return {
        contractors: [],
        matchNotes,
        locationLabel,
        emptyReason:
          "No matching licensed contractors found for this project type in the current extract. Use Verify search or Florida browse by county and trade.",
      };
    }

    if (!county && !city && !zip) {
      matchNotes.push(
        "No ZIP or city provided — results are statewide for the relevant license classes."
      );
    }

    return { contractors: rows, matchNotes, locationLabel };
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
    };
  }
}

async function queryContractors(opts: {
  licenseSource: string;
  entitySource: string;
  stateCode: string;
  occupationCodes: string[];
  county: string | null;
  city: string | null;
  zip: string | null;
  limit: number;
}): Promise<SearchResult[]> {
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

  // Location scoring via optional filters (prefer match, don't hard-require if empty)
  const locClauses: string[] = [];

  if (opts.county) {
    params.push(opts.county.toLowerCase());
    const i = params.length;
    locClauses.push(`LOWER(TRIM(COALESCE(l.county_name, ''))) = $${i}`);
    locClauses.push(`LOWER(TRIM(COALESCE(c.primary_county, ''))) = $${i}`);
    locClauses.push(
      `LOWER(TRIM(COALESCE(l.county_name, ''))) LIKE $${i} || '%'`
    );
    locClauses.push(
      `LOWER(TRIM(COALESCE(c.primary_county, ''))) LIKE $${i} || '%'`
    );
  }

  if (opts.city) {
    params.push(opts.city.toLowerCase());
    const i = params.length;
    locClauses.push(`LOWER(TRIM(COALESCE(l.city, ''))) = $${i}`);
    locClauses.push(`LOWER(TRIM(COALESCE(c.primary_city, ''))) = $${i}`);
    locClauses.push(`LOWER(TRIM(COALESCE(l.city, ''))) LIKE $${i} || '%'`);
    locClauses.push(
      `LOWER(TRIM(COALESCE(c.primary_city, ''))) LIKE $${i} || '%'`
    );
  }

  if (opts.zip) {
    params.push(opts.zip);
    const i = params.length;
    locClauses.push(`TRIM(COALESCE(l.postal_code, '')) = $${i}`);
    locClauses.push(`TRIM(COALESCE(l.postal_code, '')) LIKE $${i} || '%'`);
  }

  if (locClauses.length) {
    where += ` AND (${locClauses.join(" OR ")})`;
  }

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
  }>(
    `
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
      ) AS has_discipline
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
      CASE l.status_normalized WHEN 'active' THEN 0 WHEN 'current' THEN 1 ELSE 2 END,
      CASE WHEN e.status IS NOT NULL THEN 0 ELSE 1 END,
      c.display_name
    LIMIT $${limitParam}
    `,
    params
  );

  return rows.map(mapRow);
}


