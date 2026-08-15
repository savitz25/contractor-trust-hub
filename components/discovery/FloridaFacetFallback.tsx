import { FacetGrid } from "@/components/discovery/FacetGrid";
import { discoveryPath, getDiscoveryState } from "@/lib/discovery/config";
import {
  floridaCuratedCountyFacets,
  floridaCuratedTradeFacets,
} from "@/lib/discovery/landing-cache";

export function FloridaFacetFallback({
  reason = "unavailable",
}: {
  reason?: "loading" | "unavailable" | "timeout";
}) {
  const state = getDiscoveryState("florida");
  if (!state) return null;
  const subtitle =
    reason === "loading"
      ? "Showing every curated county and trade while live counts load."
      : reason === "timeout"
        ? "Live counts took too long. These are the same county and trade pages — counts appear on the next successful load."
        : "Live counts are unavailable right now. Browse the curated county and trade pages below.";

  return (
    <div className="mt-10 space-y-12">
      <FacetGrid
        title="Browse by county"
        subtitle={subtitle}
        facets={floridaCuratedCountyFacets()}
        showCounts={false}
        hrefFor={(slug) => discoveryPath(state, { countySlug: slug })}
      />
      <FacetGrid
        title="Browse by trade"
        facets={floridaCuratedTradeFacets()}
        showCounts={false}
        hrefFor={(slug) => discoveryPath(state, { tradeSlug: slug })}
      />
    </div>
  );
}
