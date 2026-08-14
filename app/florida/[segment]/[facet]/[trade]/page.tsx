import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { FloridaBrowseSection } from "@/components/discovery/FloridaBrowseSection";
import {
  browseIsVariant,
  CITY_INDEX_MIN,
  cityLabelFromSlug,
  cityToSlug,
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

const PUBLIC = "florida";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  /** `facet` is the city slug at /florida/{county}/{city}/{trade} */
  params: Promise<{ segment: string; facet: string; trade: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { segment, facet: rawCity, trade: tradeSlug } = await params;
  const sp = await searchParams;
  const browse = parseBrowseParams(sp);
  const view = parseBrowseView(sp);
  const citySlug = cityToSlug(rawCity);
  const state = getDiscoveryState(PUBLIC);
  if (!state || !citySlug) return { title: "Not found", robots: { index: false } };
  const county = getCounty(state, segment);
  const trade = getTrade(state, tradeSlug);
  if (!county || !trade) return { title: "Not found", robots: { index: false } };

  const { stats } = await listFloridaBrowse({
    county,
    trade,
    browse: { ...browse, citySlug, page: 1 },
    pathCitySlug: citySlug,
  });
  const cityLabel = cityLabelFromSlug(citySlug);
  const thin = stats.firms < CITY_INDEX_MIN;

  return discoveryMetadata({
    state,
    county,
    trade,
    citySlug,
    title: `${trade.title} in ${cityLabel}, ${county.name} County FL — License Evidence`,
    description: `Florida ${trade.title.toLowerCase()} with DBPR licenses listing ${cityLabel} in ${county.name} County. Evidence browse — not a ranking or marketplace.`,
    noIndex: thin || browseIsVariant(browse, true) || view === "cities",
  });
}

export default async function FloridaCityTradePage({ params, searchParams }: Props) {
  const { segment, facet: rawCity, trade: tradeSlug } = await params;
  const sp = await searchParams;
  const browse = parseBrowseParams(sp);
  const view = parseBrowseView(sp);
  const citySlug = cityToSlug(rawCity);
  const state = getDiscoveryState(PUBLIC);
  if (!state || !citySlug) notFound();

  const county = getCounty(state, segment);
  const trade = getTrade(state, tradeSlug);
  if (!county || !trade) notFound();

  const [{ results, total, stats }, cities] = await Promise.all([
    listFloridaBrowse({ county, trade, browse, pathCitySlug: citySlug }),
    listFloridaCities(county, trade),
  ]);

  if (total === 0) notFound();

  const cityLabel = cityLabelFromSlug(citySlug);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Florida", href: discoveryPath(state) },
          { label: county.name, href: discoveryPath(state, { countySlug: county.slug }) },
          {
            label: trade.label,
            href: discoveryPath(state, { countySlug: county.slug, tradeSlug: trade.slug }),
          },
          { label: cityLabel },
        ]}
      />

      <header className="mt-4 border-b border-[var(--border)] pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Florida · {county.name} · {cityLabel} · {trade.label}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {trade.title} in {cityLabel}
        </h1>
        <p className="mt-3 text-sm">
          <Link
            href={discoveryPath(state, { countySlug: county.slug, tradeSlug: trade.slug })}
            className="text-[var(--accent)]"
          >
            All {trade.label} in {county.name} County
          </Link>
          {" · "}
          <Link href="/verify" className="text-[var(--accent)]">
            Search
          </Link>
        </p>
      </header>

      <FloridaBrowseSection
        state={state}
        county={county}
        trade={trade}
        pathCitySlug={citySlug}
        browse={{ ...browse, citySlug }}
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
