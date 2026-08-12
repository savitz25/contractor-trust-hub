import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { SearchForm } from "@/components/search/SearchForm";
import { discoveryPath, getDiscoveryState } from "@/lib/discovery/config";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import {
  countCountiesBatch,
  countTradesBatch,
  getStateDiscoveryStats,
} from "@/lib/discovery/queries";

const PUBLIC = "florida";

/** Refresh landing stats periodically (build-time cache is fine otherwise). */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const state = getDiscoveryState(PUBLIC)!;
  return discoveryMetadata({
    state,
    title: "Florida Contractor Verification — Browse by County & Trade",
    description:
      "Browse Florida DBPR construction license evidence by county and trade. Independent Trust Reports with license status, Sunbiz entity links, and discipline — not a marketplace.",
  });
}

export default async function FloridaLandingPage() {
  const state = getDiscoveryState(PUBLIC)!;
  const [stats, counties, trades] = await Promise.all([
    getStateDiscoveryStats(PUBLIC),
    countCountiesBatch(PUBLIC),
    countTradesBatch(PUBLIC),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida" },
        ]}
      />

      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Discovery · {state.shortName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Florida contractor verification
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
          {state.blurb}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Searchable contractors", value: stats.contractors },
            { label: "Board licenses", value: stats.licenses },
            { label: "High-confidence Sunbiz links", value: stats.sunbizLinks },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3"
            >
              <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">
                {s.value > 0 ? s.value.toLocaleString() : "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="mb-3 text-sm font-medium text-[var(--text)]">
            Already have a name or license number?
          </p>
          <SearchForm size="default" />
        </div>
      </header>

      <div className="mt-10 space-y-12">
        <FacetGrid
          title="Browse by county"
          facets={counties}
          hrefFor={(slug) => discoveryPath(state, { countySlug: slug })}
        />
        <FacetGrid
          title="Browse by trade"
          facets={trades}
          hrefFor={(slug) => discoveryPath(state, { tradeSlug: slug })}
        />
      </div>

      <div className="mt-12 space-y-4">
        <DiscoveryDisclaimer />
        <p className="text-sm text-[var(--muted)]">
          Looking for a specific firm?{" "}
          <Link href="/verify" className="text-[var(--accent)]">
            Use search
          </Link>{" "}
          for the fastest path to a Trust Report.
        </p>
      </div>
    </main>
  );
}
