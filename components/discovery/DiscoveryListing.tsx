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
  verifyHref = "/verify",
  browseHref = "/florida",
  browseLabel = "Back to Florida browse",
  hideEntityWhenMissing = false,
  profileQuery,
}: {
  results: SearchResult[];
  total: number;
  page: number;
  basePath: string;
  emptyTitle: string;
  emptyBody: string;
  verifyHref?: string;
  browseHref?: string;
  browseLabel?: string;
  hideEntityWhenMissing?: boolean;
  profileQuery?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / DISCOVERY_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-4 py-9 text-center sm:px-8 sm:py-10">
        <p className="text-base font-medium text-[var(--text)]">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted)]">
          {emptyBody}
        </p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <Link
            href={verifyHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--navy)] no-underline"
          >
            Search by name or license
          </Link>
          <Link
            href={browseHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg-elevated)]"
          >
            {browseLabel}
          </Link>
          <Link
            href="/#research"
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm text-[var(--accent)] no-underline"
          >
            Change county or trade
          </Link>
        </div>
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
          {total > DISCOVERY_PAGE_SIZE ? ` · page ${safePage} of ${totalPages}` : null}
        </p>
      </div>
      {total > 0 && total < 5 && (
        <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/60 px-3.5 py-2.5 text-sm text-[var(--muted)]">
          Few matches in this view — try a nearby county, a broader trade, or{" "}
          <Link href={verifyHref} className="text-[var(--accent)]">
            search by name
          </Link>
          .
        </p>
      )}
      <div className="space-y-2.5 sm:space-y-3">
        {results.map((r) => (
          <ResultCard
            key={r.id}
            result={r}
            hideEntityWhenMissing={hideEntityWhenMissing}
            profileQuery={profileQuery}
          />
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
              className="inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm text-[var(--text)] no-underline hover:bg-[var(--panel)]"
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
              className="inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm text-[var(--text)] no-underline hover:bg-[var(--panel)]"
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
