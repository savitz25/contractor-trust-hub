/**
 * Shared enriched-profile predicate.
 *
 * The sitemap query and the profile page both use this module. A profile is
 * enriched when at least one public signal below is present. A DBPR license,
 * a Sunbiz link, an empty discipline line, or template copy is not a signal.
 *
 * Signal 6 (an active business-managed profile with business-supplied content)
 * is `businessManagedSignal`. Ask owns that store, so the SQL predicate does
 * not reference a table that is not in this database. Callers that already
 * hold that profile fold the signal in with `withBusinessManagedSignal`.
 *
 * The per-contractor EXISTS predicate is the definition. It is too slow to run
 * across the sitemap population inside the 8 second statement timeout, so
 * sitemap reads and profile robots read `contractor_profile_enrichment`.
 * `profileEnrichmentRefreshSelectSql` rebuilds that table from this predicate.
 */
import { shapeEnrichment, type EnrichmentRow } from "./enrichment-shape";
import { isOshaProfileEnabled, oshaPublishedStates } from "@/lib/osha/flag";
import { PUBLIC_REGULATORY_SQL } from "@/lib/regulatory/publication";

export const PROFILE_ENRICHMENT_SIGNALS = [
  "business_contact",
  "public_contact",
  "confirmed_permit",
  "osha",
  "discipline",
  "business_managed",
] as const;

export type ProfileEnrichmentSignal = (typeof PROFILE_ENRICHMENT_SIGNALS)[number];

export type ProfileEnrichment = {
  enriched: boolean;
  signals: ProfileEnrichmentSignal[];
  contentChangedAt: string | null;
};

const PLACEHOLDER = /^(n\/?a|none|unknown|null|undefined|-+)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same visible-row rule the Business contact and services section renders. */
export function enrichmentObservationIsVisible(row: EnrichmentRow): boolean {
  return shapeEnrichment([row]) != null;
}

/**
 * SQL twin of `enrichmentObservationIsVisible` for alias `e`.
 * `shapeEnrichment` does not consult review_flags or confidence.
 */
export const VISIBLE_ENRICHMENT_OBSERVATION_SQL = `
e.contractor_id = c.id
AND e.is_suppressed = FALSE
AND e.field IN ('website', 'phone', 'email', 'specialty', 'address_location')
AND length(btrim(e.value)) > 0
AND btrim(regexp_replace(e.value, '\\s+', ' ', 'g')) !~* '^(n/?a|none|unknown|null|undefined|-+)$'
AND (
  (e.field = 'website' AND btrim(e.value) ~* '^https?://[^[:space:]]+$')
  OR (
    e.field = 'email'
    AND btrim(regexp_replace(e.value, '\\s+', ' ', 'g')) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  )
  OR e.field IN ('phone', 'specialty', 'address_location')
)
`.trim();

export function businessContactExistsSql(): string {
  return `EXISTS (
    SELECT 1 FROM contractor_enrichment_observations e
    WHERE ${VISIBLE_ENRICHMENT_OBSERVATION_SQL}
  )`;
}

export function publicContactExistsSql(): string {
  return `EXISTS (
    SELECT 1
    FROM licenses l_contact
    JOIN public_contact_observations p
      ON p.attributed_license_id = l_contact.id
    WHERE l_contact.contractor_id = c.id
  )`;
}

export function confirmedPermitExistsSql(): string {
  return `(
    EXISTS (
      SELECT 1
      FROM licenses l_permit
      JOIN permit_attributions a
        ON a.matched_license_id = l_permit.id
      WHERE l_permit.contractor_id = c.id
        AND a.identity_state = 'CONFIRMED'
    )
    OR EXISTS (
      SELECT 1
      FROM permit_attributions a
      WHERE a.matched_contractor_id = c.id
        AND a.identity_state = 'CONFIRMED'
    )
  )`;
}

/** Hold, withheld, and publication-gate filters for discipline alias `d`. */
export const RENDERED_DISCIPLINE_PREDICATE_SQL = `
COALESCE(d.correction_hold, FALSE) = FALSE
AND COALESCE(d.retraction_hold, FALSE) = FALSE
AND d.publication_state IS DISTINCT FROM 'WITHHELD'
AND ${PUBLIC_REGULATORY_SQL}
`.trim();

/** Public discipline the profile renders. Alias `d`. `contractorIdExpr` is `c.id` or `$1`. */
export function renderedDisciplineSql(contractorIdExpr: string): string {
  return `(
    (
      d.contractor_id = ${contractorIdExpr}
      OR EXISTS (
        SELECT 1 FROM licenses l_disc
        WHERE l_disc.id = d.license_id
          AND l_disc.contractor_id = ${contractorIdExpr}
      )
    )
    AND ${RENDERED_DISCIPLINE_PREDICATE_SQL}
  )`;
}

export function disciplineExistsSql(): string {
  return `EXISTS (
    SELECT 1 FROM discipline_actions d
    WHERE ${renderedDisciplineSql("c.id")}
  )`;
}

function sqlStateList(states: readonly string[]): string {
  const safe = states.filter((state) => /^[A-Z]{2}$/.test(state));
  if (safe.length === 0) return "FALSE";
  return `btrim(o.state) IN (${safe.map((state) => `'${state}'`).join(", ")})`;
}

/** Present only when the OSHA profile section is enabled. */
export function oshaExistsSql(states: readonly string[] = oshaPublishedStates()): string {
  return `EXISTS (
    SELECT 1 FROM contractor_osha_license_matches o
    WHERE o.contractor_id = c.id
      AND o.match_tier IN ('exact', 'strong')
      AND ${sqlStateList(states)}
      AND EXISTS (
        SELECT 1 FROM licenses l_osha
        WHERE l_osha.contractor_id = c.id
          AND l_osha.external_key = o.license_key
      )
  )`;
}

export type EnrichmentSqlOptions = {
  oshaEnabled?: boolean;
  oshaStates?: readonly string[];
};

/** Set-based predicate. Alias the contractor row as `c`. No bind parameters. */
export function enrichedProfileSql(options: EnrichmentSqlOptions = {}): string {
  const oshaEnabled = options.oshaEnabled ?? isOshaProfileEnabled();
  const parts = [
    businessContactExistsSql(),
    publicContactExistsSql(),
    confirmedPermitExistsSql(),
    disciplineExistsSql(),
  ];
  if (oshaEnabled) parts.push(oshaExistsSql(options.oshaStates));
  return `(${parts.join("\n    OR ")})`;
}

/** Default-env predicate. Request paths call `enrichedProfileSql()` so the OSHA flag matches the page. */
export const ENRICHED_PROFILE_SQL = enrichedProfileSql();

function contentTimestampBranches(options: EnrichmentSqlOptions = {}): string[] {
  const branches = [
    `SELECT e.loaded_at AS evidence_at
     FROM contractor_enrichment_observations e
     WHERE ${VISIBLE_ENRICHMENT_OBSERVATION_SQL}`,
    `SELECT a.updated_at
     FROM permit_attributions a
     WHERE a.identity_state = 'CONFIRMED'
       AND (
         a.matched_contractor_id = c.id
         OR a.matched_license_id IN (
           SELECT l_permit_ts.id FROM licenses l_permit_ts WHERE l_permit_ts.contractor_id = c.id
         )
       )`,
    `SELECT d.updated_at
     FROM discipline_actions d
     WHERE ${renderedDisciplineSql("c.id")}`,
    `SELECT l_license_ts.last_verified_at
     FROM licenses l_license_ts
     WHERE l_license_ts.contractor_id = c.id`,
  ];
  if (options.oshaEnabled ?? isOshaProfileEnabled()) {
    branches.push(
      `SELECT o.updated_at
       FROM contractor_osha_license_matches o
       WHERE o.contractor_id = c.id
         AND o.match_tier IN ('exact', 'strong')
         AND ${sqlStateList(options.oshaStates ?? oshaPublishedStates())}
         AND EXISTS (
           SELECT 1 FROM licenses l_osha_ts
           WHERE l_osha_ts.contractor_id = c.id
             AND l_osha_ts.external_key = o.license_key
         )`,
    );
  }
  return branches;
}

/**
 * Max timestamp of contributing evidence. License material change is
 * `licenses.last_verified_at`. This expression does not read `contractors.updated_at`.
 */
export function contentChangedAtSql(options: EnrichmentSqlOptions = {}): string {
  return `(
    SELECT MAX(evidence_at) FROM (
      ${contentTimestampBranches(options).join("\n      UNION ALL\n      ")}
    ) enriched_evidence
  )`;
}

export function profileEnrichmentSelectSql(options: EnrichmentSqlOptions = {}): string {
  const oshaEnabled = options.oshaEnabled ?? isOshaProfileEnabled();
  const osha = oshaEnabled ? oshaExistsSql(options.oshaStates) : "FALSE";
  return `
    SELECT
      ${businessContactExistsSql()} AS business_contact,
      ${publicContactExistsSql()} AS public_contact,
      ${confirmedPermitExistsSql()} AS confirmed_permit,
      ${osha} AS osha,
      ${disciplineExistsSql()} AS discipline,
      FALSE AS business_managed,
      ${contentChangedAtSql(options)} AS content_changed_at
    FROM contractors c
    WHERE c.id = $1::uuid
  `;
}

/** One row from the refreshed cache. A missing row is a thin profile. */
export function profileEnrichmentCacheReadSql(): string {
  return `
    SELECT enriched, signals, content_changed_at
    FROM contractor_profile_enrichment
    WHERE contractor_id = $1::uuid
  `;
}

/**
 * Sitemap page read. Eligibility columns are copied at refresh time so this
 * statement does not scan `contractors` or recompute the evidence predicate.
 */
export function enrichedSitemapPageSql(): string {
  return `
    SELECT c.contractor_id AS id, c.slug, c.content_changed_at
    FROM contractor_profile_enrichment c
    WHERE c.enriched
      AND c.is_thin_profile = FALSE
      AND c.slug IS NOT NULL
      AND c.slug <> ''
      AND (
        c.home_state = $1
        OR COALESCE(c.license_sources, ARRAY[]::text[]) && $2::text[]
      )
    ORDER BY c.slug, c.contractor_id
    LIMIT $3 OFFSET $4
  `;
}

/** Same filter as `enrichedSitemapPageSql`, for the population count. */
export function enrichedSitemapCountSql(): string {
  return `
    SELECT COUNT(*)::text AS n
    FROM contractor_profile_enrichment c
    WHERE c.enriched
      AND c.is_thin_profile = FALSE
      AND c.slug IS NOT NULL
      AND c.slug <> ''
      AND (
        c.home_state = $1
        OR COALESCE(c.license_sources, ARRAY[]::text[]) && $2::text[]
      )
  `;
}

/** Probe fragment. No UNION and no `updated_at`. */
export function enrichedSitemapProbeSql(): string {
  return `EXISTS (
    SELECT 1 FROM contractor_profile_enrichment e
    WHERE e.contractor_id = c.id AND e.enriched
  )`;
}

function visibleEnrichmentScanSql(): string {
  return VISIBLE_ENRICHMENT_OBSERVATION_SQL.replace(/e\.contractor_id\s*=\s*c\.id\s*AND\s*/i, "");
}

function enrichmentSignalRowsSql(options: EnrichmentSqlOptions = {}): string {
  const oshaEnabled = options.oshaEnabled ?? isOshaProfileEnabled();
  const rows = [
    `SELECT e.contractor_id, 'business_contact' AS signal, e.loaded_at AS evidence_at
     FROM contractor_enrichment_observations e
     WHERE ${visibleEnrichmentScanSql()}`,
    `SELECT l.contractor_id, 'public_contact', NULL::timestamptz
     FROM public_contact_observations p
     JOIN licenses l ON l.id = p.attributed_license_id`,
    `SELECT l.contractor_id, 'confirmed_permit', a.updated_at
     FROM permit_attributions a
     JOIN licenses l ON l.id = a.matched_license_id
     WHERE a.identity_state = 'CONFIRMED'`,
    `SELECT a.matched_contractor_id, 'confirmed_permit', a.updated_at
     FROM permit_attributions a
     WHERE a.identity_state = 'CONFIRMED'
       AND a.matched_contractor_id IS NOT NULL`,
    `SELECT d.contractor_id, 'discipline', d.updated_at
     FROM discipline_actions d
     WHERE d.contractor_id IS NOT NULL
       AND ${RENDERED_DISCIPLINE_PREDICATE_SQL}`,
    `SELECT l.contractor_id, 'discipline', d.updated_at
     FROM discipline_actions d
     JOIN licenses l ON l.id = d.license_id
     WHERE ${RENDERED_DISCIPLINE_PREDICATE_SQL}`,
  ];
  if (oshaEnabled) {
    rows.push(
      `SELECT o.contractor_id, 'osha', o.updated_at
       FROM contractor_osha_license_matches o
       WHERE o.match_tier IN ('exact', 'strong')
         AND ${sqlStateList(options.oshaStates ?? oshaPublishedStates())}
         AND EXISTS (
           SELECT 1 FROM licenses l_osha
           WHERE l_osha.contractor_id = o.contractor_id
             AND l_osha.external_key = o.license_key
         )`,
    );
  }
  return rows.join("\n    UNION ALL\n    ");
}

/**
 * Rows to insert into `contractor_profile_enrichment`. One pass over the
 * evidence tables. License `last_verified_at` affects only the timestamp.
 * This statement does not read `contractors.updated_at`.
 */
export function profileEnrichmentRefreshSelectSql(options: EnrichmentSqlOptions = {}): string {
  return `
    WITH signal_rows AS MATERIALIZED (
      ${enrichmentSignalRowsSql(options)}
    ),
    enriched AS MATERIALIZED (
      SELECT contractor_id,
             ARRAY_REMOVE(ARRAY[
               CASE WHEN bool_or(signal = 'business_contact') THEN 'business_contact' END,
               CASE WHEN bool_or(signal = 'public_contact') THEN 'public_contact' END,
               CASE WHEN bool_or(signal = 'confirmed_permit') THEN 'confirmed_permit' END,
               CASE WHEN bool_or(signal = 'osha') THEN 'osha' END,
               CASE WHEN bool_or(signal = 'discipline') THEN 'discipline' END
             ], NULL) AS signals,
             MAX(evidence_at) AS signal_at
      FROM signal_rows
      WHERE contractor_id IS NOT NULL
      GROUP BY contractor_id
    ),
    license_ts AS MATERIALIZED (
      SELECT l.contractor_id, MAX(l.last_verified_at) AS license_at
      FROM licenses l
      JOIN enriched e ON e.contractor_id = l.contractor_id
      GROUP BY l.contractor_id
    ),
    license_sources AS MATERIALIZED (
      SELECT l.contractor_id, array_agg(DISTINCT l.source_system) AS license_sources
      FROM licenses l
      JOIN enriched e ON e.contractor_id = l.contractor_id
      GROUP BY l.contractor_id
    )
    SELECT e.contractor_id,
           TRUE AS enriched,
           e.signals,
           (
             SELECT MAX(v) FROM (VALUES (e.signal_at), (license_ts.license_at)) AS t(v)
           ) AS content_changed_at,
           c.slug,
           NULLIF(btrim(c.home_state::text), '') AS home_state,
           c.is_thin_profile,
           COALESCE(license_sources.license_sources, ARRAY[]::text[]) AS license_sources
    FROM enriched e
    JOIN contractors c ON c.id = e.contractor_id
    LEFT JOIN license_ts ON license_ts.contractor_id = e.contractor_id
    LEFT JOIN license_sources ON license_sources.contractor_id = e.contractor_id
    WHERE c.slug IS NOT NULL
      AND c.slug <> ''
  `;
}

export function signalsFromFlags(
  flags: Partial<Record<ProfileEnrichmentSignal, boolean>>,
): Pick<ProfileEnrichment, "enriched" | "signals"> {
  const signals = PROFILE_ENRICHMENT_SIGNALS.filter((signal) => flags[signal] === true);
  return { enriched: signals.length > 0, signals };
}

export function oshaMatchRenders(input: {
  enabled: boolean;
  matchTier: string;
  state: string;
  licenseKeyMatches: boolean;
  publishedStates?: readonly string[];
}): boolean {
  if (!input.enabled || !input.licenseKeyMatches) return false;
  if (input.matchTier !== "exact" && input.matchTier !== "strong") return false;
  const states = input.publishedStates ?? ["FL", "NJ"];
  return states.includes(input.state.trim().toUpperCase());
}

export function businessManagedSignal(profile: {
  active: boolean;
  hasBusinessSuppliedContent: boolean;
} | null | undefined): boolean {
  return Boolean(profile?.active && profile.hasBusinessSuppliedContent);
}

export function withBusinessManagedSignal(
  enrichment: ProfileEnrichment,
  profile: { active: boolean; hasBusinessSuppliedContent: boolean } | null | undefined,
): ProfileEnrichment {
  if (!businessManagedSignal(profile) || enrichment.signals.includes("business_managed")) {
    return enrichment;
  }
  const signals = [...enrichment.signals, "business_managed" as const];
  return { ...enrichment, enriched: true, signals };
}

export type ProfileEnrichmentFixture = {
  observations?: ReadonlyArray<EnrichmentRow>;
  attributedPublicContact?: boolean;
  confirmedPermit?: boolean;
  oshaRendered?: boolean;
  disciplinePublic?: boolean;
  businessManaged?: { active: boolean; hasBusinessSuppliedContent: boolean } | null;
};

/** Fixture twin of the SQL predicate. Sunbiz and a bare license add no signal. */
export function resolveProfileEnrichment(fixture: ProfileEnrichmentFixture): ProfileEnrichment {
  const flags = signalsFromFlags({
    business_contact: (fixture.observations ?? []).some(enrichmentObservationIsVisible),
    public_contact: fixture.attributedPublicContact === true,
    confirmed_permit: fixture.confirmedPermit === true,
    osha: fixture.oshaRendered === true,
    discipline: fixture.disciplinePublic === true,
    business_managed: businessManagedSignal(fixture.businessManaged),
  });
  return { ...flags, contentChangedAt: null };
}

export function disciplineRowIsPublic(row: {
  sourceSystem: string;
  publicationState?: string | null;
  identityState?: string | null;
  contractorId?: string | null;
  licenseId?: string | null;
  linkedToContractor: boolean;
  correctionHold?: boolean;
  retractionHold?: boolean;
}, gateActive: boolean): boolean {
  if (!row.linkedToContractor || row.correctionHold || row.retractionHold) return false;
  if (row.publicationState === "WITHHELD") return false;
  if (row.sourceSystem === "fl_dfs") return false;
  if (row.sourceSystem === "fl_dbpr") {
    if (!gateActive) return false;
    return (
      row.publicationState === "PUBLIC_ELIGIBLE"
      && (row.identityState === "EXACT" || row.identityState === "DETERMINISTIC")
      && Boolean(row.contractorId)
      && Boolean(row.licenseId)
    );
  }
  return true;
}

export function profileIndexRobots(enriched: boolean): { index: boolean; follow: true } {
  return { index: enriched, follow: true };
}

export function enrichmentValueLooksVisible(field: string, value: string): boolean {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || PLACEHOLDER.test(cleaned)) return false;
  if (field === "website") {
    try {
      const url = new URL(cleaned);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }
  if (field === "email") return EMAIL.test(cleaned);
  return field === "phone" || field === "specialty" || field === "address_location";
}
