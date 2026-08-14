import Link from "next/link";
import { discoveryPath } from "@/lib/discovery/config";
import type { CountyDef, DiscoveryFacet, DiscoveryStateConfig, TradeDef } from "@/lib/discovery/types";

/**
 * Clustered list-by-city navigation — no map (license extracts lack lat/lng).
 * Links city landings when county + trade are known; otherwise city query filter.
 */
export function CityClusterNav({
  state,
  county,
  trade,
  cities,
  pathCitySlug,
  filterAction,
  max = 24,
}: {
  state: DiscoveryStateConfig;
  county?: CountyDef | null;
  trade?: TradeDef | null;
  cities: DiscoveryFacet[];
  pathCitySlug?: string | null;
  /** Base path for ?city= filter when no city landing */
  filterAction: string;
  max?: number;
}) {
  if (!cities.length || !county) return null;

  const shown = cities.slice(0, max);
  const useLandings = Boolean(trade);

  return (
    <section
      id="cities"
      aria-labelledby="city-cluster-heading"
      className="scroll-mt-20 rounded-2xl border border-[var(--border)] bg-white px-3.5 py-3.5 sm:px-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2
            id="city-cluster-heading"
            className="text-sm font-semibold text-[var(--text)]"
          >
            Browse by city
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Cities with enough license records in this view
            {useLandings ? " · each opens a city landing" : " · filters this list"}. Not a map —
            published city on the board extract only.
          </p>
        </div>
        <p className="text-xs tabular-nums text-[var(--muted)]">
          {cities.length} cit{cities.length === 1 ? "y" : "ies"}
        </p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => {
          const active = pathCitySlug === c.slug;
          const href = useLandings
            ? discoveryPath(state, {
                countySlug: county.slug,
                citySlug: c.slug,
                tradeSlug: trade!.slug,
              })
            : `${filterAction}?city=${encodeURIComponent(c.slug)}`;
          return (
            <li key={c.slug}>
              <Link
                href={href}
                className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm no-underline transition-colors ${
                  active
                    ? "border-[var(--navy)] bg-[var(--navy)]/5 font-semibold text-[var(--navy)]"
                    : "border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--navy)]/30"
                }`}
              >
                <span className="truncate">{c.label}</span>
                <span className="shrink-0 tabular-nums text-xs text-[var(--muted)]">
                  {c.count.toLocaleString()}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
