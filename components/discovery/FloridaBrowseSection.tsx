import Link from "next/link";
import { CityClusterNav } from "@/components/discovery/CityClusterNav";
import { DiscoveryContext } from "@/components/discovery/DiscoveryContext";
import { DiscoveryFilterBar } from "@/components/discovery/DiscoveryFilterBar";
import { DiscoveryListing } from "@/components/discovery/DiscoveryListing";
import { ProjectContextPrompt } from "@/components/discovery/ProjectContextPrompt";
import {
  browseHref,
  browseQueryString,
  cityLabelFromSlug,
  clearedBrowse,
  emptyFilterHints,
  type BrowseView,
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
  view = "list",
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
  view?: BrowseView;
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
  const parentTradePath =
    county && trade
      ? discoveryPath(state, { countySlug: county.slug, tradeSlug: trade.slug })
      : null;

  const qs = browseQueryString(
    { ...browse, citySlug: pathCitySlug ? null : browse.citySlug, page: 1 },
    { omitCity: Boolean(pathCitySlug) }
  ).replace(/^\?/, "");

  const emptyPlace = [cityLabel, county?.name, trade?.label].filter(Boolean).join(" · ");
  const clearHref = pathCitySlug && parentTradePath
    ? parentTradePath
    : browseHref(pathCitySlug ? basePath : filterAction, clearedBrowse(browse), {
        omitCity: Boolean(pathCitySlug),
      });
  const hints = emptyFilterHints(browse, pathCitySlug);

  const listHref = qs ? `${basePath}?${qs}` : basePath;
  const citiesHref = (() => {
    const p = new URLSearchParams(qs);
    p.set("view", "cities");
    p.delete("page");
    const q = p.toString();
    return q ? `${basePath}?${q}` : `${basePath}?view=cities`;
  })();

  const showCityNav = Boolean(county && cities.length > 0);
  const showViewToggle = showCityNav && Boolean(trade);

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

      {/* Mobile jump links — filters and cities are one scroll, not buried */}
      <nav
        aria-label="Browse tools"
        className="mt-5 flex flex-wrap gap-2 sm:hidden"
      >
        <a
          href="#filters"
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--navy)] no-underline"
        >
          Filters &amp; order
        </a>
        {showCityNav ? (
          <a
            href="#cities"
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Cities
          </a>
        ) : null}
      </nav>

      <div className="mt-5">
        <DiscoveryFilterBar
          action={pathCitySlug ? basePath : filterAction}
          browse={browse}
          cities={cities}
          hideCity={Boolean(pathCitySlug) || !county}
          pathCitySlug={pathCitySlug}
          pathCityLabel={cityLabel}
          parentPath={parentTradePath}
        />
      </div>

      {showViewToggle ? (
        <div
          className="mt-5 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Result layout"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            View
          </span>
          <Link
            href={listHref}
            className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-xs font-semibold no-underline ${
              view === "list"
                ? "bg-[var(--navy)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--text)]"
            }`}
          >
            List
          </Link>
          <Link
            href={citiesHref}
            className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-xs font-semibold no-underline ${
              view === "cities"
                ? "bg-[var(--navy)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--text)]"
            }`}
          >
            By city
          </Link>
          <span className="text-[11px] text-[var(--muted)]">
            No map — city from the license extract only
          </span>
        </div>
      ) : null}

      {showCityNav && (view === "cities" || !showViewToggle) ? (
        <div className="mt-5">
          <CityClusterNav
            state={state}
            county={county}
            trade={trade}
            cities={cities}
            pathCitySlug={pathCitySlug}
            filterAction={filterAction}
          />
        </div>
      ) : null}

      {showCityNav && view === "list" && showViewToggle ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Cities with enough records
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {cities.slice(0, 12).map((c) => (
              <li key={c.slug}>
                <Link
                  href={discoveryPath(state, {
                    countySlug: county!.slug,
                    citySlug: c.slug,
                    tradeSlug: trade!.slug,
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
            {cities.length > 12 ? (
              <li>
                <Link
                  href={citiesHref}
                  className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold text-[var(--accent)] no-underline hover:underline"
                >
                  All {cities.length} cities
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {view === "cities" && showViewToggle ? (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Open a city for its evidence list, or{" "}
          <Link href={listHref} className="font-medium text-[var(--accent)]">
            return to the combined list
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8">
          <DiscoveryListing
            results={results}
            total={total}
            page={browse.page}
            basePath={basePath}
            querySuffix={qs}
            sort={browse.sort}
            emptyTitle={`No matches for ${emptyPlace || "this view"}`}
            emptyBody="Filters may be too tight for this extract. Loosen a field below, pick a nearby city, or search by company name."
            emptyHints={hints}
            clearFiltersHref={clearHref}
            browseHref={discoveryPath(state)}
            browseLabel="Back to Florida browse"
          />
        </div>
      )}
    </>
  );
}
