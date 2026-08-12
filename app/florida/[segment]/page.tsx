import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import {
  discoveryPath,
  getDiscoveryState,
  resolveDiscoverySegment,
} from "@/lib/discovery/config";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import {
  countByTrade,
  countCountiesForTrade,
  DISCOVERY_PAGE_SIZE,
  listDiscoveryContractors,
} from "@/lib/discovery/queries";

const PUBLIC = "florida";

/** Dynamic discovery lists; revalidate facets periodically. */
export const revalidate = 1800;

type Props = {
  params: Promise<{ segment: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segment } = await params;
  const state = getDiscoveryState(PUBLIC);
  if (!state) return { title: "Not found" };
  const resolved = resolveDiscoverySegment(state, segment);
  if (!resolved) return { title: "Not found", robots: { index: false } };

  if (resolved.kind === "county") {
    const { county } = resolved;
    return discoveryMetadata({
      state,
      county,
      title: `${county.name} County FL Contractors — License Evidence`,
      description: `Browse construction contractors with Florida DBPR licenses linked to ${county.name} County. License status, Sunbiz entity, and discipline evidence — not a marketplace.`,
    });
  }

  const { trade } = resolved;
  return discoveryMetadata({
    state,
    trade,
    title: `Florida ${trade.title} — License Verification`,
    description: `Browse Florida ${trade.title.toLowerCase()} with official DBPR license evidence. ${trade.description} Independent research, not a lead board.`,
  });
}

export default async function FloridaSegmentPage({ params, searchParams }: Props) {
  const { segment } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const state = getDiscoveryState(PUBLIC);
  if (!state) notFound();

  const resolved = resolveDiscoverySegment(state, segment);
  if (!resolved) notFound();

  const offset = (page - 1) * DISCOVERY_PAGE_SIZE;

  if (resolved.kind === "county") {
    const { county } = resolved;
    const [{ results, total }, trades] = await Promise.all([
      listDiscoveryContractors({
        publicStateSlug: PUBLIC,
        county,
        limit: DISCOVERY_PAGE_SIZE,
        offset,
      }),
      countByTrade(PUBLIC, county),
    ]);
    const path = discoveryPath(state, { countySlug: county.slug });

    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Florida", href: discoveryPath(state) },
            { label: county.name },
          ]}
        />
        <header className="mt-4 border-b border-[var(--border)] pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Florida · County
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {county.name} County contractors
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
            Construction license evidence for contractors associated with {county.name} County in
            Florida DBPR extracts. Verification research only — not a directory for hire or paid
            rankings.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {total.toLocaleString()} searchable contractor
            {total === 1 ? "" : "s"} in this county view
          </p>
        </header>

        <div className="mt-8">
          <FacetGrid
            title={`Trades in ${county.name}`}
            facets={trades}
            hrefFor={(slug) =>
              discoveryPath(state, { countySlug: county.slug, tradeSlug: slug })
            }
          />
        </div>

        <div className="mt-10">
          <DiscoveryListing
            results={results}
            total={total}
            page={page}
            basePath={path}
            emptyTitle={`No contractors found for ${county.name}`}
            emptyBody="County fields on board extracts are incomplete for some rows. Try statewide search or another county."
          />
        </div>

        <div className="mt-10">
          <DiscoveryDisclaimer />
        </div>
      </main>
    );
  }

  const { trade } = resolved;
  const [{ results, total }, countyFacets] = await Promise.all([
    listDiscoveryContractors({
      publicStateSlug: PUBLIC,
      trade,
      limit: DISCOVERY_PAGE_SIZE,
      offset,
    }),
    countCountiesForTrade(PUBLIC, trade),
  ]);

  const path = discoveryPath(state, { tradeSlug: trade.slug });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida", href: discoveryPath(state) },
          { label: trade.label },
        ]}
      />
      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Florida · Trade
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Florida {trade.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {trade.description} Occupation codes: {trade.occupationCodes.join(", ")}. Independent
          evidence browse — not a marketplace.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {total.toLocaleString()} searchable contractor{total === 1 ? "" : "s"}
        </p>
        <p className="mt-4 text-sm">
          <Link href="/verify" className="text-[var(--accent)]">
            Prefer search by name or license?
          </Link>
        </p>
      </header>

      <div className="mt-8">
        <FacetGrid
          title={`${trade.label} by county`}
          facets={countyFacets}
          hrefFor={(slug) =>
            discoveryPath(state, { countySlug: slug, tradeSlug: trade.slug })
          }
        />
      </div>

      <div className="mt-10">
        <DiscoveryListing
          results={results}
          total={total}
          page={page}
          basePath={path}
          emptyTitle={`No ${trade.label} found`}
          emptyBody="Try another trade category or search by company name."
        />
      </div>

      <div className="mt-10">
        <DiscoveryDisclaimer />
      </div>
    </main>
  );
}
