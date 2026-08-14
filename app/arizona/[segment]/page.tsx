import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AzCoverageStrip } from "@/components/arizona/AzCoverageStrip";
import { AzGeoMethodNote } from "@/components/arizona/AzGeoMethodNote";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { ARIZONA_PROJECTS } from "@/lib/arizona/projects";
import { azGeoEmptyBody, azGeoLabel } from "@/lib/arizona/listing";
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

const PUBLIC = "arizona";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const geo = resolved.county;
    const place = azGeoLabel(geo);
    return discoveryMetadata({
      state,
      county: geo,
      title: `${place} AZ Contractors — ROC License Evidence`,
      description: `Browse Arizona ROC current contractor licenses associated with ${place}. Official posting-list evidence — not a marketplace.`,
    });
  }

  const { trade } = resolved;
  return discoveryMetadata({
    state,
    trade,
    title: `Arizona ${trade.title} — ROC License Evidence`,
    description: `Browse Arizona ${trade.title.toLowerCase()} from the official ROC current posting list. ${trade.description}`,
  });
}

export default async function ArizonaSegmentPage({ params, searchParams }: Props) {
  const { segment } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const state = getDiscoveryState(PUBLIC);
  if (!state) notFound();

  const resolved = resolveDiscoverySegment(state, segment);
  if (!resolved) notFound();

  const offset = (page - 1) * DISCOVERY_PAGE_SIZE;
  const listingProps = {
    verifyHref: "/verify?state=az",
    browseHref: "/arizona",
    browseLabel: "Back to Arizona browse",
    hideEntityWhenMissing: true,
  };

  if (resolved.kind === "county") {
    const geo = resolved.county;
    const place = azGeoLabel(geo);
    const [{ results, total }, trades] = await Promise.all([
      listDiscoveryContractors({
        publicStateSlug: PUBLIC,
        county: geo,
        limit: DISCOVERY_PAGE_SIZE,
        offset,
      }),
      countByTrade(PUBLIC, geo),
    ]);
    const path = discoveryPath(state, { countySlug: geo.slug });

    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Arizona", href: "/arizona" },
            { label: place },
          ]}
        />
        <header className="mt-4 border-b border-[var(--border)] pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Arizona · {geo.kind === "city" ? "City" : "County"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {place} contractors
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
            Active Arizona ROC licenses in this view. Lists are ordered for browsing — not ranked by
            quality or paid placement.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {total.toLocaleString()} active contractor{total === 1 ? "" : "s"} in this view
          </p>
          <div className="mt-5 grid max-w-2xl gap-3">
            <AzGeoMethodNote geo={geo} />
            <AzCoverageStrip compact />
          </div>
        </header>

        <div className="mt-8">
          <FacetGrid
            title={`Trades in ${place}`}
            facets={trades}
            hrefFor={(slug) => discoveryPath(state, { countySlug: geo.slug, tradeSlug: slug })}
          />
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Projects in {place}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {ARIZONA_PROJECTS.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/arizona/${geo.slug}/${p.slug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-950 no-underline"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <DiscoveryListing
            results={results}
            total={total}
            page={page}
            basePath={path}
            emptyTitle={`No active ROC licenses found for ${place}`}
            emptyBody={azGeoEmptyBody(geo)}
            {...listingProps}
          />
        </div>

        <div className="mt-10">
          <DiscoveryDisclaimer
            confirmLabel="the official Arizona ROC contractor search"
            verifyHref="/verify?state=az"
          />
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
          { label: "Arizona", href: "/arizona" },
          { label: trade.label },
        ]}
      />
      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Arizona · Trade
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Arizona {trade.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {trade.description} Official class codes: {trade.occupationCodes.join(", ")}.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {total.toLocaleString()} active contractor{total === 1 ? "" : "s"}
        </p>
        <p className="mt-4 text-sm">
          <Link href="/verify?state=az" className="text-[var(--accent)]">
            Prefer search by name or license?
          </Link>
        </p>
        <div className="mt-5 max-w-2xl">
          <AzCoverageStrip compact />
        </div>
      </header>

      <div className="mt-8">
        <FacetGrid
          title={`${trade.label} by county`}
          subtitle="County totals are derived from mailing city — not an official ROC county field."
          facets={countyFacets}
          hrefFor={(slug) => discoveryPath(state, { countySlug: slug, tradeSlug: trade.slug })}
        />
      </div>

      <div className="mt-10">
        <DiscoveryListing
          results={results}
          total={total}
          page={page}
          basePath={path}
          emptyTitle={`No ${trade.label} found`}
          emptyBody="Try another class family, a city, or search by company name."
          {...listingProps}
        />
      </div>

      <div className="mt-10">
        <DiscoveryDisclaimer
          confirmLabel="the official Arizona ROC contractor search"
          verifyHref="/verify?state=az"
        />
      </div>
    </main>
  );
}
