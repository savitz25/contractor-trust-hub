import Link from "next/link";
import type { DiscoveryFacet } from "@/lib/discovery/types";

export function FacetGrid({
  title,
  facets,
  hrefFor,
  emptyLabel = "No categories with records yet.",
}: {
  title: string;
  facets: DiscoveryFacet[];
  hrefFor: (slug: string) => string;
  emptyLabel?: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h2>
      {facets.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {facets.map((f) => (
            <li key={f.slug}>
              <Link
                href={hrefFor(f.slug)}
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm no-underline shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/20 hover:shadow-[var(--shadow-md)]"
              >
                <span className="font-medium text-[var(--text)]">{f.label}</span>
                <span className="tabular-nums text-[var(--muted)]">
                  {f.count.toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
