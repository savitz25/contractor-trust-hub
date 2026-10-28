import {
  logSitemapTiming,
  renderSitemapIndexXml,
  renderUrlSetXml,
  SITEMAP_MAX_URLS_PER_CHILD,
  SITEMAP_XML_HEADERS,
  type SitemapChildLookup,
  type SitemapShardPlan,
} from "@/lib/seo/sitemap-data";

const UNAVAILABLE = "Sitemap temporarily unavailable";
const NOT_FOUND = "Sitemap shard not found";

function xmlHeaders(retry: boolean): HeadersInit {
  if (!retry) return SITEMAP_XML_HEADERS;
  return {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "no-store",
  };
}

function plainResponse(status: number, body: string, noStore: boolean): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...(noStore ? { "Cache-Control": "no-store" } : {}),
    },
  });
}

function byteLength(body: string): number {
  return new TextEncoder().encode(body).byteLength;
}

function recordSitemapTiming(timing: {
  route: "index" | "child";
  id?: number;
  status: number;
  bytes: number;
  probeMs: number;
  fetchMs: number;
  filterMs: number;
  xmlMs: number;
}): void {
  logSitemapTiming(timing);
}

function unavailableResponse(
  route: "index" | "child",
  id: number | undefined,
  timings: { probeMs: number; fetchMs: number; filterMs: number; xmlMs: number },
): Response {
  recordSitemapTiming({
    route,
    id,
    status: 503,
    bytes: byteLength(UNAVAILABLE),
    ...timings,
  });
  return plainResponse(503, UNAVAILABLE, true);
}

export function createSitemapRouteHandlers(
  loadPlan: () => Promise<SitemapShardPlan>,
  loadChild?: (id: number) => Promise<SitemapChildLookup>,
) {
  return {
    async index(): Promise<Response> {
      try {
        const plan = await loadPlan();
        const xmlStarted = performance.now();
        const xml = renderSitemapIndexXml(plan.childIds);
        const xmlMs = performance.now() - xmlStarted;
        recordSitemapTiming({
          route: "index",
          status: 200,
          bytes: byteLength(xml),
          probeMs: plan.timings.probeMs,
          fetchMs: 0,
          filterMs: plan.timings.filterMs,
          xmlMs,
        });
        return new Response(xml, {
          status: 200,
          headers: xmlHeaders(plan.retry),
        });
      } catch (error) {
        console.error("[sitemap.xml index]", error);
        return unavailableResponse("index", undefined, {
          probeMs: 0,
          fetchMs: 0,
          filterMs: 0,
          xmlMs: 0,
        });
      }
    },

    async child(rawId: string): Promise<Response> {
      const idText = String(rawId).replace(/\.xml$/i, "");
      if (!/^\d+$/.test(idText)) {
        return plainResponse(400, "Invalid sitemap id", false);
      }
      const id = Number(idText);
      if (loadChild) return serveLookedUpChild(id, loadChild);
      return servePlannedChild(id, loadPlan);
    },
  };
}

async function serveLookedUpChild(
  id: number,
  loadChild: (id: number) => Promise<SitemapChildLookup>,
): Promise<Response> {
  try {
    const lookup = await loadChild(id);
    if (lookup.status === 200 && lookup.entries.length > SITEMAP_MAX_URLS_PER_CHILD) {
      throw new RangeError(`Sitemap child ${id} exceeds ${SITEMAP_MAX_URLS_PER_CHILD} URLs`);
    }

    const xmlStarted = performance.now();
    let body: string;
    let headers: HeadersInit;
    if (lookup.status === 404) {
      body = NOT_FOUND;
      headers = { "Content-Type": "text/plain; charset=utf-8" };
    } else if (lookup.status === 503) {
      body = UNAVAILABLE;
      headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
    } else if (lookup.status !== 200) {
      throw new Error(`Unexpected sitemap child status ${lookup.status}`);
    } else {
      body = renderUrlSetXml(lookup.entries);
      headers = xmlHeaders(lookup.retry);
    }
    const xmlMs = lookup.status === 200 ? performance.now() - xmlStarted : 0;
    recordSitemapTiming({
      route: "child",
      id,
      status: lookup.status,
      bytes: byteLength(body),
      probeMs: lookup.timings.probeMs,
      fetchMs: lookup.timings.fetchMs,
      filterMs: lookup.timings.filterMs,
      xmlMs,
    });
    return new Response(body, { status: lookup.status, headers });
  } catch (error) {
    console.error("[sitemap shard]", id, error);
    return unavailableResponse("child", id, {
      probeMs: 0,
      fetchMs: 0,
      filterMs: 0,
      xmlMs: 0,
    });
  }
}

async function servePlannedChild(
  id: number,
  loadPlan: () => Promise<SitemapShardPlan>,
): Promise<Response> {
  try {
    const plan = await loadPlan();
    if (!plan.childIds.includes(id)) {
      if (plan.retry) {
        return unavailableResponse("child", id, {
          probeMs: plan.timings.probeMs,
          fetchMs: 0,
          filterMs: plan.timings.filterMs,
          xmlMs: 0,
        });
      }
      const body = NOT_FOUND;
      recordSitemapTiming({
        route: "child",
        id,
        status: 404,
        bytes: byteLength(body),
        probeMs: plan.timings.probeMs,
        fetchMs: 0,
        filterMs: plan.timings.filterMs,
        xmlMs: 0,
      });
      return plainResponse(404, body, false);
    }

    const fetchStarted = performance.now();
    const entries = await plan.entriesForChild(id);
    const fetchMs = performance.now() - fetchStarted;
    if (entries.length === 0) {
      const body = NOT_FOUND;
      recordSitemapTiming({
        route: "child",
        id,
        status: 404,
        bytes: byteLength(body),
        probeMs: plan.timings.probeMs,
        fetchMs,
        filterMs: plan.timings.filterMs,
        xmlMs: 0,
      });
      return plainResponse(404, body, false);
    }
    if (entries.length > SITEMAP_MAX_URLS_PER_CHILD) {
      throw new RangeError(`Sitemap child ${id} exceeds ${SITEMAP_MAX_URLS_PER_CHILD} URLs`);
    }

    const xmlStarted = performance.now();
    const xml = renderUrlSetXml(entries);
    const xmlMs = performance.now() - xmlStarted;
    recordSitemapTiming({
      route: "child",
      id,
      status: 200,
      bytes: byteLength(xml),
      probeMs: plan.timings.probeMs,
      fetchMs,
      filterMs: plan.timings.filterMs,
      xmlMs,
    });
    return new Response(xml, {
      status: 200,
      headers: xmlHeaders(plan.retry),
    });
  } catch (error) {
    console.error("[sitemap shard]", id, error);
    return unavailableResponse("child", id, {
      probeMs: 0,
      fetchMs: 0,
      filterMs: 0,
      xmlMs: 0,
    });
  }
}
