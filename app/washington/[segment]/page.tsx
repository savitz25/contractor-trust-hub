import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WaCoverageStrip } from "@/components/washington/WaCoverageStrip";
import { WaGeoMethodNote } from "@/components/washington/WaGeoMethodNote";
import { WaOutOfStateNote } from "@/components/washington/WaOutOfStateNote";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { WASHINGTON_PROJECTS } from "@/lib/washington/projects";
import { waGeoIsOutOfState } from "@/lib/washington/geo-copy";
import { waGeoEmptyBody, waGeoLabel } from "@/lib/washington/listing";
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

const PUBLIC = "washington";

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
    const place = waGeoLabel(geo);
    return discoveryMetadata({
      state,
      county: geo,
      title: `${place} WA Contractors — L&I License Evidence`,
      description: `Browse Washington L&I contractor licenses associated with ${place}. Official contractor-license extract — not a marketplace.`,
    });
  }

  const { trade } = resolved;
  return discoveryMetadata({
    state,
    trade,
    title: `Washington ${trade.title} — L&I License Evidence`,
    description: `Browse Washington ${trade.title.toLowerCase()} from the official L&I contractor-license extract. ${trade.description}`,
  });
}

export default async function WashingtonSegmentPage({ params, searchParams }: Props) {
  const { segment } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const state = getDiscoveryState(PUBLIC);
  if (!state) notFound();

  const resolved = resolveDiscoverySegment(state, segment);
  if (!resolved) notFound();

  const offset = (page - 1) * DISCOVERY_PAGE_SIZE;
  const listingProps = {
    verifyHref: "/verify?state=wa",
    browseHref: "/washington",
    browseLabel: "Back to Washington browse",
    hideEntityWhenMissing: true,
  };

  if (resolved.kind === "county") {
    const geo = resolved.county;
    const place = waGeoLabel(geo);
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
            { label: "Washington", href: "/washington" },
            { label: place },
          ]}
        />
        <header className="mt-4 border-b border-[var(--border)] pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Washington · {geo.slug === "out-of-state" ? "Mailing" : geo.kind === "city" ? "City" : "County"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {place} contractors
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
            Active Washington L&I licenses in this view. Lists are ordered for browsing — not ranked
            by quality or paid placement.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {total.toLocaleString()} active contractor{total === 1 ? "" : "s"} in this view
          </p>
          <div className="mt-5 grid max-w-2xl gap-3">
            {waGeoIsOutOfState(geo) ? <WaOutOfStateNote /> : <WaGeoMethodNote geo={geo} />}
            <WaCoverageStrip compact />
          </div>
        </header>

        <div className="mt-8">
          <FacetGrid
            title={`Types in ${place}`}
            facets={trades}
            hrefFor={(slug) => discoveryPath(state, { countySlug: geo.slug, tradeSlug: slug })}
          />
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Projects in {place}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {WASHINGTON_PROJECTS.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/washington/${geo.slug}/${p.slug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 text-xs font-medium text-cyan-950 no-underline"
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
            emptyTitle={`No active L&I licenses found for ${place}`}
            emptyBody={waGeoEmptyBody(geo)}
            {...listingProps}
          />
        </div>

        <div className="mt-10">
          <DiscoveryDisclaimer
            confirmLabel="the official Washington L&I contractor verify site"
            verifyHref="/verify?state=wa"
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
  const officialBits = [
    trade.occupationCodes.join(", "),
    trade.classCodes?.length ? `class ${trade.classCodes.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Washington", href: "/washington" },
          { label: trade.label },
        ]}
      />
      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Washington · Type
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Washington {trade.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {trade.description} Official codes: {officialBits}.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {total.toLocaleString()} active contractor{total === 1 ? "" : "s"}
        </p>
        <p className="mt-4 text-sm">
          <Link href="/verify?state=wa" className="text-[var(--accent)]">
            Prefer search by name or license?
          </Link>
        </p>
        <div className="mt-5 max-w-2xl">
          <WaCoverageStrip compact />
        </div>
      </header>

      <div className="mt-8">
        <FacetGrid
          title={`${trade.label} by county`}
          subtitle="County totals are derived from five-digit mailing ZIP — not an official L&I county field. City pages are separate."
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
          emptyBody="Try another type family, a city, or search by company name."
          {...listingProps}
        />
      </div>

      <div className="mt-10">
        <DiscoveryDisclaimer
          confirmLabel="the official Washington L&I contractor verify site"
          verifyHref="/verify?state=wa"
        />
      </div>
    </main>
  );
}
