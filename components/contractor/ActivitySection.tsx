import Link from "next/link";
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
        Associated in available datasets only — never a quality rating.{" "}
        <Link href="/property" className="font-medium text-[var(--navy)]">
          How property research works
        </Link>
      </p>

      {signals.status === "unavailable" ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)]/50 px-4 py-4">
          <p className="text-sm font-medium text-[var(--text)]">
            Permit/activity history not yet linked for this record
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{signals.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/property"
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
            >
              Check my address
            </Link>
            <Link
              href="/tools/permit-planner"
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
            >
              Permit Planner
            </Link>
          </div>
        </div>
      ) : (
        <>
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
            {signals.categories?.length ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--muted)]">Trade / category mix</dt>
                <dd className="text-[var(--text)]">{signals.categories.join(", ")}</dd>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <p className="text-xs text-[var(--muted)]">{signals.note}</p>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/property"
              className="text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
            >
              Property research →
            </Link>
            <Link
              href="/tools/permit-planner"
              className="text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
            >
              Permit Planner for this project type →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
