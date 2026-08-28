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
import { listFloridaBrowse, listFloridaCities } from "@/lib/discovery/florida-list";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import { countByTrade, countCountiesForTrade } from "@/lib/discovery/queries";
import { CountyIntelligence } from "@/components/intelligence/CountyIntelligence";
import { isFloridaCountyIntelSlug } from "@/lib/intelligence/coverage";
import { getFloridaCountyIntelligenceSnapshot } from "@/lib/intelligence/county-snapshot";

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
    return discoveryMetadata({
      state,
      county,
      title: `${county.name} County FL Contractors — License Evidence`,
      description: `Browse Florida DBPR construction license profiles whose HQ/base mailing county is ${county.name}. Not a list of who operates only in this county, and not a marketplace.`,
      noIndex: browseIsVariant(browse),
    });
  }

  const { trade } = resolved;
  return discoveryMetadata({
    state,
    trade,
    title: `Florida ${trade.title} — License Verification`,
    description: `Browse Florida ${trade.title.toLowerCase()} with official DBPR license evidence. ${trade.description} Independent research, not a lead board.`,
    noIndex: browseIsVariant(browse),
  });
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
    const [{ results, total, stats }, trades, cities] = await Promise.all([
      listFloridaBrowse({ county, browse }),
      countByTrade(PUBLIC, county),
      listFloridaCities(county),
    ]);
    const intelPayload = countyIntel
      ? await getFloridaCountyIntelligenceSnapshot(county.slug)
      : null;

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

        <details className="mt-10 rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
          <summary className="cursor-pointer text-base font-semibold">
            Research contractors in {county.name} (directory)
          </summary>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Directory cards are secondary. They list credentials whose HQ/base mailing county is{" "}
            {county.name} — not everyone who works there.
          </p>
          <div className="mt-8">
            <FacetGrid
              title={`Trades in ${county.name}`}
              facets={trades}
              hrefFor={(slug) =>
                discoveryPath(state, { countySlug: county.slug, tradeSlug: slug })
              }
            />
          </div>
          <div id="contractors">
            <FloridaBrowseSection
              state={state}
              county={county}
              browse={browse}
              results={results}
              total={total}
              stats={stats}
              cities={cities}
              view={view}
            />
          </div>
        </details>

        <div className="mt-10">
          <DiscoveryDisclaimer />
        </div>
      </main>
    );
  }

  const { trade } = resolved;
  const view = parseBrowseView(sp);
  const [{ results, total, stats }, countyFacets] = await Promise.all([
    listFloridaBrowse({ trade, browse }),
    countCountiesForTrade(PUBLIC, trade),
  ]);

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
