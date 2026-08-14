import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WaCoverageStrip } from "@/components/washington/WaCoverageStrip";
import { WaProjectScopeNote } from "@/components/washington/WaProjectScopeNote";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { getWaProject, waProjectAsTrade } from "@/lib/washington/projects";
import { getDiscoveryState } from "@/lib/discovery/config";
import { pageMetadata } from "@/lib/seo/page-meta";
import {
  countCountiesForTrade,
  DISCOVERY_PAGE_SIZE,
  listDiscoveryContractors,
} from "@/lib/discovery/queries";

const PUBLIC = "washington";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { project: slug } = await params;
  const project = getWaProject(slug);
  if (!project) return { title: "Not found", robots: { index: false } };
  return pageMetadata({
    title: `Washington ${project.title} — L&I License Research`,
    description: `${project.description} Official L&I contractor-license extract — not a marketplace.`,
    path: `/washington/projects/${project.slug}`,
  });
}

export default async function WashingtonProjectPage({ params, searchParams }: Props) {
  const { project: slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const state = getDiscoveryState(PUBLIC);
  const project = getWaProject(slug);
  if (!state || !project) notFound();

  const primaryTrade = waProjectAsTrade(project, false);

  let { results, total } = await listDiscoveryContractors({
    publicStateSlug: PUBLIC,
    trade: primaryTrade,
    limit: DISCOVERY_PAGE_SIZE,
    offset: (page - 1) * DISCOVERY_PAGE_SIZE,
  });
  let usedSecondary = false;
  const hasSecondary =
    project.secondary.occupationCodes.length > 0 ||
    (project.secondary.classCodes || []).length > 0 ||
    (project.secondary.descriptionIncludes || []).length > 0;
  if (total < 5 && hasSecondary) {
    usedSecondary = true;
    ({ results, total } = await listDiscoveryContractors({
      publicStateSlug: PUBLIC,
      trade: waProjectAsTrade(project, true),
      limit: DISCOVERY_PAGE_SIZE,
      offset: (page - 1) * DISCOVERY_PAGE_SIZE,
    }));
  }

  const countyFacets = await countCountiesForTrade(
    PUBLIC,
    waProjectAsTrade(project, usedSecondary)
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Washington", href: "/washington" },
          { label: project.label },
        ]}
      />
      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Washington · Project
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {project.title} in Washington
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {project.description}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {total.toLocaleString()} active contractor{total === 1 ? "" : "s"} matching published
          types
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
        <WaProjectScopeNote project={project} usedSecondary={usedSecondary} />
      </div>

      <div className="mt-8">
        <FacetGrid
          title={`${project.label} by county`}
          subtitle="County totals are derived from five-digit mailing ZIP — not an official L&I county field."
          facets={countyFacets}
          hrefFor={(slug) => `/washington/${slug}/${project.slug}`}
        />
      </div>

      <div className="mt-10">
        <DiscoveryListing
          results={results}
          total={total}
          page={page}
          basePath={`/washington/projects/${project.slug}`}
          emptyTitle={`No published-type matches for ${project.label}`}
          emptyBody="Try a related type, a city, or search by company name."
          verifyHref="/verify?state=wa"
          browseHref="/washington"
          browseLabel="Back to Washington browse"
          hideEntityWhenMissing
          profileQuery={`project=${project.slug}`}
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
