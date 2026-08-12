import { getActivitySignals } from "@/lib/contractors/activity-signals";
import type { ContractorDetail } from "@/lib/contractors/types";

export function ActivitySection({ contractor }: { contractor: ContractorDetail }) {
  const signals = getActivitySignals(contractor);

  return (
    <section
      id="activity"
      className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Activity / permit signals
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        Moves beyond “licensed” toward evidence of relevant activity — only when source datasets
        are linked.
      </p>

      {signals.status === "unavailable" ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)]/50 px-4 py-4">
          <p className="text-sm font-medium text-[var(--text)]">
            Permit/activity history not yet linked for this record
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{signals.message}</p>
          <p className="mt-3 text-xs text-[var(--muted)]">
            We do not invent permit volume, recency, or “high-volume” rankings. When data is
            available, metrics will be source-attributed and labeled as associated records only.
          </p>
        </div>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Permits associated</dt>
            <dd className="font-medium text-[var(--text)]">
              {signals.permitCount != null ? signals.permitCount : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Recent activity window</dt>
            <dd className="font-medium text-[var(--text)]">
              {signals.recentWindow || "Not shown in current dataset"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--muted)]">Counties of activity</dt>
            <dd className="text-[var(--text)]">
              {signals.counties.length ? signals.counties.join(", ") : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-[var(--muted)]">{signals.note}</p>
          </div>
        </dl>
      )}
    </section>
  );
}
