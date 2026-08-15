/**
 * Florida Sunbiz entity lineage for Trust Reports.
 * Exact officer-name association only — not a fraud score or accusation.
 */

import { query } from "@/lib/db";
import { statusLabel } from "./format";
import type { EntityDetail } from "./types";

export type LineageOfficer = {
  name: string;
  title: string | null;
  /** Normalized key used for exact association */
  key: string;
};

export type LineageRelatedEntity = {
  id: string;
  documentNumber: string;
  legalName: string;
  status: string | null;
  statusLabel: string;
  entityType: string | null;
  formationDate: string | null;
  lastVerifiedAt: string | null;
  /** Officer keys that matched this entity */
  matchedOfficerKeys: string[];
  matchedOfficerNames: string[];
  sunbizSearchHref: string;
};

export type EntityLineage = {
  primary: {
    documentNumber: string;
    legalName: string;
    status: string | null;
    statusLabel: string;
    entityType: string | null;
    formationDate: string | null;
    matchMethod: string | null;
    matchConfidence: number | null;
    lastVerifiedAt: string | null;
    officers: LineageOfficer[];
    sunbizSearchHref: string;
  };
  /** Principals used for association (from primary entity officers) */
  principals: LineageOfficer[];
  related: LineageRelatedEntity[];
  evidenceNote: string;
};

/** Collapse whitespace + upper-case for exact officer keying (no fuzzy). */
export function normalizeOfficerKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toUpperCase()
    .replace(/[.,'"/\\-]/g, " ")
    .replace(/\b(JR|SR|II|III|IV|MR|MRS|MS|DR)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Officer names usable for cross-entity association.
 * Require multi-token names of reasonable length — single tokens are too weak.
 */
export function isUsableOfficerKey(key: string): boolean {
  if (key.length < 8) return false;
  const parts = key.split(" ").filter(Boolean);
  if (parts.length < 2) return false;
  // Reject keys that look like registered-agent services / entities
  if (
    /\b(LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP|PA|PLLC|SERVICES|SERVICE|AGENT|REGISTERED)\b/.test(
      key
    )
  ) {
    return false;
  }
  return parts.every((p) => p.length >= 2);
}

export function sunbizDocumentSearchHref(documentNumber: string): string {
  // Official search hub — document number is shown for the homeowner to paste/confirm.
  const q = encodeURIComponent(documentNumber.trim());
  return `https://search.sunbiz.org/Inquiry/CorporationSearch/ByName?searchTerm=${q}`;
}

export function sunbizHubHref(): string {
  return "https://dos.fl.gov/sunbiz/";
}

export function officersFromEntity(ent: EntityDetail): LineageOfficer[] {
  const out: LineageOfficer[] = [];
  const seen = new Set<string>();
  for (const o of ent.officers || []) {
    const name = (o.name || "").trim();
    const key = normalizeOfficerKey(name);
    if (!isUsableOfficerKey(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      title: o.title?.trim() || null,
      key,
    });
  }
  return out;
}

/** Principal keys from high-confidence linked entities (max 6). */
export function principalKeysFromEntities(entities: EntityDetail[]): LineageOfficer[] {
  const byKey = new Map<string, LineageOfficer>();
  for (const ent of entities) {
    for (const o of officersFromEntity(ent)) {
      if (!byKey.has(o.key)) byKey.set(o.key, o);
    }
  }
  return [...byKey.values()].slice(0, 6);
}

export function entityStatusLabel(status: string | null | undefined): string {
  if (!status) return "Status not published in extract";
  return statusLabel(status);
}

type RelatedRow = {
  id: string;
  external_key: string;
  legal_name: string;
  status: string | null;
  entity_type: string | null;
  formation_date: Date | null;
  officers: unknown;
  last_verified_at: Date | null;
  matched_key: string;
};

/**
 * Load related Sunbiz entities that publish the same exact officer keys
 * as the high-confidence linked entity on this FL profile.
 * Returns null when there is nothing reliable to show.
 */
export async function loadFloridaEntityLineage(
  entities: EntityDetail[]
): Promise<EntityLineage | null> {
  if (!entities.length) return null;

  const primary = entities[0];
  const principals = principalKeysFromEntities(entities);
  if (principals.length === 0) {
    // Still show primary entity + published officers if present (no cross-entity graph)
    const primaryOfficers = officersFromEntity(primary);
    if (primaryOfficers.length === 0 && entities.length < 2) return null;
    return {
      primary: {
        documentNumber: primary.externalKey,
        legalName: primary.legalName,
        status: primary.status,
        statusLabel: entityStatusLabel(primary.status),
        entityType: primary.entityType,
        formationDate: primary.formationDate,
        matchMethod: primary.matchMethod,
        matchConfidence: primary.matchConfidence,
        lastVerifiedAt: primary.lastVerifiedAt,
        officers: primaryOfficers,
        sunbizSearchHref: sunbizDocumentSearchHref(primary.externalKey),
      },
      principals: primaryOfficers,
      related: entities.slice(1).map((e) => ({
        id: e.id,
        documentNumber: e.externalKey,
        legalName: e.legalName,
        status: e.status,
        statusLabel: entityStatusLabel(e.status),
        entityType: e.entityType,
        formationDate: e.formationDate,
        lastVerifiedAt: e.lastVerifiedAt,
        matchedOfficerKeys: [],
        matchedOfficerNames: [],
        sunbizSearchHref: sunbizDocumentSearchHref(e.externalKey),
      })),
      evidenceNote:
        "Officers shown as published on the high-confidence Sunbiz link for this contractor. No additional entities shared those principal names in our extract under exact-name association.",
    };
  }

  const excludeIds = entities.map((e) => e.id);
  const keys = principals.map((p) => p.key);
  const keyToName = new Map(principals.map((p) => [p.key, p.name]));

  let rows: RelatedRow[] = [];
  try {
    // Exact officer name key match on fl_sunbiz entities that already have a
    // high-confidence contractor link (indexed via contractor_entities).
    // Avoids full-table JSONB scan of all Sunbiz rows on Trust Report SSR.
    // Normalization mirrors normalizeOfficerKey (upper, strip punct, collapse space).
    rows = await query<RelatedRow>(
      `
      SELECT DISTINCT ON (e.id, matched_key)
        e.id,
        e.external_key,
        e.legal_name,
        e.status,
        e.entity_type,
        e.formation_date,
        e.officers,
        e.last_verified_at,
        matched_key
      FROM contractor_entities ce
      JOIN entities e ON e.id = ce.entity_id
      CROSS JOIN LATERAL (
        SELECT upper(trim(regexp_replace(
          regexp_replace(COALESCE(o->>'name', ''), '[.,''"/\\\\-]+', ' ', 'g'),
          '\\s+', ' ', 'g'
        ))) AS matched_key
        FROM jsonb_array_elements(COALESCE(e.officers, '[]'::jsonb)) AS o
      ) keys
      WHERE e.source_system = 'fl_sunbiz'
        AND ce.role IN ('sunbiz_entity', 'linked', 'entity')
        AND ce.confidence IS NOT NULL
        AND ce.confidence >= 0.90
        AND NOT (e.id = ANY($1::uuid[]))
        AND keys.matched_key = ANY($2::text[])
      ORDER BY e.id, matched_key
      LIMIT 40
      `,
      [excludeIds, keys]
    );
  } catch (err) {
    console.error(
      "[entity-lineage] related query failed:",
      err instanceof Error ? err.message : err
    );
    rows = [];
  }

  // Group by entity; collect matched officer keys
  const keySet = new Set(keys);
  const byId = new Map<
    string,
    {
      row: RelatedRow;
      matchedKeys: Set<string>;
    }
  >();
  for (const r of rows) {
    const matchKey = normalizeOfficerKey(r.matched_key);
    if (!keySet.has(matchKey)) continue;
    const existing = byId.get(r.id);
    if (existing) {
      existing.matchedKeys.add(matchKey);
    } else {
      byId.set(r.id, { row: r, matchedKeys: new Set([matchKey]) });
    }
  }

  // Also include other high-confidence entities already on this profile as "related"
  const related: LineageRelatedEntity[] = [];
  for (const e of entities.slice(1)) {
    related.push({
      id: e.id,
      documentNumber: e.externalKey,
      legalName: e.legalName,
      status: e.status,
      statusLabel: entityStatusLabel(e.status),
      entityType: e.entityType,
      formationDate: e.formationDate,
      lastVerifiedAt: e.lastVerifiedAt,
      matchedOfficerKeys: [],
      matchedOfficerNames: [],
      sunbizSearchHref: sunbizDocumentSearchHref(e.externalKey),
    });
  }

  for (const { row, matchedKeys } of byId.values()) {
    const mkeys = [...matchedKeys];
    related.push({
      id: row.id,
      documentNumber: row.external_key,
      legalName: row.legal_name,
      status: row.status,
      statusLabel: entityStatusLabel(row.status),
      entityType: row.entity_type,
      formationDate: row.formation_date ? row.formation_date.toISOString() : null,
      lastVerifiedAt: row.last_verified_at
        ? row.last_verified_at.toISOString()
        : null,
      matchedOfficerKeys: mkeys,
      matchedOfficerNames: mkeys.map((k) => keyToName.get(k) || k),
      sunbizSearchHref: sunbizDocumentSearchHref(row.external_key),
    });
  }

  // Cap display density
  const relatedCapped = related.slice(0, 12);
  const primaryOfficers = officersFromEntity(primary);

  // Hide section only if we have neither officers nor related entities
  if (primaryOfficers.length === 0 && relatedCapped.length === 0) return null;

  return {
    primary: {
      documentNumber: primary.externalKey,
      legalName: primary.legalName,
      status: primary.status,
      statusLabel: entityStatusLabel(primary.status),
      entityType: primary.entityType,
      formationDate: primary.formationDate,
      matchMethod: primary.matchMethod,
      matchConfidence: primary.matchConfidence,
      lastVerifiedAt: primary.lastVerifiedAt,
      officers: primaryOfficers,
      sunbizSearchHref: sunbizDocumentSearchHref(primary.externalKey),
    },
    principals,
    related: relatedCapped,
    evidenceNote:
      relatedCapped.length > 0
        ? "Related entities appear because they publish the same officer/principal name(s) in our Florida Sunbiz extract (exact name key after normalization) and are already high-confidence linked to a contractor profile in our product. This is not an accusation of misconduct, and it is not a complete officer graph of every Sunbiz filing."
        : "Principals shown as published on the high-confidence Sunbiz link. No other high-confidence-linked entities in our product shared those exact principal names under our association rules.",
  };
}
