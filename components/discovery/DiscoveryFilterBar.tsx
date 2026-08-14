import Link from "next/link";
import {
  activeFilterChips,
  browseHref,
  clearedBrowse,
  SORT_DISCLOSURE,
  SORT_LABELS,
  type DiscoveryBrowse,
} from "@/lib/discovery/browse";
import type { DiscoveryFacet } from "@/lib/discovery/types";

export function DiscoveryFilterBar({
  action,
  browse,
  cities,
  hideCity,
  pathCitySlug,
  pathCityLabel,
  parentPath,
}: {
  action: string;
  browse: DiscoveryBrowse;
  cities: DiscoveryFacet[];
  hideCity?: boolean;
  pathCitySlug?: string | null;
  pathCityLabel?: string | null;
  /** County+trade path used to leave a path city landing */
  parentPath?: string | null;
}) {
  const chips = activeFilterChips(browse, {
    pathCitySlug,
    pathCityLabel,
  });
  const loosenable = chips.filter((c) => c.id !== "path-city");
  const clearAllHref = browseHref(action, clearedBrowse(browse), {
    omitCity: Boolean(pathCitySlug),
  });

  return (
    <section
      id="filters"
      aria-labelledby="discovery-filters-heading"
      className="scroll-mt-20 rounded-2xl border border-[var(--border)] bg-white shadow-sm"
    >
      {/* Always-visible summary: filters + current browse order */}
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <h2
            id="discovery-filters-heading"
            className="text-sm font-semibold text-[var(--text)]"
          >
            Filter this list
            {loosenable.length > 0 ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-[var(--navy)]/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--navy)]">
                {loosenable.length} active
              </span>
            ) : (
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                optional
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Evidence fields only — not a quality score or marketplace ranking.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 sm:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Browse order
          </p>
          <p className="text-sm font-semibold text-[var(--text)]">
            {SORT_LABELS[browse.sort]}
          </p>
          <p className="mt-0.5 max-w-[16rem] text-[11px] leading-snug text-[var(--muted)] sm:ml-auto">
            Scanning order, not a ranking
          </p>
        </div>
      </div>

      {/* Active chips */}
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)]/60 px-3.5 py-2.5 sm:px-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Active
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              if (chip.id === "path-city" && parentPath) {
                return (
                  <li key={chip.id}>
                    <Link
                      href={parentPath}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--navy)]/20 bg-white px-2.5 py-1 text-xs font-medium text-[var(--navy)] no-underline hover:border-[var(--navy)]/40"
                      title="Leave city landing"
                    >
                      {chip.label}
                      <span aria-hidden className="text-[var(--muted)]">
                        ×
                      </span>
                    </Link>
                  </li>
                );
              }
              if (chip.id === "path-city") {
                return (
                  <li key={chip.id}>
                    <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--text)]">
                      {chip.label}
                    </span>
                  </li>
                );
              }
              return (
                <li key={chip.id}>
                  <Link
                    href={browseHref(action, chip.without, {
                      omitCity: Boolean(pathCitySlug),
                    })}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--navy)]/20 bg-white px-2.5 py-1 text-xs font-medium text-[var(--navy)] no-underline hover:border-[var(--navy)]/40"
                    title={`Remove ${chip.label}`}
                  >
                    {chip.label}
                    <span aria-hidden className="text-[var(--muted)]">
                      ×
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {loosenable.length > 0 || (pathCitySlug && parentPath) ? (
            <Link
              href={pathCitySlug && parentPath ? parentPath : clearAllHref}
              className="ml-auto inline-flex min-h-8 items-center text-xs font-semibold text-[var(--accent)] no-underline hover:underline"
            >
              Clear all
            </Link>
          ) : null}
        </div>
      ) : null}

      <form method="get" action={action} className="px-3.5 py-3.5 sm:px-4">
        {/* Browse order — full width, always labeled */}
        <div className="mb-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2.5">
          <label className="block text-xs font-semibold text-[var(--text)]">
            Browse order
            <span className="ml-1.5 font-normal text-[var(--muted)]">
              (not a ranking)
            </span>
            <select
              name="sort"
              defaultValue={browse.sort}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2.5 text-sm font-medium text-[var(--text)] sm:max-w-xs"
            >
              {(Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>).map(
                (k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                )
              )}
            </select>
          </label>
          <p className="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">
            {SORT_DISCLOSURE} Currently:{" "}
            <span className="font-medium text-[var(--text)]">
              {SORT_LABELS[browse.sort]}
            </span>
            .
          </p>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Evidence filters
        </p>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {hideCity ? null : (
            <label className="block text-xs font-medium text-[var(--text)]">
              City on license
              <select
                name="city"
                defaultValue={browse.citySlug || ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2.5 text-sm text-[var(--text)]"
              >
                <option value="">All cities in this view</option>
                {cities.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label} ({c.count.toLocaleString()})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-xs font-medium text-[var(--text)]">
            License status
            <select
              name="status"
              defaultValue={browse.status}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2.5 text-sm text-[var(--text)]"
            >
              <option value="any">Any published status</option>
              <option value="active">Active / current</option>
              <option value="inactive">Not active in extract</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-[var(--text)]">
            Sunbiz entity
            <select
              name="entity"
              defaultValue={browse.entity}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2.5 text-sm text-[var(--text)]"
            >
              <option value="any">Any</option>
              <option value="linked">High-confidence link</option>
              <option value="unlinked">No high-confidence link</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-[var(--text)]">
            Discipline in extract
            <select
              name="discipline"
              defaultValue={browse.discipline}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2.5 text-sm text-[var(--text)]"
            >
              <option value="any">Any</option>
              <option value="present">Has a linked action</option>
              <option value="none">None linked</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-[var(--text)]">
            License tenure
            <select
              name="tenure"
              defaultValue={browse.tenure}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2.5 text-sm text-[var(--text)]"
            >
              <option value="any">Any / unknown issue date</option>
              <option value="lt5">Issued in last 5 years</option>
              <option value="5to15">Issued 5–15 years ago</option>
              <option value="gt15">Issued more than 15 years ago</option>
            </select>
          </label>
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--navy)] px-5 text-sm font-semibold text-white sm:flex-none"
          >
            Apply filters
          </button>
          <a
            href={clearAllHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] no-underline hover:bg-[var(--bg)]"
          >
            Reset filters
          </a>
        </div>
      </form>
    </section>
  );
}
