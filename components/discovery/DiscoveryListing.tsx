import Link from "next/link";
import { ResultCard } from "@/components/search/ResultCard";
import { DISCOVERY_PAGE_SIZE } from "@/lib/discovery/queries";
import type { SearchResult } from "@/lib/contractors/types";

export function DiscoveryListing({
  results,
  total,
  page,
  basePath,
  emptyTitle,
  emptyBody,
}: {
  results: SearchResult[];
  total: number;
  page: number;
  basePath: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / DISCOVERY_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-5 py-10 text-center">
        <p className="text-base font-medium text-[var(--text)]">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
          {emptyBody}
        </p>
        <Link
          href="/verify"
          className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)] no-underline"
        >
          Search by name or license
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Contractors
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {total.toLocaleString()} in this view
          {total > DISCOVERY_PAGE_SIZE
            ? ` · page ${safePage} of ${totalPages}`
            : null}
        </p>
      </div>
      <div className="space-y-3">
        {results.map((r) => (
          <ResultCard key={r.id} result={r} />
        ))}
      </div>
      {totalPages > 1 && (
        <nav
          className="mt-8 flex flex-wrap items-center justify-center gap-2"
          aria-label="Pagination"
        >
          {safePage > 1 && (
            <Link
              href={pageHref(basePath, safePage - 1)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] no-underline hover:bg-[var(--panel)]"
            >
              Previous
            </Link>
          )}
          <span className="px-2 text-sm text-[var(--muted)]">
            Page {safePage} / {totalPages}
          </span>
          {safePage < totalPages && (
            <Link
              href={pageHref(basePath, safePage + 1)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] no-underline hover:bg-[var(--panel)]"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function pageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  return `${basePath}?page=${page}`;
}
