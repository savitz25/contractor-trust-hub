import {
  getSitemapShardCount,
  renderSitemapIndexXml,
  SITEMAP_XML_HEADERS,
} from "@/lib/seo/sitemap-data";

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
  try {
    const shards = await getSitemapShardCount();
    const xml = renderSitemapIndexXml(shards);
    return new Response(xml, { status: 200, headers: SITEMAP_XML_HEADERS });
  } catch (e) {
    console.error("[sitemap.xml index]", e);
    // Minimal valid index so crawlers never get HTML 404 for this path
    const xml = renderSitemapIndexXml(1);
    return new Response(xml, { status: 200, headers: SITEMAP_XML_HEADERS });
  }
}
