import {
  MAX_SITEMAP_SHARDS,
  renderSitemapIndexXml,
  renderUrlSetXml,
  SITEMAP_MAX_URLS_PER_CHILD,
  SITEMAP_XML_HEADERS,
  type SitemapShardPlan,
} from "@/lib/seo/sitemap-data";

function responseHeaders(plan: SitemapShardPlan): HeadersInit {
  if (!plan.retry) return SITEMAP_XML_HEADERS;
  return {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "no-store",
  };
}

export function createSitemapRouteHandlers(loadPlan: () => Promise<SitemapShardPlan>) {
  return {
    async index(): Promise<Response> {
      try {
        const plan = await loadPlan();
        return new Response(renderSitemapIndexXml(plan.childIds), {
          status: 200,
          headers: responseHeaders(plan),
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
      if (id >= MAX_SITEMAP_SHARDS) {
        return new Response("Sitemap shard not found", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      try {
        const plan = await loadPlan();
        // A short probe can drop a later shard while a cached index still
        // lists it. Load that page before answering 503. An empty verified
        // miss stays 404. Only a failed page read stays retryable.
        const entries = plan.childIds.includes(id)
          ? await plan.entriesForChild(id)
          : plan.retry
            ? await plan.entriesForChild(id, { includeUnverified: true })
            : null;
        if (!entries) {
          return new Response("Sitemap shard not found", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        if (entries.length === 0) {
          return new Response("Sitemap shard not found", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        if (entries.length > SITEMAP_MAX_URLS_PER_CHILD) {
          throw new RangeError(`Sitemap child ${id} exceeds ${SITEMAP_MAX_URLS_PER_CHILD} URLs`);
        }

        const xml = renderUrlSetXml(entries);
        // A recovered page is complete even when the manifest probe was not.
        const headers = plan.childIds.includes(id) ? responseHeaders(plan) : SITEMAP_XML_HEADERS;
        return new Response(xml, {
          status: 200,
          headers,
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
