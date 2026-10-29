/**
 * Shared sitemap builders for explicit route handlers.
 * Used by /sitemap.xml (index) and /sitemap/:id.xml (shards).
 */

import {
  listSearchableContractorSlugs,
  SITEMAP_PAGE_SIZE,
} from "@/lib/contractors/queries";
import { isDbCapacityError, isDbConnectTimeout, isDbQueryTimeout } from "@/lib/db";
import { discoveryPath, getLiveDiscoveryStates } from "@/lib/discovery/config";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

/** Cap shards so index generation stays reliable. */
export const MAX_SITEMAP_SHARDS = 50;
export const SITEMAP_MAX_URLS_PER_CHILD = 50_000;

/**
 * Product routes that set noIndex. They must not appear in the sitemap.
 * Profile pages are a separate decision and are unchanged here.
 */
const SITEMAP_NOINDEX_PATHS = new Set(["/account", "/watch", "/compare"]);

/** Fail a later-page probe quickly. A timeout omits that shard for this response only. */
const SITEMAP_SHARD_PROBE_TIMEOUT_MS = 1_500;

/**
 * Pool, connect, and statement timeouts are the known transient probe failures.
 * Syntax errors, missing relations, and programming errors stay fatal.
 */
export function isTransientSitemapFailure(error: unknown): boolean {
  return isDbQueryTimeout(error) || isDbConnectTimeout(error) || isDbCapacityError(error);
}

function logSitemapRecovery(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[sitemap] ${scope} kind=transient msg=${message.slice(0, 200)}`);
}

function validLastmod(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function isPublishableSitemapLoc(loc: string): boolean {
  let url: URL;
  try {
    url = new URL(loc);
  } catch {
    return false;
  }
  let canonicalHost: string;
  try {
    canonicalHost = new URL(getSiteUrl()).host;
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.host !== canonicalHost) return false;
  if (url.search !== "" || url.hash !== "") return false;
  if (SITEMAP_NOINDEX_PATHS.has(url.pathname)) return false;
  if (url.pathname.startsWith("/contractors/")) {
    const slug = decodeURIComponent(url.pathname.slice("/contractors/".length));
    if (!slug || slug.includes("/") || slug === "." || slug === "..") return false;
  }
  return true;
}

function isSitemapPathAllowed(path: string): boolean {
  return path.startsWith("/") && !path.includes("?") && !path.includes("#") && !SITEMAP_NOINDEX_PATHS.has(path);
}

/**
 * Publish a leading run of shards that each contain at least one URL.
 * Shard 0 is the static/discovery page and is always first.
 * Stop at the first empty contractor page so the index never lists a gap.
 */
export function leadingNonEmptyShardCount(pageHasRows: readonly boolean[]): number {
  let count = 0;
  const cap = Math.min(pageHasRows.length, MAX_SITEMAP_SHARDS);
  for (let id = 0; id < cap; id += 1) {
    if (!pageHasRows[id]) break;
    count += 1;
  }
  return count;
}

export type SitemapUrlEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  /** Stable source-row key used only to break ties; never emitted into XML. */
  stableId?: string;
};

function compareStable(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Sort deterministically and remove duplicate locations before chunking/rendering. */
export function stableUniqueSitemapEntries(
  entries: readonly SitemapUrlEntry[],
): SitemapUrlEntry[] {
  const sorted = entries.filter((entry) => isPublishableSitemapLoc(entry.loc)).sort(
    (a, b) => compareStable(a.loc, b.loc) || compareStable(a.stableId ?? a.loc, b.stableId ?? b.loc),
  );
  const seen = new Set<string>();
  return sorted.filter((entry) => {
    if (!entry.loc || seen.has(entry.loc)) return false;
    seen.add(entry.loc);
    return true;
  });
}

/** Pure stable chunker used for the production manifest and boundary tests. */
export function chunkSitemapEntries(
  entries: readonly SitemapUrlEntry[],
  chunkSize = SITEMAP_PAGE_SIZE,
): SitemapUrlEntry[][] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > SITEMAP_MAX_URLS_PER_CHILD) {
    throw new RangeError(`chunkSize must be an integer between 1 and ${SITEMAP_MAX_URLS_PER_CHILD}`);
  }
  const unique = stableUniqueSitemapEntries(entries);
  const chunks: SitemapUrlEntry[][] = [];
  for (let offset = 0; offset < unique.length; offset += chunkSize) {
    chunks.push(unique.slice(offset, offset + chunkSize));
  }
  return chunks;
}

export type SitemapShardPlan = {
  childIds: readonly number[];
  entriesForChild(id: number): Promise<SitemapUrlEntry[]>;
  /**
   * A known transient probe failed. The missing shard is omitted from this
   * response only, and the response must not be cached as a complete sitemap.
   */
  retry: boolean;
};

export type SitemapShardPlanSource = {
  staticEntries: readonly SitemapUrlEntry[];
  profilePageHasRows(id: number): Promise<boolean>;
  profileEntries(id: number): Promise<readonly SitemapUrlEntry[]>;
  chunkSize?: number;
  maxChildren?: number;
};

/**
 * One manifest contract for both routes: contiguous child IDs are probed from
 * the same eligible profile source and page size that child lookup uses.
 */
export async function createSitemapShardPlan(
  source: SitemapShardPlanSource,
): Promise<SitemapShardPlan> {
  const chunkSize = source.chunkSize ?? SITEMAP_PAGE_SIZE;
  const maxChildren = Math.min(source.maxChildren ?? MAX_SITEMAP_SHARDS, MAX_SITEMAP_SHARDS);
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > SITEMAP_MAX_URLS_PER_CHILD) {
    throw new RangeError("Invalid sitemap profile page size");
  }

  const staticEntries = stableUniqueSitemapEntries(source.staticEntries);
  const childIds: number[] = staticEntries.length > 0 ? [0] : [];
  const plan: SitemapShardPlan = {
    childIds,
    retry: false,
    async entriesForChild(id) {
      if (!childIds.includes(id)) return [];
      const entries: SitemapUrlEntry[] = id === 0 ? [...staticEntries] : [];
      try {
        entries.push(...(await source.profileEntries(id)));
      } catch (error) {
        // Shard 0 still has verified static and discovery URLs. A later shard
        // has nothing truthful to serve, so its failure stays fatal.
        if (id !== 0 || staticEntries.length === 0 || !isTransientSitemapFailure(error)) {
          throw error;
        }
        plan.retry = true;
        logSitemapRecovery("shard 0 profiles unavailable; serving static and discovery URLs only", error);
      }
      return stableUniqueSitemapEntries(entries);
    },
  };

  const probeFrom = childIds.length > 0 ? 1 : 0;
  for (let id = probeFrom; id < maxChildren; id += 1) {
    let hasRows = false;
    try {
      hasRows = await source.profilePageHasRows(id);
    } catch (error) {
      if (!isTransientSitemapFailure(error)) throw error;
      plan.retry = true;
      logSitemapRecovery(
        id === 0
          ? "shard 0 probe failed; no verified profile page to publish"
          : `later shard ${id} probe failed; serving verified shards only`,
        error,
      );
      break;
    }
    if (!hasRows) break;
    if (!childIds.includes(id)) childIds.push(id);
  }

  return plan;
}

/** The sole production manifest factory shared by /sitemap.xml and its children. */
export async function getSitemapShardPlan(
  loadProfileRows: typeof listSearchableContractorSlugs = listSearchableContractorSlugs,
): Promise<SitemapShardPlan> {
  const staticEntries = stableUniqueSitemapEntries(nonContractorSitemapEntries());
  const pageSize = SITEMAP_PAGE_SIZE;
  const profilePage = async (id: number) => {
    const rows = await loadProfileRows({
      stateSlug: "fl",
      limit: pageSize,
      offset: id * pageSize,
    });
    return rows.flatMap((row) => {
      const slug = row.slug.trim();
      if (!slug || /[/?#\\]/.test(slug)) return [];
      return [{
        loc: absoluteUrl(`/contractors/${encodeURIComponent(slug)}`),
        lastmod: validLastmod(row.updatedAt),
        changefreq: "weekly" as const,
        priority: 0.55,
        stableId: row.id,
      }];
    });
  };

  return createSitemapShardPlan({
    staticEntries,
    chunkSize: pageSize,
    profilePageHasRows: async (id) => {
      const rows = await loadProfileRows({
        stateSlug: "fl",
        limit: 1,
        offset: id * pageSize,
        statementTimeoutMs: SITEMAP_SHARD_PROBE_TIMEOUT_MS,
      });
      return rows.length > 0;
    },
    profileEntries: profilePage,
  });
}

function discoveryEntries(): SitemapUrlEntry[] {
  const entries: SitemapUrlEntry[] = [];
  for (const state of getLiveDiscoveryStates()) {
    entries.push({
      loc: absoluteUrl(discoveryPath(state)),
      changefreq: "weekly",
      priority: 0.85,
    });
    const geos = [...state.counties, ...(state.cities || [])];
    for (const county of geos) {
      entries.push({
        loc: absoluteUrl(discoveryPath(state, { countySlug: county.slug })),
        changefreq: "weekly",
        priority: 0.75,
      });
    }
    for (const trade of state.trades) {
      entries.push({
        loc: absoluteUrl(discoveryPath(state, { tradeSlug: trade.slug })),
        changefreq: "weekly",
        priority: 0.75,
      });
    }
    for (const county of geos) {
      for (const trade of state.trades) {
        entries.push({
          loc: absoluteUrl(
            discoveryPath(state, { countySlug: county.slug, tradeSlug: trade.slug })
          ),
          changefreq: "weekly",
          priority: 0.7,
        });
      }
    }
  }
  return entries;
}

function staticProductEntries(): SitemapUrlEntry[] {
  const items: { path: string; priority: number; changefreq: string }[] = [
    { path: "/", priority: 1, changefreq: "weekly" },
    { path: "/verify", priority: 0.95, changefreq: "daily" },
    { path: "/oregon", priority: 0.9, changefreq: "weekly" },
    { path: "/oregon/multnomah", priority: 0.8, changefreq: "weekly" },
    { path: "/oregon/projects/kitchen-remodel", priority: 0.78, changefreq: "weekly" },
    { path: "/oregon/residential-general", priority: 0.78, changefreq: "weekly" },
    { path: "/washington", priority: 0.9, changefreq: "weekly" },
    { path: "/washington/seattle", priority: 0.8, changefreq: "weekly" },
    { path: "/washington/king", priority: 0.8, changefreq: "weekly" },
    { path: "/washington/projects/kitchen-remodel", priority: 0.78, changefreq: "weekly" },
    { path: "/washington/projects/roofing", priority: 0.78, changefreq: "weekly" },
    { path: "/washington/electrical", priority: 0.78, changefreq: "weekly" },
    { path: "/plan/start", priority: 0.92, changefreq: "weekly" },
    { path: "/plan", priority: 0.9, changefreq: "weekly" },
    { path: "/studios", priority: 0.9, changefreq: "weekly" },
    { path: "/tools", priority: 0.92, changefreq: "weekly" },
    { path: "/projects", priority: 0.9, changefreq: "weekly" },
    { path: "/watch", priority: 0.65, changefreq: "weekly" },
    { path: "/passport", priority: 0.9, changefreq: "weekly" },
    { path: "/account", priority: 0.75, changefreq: "weekly" },
    { path: "/tools/contract-analyzer", priority: 0.88, changefreq: "weekly" },
    { path: "/property", priority: 0.92, changefreq: "weekly" },
    { path: "/tools/permit-planner", priority: 0.88, changefreq: "weekly" },
    { path: "/tools/coverage", priority: 0.7, changefreq: "weekly" },
    { path: "/tools/scope-builder", priority: 0.85, changefreq: "weekly" },
    { path: "/tools/quote-analyzer", priority: 0.85, changefreq: "weekly" },
    { path: "/tools/compare-bids", priority: 0.85, changefreq: "weekly" },
    { path: "/tools/pre-hire-checklist", priority: 0.85, changefreq: "weekly" },
    { path: "/studio/cost", priority: 0.9, changefreq: "weekly" },
    { path: "/studio/roofing", priority: 0.9, changefreq: "weekly" },
    { path: "/studio/kitchen", priority: 0.9, changefreq: "weekly" },
    { path: "/studio/bathroom", priority: 0.9, changefreq: "weekly" },
    { path: "/guides", priority: 0.85, changefreq: "weekly" },
    { path: "/guides/how-to-verify-florida-contractor", priority: 0.88, changefreq: "monthly" },
    { path: "/guides/florida-contractor-red-flags", priority: 0.86, changefreq: "monthly" },
    { path: "/guides/florida-contractor-license-types", priority: 0.86, changefreq: "monthly" },
    { path: "/texas", priority: 0.9, changefreq: "weekly" },
    { path: "/texas/austin", priority: 0.84, changefreq: "weekly" },
    { path: "/california", priority: 0.9, changefreq: "weekly" },
    { path: "/california/san-francisco", priority: 0.84, changefreq: "weekly" },
    { path: "/california/los-angeles", priority: 0.84, changefreq: "weekly" },
    { path: "/florida", priority: 0.9, changefreq: "weekly" },
    { path: "/new-jersey", priority: 0.9, changefreq: "weekly" },
    { path: "/new-jersey/monmouth-county", priority: 0.82, changefreq: "weekly" },
    { path: "/new-jersey/middlesex-county", priority: 0.82, changefreq: "weekly" },
    { path: "/new-jersey/somerset-county", priority: 0.82, changefreq: "weekly" },
    { path: "/new-jersey/union-county", priority: 0.82, changefreq: "weekly" },
    { path: "/arizona", priority: 0.9, changefreq: "weekly" },
    { path: "/arizona/phoenix", priority: 0.8, changefreq: "weekly" },
    { path: "/arizona/tucson", priority: 0.8, changefreq: "weekly" },
    { path: "/arizona/projects/kitchen-remodel", priority: 0.78, changefreq: "weekly" },
    { path: "/arizona/projects/roofing", priority: 0.78, changefreq: "weekly" },
    { path: "/arizona/roofing", priority: 0.78, changefreq: "weekly" },
    { path: "/colorado", priority: 0.9, changefreq: "weekly" },
    { path: "/virginia", priority: 0.9, changefreq: "weekly" },
    { path: "/new-york", priority: 0.9, changefreq: "weekly" },
    { path: "/new-york/new-york-city", priority: 0.84, changefreq: "weekly" },
    { path: "/illinois", priority: 0.9, changefreq: "weekly" },
    { path: "/pennsylvania", priority: 0.9, changefreq: "weekly" },
    { path: "/north-carolina", priority: 0.9, changefreq: "weekly" },
    { path: "/ohio", priority: 0.9, changefreq: "weekly" },
    { path: "/georgia", priority: 0.9, changefreq: "weekly" },
    { path: "/massachusetts", priority: 0.9, changefreq: "weekly" },
    { path: "/rhode-island", priority: 0.9, changefreq: "weekly" },
    { path: "/tennessee", priority: 0.9, changefreq: "weekly" },
    { path: "/nevada", priority: 0.9, changefreq: "weekly" },
    { path: "/minnesota", priority: 0.9, changefreq: "weekly" },
    { path: "/michigan", priority: 0.9, changefreq: "weekly" },
      { path: "/maryland", priority: 0.9, changefreq: "weekly" },
      { path: "/wisconsin", priority: 0.9, changefreq: "weekly" },
      { path: "/louisiana", priority: 0.9, changefreq: "weekly" },
      { path: "/kentucky", priority: 0.9, changefreq: "weekly" },
      { path: "/south-carolina", priority: 0.9, changefreq: "weekly" },
      { path: "/mississippi", priority: 0.9, changefreq: "weekly" },
      { path: "/oklahoma", priority: 0.9, changefreq: "weekly" },
      { path: "/utah", priority: 0.9, changefreq: "weekly" },
      { path: "/missouri", priority: 0.9, changefreq: "weekly" },
      { path: "/arkansas", priority: 0.9, changefreq: "weekly" },
      { path: "/new-mexico", priority: 0.9, changefreq: "weekly" },
      { path: "/kansas", priority: 0.9, changefreq: "weekly" },
      { path: "/idaho", priority: 0.9, changefreq: "weekly" },
      { path: "/nebraska", priority: 0.9, changefreq: "weekly" },
      { path: "/west-virginia", priority: 0.9, changefreq: "weekly" },
      { path: "/montana", priority: 0.9, changefreq: "weekly" },
      { path: "/vermont", priority: 0.9, changefreq: "weekly" },
      { path: "/wyoming", priority: 0.9, changefreq: "weekly" },
      { path: "/south-dakota", priority: 0.9, changefreq: "weekly" },
      { path: "/alaska", priority: 0.9, changefreq: "weekly" },
      { path: "/delaware", priority: 0.9, changefreq: "weekly" },
      { path: "/hawaii", priority: 0.9, changefreq: "weekly" },
      { path: "/iowa", priority: 0.9, changefreq: "weekly" },
      { path: "/maine", priority: 0.9, changefreq: "weekly" },
      { path: "/new-hampshire", priority: 0.9, changefreq: "weekly" },
      { path: "/north-dakota", priority: 0.9, changefreq: "weekly" },
    { path: "/indiana", priority: 0.9, changefreq: "weekly" },
    { path: "/alabama", priority: 0.9, changefreq: "weekly" },
    { path: "/connecticut", priority: 0.9, changefreq: "weekly" },
    { path: "/about", priority: 0.75, changefreq: "weekly" },
    { path: "/methodology", priority: 0.75, changefreq: "weekly" },
    { path: "/independence", priority: 0.7, changefreq: "monthly" },
    { path: "/corrections", priority: 0.65, changefreq: "monthly" },
    { path: "/disclaimer", priority: 0.6, changefreq: "monthly" },
    { path: "/compare", priority: 0.5, changefreq: "weekly" },
  ];
  return items
    .filter((item) => isSitemapPathAllowed(item.path))
    .map((item) => ({
      loc: absoluteUrl(item.path),
      changefreq: item.changefreq,
      priority: item.priority,
    }));
}

/** Static product URLs plus discovery URLs. No contractor profiles. */
export function nonContractorSitemapEntries(): SitemapUrlEntry[] {
  return [...staticProductEntries(), ...discoveryEntries()];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderUrlSetXml(entries: SitemapUrlEntry[]): string {
  const urls = entries
    .filter((entry) => isPublishableSitemapLoc(entry.loc))
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
      const lastmod = validLastmod(e.lastmod);
      if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${escapeXml(e.changefreq)}</changefreq>`);
      if (e.priority != null) {
        parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function renderSitemapIndexXml(childIds: readonly number[]): string {
  const base = getSiteUrl();
  const items = childIds.map((id) => {
    const loc = `${base}/sitemap/${id}.xml`;
    return `  <sitemap>
    <loc>${escapeXml(loc)}</loc>
  </sitemap>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>
`;
}

/** Index for immutable, generation-specific child URLs. */
export function renderVersionedSitemapIndexXml(
  generationId: string,
  shardIds: readonly number[],
): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(generationId)) {
    throw new RangeError("Invalid sitemap generation id");
  }
  const base = getSiteUrl();
  const items = shardIds.map((id) => {
    if (!Number.isSafeInteger(id) || id < 0 || id >= MAX_SITEMAP_SHARDS) {
      throw new RangeError("Invalid sitemap shard id");
    }
    const loc = `${base}/sitemap/g/${generationId}/${id}.xml`;
    return `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n  </sitemap>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>
`;
}

export const SITEMAP_XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
} as const;
