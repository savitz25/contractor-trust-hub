import {
  getSitemapShardPlan,
} from "@/lib/seo/sitemap-data";
import { createSitemapRouteHandlers, resolveSitemapPlanLoader } from "@/lib/seo/sitemap-handlers";
import {
  createSitemapGenerationHandlers,
  sitemapGenerationReaderEnabled,
} from "@/lib/seo/sitemap-generation-reader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Explicit sitemap index at /sitemap.xml.
 *
 * Why not app/sitemap.ts + generateSitemaps alone?
 * Next's multi-sitemap metadata route was serving 404 HTML at /sitemap.xml
 * while /sitemap/0.xml still worked — the index never registered reliably.
 * This route handler owns /sitemap.xml with correct Content-Type.
 */
export async function GET() {
  if (sitemapGenerationReaderEnabled()) {
    return createSitemapGenerationHandlers().index();
  }
  return createSitemapRouteHandlers(resolveSitemapPlanLoader(getSitemapShardPlan)).index();
}
