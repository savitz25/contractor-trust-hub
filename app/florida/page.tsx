import type { Metadata } from "next";
import { Suspense } from "react";
import { FloridaFacetFallback } from "@/components/discovery/FloridaFacetFallback";
import { FloridaLandingChrome } from "@/components/discovery/FloridaLandingChrome";
import { FloridaLandingFacets } from "@/components/discovery/FloridaLandingFacets";
import { getDiscoveryState } from "@/lib/discovery/config";
import { getFloridaLandingSnapshot } from "@/lib/discovery/landing-cache";
import { discoveryMetadata } from "@/lib/discovery/metadata";

const PUBLIC = "florida";

/**
 * Dynamic so Vercel SSG does not open many parallel DB sessions
 * (Supabase session pooler EMAXCONNSESSION). Landing aggregations are
 * cached separately (see lib/discovery/landing-cache.ts).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const state = getDiscoveryState(PUBLIC)!;
  return discoveryMetadata({
    state,
    title: "Florida Contractor Verification — Browse by County & Trade",
    description:
      "Browse Florida DBPR construction license evidence by county and trade. Independent Trust Reports with license status, Sunbiz entity links, and discipline — not a marketplace.",
  });
}

async function FloridaLandingBody() {
  const snap = await getFloridaLandingSnapshot();
  return (
    <FloridaLandingChrome stats={snap.stats}>
      <FloridaLandingFacets snapshot={snap} />
    </FloridaLandingChrome>
  );
}

export default function FloridaLandingPage() {
  return (
    <Suspense
      fallback={
        <FloridaLandingChrome>
          <FloridaFacetFallback reason="loading" />
        </FloridaLandingChrome>
      }
    >
      <FloridaLandingBody />
    </Suspense>
  );
}
