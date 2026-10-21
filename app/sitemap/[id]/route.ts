import {
  getSitemapShardPlan,
} from "@/lib/seo/sitemap-data";
import { createSitemapRouteHandlers } from "@/lib/seo/sitemap-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

/**
 * Sitemap shard at /sitemap/:id (rewritten from /sitemap/:id.xml).
 * Shard 0 = static product pages + discovery + first contractor page.
 */
export async function GET(_req: Request, { params }: Props) {
  const { id: raw } = await params;
  return createSitemapRouteHandlers(getSitemapShardPlan).child(raw);
}
