import type { MetadataRoute } from "next";
import {
  countSearchableContractorSlugs,
  listSearchableContractorSlugs,
  SITEMAP_PAGE_SIZE,
} from "@/lib/contractors/queries";
import { absoluteUrl } from "@/lib/site";

/**
 * Multi-file sitemap for ~270k Florida contractor profiles.
 * Next.js emits /sitemap.xml index → /sitemap/0.xml, /sitemap/1.xml, ...
 */
export async function generateSitemaps() {
  let count = 0;
  try {
    count = await countSearchableContractorSlugs("fl");
  } catch {
    count = 0;
  }
  // id 0 always exists (static routes + first contractor page)
  const contractorPages = Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE) || 1);
  return Array.from({ length: contractorPages }, (_, id) => ({ id }));
}

export default async function sitemap(props: {
  id: number | Promise<number>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const entries: MetadataRoute.Sitemap = [];

  if (id === 0) {
    const staticPaths = ["/", "/verify", "/about", "/methodology"] as const;
    for (const path of staticPaths) {
      entries.push({
        url: absoluteUrl(path),
        changeFrequency: path === "/verify" ? "daily" : "weekly",
        priority: path === "/" ? 1 : 0.8,
      });
    }
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
