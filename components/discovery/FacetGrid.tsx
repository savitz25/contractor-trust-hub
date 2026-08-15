import type { ReactNode } from "react";
import Link from "next/link";
import type { DiscoveryFacet } from "@/lib/discovery/types";

export function FacetGrid({
  title,
  facets,
  hrefFor,
  emptyLabel = "No categories with records yet.",
  emptyFallback,
  subtitle,
  showCounts = true,
}: {
  title: string;
  facets: DiscoveryFacet[];
  hrefFor: (slug: string) => string;
  emptyLabel?: string;
  emptyFallback?: ReactNode;
  subtitle?: string;
  showCounts?: boolean;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">{subtitle}</p>
      ) : null}
      {facets.length === 0 ? (
        emptyFallback ?? <p className="mt-3 text-sm text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {facets.map((f) => (
            <li key={f.slug}>
              <Link
                href={hrefFor(f.slug)}
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm no-underline shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/20 hover:shadow-[var(--shadow-md)]"
              >
                <span className="font-medium text-[var(--text)]">{f.label}</span>
                {showCounts && f.count > 0 ? (
                  <span className="tabular-nums text-[var(--muted)]">
                    {f.count.toLocaleString()}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
