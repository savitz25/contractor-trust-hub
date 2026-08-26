import { unstable_cache } from "next/cache";
import { FLORIDA_COUNTIES } from "./counties";
import { countCountiesBatch, countTradesBatch } from "./queries";
import { FLORIDA_TRADES } from "./trades";
import type { DiscoveryFacet } from "./types";
import { queryOne } from "@/lib/db";

const LANDING_TIMEOUT_MS = 6_000;
const LANDING_REVALIDATE_SEC = 1_800;

export type FloridaLandingStats = {
  /** Trade credentials (excludes FRO / CRS1 / PVDR). Not distinct businesses. */
  credentials: number;
  /** status_normalized = active trade credentials. */
  activeCredentials: number;
  sunbizLinks: number;
};

export type FloridaLandingSnapshot = {
  stats: FloridaLandingStats;
  counties: DiscoveryFacet[];
  trades: DiscoveryFacet[];
  fromCache: boolean;
  timedOut: boolean;
};

/** Curated links — no DB. Always safe to render on /florida. */
export function floridaCuratedCountyFacets(): DiscoveryFacet[] {
  return FLORIDA_COUNTIES.map((c) => ({ slug: c.slug, label: c.name, count: 0 }));
}

export function floridaCuratedTradeFacets(): DiscoveryFacet[] {
  return FLORIDA_TRADES.map((t) => ({ slug: t.slug, label: t.label, count: 0 }));
}

function emptyStats(): FloridaLandingStats {
  return { credentials: 0, activeCredentials: 0, sunbizLinks: 0 };
}

/**
 * Cheap landing stats — three independent counts, no EXISTS-per-contractor.
 * `licenses` is ALL fl_dbpr credential rows (not active-only, not distinct businesses).
 * `contractors` is non-thin FL product shells (one per license), not distinct firms.
 * Sunbiz links use confidence >= 0.95 (HIGH_CONFIDENCE address/ZIP). Do not hard-code totals.
 */
async function loadFloridaLandingStats(): Promise<FloridaLandingSnapshot["stats"]> {
  const row = await queryOne<{
    credentials: string;
    active: string;
    links: string;
  }>(
    `
    SELECT
      (SELECT COUNT(*)::text
         FROM licenses l
         WHERE l.source_system = 'fl_dbpr'
           AND UPPER(COALESCE(l.occupation_code, '')) NOT IN ('FRO', 'CRS1', 'PVDR')
      ) AS credentials,
      (SELECT COUNT(*)::text
         FROM licenses l
         WHERE l.source_system = 'fl_dbpr'
           AND l.status_normalized = 'active'
           AND UPPER(COALESCE(l.occupation_code, '')) NOT IN ('FRO', 'CRS1', 'PVDR')
      ) AS active,
      (SELECT COUNT(*)::text
         FROM contractor_entities ce
         JOIN entities e ON e.id = ce.entity_id
         WHERE ce.role = 'sunbiz_entity'
           AND e.source_system = 'fl_sunbiz'
           AND ce.confidence >= 0.95) AS links
    `
  );
  return {
    credentials: Number(row?.credentials || 0),
    activeCredentials: Number(row?.active || 0),
    sunbizLinks: Number(row?.links || 0),
  };
}

async function loadFloridaLandingUncached(): Promise<
  Omit<FloridaLandingSnapshot, "fromCache" | "timedOut">
> {
  const [stats, counties, trades] = await Promise.all([
    loadFloridaLandingStats(),
    countCountiesBatch("florida"),
    countTradesBatch("florida"),
  ]);
  return { stats, counties, trades };
}

const getCachedFloridaLandingInner = unstable_cache(
  async () => loadFloridaLandingUncached(),
  ["florida-landing-facets-v2-credentials"],
  { revalidate: LANDING_REVALIDATE_SEC }
);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

/**
 * Legacy county/trade/stat snapshot. Canonical /florida State Intelligence
 * uses lib/intelligence/florida-snapshot.ts. Kept for timeout-safe facet reuse.
 */
export async function getFloridaLandingSnapshot(): Promise<FloridaLandingSnapshot> {
  const hit = await withTimeout(getCachedFloridaLandingInner(), LANDING_TIMEOUT_MS);
  if (!hit) {
    return {
      stats: emptyStats(),
      counties: [],
      trades: [],
      fromCache: false,
      timedOut: true,
    };
  }
  return { ...hit, fromCache: true, timedOut: false };
}
