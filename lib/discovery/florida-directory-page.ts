/**
 * FL-DIR-PERF-003: request-scoped data for the Florida directory routes.
 *
 * generateMetadata and the page body call the same loader with the same
 * arguments and share ONE promise per request (React cache), so:
 *  - robots are decided from the same reads the body renders (a failed
 *    directory read is noindex in metadata and 500 in the body; never the old
 *    "index, follow" + Next "noindex" pair);
 *  - reads run strictly one after another (directory first, then side lists)
 *    so they never queue behind each other on the max:1 pool;
 *  - side lists are never started after a directory failure;
 *  - a failed side list is reported (ok:false), never shown as an empty list
 *    on an indexable page.
 *
 * lib/discovery/queries.ts (shared with AZ/OR/WA) still collapses a failed
 * countByTrade / countCountiesForTrade read into []. Until those helpers report
 * failure themselves, an EMPTY trade/county list next to a NON-EMPTY directory
 * is treated as a failed read (fail safe: noindex + notice, never "no trades").
 */
import { cache } from "react";
import type { DiscoveryBrowse } from "./browse";
import {
  floridaBrowseRequestKey,
  listFloridaBrowseOnce,
  listFloridaCitiesChecked,
  type FloridaFacetResult,
} from "./florida-list";
import { countByTrade, countCountiesForTrade } from "./queries";
import type { CountyDef, DiscoveryFacet, TradeDef } from "./types";

const PUBLIC = "florida";

type Directory = Awaited<ReturnType<typeof listFloridaBrowseOnce>>;

export type FloridaDirectoryPageData = {
  directory: Directory;
  /** County facets (/florida/{trade}) or trade facets (/florida/{county}). */
  facets: FloridaFacetResult | null;
  cities: FloridaFacetResult | null;
  /** False when any side list failed: the response must be noindex. */
  complete: boolean;
};

/** A shared-helper facet list: empty while the directory has firms = failed read. */
export function checkedSharedFacet(
  facets: DiscoveryFacet[],
  directoryFirms: number
): FloridaFacetResult {
  if (facets.length === 0 && directoryFirms > 0) return { ok: false, facets: [] };
  return { ok: true, facets };
}

function done(
  directory: Directory,
  facets: FloridaFacetResult | null,
  cities: FloridaFacetResult | null
): FloridaDirectoryPageData {
  return {
    directory,
    facets,
    cities,
    complete: (facets?.ok ?? true) && (cities?.ok ?? true),
  };
}

const store = cache(() => new Map<string, Promise<FloridaDirectoryPageData>>());

function once(
  kind: string,
  key: string,
  load: () => Promise<FloridaDirectoryPageData>
): Promise<FloridaDirectoryPageData> {
  const m = store();
  const k = `${kind}:${key}`;
  let p = m.get(k);
  if (!p) {
    p = load();
    m.set(k, p);
  }
  return p;
}

/** /florida/{trade}: directory, then the county side list. */
export function loadFloridaTradePage(
  trade: TradeDef,
  browse: DiscoveryBrowse
): Promise<FloridaDirectoryPageData> {
  const opts = { trade, browse };
  return once("trade", floridaBrowseRequestKey(opts), async () => {
    const directory = await listFloridaBrowseOnce(opts);
    const counties = checkedSharedFacet(
      await countCountiesForTrade(PUBLIC, trade),
      directory.stats.firms
    );
    return done(directory, counties, null);
  });
}

/** /florida/{county} directory view: directory, then trades, then cities. */
export function loadFloridaCountyPage(
  county: CountyDef,
  browse: DiscoveryBrowse
): Promise<FloridaDirectoryPageData> {
  const opts = { county, browse };
  return once("county", floridaBrowseRequestKey(opts), async () => {
    const directory = await listFloridaBrowseOnce(opts);
    const trades = checkedSharedFacet(
      await countByTrade(PUBLIC, county),
      directory.stats.firms
    );
    const cities = await listFloridaCitiesChecked(county);
    return done(directory, trades, cities);
  });
}

/** /florida/{county}/{trade}: directory, then cities. */
export function loadFloridaCountyTradePage(
  county: CountyDef,
  trade: TradeDef,
  browse: DiscoveryBrowse
): Promise<FloridaDirectoryPageData> {
  const opts = { county, trade, browse };
  return once("county-trade", floridaBrowseRequestKey(opts), async () => {
    const directory = await listFloridaBrowseOnce(opts);
    const cities = await listFloridaCitiesChecked(county, trade);
    return done(directory, null, cities);
  });
}

/**
 * /florida/{county}/{city}/{trade}: directory, then cities. A city with zero
 * firms is a 404 in the page, so its city list is never read.
 */
export function loadFloridaCityTradePage(
  county: CountyDef,
  trade: TradeDef,
  citySlug: string,
  browse: DiscoveryBrowse
): Promise<FloridaDirectoryPageData> {
  const opts = { county, trade, browse, pathCitySlug: citySlug };
  return once("city-trade", floridaBrowseRequestKey(opts), async () => {
    const directory = await listFloridaBrowseOnce(opts);
    if (directory.total === 0) return done(directory, null, null);
    const cities = await listFloridaCitiesChecked(county, trade);
    return done(directory, null, cities);
  });
}
