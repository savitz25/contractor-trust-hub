import Link from "next/link";
import { DiscoveryContext } from "@/components/discovery/DiscoveryContext";
import { DiscoveryFilterBar } from "@/components/discovery/DiscoveryFilterBar";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { ProjectContextPrompt } from "@/components/discovery/ProjectContextPrompt";
import {
  browseQueryString,
  cityLabelFromSlug,
  type DiscoveryBrowse,
} from "@/lib/discovery/browse";
import { discoveryPath } from "@/lib/discovery/config";
import type { FloridaBrowseStats } from "@/lib/discovery/florida-list";
import type { CountyDef, DiscoveryFacet, DiscoveryStateConfig, TradeDef } from "@/lib/discovery/types";
import type { SearchResult } from "@/lib/contractors/types";

export function FloridaBrowseSection({
  state,
  county,
  trade,
  pathCitySlug,
  browse,
  results,
  total,
  stats,
  cities,
}: {
  state: DiscoveryStateConfig;
  county?: CountyDef | null;
  trade?: TradeDef | null;
  pathCitySlug?: string | null;
  browse: DiscoveryBrowse;
  results: SearchResult[];
  total: number;
  stats: FloridaBrowseStats;
  cities: DiscoveryFacet[];
}) {
  const cityLabel = pathCitySlug ? cityLabelFromSlug(pathCitySlug) : null;
  const basePath = discoveryPath(state, {
    countySlug: county?.slug,
    citySlug: pathCitySlug || undefined,
    tradeSlug: trade?.slug,
  });
  const filterAction = discoveryPath(state, {
    countySlug: county?.slug,
    tradeSlug: trade?.slug,
  });
  const qs = browseQueryString(
    { ...browse, citySlug: pathCitySlug ? null : browse.citySlug, page: 1 },
    { omitCity: Boolean(pathCitySlug) }
  ).replace(/^\?/, "");

  const emptyPlace = [cityLabel, county?.name, trade?.label].filter(Boolean).join(" · ");

  return (
    <>
      <ProjectContextPrompt countyName={county?.name} countySlug={county?.slug} />
      <DiscoveryContext
        county={county}
        trade={trade}
        cityLabel={cityLabel}
        stats={stats}
        browse={browse}
      />

      {county && trade && cities.length > 0 && !pathCitySlug ? (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Cities with enough records
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {cities.slice(0, 12).map((c) => (
              <li key={c.slug}>
                <Link
                  href={discoveryPath(state, {
                    countySlug: county.slug,
                    citySlug: c.slug,
                    tradeSlug: trade.slug,
                  })}
                  className="inline-flex min-h-9 items-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--navy)] no-underline hover:border-[var(--navy)]/25"
                >
                  {c.label}
                  <span className="ml-1.5 tabular-nums text-[var(--muted)]">
                    {c.count.toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <DiscoveryFilterBar
          action={pathCitySlug ? basePath : filterAction}
          browse={browse}
          cities={cities}
          hideCity={Boolean(pathCitySlug) || !county}
        />
      </div>

      <div className="mt-8">
        <DiscoveryListing
          results={results}
          total={total}
          page={browse.page}
          basePath={basePath}
          querySuffix={qs}
          emptyTitle={`No matches for ${emptyPlace || "this view"}`}
          emptyBody="Try clearing a filter, a nearby city, or search by company name."
        />
      </div>
    </>
  );
}
