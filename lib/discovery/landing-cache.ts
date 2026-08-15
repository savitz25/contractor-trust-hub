import { unstable_cache } from "next/cache";
import { FLORIDA_COUNTIES } from "./counties";
import { countCountiesBatch, countTradesBatch } from "./queries";
import { FLORIDA_TRADES } from "./trades";
import type { DiscoveryFacet } from "./types";
import { queryOne } from "@/lib/db";

const LANDING_TIMEOUT_MS = 6_000;
const LANDING_REVALIDATE_SEC = 1_800;

export type FloridaLandingSnapshot = {
  stats: { contractors: number; licenses: number; sunbizLinks: number };
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

function emptyStats() {
  return { contractors: 0, licenses: 0, sunbizLinks: 0 };
}

/**
 * Cheap landing stats — three independent counts, no EXISTS-per-contractor.
 * Accurate enough for the state hub; list pages still use live filters.
 */
async function loadFloridaLandingStats(): Promise<FloridaLandingSnapshot["stats"]> {
  const row = await queryOne<{
    contractors: string;
    licenses: string;
    links: string;
  }>(
    `
    SELECT
      (SELECT COUNT(*)::text
         FROM contractors c
         WHERE c.is_thin_profile = FALSE AND c.home_state = 'FL') AS contractors,
      (SELECT COUNT(*)::text
         FROM licenses l
         WHERE l.source_system = 'fl_dbpr') AS licenses,
      (SELECT COUNT(*)::text
         FROM contractor_entities ce
         JOIN entities e ON e.id = ce.entity_id
         WHERE ce.role = 'sunbiz_entity'
           AND e.source_system = 'fl_sunbiz'
           AND ce.confidence >= 0.9) AS links
    `
  );
  return {
    contractors: Number(row?.contractors || 0),
    licenses: Number(row?.licenses || 0),
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
  ["florida-landing-facets-v1"],
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
 * Cached county/trade/stat snapshot for /florida.
 * Times out to an empty payload so the landing can show curated links.
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
