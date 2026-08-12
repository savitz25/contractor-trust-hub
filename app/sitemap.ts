import type { MetadataRoute } from "next";
import {
  countSearchableContractorSlugs,
  listSearchableContractorSlugs,
  SITEMAP_PAGE_SIZE,
} from "@/lib/contractors/queries";
import { discoveryPath, getLiveDiscoveryStates } from "@/lib/discovery/config";
import { absoluteUrl } from "@/lib/site";

/**
 * Multi-file sitemap for ~270k Florida contractor profiles + discovery URLs.
 * Next.js emits /sitemap.xml index → /sitemap/0.xml, /sitemap/1.xml, ...
 */
export async function generateSitemaps() {
  let count = 0;
  try {
    count = await countSearchableContractorSlugs("fl");
  } catch {
    count = 0;
  }
  // id 0 always exists (static + discovery + first contractor page)
  const contractorPages = Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE) || 1);
  return Array.from({ length: contractorPages }, (_, id) => ({ id }));
}

function discoverySitemapEntries(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const state of getLiveDiscoveryStates()) {
    entries.push({
      url: absoluteUrl(discoveryPath(state)),
      changeFrequency: "weekly",
      priority: 0.85,
    });
    for (const county of state.counties) {
      entries.push({
        url: absoluteUrl(discoveryPath(state, { countySlug: county.slug })),
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }
    for (const trade of state.trades) {
      entries.push({
        url: absoluteUrl(discoveryPath(state, { tradeSlug: trade.slug })),
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }
    // Combined county × trade (high-value SEO pages)
    for (const county of state.counties) {
      for (const trade of state.trades) {
        entries.push({
          url: absoluteUrl(
            discoveryPath(state, { countySlug: county.slug, tradeSlug: trade.slug })
          ),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  }
  return entries;
}

export default async function sitemap(props: {
  id: number | Promise<number>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const entries: MetadataRoute.Sitemap = [];

  if (id === 0) {
    const staticPaths = [
      "/",
      "/studios",
      "/studios/kitchen",
      "/studios/bathroom",
      "/studios/roofing",
      "/plan",
      "/verify",
      "/about",
      "/methodology",
      "/independence",
      "/corrections",
      "/disclaimer",
      "/compare",
    ] as const;
    for (const path of staticPaths) {
      entries.push({
        url: absoluteUrl(path),
        changeFrequency:
          path === "/verify" || path === "/plan" ? "daily" : "weekly",
        priority: path === "/" ? 1 : path === "/plan" ? 0.9 : 0.8,
      });
    }
    entries.push(...discoverySitemapEntries());
  }

  const offset = id * SITEMAP_PAGE_SIZE;
  let rows: { slug: string; updatedAt: string | null }[] = [];
  try {
    rows = await listSearchableContractorSlugs({
      stateSlug: "fl",
      limit: SITEMAP_PAGE_SIZE,
      offset,
    });
  } catch {
    rows = [];
  }

  for (const row of rows) {
    entries.push({
      url: absoluteUrl(`/contractors/${encodeURIComponent(row.slug)}`),
      lastModified: row.updatedAt ? new Date(row.updatedAt) : undefined,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
