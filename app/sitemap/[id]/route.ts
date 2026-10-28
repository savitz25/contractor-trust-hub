import { getSitemapChild } from "@/lib/seo/sitemap-data";
import { createSitemapRouteHandlers } from "@/lib/seo/sitemap-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

/**
 * Sitemap shard at /sitemap/:id (rewritten from /sitemap/:id.xml).
 * Shard 0 = static product pages + discovery + first contractor page.
 *
 * Child requests call getSitemapChild. They do not rebuild the index probe
 * loop. The unused plan loader throws so a regression cannot fall back to
 * probing every preceding shard or turn a timed-out predecessor into a page.
 */
export async function GET(_req: Request, { params }: Props) {
  const { id: raw } = await params;
  return createSitemapRouteHandlers(async () => {
    throw new Error("child sitemap must not rebuild the shard plan");
  }, getSitemapChild).child(raw);
}
