import {
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

function unavailableSitemap(): Response {
  return new Response("Sitemap temporarily unavailable", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Test-only plan loader. Production leaves this unset, so both route handlers
 * keep calling getSitemapShardPlan. A test sets it to inject a probe failure
 * without opening a database.
 */
let testPlanLoader: (() => Promise<SitemapShardPlan>) | null = null;

export function useSitemapPlanLoaderForTests(
  loader: (() => Promise<SitemapShardPlan>) | null,
): void {
  testPlanLoader = loader;
}

export function resolveSitemapPlanLoader(
  production: () => Promise<SitemapShardPlan>,
): () => Promise<SitemapShardPlan> {
  return () => (testPlanLoader ?? production)();
}

export function createSitemapRouteHandlers(loadPlan: () => Promise<SitemapShardPlan>) {
  return {
    async index(): Promise<Response> {
      try {
        const plan = await loadPlan();
        // A transient probe stops the planner early. Publishing childIds then
        // tells crawlers the sitemap is complete when later shards were not verified.
        if (plan.retry) return unavailableSitemap();
        return new Response(renderSitemapIndexXml(plan.childIds), {
          status: 200,
          headers: SITEMAP_XML_HEADERS,
        });
      } catch (error) {
        console.error("[sitemap.xml index]", error);
        return unavailableSitemap();
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
          if (plan.retry) return unavailableSitemap();
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
          headers: responseHeaders(plan),
        });
      } catch (error) {
        console.error("[sitemap shard]", id, error);
        return unavailableSitemap();
      }
    },
  };
}
