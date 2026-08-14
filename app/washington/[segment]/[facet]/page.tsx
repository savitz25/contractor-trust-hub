import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WaCoverageStrip } from "@/components/washington/WaCoverageStrip";
import { WaGeoMethodNote } from "@/components/washington/WaGeoMethodNote";
import { WaOutOfStateNote } from "@/components/washington/WaOutOfStateNote";
import { WaProjectScopeNote } from "@/components/washington/WaProjectScopeNote";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { getWaProject, waProjectAsTrade } from "@/lib/washington/projects";
import { waGeoIsOutOfState } from "@/lib/washington/geo-copy";
import { waGeoEmptyBody, waGeoLabel } from "@/lib/washington/listing";
import {
  discoveryPath,
  getCounty,
  getDiscoveryState,
  getTrade,
} from "@/lib/discovery/config";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import { pageMetadata } from "@/lib/seo/page-meta";
import { DISCOVERY_PAGE_SIZE, listDiscoveryContractors } from "@/lib/discovery/queries";

const PUBLIC = "washington";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ segment: string; facet: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segment, facet } = await params;
  const state = getDiscoveryState(PUBLIC);
  if (!state) return { title: "Not found" };
  const geo = getCounty(state, segment);
  const trade = getTrade(state, facet);
  const project = getWaProject(facet);
  if (!geo || (!trade && !project)) return { title: "Not found", robots: { index: false } };
  const place = waGeoLabel(geo);
  if (trade) {
    return discoveryMetadata({
      state,
      county: geo,
      trade,
      title: `${trade.title} in ${place} WA — L&I License Evidence`,
      description: `Washington ${trade.title.toLowerCase()} with L&I licenses mapped to ${place}. Official contractor-license extract — not a marketplace.`,
    });
  }
  return pageMetadata({
    title: `${project!.title} in ${place} WA — L&I License Research`,
    description: `${project!.description} Location derived from city or ZIP on the L&I extract.`,
    path: `/washington/${geo.slug}/${project!.slug}`,
  });
}

export default async function WashingtonGeoFacetPage({ params, searchParams }: Props) {
  const { segment, facet } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const state = getDiscoveryState(PUBLIC);
  if (!state) notFound();

  const geo = getCounty(state, segment);
  const trade = getTrade(state, facet);
  const project = getWaProject(facet);
  if (!geo || (!trade && !project)) notFound();

  const place = waGeoLabel(geo);
  const offset = (page - 1) * DISCOVERY_PAGE_SIZE;
  const listingProps = {
    verifyHref: "/verify?state=wa",
    browseHref: "/washington",
    browseLabel: "Back to Washington browse",
    hideEntityWhenMissing: true as const,
  };

  if (trade) {
    const path = discoveryPath(state, { countySlug: geo.slug, tradeSlug: trade.slug });
    const { results, total } = await listDiscoveryContractors({
      publicStateSlug: PUBLIC,
      county: geo,
      trade,
      limit: DISCOVERY_PAGE_SIZE,
      offset,
    });
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
            { label: place, href: discoveryPath(state, { countySlug: geo.slug }) },
            { label: trade.label },
          ]}
        />
        <header className="mt-4 border-b border-[var(--border)] pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Washington · {place} · {trade.label}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {trade.title} in {place}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
            {trade.description} Official codes: {officialBits}.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {total.toLocaleString()} active contractor{total === 1 ? "" : "s"}
          </p>
          <div className="mt-5 grid max-w-2xl gap-3">
            {waGeoIsOutOfState(geo) ? (
              <WaOutOfStateNote compact />
            ) : (
              <WaGeoMethodNote geo={geo} compact />
            )}
            <WaCoverageStrip compact />
          </div>
        </header>
        <div className="mt-10">
          <DiscoveryListing
            results={results}
            total={total}
            page={page}
            basePath={path}
            emptyTitle={`No ${trade.label} found in ${place}`}
            emptyBody={`${waGeoEmptyBody(geo)} Or open the statewide ${trade.label.toLowerCase()} list.`}
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

  const primaryTrade = waProjectAsTrade(project!, false);
  let { results, total } = await listDiscoveryContractors({
    publicStateSlug: PUBLIC,
    county: geo,
    trade: primaryTrade,
    limit: DISCOVERY_PAGE_SIZE,
    offset,
  });
  let usedSecondary = false;
  const hasSecondary =
    project!.secondary.occupationCodes.length > 0 ||
    (project!.secondary.classCodes || []).length > 0 ||
    (project!.secondary.descriptionIncludes || []).length > 0;
  if (total < 5 && hasSecondary) {
    usedSecondary = true;
    ({ results, total } = await listDiscoveryContractors({
      publicStateSlug: PUBLIC,
      county: geo,
      trade: waProjectAsTrade(project!, true),
      limit: DISCOVERY_PAGE_SIZE,
      offset,
    }));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Washington", href: "/washington" },
          { label: place, href: discoveryPath(state, { countySlug: geo.slug }) },
          { label: project!.label },
        ]}
      />
      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Washington · {place} · Project
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {project!.title} in {place}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {project!.description}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {total.toLocaleString()} active contractor{total === 1 ? "" : "s"} matching published
          types
        </p>
        <p className="mt-4 text-sm">
          <Link href={`/washington/projects/${project!.slug}`} className="text-[var(--accent)]">
            Statewide {project!.label} list
          </Link>
        </p>
        <div className="mt-5 grid max-w-2xl gap-3">
          {waGeoIsOutOfState(geo) ? (
            <WaOutOfStateNote compact />
          ) : (
            <WaGeoMethodNote geo={geo} compact />
          )}
          <WaCoverageStrip compact />
        </div>
      </header>

      <div className="mt-8">
        <WaProjectScopeNote project={project!} usedSecondary={usedSecondary} />
      </div>

      <div className="mt-10">
        <DiscoveryListing
          results={results}
          total={total}
          page={page}
          basePath={`/washington/${geo.slug}/${project!.slug}`}
          emptyTitle={`No ${project!.label} matches in ${place}`}
          emptyBody={`${waGeoEmptyBody(geo)} Or open the statewide ${project!.label.toLowerCase()} list.`}
          {...listingProps}
          profileQuery={`project=${project!.slug}`}
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
