import Link from "next/link";
import { AZ_TOP_MARKET_SLUGS } from "@/lib/arizona/geo-copy";
import type { DiscoveryFacet } from "@/lib/discovery/types";

export function AzLargestMarkets({ cities }: { cities: DiscoveryFacet[] }) {
  const bySlug = new Map(cities.map((c) => [c.slug, c]));
  const ranked = AZ_TOP_MARKET_SLUGS.map((slug) => bySlug.get(slug)).filter(
    Boolean
  ) as DiscoveryFacet[];
  const list =
    ranked.length > 0
      ? ranked.sort((a, b) => b.count - a.count)
      : AZ_TOP_MARKET_SLUGS.map((slug) => ({
          slug,
          label: slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
          count: 0,
        }));

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Largest Arizona markets
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
        Active ROC licenses by mailing city — the densest cities on the current extract. Each page
        matches that city only.
      </p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {list.map((c, i) => (
          <li key={c.slug}>
            <Link
              href={`/arizona/${c.slug}`}
              className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 no-underline transition hover:border-amber-300 hover:bg-amber-50"
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-amber-800/80">
                  {i + 1}
                </span>
                <span className="block truncate text-sm font-semibold text-[var(--text)]">
                  {c.label}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-xs text-[var(--muted)]">
                {c.count > 0 ? c.count.toLocaleString() : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
