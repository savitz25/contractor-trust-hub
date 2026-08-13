/**
 * Shared sitemap builders for explicit route handlers.
 * Used by /sitemap.xml (index) and /sitemap/:id.xml (shards).
 */

import {
  countSearchableContractorSlugs,
  listSearchableContractorSlugs,
  SITEMAP_PAGE_SIZE,
} from "@/lib/contractors/queries";
import { discoveryPath, getLiveDiscoveryStates } from "@/lib/discovery/config";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

/** Cap shards so index generation stays reliable. */
export const MAX_SITEMAP_SHARDS = 50;

export type SitemapUrlEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
};

export async function getSitemapShardCount(): Promise<number> {
  let count = 0;
  try {
    count = await countSearchableContractorSlugs("fl");
  } catch {
    count = 0;
  }
  const needed = Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE) || 1);
  return Math.min(needed, MAX_SITEMAP_SHARDS);
}

function discoveryEntries(): SitemapUrlEntry[] {
  const entries: SitemapUrlEntry[] = [];
  for (const state of getLiveDiscoveryStates()) {
    entries.push({
      loc: absoluteUrl(discoveryPath(state)),
      changefreq: "weekly",
      priority: 0.85,
    });
    for (const county of state.counties) {
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
    for (const county of state.counties) {
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
  const now = new Date().toISOString();
  const items: { path: string; priority: number; changefreq: string }[] = [
    { path: "/", priority: 1, changefreq: "weekly" },
    { path: "/verify", priority: 0.95, changefreq: "daily" },
    { path: "/verify?state=or", priority: 0.9, changefreq: "weekly" },
    { path: "/plan", priority: 0.9, changefreq: "weekly" },
    { path: "/studios", priority: 0.9, changefreq: "weekly" },
    { path: "/tools", priority: 0.92, changefreq: "weekly" },
    { path: "/projects", priority: 0.9, changefreq: "weekly" },
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
    { path: "/florida", priority: 0.9, changefreq: "weekly" },
    { path: "/about", priority: 0.75, changefreq: "weekly" },
    { path: "/methodology", priority: 0.75, changefreq: "weekly" },
    { path: "/independence", priority: 0.7, changefreq: "monthly" },
    { path: "/corrections", priority: 0.65, changefreq: "monthly" },
    { path: "/disclaimer", priority: 0.6, changefreq: "monthly" },
    { path: "/compare", priority: 0.5, changefreq: "weekly" },
  ];
  return items.map((item) => ({
    loc: absoluteUrl(item.path),
    lastmod: now,
    changefreq: item.changefreq,
    priority: item.priority,
  }));
}

/** URLs for one shard. Shard 0 includes static + discovery + first contractor page. */
export async function getSitemapShardEntries(id: number): Promise<SitemapUrlEntry[]> {
  if (!Number.isFinite(id) || id < 0) return [];

  const entries: SitemapUrlEntry[] = [];
  const now = new Date().toISOString();

  if (id === 0) {
    entries.push(...staticProductEntries());
    entries.push(...discoveryEntries());
  }

  try {
    const rows = await listSearchableContractorSlugs({
      stateSlug: "fl",
      limit: SITEMAP_PAGE_SIZE,
      offset: id * SITEMAP_PAGE_SIZE,
    });
    for (const row of rows) {
      entries.push({
        loc: absoluteUrl(`/contractors/${encodeURIComponent(row.slug)}`),
        lastmod: row.updatedAt ? new Date(row.updatedAt).toISOString() : now,
        changefreq: "weekly",
        priority: 0.55,
      });
    }
  } catch {
    // Still return static/discovery on shard 0 if contractor query fails
  }

  return entries;
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
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${escapeXml(e.lastmod)}</lastmod>`);
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

export function renderSitemapIndexXml(shardCount: number): string {
  const base = getSiteUrl();
  const lastmod = new Date().toISOString();
  const items = Array.from({ length: shardCount }, (_, id) => {
    const loc = `${base}/sitemap/${id}.xml`;
    return `  <sitemap>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
  </sitemap>`;
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
