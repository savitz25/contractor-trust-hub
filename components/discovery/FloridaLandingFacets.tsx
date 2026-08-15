import { FacetGrid } from "@/components/discovery/FacetGrid";
import { FloridaFacetFallback } from "@/components/discovery/FloridaFacetFallback";
import { discoveryPath, getDiscoveryState } from "@/lib/discovery/config";
import type { FloridaLandingSnapshot } from "@/lib/discovery/landing-cache";

export function FloridaLandingFacets({ snapshot }: { snapshot: FloridaLandingSnapshot }) {
  const state = getDiscoveryState("florida");
  if (!state) return null;

  if (
    snapshot.timedOut ||
    (snapshot.counties.length === 0 && snapshot.trades.length === 0)
  ) {
    return <FloridaFacetFallback reason={snapshot.timedOut ? "timeout" : "unavailable"} />;
  }

  return (
    <div className="mt-10 space-y-12">
      <FacetGrid
        title="Browse by county"
        facets={snapshot.counties}
        hrefFor={(slug) => discoveryPath(state, { countySlug: slug })}
      />
      <FacetGrid
        title="Browse by trade"
        facets={snapshot.trades}
        hrefFor={(slug) => discoveryPath(state, { tradeSlug: slug })}
      />
    </div>
  );
}
