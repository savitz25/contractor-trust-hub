import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import {
  discoveryPath,
  getCounty,
  getDiscoveryState,
  getTrade,
} from "@/lib/discovery/config";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import {
  DISCOVERY_PAGE_SIZE,
  listDiscoveryContractors,
} from "@/lib/discovery/queries";

const PUBLIC = "florida";

/** Avoid parallel SSG DB fan-out against Supabase session pooler limits. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ segment: string; trade: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segment, trade: tradeSlug } = await params;
  const state = getDiscoveryState(PUBLIC);
  if (!state) return { title: "Not found" };
  const county = getCounty(state, segment);
  const trade = getTrade(state, tradeSlug);
  if (!county || !trade) return { title: "Not found", robots: { index: false } };

  return discoveryMetadata({
    state,
    county,
    trade,
    title: `${trade.title} in ${county.name} County FL — License Evidence`,
    description: `Florida ${trade.title.toLowerCase()} with DBPR licenses linked to ${county.name} County. Verify license status, Sunbiz entity, and discipline — independent research, not a marketplace.`,
  });
}

export default async function FloridaCountyTradePage({ params, searchParams }: Props) {
  const { segment, trade: tradeSlug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const state = getDiscoveryState(PUBLIC);
  if (!state) notFound();

  const county = getCounty(state, segment);
  const trade = getTrade(state, tradeSlug);
  if (!county || !trade) notFound();

  const path = discoveryPath(state, { countySlug: county.slug, tradeSlug: trade.slug });
  const { results, total } = await listDiscoveryContractors({
    publicStateSlug: PUBLIC,
    county,
    trade,
    limit: DISCOVERY_PAGE_SIZE,
    offset: (page - 1) * DISCOVERY_PAGE_SIZE,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida", href: discoveryPath(state) },
          { label: county.name, href: discoveryPath(state, { countySlug: county.slug }) },
          { label: trade.label },
        ]}
      />

      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Florida · {county.name} · {trade.label}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {trade.title} in {county.name} County
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {trade.description} Filtered to {county.name} County board location fields. Evidence
          browse only — we do not sell leads or rank paid listings.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {total.toLocaleString()} match{total === 1 ? "" : "es"} in this view
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href={discoveryPath(state, { countySlug: county.slug })}
            className="text-[var(--accent)]"
          >
            All trades in {county.name}
          </Link>
          <span className="text-[var(--border)]">·</span>
          <Link
            href={discoveryPath(state, { tradeSlug: trade.slug })}
            className="text-[var(--accent)]"
          >
            {trade.label} statewide
          </Link>
          <span className="text-[var(--border)]">·</span>
          <Link href="/verify" className="text-[var(--accent)]">
            Search
          </Link>
        </div>
      </header>

      <div className="mt-10">
        <DiscoveryListing
          results={results}
          total={total}
          page={page}
          basePath={path}
          emptyTitle={`No ${trade.label} found in ${county.name}`}
          emptyBody="Try the county-wide list, the statewide trade page, or search by company name."
        />
      </div>

      <div className="mt-10">
        <DiscoveryDisclaimer />
      </div>
    </main>
  );
}
