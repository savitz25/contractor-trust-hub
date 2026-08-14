import type { FloridaBrowseStats } from "@/lib/discovery/florida-list";
import { SORT_DISCLOSURE, SORT_LABELS, type DiscoveryBrowse } from "@/lib/discovery/browse";
import type { CountyDef, TradeDef } from "@/lib/discovery/types";

export function DiscoveryContext({
  county,
  trade,
  cityLabel,
  stats,
  browse,
}: {
  county?: CountyDef | null;
  trade?: TradeDef | null;
  cityLabel?: string | null;
  stats: FloridaBrowseStats;
  browse: DiscoveryBrowse;
}) {
  const place = [cityLabel, county ? `${county.name} County` : null, "Florida"]
    .filter(Boolean)
    .join(", ");
  const entityRate =
    stats.firms > 0 ? Math.round((stats.entityLinked / stats.firms) * 100) : null;
  const discRate =
    stats.firms > 0 ? Math.round((stats.withDiscipline / stats.firms) * 100) : null;

  return (
    <div className="mt-4 space-y-3">
      {trade ? (
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          {trade.description} Occupation codes in this browse:{" "}
          <span className="font-medium text-[var(--text)]">
            {trade.occupationCodes.join(", ")}
          </span>
          .
        </p>
      ) : (
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          Construction license evidence associated with {place} in Florida DBPR extracts.
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-3">
        <li className="rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Firms in this view
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--text)]">
            {stats.firms.toLocaleString()}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {stats.activeFirms.toLocaleString()} with an active/current license
          </p>
        </li>
        <li className="rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            High-confidence Sunbiz
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--text)]">
            {entityRate == null ? "—" : `${entityRate}%`}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {stats.entityLinked.toLocaleString()} firms linked — missing ≠ no company
          </p>
        </li>
        <li className="rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Discipline in extract
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--text)]">
            {discRate == null ? "—" : `${discRate}%`}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {stats.withDiscipline.toLocaleString()} with a linked board action
          </p>
        </li>
      </ul>

      <p className="text-sm text-[var(--muted)]">
        County comes from the address on the board extract
        {cityLabel ? ` · city from the published license city (${cityLabel})` : ""}.
        Confirm live status on Florida DBPR before you hire.
      </p>
      <p className="text-sm font-medium text-[var(--text)]">
        Evidence browse only — not a ranking. {SORT_DISCLOSURE} Current order:{" "}
        {SORT_LABELS[browse.sort]}.
      </p>
    </div>
  );
}
