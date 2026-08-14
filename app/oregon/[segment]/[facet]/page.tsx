import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrCoverageStrip } from "@/components/oregon/OrCoverageStrip";
import { OrOutOfStateNote } from "@/components/oregon/OrOutOfStateNote";
import { OrProjectScopeNote } from "@/components/oregon/OrProjectScopeNote";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { getOrProject, orProjectCodes } from "@/lib/oregon/projects";
import {
  discoveryPath,
  getCounty,
  getDiscoveryState,
  getTrade,
} from "@/lib/discovery/config";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import { pageMetadata } from "@/lib/seo/page-meta";
import { DISCOVERY_PAGE_SIZE, listDiscoveryContractors } from "@/lib/discovery/queries";

const PUBLIC = "oregon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ segment: string; facet: string }>;
  searchParams: Promise<{ page?: string }>;
};

function countyLabel(slug: string, name: string): string {
  return slug === "out-of-state" ? "Out of state" : `${name} County`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segment, facet } = await params;
  const state = getDiscoveryState(PUBLIC);
  if (!state) return { title: "Not found" };
  const county = getCounty(state, segment);
  const trade = getTrade(state, facet);
  const project = getOrProject(facet);
  if (!county || (!trade && !project)) return { title: "Not found", robots: { index: false } };
  const place = countyLabel(county.slug, county.name);
  if (trade) {
    return discoveryMetadata({
      state,
      county,
      trade,
      title: `${trade.title} in ${place} OR — CCB License Evidence`,
      description: `Oregon ${trade.title.toLowerCase()} with CCB active licenses in ${place}. Official extract — not a marketplace.`,
    });
  }
  return pageMetadata({
    title: `${project!.title} in ${place} OR — CCB License Research`,
    description: `${project!.description} Official CCB county field.`,
    path: `/oregon/${county.slug}/${project!.slug}`,
  });
}

export default async function OregonCountyFacetPage({ params, searchParams }: Props) {
  const { segment, facet } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const state = getDiscoveryState(PUBLIC);
  if (!state) notFound();

  const county = getCounty(state, segment);
  const trade = getTrade(state, facet);
  const project = getOrProject(facet);
  if (!county || (!trade && !project)) notFound();

  const place = countyLabel(county.slug, county.name);
  const offset = (page - 1) * DISCOVERY_PAGE_SIZE;
  const listingProps = {
    verifyHref: "/verify?state=or",
    browseHref: "/oregon",
    browseLabel: "Back to Oregon browse",
    hideEntityWhenMissing: true as const,
  };

  if (trade) {
    const path = discoveryPath(state, { countySlug: county.slug, tradeSlug: trade.slug });
    const { results, total } = await listDiscoveryContractors({
      publicStateSlug: PUBLIC,
      county,
      trade,
      limit: DISCOVERY_PAGE_SIZE,
      offset,
    });

    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Oregon", href: "/oregon" },
            { label: place, href: discoveryPath(state, { countySlug: county.slug }) },
            { label: trade.label },
          ]}
        />
        <header className="mt-4 border-b border-[var(--border)] pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Oregon · {place} · {trade.label}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {trade.title} in {place}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
            {trade.description} Official type: {trade.occupationCodes.join(", ")}.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {total.toLocaleString()} active contractor{total === 1 ? "" : "s"}
          </p>
          <div className="mt-5 grid max-w-2xl gap-3">
            {county.slug === "out-of-state" ? <OrOutOfStateNote compact /> : null}
            <OrCoverageStrip compact />
          </div>
        </header>
        <div className="mt-10">
          <DiscoveryListing
            results={results}
            total={total}
            page={page}
            basePath={path}
            emptyTitle={`No ${trade.label} found in ${place}`}
            emptyBody={
              county.slug === "out-of-state"
                ? "No matching CCB rows with an out-of-state mailing address in this view. Try an Oregon county or search by name. Mailing address is not the jobsite."
                : "Try the statewide endorsement list, another county, or search by name."
            }
            {...listingProps}
          />
        </div>
        <div className="mt-10">
          <DiscoveryDisclaimer
            confirmLabel="the official Oregon CCB search"
            verifyHref="/verify?state=or"
          />
        </div>
      </main>
    );
  }

  const primaryTrade = {
    slug: project!.slug,
    label: project!.label,
    title: project!.title,
    description: project!.description,
    occupationCodes: orProjectCodes(project!, false),
  };
  let { results, total } = await listDiscoveryContractors({
    publicStateSlug: PUBLIC,
    county,
    trade: primaryTrade,
    limit: DISCOVERY_PAGE_SIZE,
    offset,
  });
  let usedSecondary = false;
  if (total < 5 && project!.secondaryCodes.length > 0) {
    usedSecondary = true;
    ({ results, total } = await listDiscoveryContractors({
      publicStateSlug: PUBLIC,
      county,
      trade: { ...primaryTrade, occupationCodes: orProjectCodes(project!, true) },
      limit: DISCOVERY_PAGE_SIZE,
      offset,
    }));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Oregon", href: "/oregon" },
          { label: place, href: discoveryPath(state, { countySlug: county.slug }) },
          { label: project!.label },
        ]}
      />
      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Oregon · {place} · Project
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {project!.title} in {place}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {project!.description}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {total.toLocaleString()} active contractor{total === 1 ? "" : "s"} matching published types
        </p>
        <p className="mt-4 text-sm">
          <Link href={`/oregon/projects/${project!.slug}`} className="text-[var(--accent)]">
            Statewide {project!.label} list
          </Link>
        </p>
        <div className="mt-5 grid max-w-2xl gap-3">
          {county.slug === "out-of-state" ? <OrOutOfStateNote compact /> : null}
          <OrCoverageStrip compact />
        </div>
      </header>

      <div className="mt-8">
        <OrProjectScopeNote project={project!} usedSecondary={usedSecondary} />
      </div>

      <div className="mt-10">
        <DiscoveryListing
          results={results}
          total={total}
          page={page}
          basePath={`/oregon/${county.slug}/${project!.slug}`}
          emptyTitle={`No ${project!.label} matches in ${place}`}
          emptyBody={
            county.slug === "out-of-state"
              ? "No matching CCB rows with an out-of-state mailing address in this view. Try the statewide project list or an Oregon county. Mailing address is not the jobsite."
              : "Try the statewide project list, another county, or search by name."
          }
          {...listingProps}
          profileQuery={`project=${project!.slug}`}
        />
      </div>
      <div className="mt-10">
        <DiscoveryDisclaimer
          confirmLabel="the official Oregon CCB search"
          verifyHref="/verify?state=or"
        />
      </div>
    </main>
  );
}
