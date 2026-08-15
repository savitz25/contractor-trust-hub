import { FloridaFacetFallback } from "@/components/discovery/FloridaFacetFallback";
import { FloridaLandingChrome } from "@/components/discovery/FloridaLandingChrome";

/** Instant curated browse — never a dead “Loading Florida discovery…” skeleton. */
export default function FloridaLoading() {
  return (
    <FloridaLandingChrome>
      <FloridaFacetFallback reason="loading" />
    </FloridaLandingChrome>
  );
}
