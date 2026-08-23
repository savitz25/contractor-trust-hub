import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { FloridaBrowseSection } from "@/components/discovery/FloridaBrowseSection";
import {
  browseIsVariant,
  parseBrowseParams,
  parseBrowseView,
} from "@/lib/discovery/browse";
import {
  discoveryPath,
  getCounty,
  getDiscoveryState,
  getTrade,
} from "@/lib/discovery/config";
import { listFloridaBrowse, listFloridaCities } from "@/lib/discovery/florida-list";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import { parseContractorAskHandoff } from "@/lib/ask-handoff/parse";
import { AskSearchContextBanner } from "@/components/ask-handoff/AskSearchContextBanner";

const PUBLIC = "florida";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  /** `facet` is the trade slug at /florida/{county}/{trade} */
  params: Promise<{ segment: string; facet: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { segment, facet: tradeSlug } = await params;
  const sp = await searchParams;
  const browse = parseBrowseParams(sp);
  const view = parseBrowseView(sp);
  const state = getDiscoveryState(PUBLIC);
  if (!state) return { title: "Not found", robots: { index: false } };
  const county = getCounty(state, segment);
  const trade = getTrade(state, tradeSlug);
  if (!county || !trade) return { title: "Not found", robots: { index: false } };

  return discoveryMetadata({
    state,
    county,
    trade,
    title: `${trade.title} in ${county.name} County FL — License Evidence`,
    description: `Florida ${trade.title.toLowerCase()} with DBPR licenses linked to ${county.name} County. Filter by city, status, Sunbiz link, and discipline — independent research, not a marketplace.`,
    noIndex: browseIsVariant(browse) || view === "cities" || Boolean(parseContractorAskHandoff(sp)),
  });
}

export default async function FloridaCountyTradePage({ params, searchParams }: Props) {
  const { segment, facet: tradeSlug } = await params;
  const sp = await searchParams;
  const browse = parseBrowseParams(sp);
  const view = parseBrowseView(sp);
  const state = getDiscoveryState(PUBLIC);
  if (!state) notFound();

  const county = getCounty(state, segment);
  const trade = getTrade(state, tradeSlug);
  if (!county || !trade) notFound();

  const [{ results, total, stats }, cities] = await Promise.all([
    listFloridaBrowse({ county, trade, browse }),
    listFloridaCities(county, trade),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida", href: discoveryPath(state) },
          { label: county.name, href: discoveryPath(state, { countySlug: county.slug }) },
          { label: trade.label },
        ]}
      />

      <header className="mt-4 border-b border-[var(--border)] pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Florida · {county.name} · {trade.label}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {trade.title} in {county.name} County
        </h1>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href={discoveryPath(state, { countySlug: county.slug })}
            className="text-[var(--accent)]"
          >
            All trades in {county.name}
          </Link>
          <span className="text-[var(--border)]">·</span>
          <Link
            href={discoveryPath(state, { tradeSlug: trade.slug })}
            className="text-[var(--accent)]"
          >
            {trade.label} statewide
          </Link>
          <span className="text-[var(--border)]">·</span>
          <Link href="/verify" className="text-[var(--accent)]">
            Search
          </Link>
        </div>
      </header>

      <AskSearchContextBanner ctx={parseContractorAskHandoff(sp)} />

      <FloridaBrowseSection
        state={state}
        county={county}
        trade={trade}
        browse={browse}
        results={results}
        total={total}
        stats={stats}
        cities={cities}
        view={view}
      />

      <div className="mt-10">
        <DiscoveryDisclaimer />
      </div>
    </main>
  );
}
