import Link from "next/link";
import {
  WA_MARKET_SHORTCUTS,
  WA_TOP_COUNTY_SLUGS,
  WA_TOP_MARKET_SLUGS,
} from "@/lib/washington/geo-copy";
import type { DiscoveryFacet } from "@/lib/discovery/types";

function fallbackLabel(slug: string): string {
  if (slug === "spokane-county") return "Spokane County";
  if (slug === "federal-way") return "Federal Way";
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function rankedList(
  slugs: readonly string[],
  facets: DiscoveryFacet[],
  countySuffix?: boolean
): DiscoveryFacet[] {
  const bySlug = new Map(facets.map((f) => [f.slug, f]));
  const picked = slugs.map((slug) => {
    const hit = bySlug.get(slug);
    if (hit) {
      const label =
        countySuffix && !hit.label.toLowerCase().includes("county")
          ? `${hit.label} County`
          : hit.label;
      return { ...hit, label };
    }
    const raw = fallbackLabel(slug);
    return {
      slug,
      label: countySuffix && !raw.toLowerCase().includes("county") ? `${raw} County` : raw,
      count: 0,
    };
  });
  return picked.sort((a, b) => b.count - a.count);
}

function MarketCard({
  item,
  kind,
  rank,
}: {
  item: DiscoveryFacet;
  kind: "city" | "county";
  rank: number;
}) {
  const note =
    item.slug === "spokane"
      ? "City · not Spokane County"
      : item.slug === "spokane-county"
        ? "ZIP5 county · not the city"
        : item.slug === "vancouver"
          ? "City · Washington, not B.C."
          : kind === "city"
            ? "Mailing city + WA"
            : "Derived from ZIP5";

  return (
    <li>
      <div className="flex h-full flex-col rounded-xl border border-cyan-200/80 bg-cyan-50/50 px-3 py-2.5">
        <Link
          href={`/washington/${item.slug}`}
          className="flex min-h-11 items-start justify-between gap-2 no-underline"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-cyan-800/80">
              {rank} · {kind === "city" ? "City" : "County"}
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--text)]">
              {item.label}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)]">{note}</span>
          </span>
          <span className="shrink-0 pt-0.5 tabular-nums text-xs font-medium text-[var(--muted)]">
            {item.count > 0 ? item.count.toLocaleString() : "—"}
          </span>
        </Link>
        <ul className="mt-2 flex flex-wrap gap-1">
          {WA_MARKET_SHORTCUTS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/washington/${item.slug}/${s.slug}`}
                className="inline-flex min-h-8 items-center rounded-full border border-cyan-200 bg-white px-2 text-[11px] font-medium text-cyan-950 no-underline hover:border-cyan-300"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export function WaLargestMarkets({
  cities,
  counties,
}: {
  cities: DiscoveryFacet[];
  counties: DiscoveryFacet[];
}) {
  const cityList = rankedList(WA_TOP_MARKET_SLUGS, cities);
  const countyList = rankedList(WA_TOP_COUNTY_SLUGS, counties, true);

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Largest Washington markets
      </h2>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
        Active L&I licenses in the densest mailing cities and ZIP-derived counties. City cards match
        that city only. County cards use five-digit mailing ZIP — not an official L&I county field.
        Kitchen, roofing, and electrical open a filtered list for that market.
      </p>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-cyan-900/80">
        Cities
      </h3>
      <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {cityList.map((c, i) => (
          <MarketCard key={c.slug} item={c} kind="city" rank={i + 1} />
        ))}
      </ol>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-cyan-900/80">
        Counties · derived from ZIP5
      </h3>
      <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {countyList.map((c, i) => (
          <MarketCard key={c.slug} item={c} kind="county" rank={i + 1} />
        ))}
      </ol>
    </section>
  );
}
