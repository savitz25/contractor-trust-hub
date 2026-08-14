import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrCoverageStrip } from "@/components/oregon/OrCoverageStrip";
import { OrProjectScopeNote } from "@/components/oregon/OrProjectScopeNote";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { getOrProject, orProjectCodes } from "@/lib/oregon/projects";
import { getDiscoveryState } from "@/lib/discovery/config";
import { pageMetadata } from "@/lib/seo/page-meta";
import {
  countCountiesForTrade,
  DISCOVERY_PAGE_SIZE,
  listDiscoveryContractors,
} from "@/lib/discovery/queries";

const PUBLIC = "oregon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { project: slug } = await params;
  const project = getOrProject(slug);
  if (!project) return { title: "Not found", robots: { index: false } };
  return pageMetadata({
    title: `Oregon ${project.title} — CCB License Research`,
    description: `${project.description} Official CCB Active Licenses extract — not a marketplace.`,
    path: `/oregon/projects/${project.slug}`,
  });
}

export default async function OregonProjectPage({ params, searchParams }: Props) {
  const { project: slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const state = getDiscoveryState(PUBLIC);
  const project = getOrProject(slug);
  if (!state || !project) notFound();

  const primaryTrade = {
    slug: project.slug,
    label: project.label,
    title: project.title,
    description: project.description,
    occupationCodes: orProjectCodes(project, false),
  };

  let { results, total } = await listDiscoveryContractors({
    publicStateSlug: PUBLIC,
    trade: primaryTrade,
    limit: DISCOVERY_PAGE_SIZE,
    offset: (page - 1) * DISCOVERY_PAGE_SIZE,
  });
  let usedSecondary = false;
  if (total < 5 && project.secondaryCodes.length > 0) {
    usedSecondary = true;
    ({ results, total } = await listDiscoveryContractors({
      publicStateSlug: PUBLIC,
      trade: { ...primaryTrade, occupationCodes: orProjectCodes(project, true) },
      limit: DISCOVERY_PAGE_SIZE,
      offset: (page - 1) * DISCOVERY_PAGE_SIZE,
    }));
  }

  const countyFacets = await countCountiesForTrade(PUBLIC, {
    ...primaryTrade,
    occupationCodes: orProjectCodes(project, usedSecondary),
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Oregon", href: "/oregon" },
          { label: project.label },
        ]}
      />
      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Oregon · Project
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {project.title} in Oregon
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {project.description}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {total.toLocaleString()} active contractor{total === 1 ? "" : "s"} matching published types
        </p>
        <p className="mt-4 text-sm">
          <Link href="/verify?state=or" className="text-[var(--accent)]">
            Prefer search by name or CCB number?
          </Link>
        </p>
        <div className="mt-5 max-w-2xl">
          <OrCoverageStrip compact />
        </div>
      </header>

      <div className="mt-8">
        <OrProjectScopeNote project={project} usedSecondary={usedSecondary} />
      </div>

      <div className="mt-8">
        <FacetGrid
          title={`${project.label} by county`}
          subtitle="Official CCB county field."
          facets={countyFacets}
          hrefFor={(slug) => `/oregon/${slug}/${project.slug}`}
        />
      </div>

      <div className="mt-10">
        <DiscoveryListing
          results={results}
          total={total}
          page={page}
          basePath={`/oregon/projects/${project.slug}`}
          emptyTitle={`No published-type matches for ${project.label}`}
          emptyBody="Try a related endorsement family, a county, or search by company name."
          verifyHref="/verify?state=or"
          browseHref="/oregon"
          browseLabel="Back to Oregon browse"
          hideEntityWhenMissing
          profileQuery={`project=${project.slug}`}
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
