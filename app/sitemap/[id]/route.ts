import {
  getSitemapShardCount,
  getSitemapShardEntries,
  renderUrlSetXml,
  SITEMAP_XML_HEADERS,
} from "@/lib/seo/sitemap-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

/**
 * Sitemap shard at /sitemap/:id (rewritten from /sitemap/:id.xml).
 * Shard 0 = static product pages + discovery + first contractor page.
 */
export async function GET(_req: Request, { params }: Props) {
  const { id: raw } = await params;
  // Accept "0" or "0.xml" if rewrite is bypassed
  const id = Number(String(raw).replace(/\.xml$/i, ""));

  if (!Number.isInteger(id) || id < 0) {
    return new Response("Invalid sitemap id", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const max = await getSitemapShardCount();
  if (id >= max) {
    return new Response("Sitemap shard not found", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    const entries = await getSitemapShardEntries(id);
    const xml = renderUrlSetXml(entries);
    return new Response(xml, { status: 200, headers: SITEMAP_XML_HEADERS });
  } catch (e) {
    console.error("[sitemap shard]", id, e);
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
