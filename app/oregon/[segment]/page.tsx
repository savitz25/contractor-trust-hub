import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrCoverageStrip } from "@/components/oregon/OrCoverageStrip";
import { OrOutOfStateNote } from "@/components/oregon/OrOutOfStateNote";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { OREGON_PROJECTS } from "@/lib/oregon/projects";
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

const PUBLIC = "oregon";

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
    const { county } = resolved;
    return discoveryMetadata({
      state,
      county,
      title: `${county.name} County OR Contractors — CCB License Evidence`,
      description: `Browse Oregon CCB active licenses in ${county.name} County. Official county field on the Active Licenses extract — not a marketplace.`,
    });
  }

  const { trade } = resolved;
  return discoveryMetadata({
    state,
    trade,
    title: `Oregon ${trade.title} — CCB License Evidence`,
    description: `Browse Oregon ${trade.title.toLowerCase()} from the official CCB Active Licenses extract. ${trade.description}`,
  });
}

export default async function OregonSegmentPage({ params, searchParams }: Props) {
  const { segment } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const state = getDiscoveryState(PUBLIC);
  if (!state) notFound();

  const resolved = resolveDiscoverySegment(state, segment);
  if (!resolved) notFound();

  const offset = (page - 1) * DISCOVERY_PAGE_SIZE;
  const listingProps = {
    verifyHref: "/verify?state=or",
    browseHref: "/oregon",
    browseLabel: "Back to Oregon browse",
    hideEntityWhenMissing: true,
  };

  if (resolved.kind === "county") {
    const { county } = resolved;
    const isOut = county.slug === "out-of-state";
    const place = isOut ? "Out of state" : `${county.name} County`;
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
            { label: "Oregon", href: "/oregon" },
            { label: place },
          ]}
        />
        <header className="mt-4 border-b border-[var(--border)] pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Oregon · {isOut ? "Mailing location" : "County"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {place} contractors
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
            {isOut
              ? "Official CCB county field is Out of State. These are CCB-licensed businesses with a non-Oregon mailing address. Mailing address is not the jobsite."
              : `Oregon CCB active licenses with official county ${county.name}. County comes from the CCB extract, not a derived map.`}{" "}
            Active-first browse — not a ranking.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {total.toLocaleString()} active contractor{total === 1 ? "" : "s"} in this view
          </p>
          <div className="mt-5 grid max-w-2xl gap-3">
            {isOut ? <OrOutOfStateNote /> : null}
            <OrCoverageStrip compact />
          </div>
        </header>

        <div className="mt-8">
          <FacetGrid
            title={`Endorsement families in ${place}`}
            facets={trades}
            hrefFor={(slug) => discoveryPath(state, { countySlug: county.slug, tradeSlug: slug })}
          />
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Projects in {place}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {OREGON_PROJECTS.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/oregon/${county.slug}/${p.slug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-950 no-underline"
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
            emptyTitle={`No active CCB licenses found for ${place}`}
            emptyBody={
              isOut
                ? "No active CCB rows with county Out of State in this view. Try an Oregon county, an endorsement family, or search by name. Mailing address is not the jobsite."
                : "Try another county, an endorsement family, or search by company name."
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
          { label: "Oregon", href: "/oregon" },
          { label: trade.label },
        ]}
      />
      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Oregon · Endorsement
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Oregon {trade.title}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {trade.description} Official type: {trade.occupationCodes.join(", ")}.
          {trade.slug === "residential-specialty"
            ? " RSC is an unnamed specialty — this list is not proof of roofing, HVAC, plumbing, or electrical."
            : ""}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {total.toLocaleString()} active contractor{total === 1 ? "" : "s"}
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
        <FacetGrid
          title={`${trade.label} by county`}
          subtitle="Official CCB county field."
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
          emptyBody="Try another endorsement family, a county, or search by company name."
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
