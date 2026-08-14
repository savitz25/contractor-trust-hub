import type { DiscoveryBrowse } from "@/lib/discovery/browse";
import { SORT_LABELS } from "@/lib/discovery/browse";
import type { DiscoveryFacet } from "@/lib/discovery/types";

export function DiscoveryFilterBar({
  action,
  browse,
  cities,
  hideCity,
}: {
  action: string;
  browse: DiscoveryBrowse;
  cities: DiscoveryFacet[];
  hideCity?: boolean;
}) {
  return (
    <form
      method="get"
      action={action}
      className="rounded-2xl border border-[var(--border)] bg-white px-3.5 py-3.5 sm:px-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Evidence filters
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {hideCity ? null : (
          <label className="block text-xs font-medium text-[var(--text)]">
            City
            <select
              name="city"
              defaultValue={browse.citySlug || ""}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
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
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
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
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
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
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
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
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
          >
            <option value="any">Any / unknown issue date</option>
            <option value="lt5">Issued in last 5 years</option>
            <option value="5to15">Issued 5–15 years ago</option>
            <option value="gt15">Issued more than 15 years ago</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-[var(--text)]">
          Browse order
          <select
            name="sort"
            defaultValue={browse.sort}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
          >
            {(Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="inline-flex min-h-10 items-center rounded-xl bg-[var(--navy)] px-4 text-sm font-semibold text-white"
        >
          Apply
        </button>
        <a
          href={action}
          className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-[var(--muted)] no-underline hover:text-[var(--navy)]"
        >
          Reset
        </a>
      </div>
    </form>
  );
}
