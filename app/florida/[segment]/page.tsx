import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { FloridaBrowseSection } from "@/components/discovery/FloridaBrowseSection";
import {
  browseIsVariant,
  parseBrowseParams,
  parseBrowseView,
} from "@/lib/discovery/browse";
import {
  discoveryPath,
  getDiscoveryState,
  resolveDiscoverySegment,
} from "@/lib/discovery/config";
import {
  loadFloridaCountyPage,
  loadFloridaTradePage,
} from "@/lib/discovery/florida-directory-page";
import { isFloridaDirectoryUnavailableError } from "@/lib/discovery/florida-list";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import { CountyIntelligence } from "@/components/intelligence/CountyIntelligence";
import { isFloridaCountyIntelSlug } from "@/lib/intelligence/coverage";
import {
  getFloridaCountyIntelligenceSnapshotOnce,
  isCountyIntelComplete,
} from "@/lib/intelligence/county-snapshot";

const PUBLIC = "florida";

/** Avoid parallel SSG DB fan-out against Supabase session pooler limits. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ segment: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { segment } = await params;
  const sp = await searchParams;
  const browse = parseBrowseParams(sp);
  const state = getDiscoveryState(PUBLIC);
  if (!state) return { title: "Not found", robots: { index: false } };
  const resolved = resolveDiscoverySegment(state, segment);
  if (!resolved) return { title: "Not found", robots: { index: false } };

  if (resolved.kind === "county") {
    const { county } = resolved;
    // FL-DIR-PERF-003: robots come from the same request-scoped reads as the
    // body. A failed directory read is noindex here and 500 in the body; a
    // failed side list keeps the 200 page out of the index.
    let degraded = false;
    if (countyShowsDirectory(county.slug, browse, sp)) {
      try {
        degraded = !(await loadFloridaCountyPage(county, browse)).complete;
      } catch (err) {
        if (!isFloridaDirectoryUnavailableError(err)) throw err;
        degraded = true;
      }
    }
    // FL-DIR-PERF-003 (research completeness): a timed-out or partial county
    // research snapshot (missing statewide comparison) is never indexable.
    if (isFloridaCountyIntelSlug(county.slug)) {
      const intel = await getFloridaCountyIntelligenceSnapshotOnce(county.slug);
      if (!isCountyIntelComplete(intel)) degraded = true;
    }
    return discoveryMetadata({
      state,
      county,
      title: isFloridaCountyIntelSlug(county.slug)
        ? `${county.name} Contractor Intelligence`
        : `${county.name} County FL Contractors — License Evidence`,
      description: isFloridaCountyIntelSlug(county.slug)
        ? `How ${county.name} County contractor credentials compare with Florida. HQ/base mailing county is not a service area. Independent research, not a ranking.`
        : `Browse Florida DBPR construction license profiles whose HQ/base mailing county is ${county.name}. Not a list of who operates only in this county, and not a marketplace.`,
      noIndex: degraded || browseIsVariant(browse),
    });
  }

  const { trade } = resolved;
  let degraded = false;
  try {
    degraded = !(await loadFloridaTradePage(trade, browse)).complete;
  } catch (err) {
    if (!isFloridaDirectoryUnavailableError(err)) throw err;
    degraded = true;
  }
  return discoveryMetadata({
    state,
    trade,
    title: `Florida ${trade.title} — License Verification`,
    description: `Browse Florida ${trade.title.toLowerCase()} with official DBPR license evidence. ${trade.description} Independent research, not a lead board.`,
    noIndex: degraded || browseIsVariant(browse),
  });
}

/** Research counties show the directory only on ?list=1 or a filtered/paged URL. */
function countyShowsDirectory(
  countySlug: string,
  browse: ReturnType<typeof parseBrowseParams>,
  sp: Record<string, string | string[] | undefined>
): boolean {
  const listParam = Array.isArray(sp.list) ? sp.list[0] : sp.list;
  return !isFloridaCountyIntelSlug(countySlug) || browseIsVariant(browse) || listParam === "1";
}

function SideListUnavailable({ what }: { what: string }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)]">
      {`The ${what} list could not be loaded on this request. The directory below is complete; reload to see the ${what} list.`}
    </p>
  );
}

export default async function FloridaSegmentPage({ params, searchParams }: Props) {
  const { segment } = await params;
  const sp = await searchParams;
  const browse = parseBrowseParams(sp);
  const state = getDiscoveryState(PUBLIC);
  if (!state) notFound();

  const resolved = resolveDiscoverySegment(state, segment);
  if (!resolved) notFound();

  if (resolved.kind === "county") {
    const { county } = resolved;
    const view = parseBrowseView(sp);
    const countyIntel = isFloridaCountyIntelSlug(county.slug);
    const showDirectory = countyShowsDirectory(county.slug, browse, sp);
    // FL-DIR-PERF-003: one read at a time on the max:1 pool. Directory first
    // (a failure throws: HTTP 500 + noindex, side lists never start), then
    // trades, then cities, then the cached research snapshot.
    const data = showDirectory ? await loadFloridaCountyPage(county, browse) : null;
    const intelPayload = countyIntel
      ? await getFloridaCountyIntelligenceSnapshotOnce(county.slug)
      : null;
    const results = data?.directory.results ?? [];
    const total = data?.directory.total ?? 0;
    const stats = data?.directory.stats;
    const trades = data?.facets?.facets ?? [];
    const tradesUnavailable = data?.facets?.ok === false;
    const cities = data?.cities?.facets ?? [];
    const citiesUnavailable = data?.cities?.ok === false;

    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Florida", href: discoveryPath(state) },
            { label: county.name },
          ]}
        />
        {intelPayload ? (
          <CountyIntelligence payload={intelPayload} />
        ) : (
          <header className="mt-4 border-b border-[var(--border)] pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Florida · County
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
              {county.name} County contractors
            </h1>
          </header>
        )}

        <details className="mt-10 rounded-2xl border border-[var(--border)] bg-white px-4 py-4" id="contractors">
          <summary className="cursor-pointer text-base font-semibold">
            Research contractors in {county.name} (directory)
          </summary>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Directory cards are secondary. They list credentials whose HQ/base mailing county is{" "}
            {county.name} — not everyone who works there.
          </p>
          {showDirectory && stats ? (
            <>
              <div className="mt-8">
                <FacetGrid
                  title={`Trades in ${county.name}`}
                  facets={trades}
                  hrefFor={(slug) =>
                    discoveryPath(state, { countySlug: county.slug, tradeSlug: slug })
                  }
                  emptyFallback={tradesUnavailable ? <SideListUnavailable what="trade" /> : undefined}
                />
              </div>
              <FloridaBrowseSection
                state={state}
                county={county}
                browse={browse}
                results={results}
                total={total}
                stats={stats}
                cities={cities}
                citiesUnavailable={citiesUnavailable}
                view={view}
              />
            </>
          ) : (
            <p className="mt-4">
              <Link
                href={`${discoveryPath(state, { countySlug: county.slug })}?list=1#contractors`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--navy)] underline-offset-2 hover:underline"
              >
                Open {county.name} contractor directory
              </Link>
            </p>
          )}
        </details>

        <div className="mt-10">
          <DiscoveryDisclaimer />
        </div>
      </main>
    );
  }

  const { trade } = resolved;
  const view = parseBrowseView(sp);
  // FL-DIR-PERF-003: directory first, then the county side list (never in
  // parallel on the max:1 pool; never after a failed directory read).
  const data = await loadFloridaTradePage(trade, browse);
  const { results, total, stats } = data.directory;
  const countyFacets = data.facets?.facets ?? [];
  const countiesUnavailable = data.facets?.ok === false;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida", href: discoveryPath(state) },
          { label: trade.label },
        ]}
      />
      <header className="mt-4 border-b border-[var(--border)] pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Florida · Trade
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Florida {trade.title}
        </h1>
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
          emptyFallback={countiesUnavailable ? <SideListUnavailable what="county" /> : undefined}
        />
      </div>

      <FloridaBrowseSection
        state={state}
        trade={trade}
        browse={browse}
        results={results}
        total={total}
        stats={stats}
        cities={[]}
        view={view}
      />

      <div className="mt-10">
        <DiscoveryDisclaimer />
      </div>
    </main>
  );
}
