import type { Metadata } from "next";
import { Suspense } from "react";
import { FloridaStateIntelligence } from "@/components/intelligence/FloridaStateIntelligence";
import { getDiscoveryState } from "@/lib/discovery/config";
import { getFloridaIntelligenceSnapshot } from "@/lib/intelligence/florida-snapshot";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";

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

async function FloridaIntelligenceBody() {
  const payload = await getFloridaIntelligenceSnapshot();
  return <FloridaStateIntelligence payload={payload} />;
}

export default function FloridaLandingPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Florida" },
            ]}
          />
          <div className="mt-4">
            <p className="mt-8 text-sm text-[var(--muted)]" role="status">
              Loading Florida research snapshot…
            </p>
          </div>
        </main>
      }
    >
      <FloridaIntelligenceBody />
    </Suspense>
  );
}
