import type { Metadata } from "next";
import { FloridaStateIntelligence } from "@/components/intelligence/FloridaStateIntelligence";
import { getDiscoveryState } from "@/lib/discovery/config";
import { getFloridaIntelligenceSnapshot } from "@/lib/intelligence/florida-snapshot";
import { discoveryMetadata } from "@/lib/discovery/metadata";

const PUBLIC = "florida";

/**
 * Dynamic so Vercel SSG does not open many parallel DB sessions
 * (Supabase session pooler EMAXCONNSESSION). Intelligence aggregations are
 * cached in lib/intelligence/florida-snapshot.ts.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const state = getDiscoveryState(PUBLIC)!;
  return discoveryMetadata({
    state,
    title: "Florida Contractor Intelligence — License, County & Public-Record Research",
    description:
      "Research Florida contractor credentials, trade categories, HQ/base county distribution, and public regulatory records. Independent Trust Hub research — not a marketplace or ranking.",
  });
}

/**
 * FL-SEO-SERVER-RENDER-001: no Suspense / loading.tsx boundary on /florida.
 * The snapshot is cached (unstable_cache, 30 min) and bounded by a 6s
 * timeout that falls back to the static source catalog, so the full research
 * body is in the initial server HTML instead of a "Loading…" placeholder.
 */
export default async function FloridaLandingPage() {
  const payload = await getFloridaIntelligenceSnapshot();
  return <FloridaStateIntelligence payload={payload} />;
}
