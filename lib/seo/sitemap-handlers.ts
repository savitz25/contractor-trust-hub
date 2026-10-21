import {
  renderSitemapIndexXml,
  renderUrlSetXml,
  SITEMAP_MAX_URLS_PER_CHILD,
  SITEMAP_XML_HEADERS,
  type SitemapShardPlan,
} from "@/lib/seo/sitemap-data";

export function createSitemapRouteHandlers(loadPlan: () => Promise<SitemapShardPlan>) {
  return {
    async index(): Promise<Response> {
      try {
        const plan = await loadPlan();
        return new Response(renderSitemapIndexXml(plan.childIds), {
          status: 200,
          headers: SITEMAP_XML_HEADERS,
        });
      } catch (error) {
        console.error("[sitemap.xml index]", error);
        return new Response("Sitemap temporarily unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
    },

    async child(rawId: string): Promise<Response> {
      const idText = String(rawId).replace(/\.xml$/i, "");
      if (!/^\d+$/.test(idText)) {
        return new Response("Invalid sitemap id", {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      const id = Number(idText);

      try {
        const plan = await loadPlan();
        if (!plan.childIds.includes(id)) {
          return new Response("Sitemap shard not found", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        const entries = await plan.entriesForChild(id);
        if (entries.length === 0) {
          return new Response("Sitemap shard not found", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        if (entries.length > SITEMAP_MAX_URLS_PER_CHILD) {
          throw new RangeError(`Sitemap child ${id} exceeds ${SITEMAP_MAX_URLS_PER_CHILD} URLs`);
        }

        return new Response(renderUrlSetXml(entries), {
          status: 200,
          headers: SITEMAP_XML_HEADERS,
        });
      } catch (error) {
        console.error("[sitemap shard]", id, error);
        return new Response("Sitemap temporarily unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
    },
  };
}
