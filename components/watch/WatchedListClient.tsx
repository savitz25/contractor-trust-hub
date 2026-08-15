"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { shareSummaryPath } from "@/lib/contractors/share-summary";
import { formatDateTime, statusLabel } from "@/lib/contractors/format";
import {
  listAlerts,
  listWatches,
  unwatchContractor,
} from "@/lib/projects/store";
import type { ContractorSnapshot, WatchAlert } from "@/lib/projects/types";
import { WATCH_DISCLAIMER } from "@/lib/projects/disclaimers";

export function WatchedListClient() {
  const [watches, setWatches] = useState<ContractorSnapshot[]>([]);
  const [alerts, setAlerts] = useState<WatchAlert[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setWatches(listWatches());
    setAlerts(listAlerts().filter((a) => !a.read).slice(0, 8));
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("cth-projects-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("cth-projects-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const remove = (slug: string) => {
    unwatchContractor(slug);
    refresh();
  };

  if (!ready) {
    return (
      <p className="text-sm text-[var(--muted)]" aria-live="polite">
        Loading watched list...
      </p>
    );
  }

  if (watches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-4 py-10 text-center sm:px-8">
        <p className="text-base font-medium text-[var(--text)]">No contractors watched yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
          When you find a finalist on a Trust Report, tap{" "}
          <strong className="font-semibold text-[var(--text)]">Watch this contractor</strong> to
          save them on this device. Come back here to re-open their evidence — no account required.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-[var(--muted)]">
          Watching is not continuous live government monitoring. It stores a snapshot so you can
          re-check later.
        </p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <Link
            href="/verify"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--navy)] px-5 text-sm font-semibold text-white no-underline"
          >
            Search Verify
          </Link>
          <Link
            href="/florida"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-medium text-[var(--text)] no-underline"
          >
            Browse Florida
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        <span className="font-semibold text-[var(--text)]">{watches.length}</span> saved on this
        device
        {alerts.length > 0 ? (
          <span className="text-amber-900">
            {" "}
            · {alerts.length} local note{alerts.length === 1 ? "" : "s"} since last check
          </span>
        ) : null}
      </p>

      {alerts.length > 0 ? (
        <section
          className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3"
          aria-labelledby="local-watch-notes"
        >
          <h2 id="local-watch-notes" className="text-sm font-semibold text-amber-950">
            Notes from re-opening reports
          </h2>
          <p className="mt-1 text-xs text-amber-900/90">
            Detected when you open a saved Trust Report — from our extracts, not a live board feed.
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-950">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/contractors/${encodeURIComponent(a.contractorSlug)}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {a.contractorName}
                </Link>
                <span className="text-amber-900/80"> — {a.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="space-y-3">
        {watches.map((w) => (
          <li
            key={w.slug}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 sm:px-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[var(--text)]">
                  <Link
                    href={`/contractors/${encodeURIComponent(w.slug)}`}
                    className="no-underline hover:underline"
                  >
                    {w.name}
                  </Link>
                </h2>
                <dl className="mt-2 grid gap-1 text-sm text-[var(--muted)] sm:grid-cols-2">
                  {w.licenseKey ? (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider">
                        License id
                      </dt>
                      <dd className="font-mono text-[13px] text-[var(--text)] break-all">
                        {w.licenseKey}
                      </dd>
                    </div>
                  ) : null}
                  {w.licenseStatus ? (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider">
                        Status (when saved)
                      </dt>
                      <dd className="text-[var(--text)]">{statusLabel(w.licenseStatus)}</dd>
                    </div>
                  ) : null}
                  {w.entityStatus ? (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider">
                        Entity (when saved)
                      </dt>
                      <dd className="text-[var(--text)]">{statusLabel(w.entityStatus)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider">
                      Discipline rows (when saved)
                    </dt>
                    <dd className="text-[var(--text)]">
                      {typeof w.disciplineCount === "number" ? w.disciplineCount : "—"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-[var(--muted)]">
                  Watched {formatDateTime(w.watchedAt)}
                  {w.lastCheckedAt && w.lastCheckedAt !== w.watchedAt
                    ? ` · last compared ${formatDateTime(w.lastCheckedAt)}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(w.slug)}
                className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-rose-200 hover:text-rose-800"
              >
                Unwatch
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/contractors/${encodeURIComponent(w.slug)}`}
                className="inline-flex min-h-10 items-center rounded-xl bg-[var(--navy)] px-3.5 text-xs font-semibold text-white no-underline"
              >
                Open Trust Report
              </Link>
              <Link
                href={shareSummaryPath(w.slug)}
                className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] px-3.5 text-xs font-semibold text-[var(--navy)] no-underline"
              >
                Evidence summary
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-[var(--muted)]">{WATCH_DISCLAIMER}</p>
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        Optional: sign in under{" "}
        <Link href="/account" className="font-medium text-[var(--navy)]">
          Account
        </Link>{" "}
        if you want durable sync and email alerts when those preferences are enabled. Device watch
        alone does not send email.
      </p>
    </div>
  );
}
