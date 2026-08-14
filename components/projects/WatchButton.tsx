"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  checkWatchAgainstSnapshot,
  isWatching,
  unwatchContractor,
  watchContractor,
} from "@/lib/projects/store";

export function WatchButton({
  slug,
  name,
  licenseKey,
  licenseStatus,
  entityStatus,
  disciplineCount,
  projectId,
  compact,
  /** Show calm one-line explanation under the control (Trust Report) */
  explain = true,
}: {
  slug: string;
  name: string;
  licenseKey?: string | null;
  licenseStatus?: string | null;
  entityStatus?: string | null;
  disciplineCount?: number;
  projectId?: string;
  compact?: boolean;
  explain?: boolean;
}) {
  const [watching, setWatching] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setWatching(isWatching(slug));
    // On open: detect local snapshot changes (not live government monitoring)
    if (isWatching(slug)) {
      const alerts = checkWatchAgainstSnapshot({
        slug,
        name,
        licenseStatus,
        entityStatus,
        disciplineCount,
      });
      if (alerts.length) {
        setFlash(
          alerts.length === 1
            ? "Change since you last saved — re-check the full report"
            : `${alerts.length} changes since you last saved — re-check the full report`
        );
        setTimeout(() => setFlash(null), 4500);
      }
    }
  }, [slug, name, licenseStatus, entityStatus, disciplineCount]);

  const toggle = () => {
    if (watching) {
      unwatchContractor(slug);
      setWatching(false);
      setFlash("Removed from watched list on this device");
      setTimeout(() => setFlash(null), 2500);
    } else {
      watchContractor({
        slug,
        name,
        licenseKey,
        licenseStatus,
        entityStatus,
        disciplineCount,
        projectId,
      });
      setWatching(true);
      setFlash("Saved on this device — open Watched anytime");
      setTimeout(() => setFlash(null), 3000);
    }
  };

  const showExplain = explain && !compact;

  return (
    <div className={compact ? "inline-flex flex-col" : "flex flex-col gap-1.5"}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={mounted ? watching : undefined}
          aria-label={
            watching
              ? `Stop watching ${name}. Currently saved on this device.`
              : `Watch ${name}. Save on this device to re-check later.`
          }
          className={
            compact
              ? watching
                ? "rounded-lg border border-[var(--navy)]/25 bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)]"
                : "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--muted)]"
              : watching
                ? "inline-flex min-h-11 items-center rounded-xl border border-[var(--navy)]/30 bg-[var(--accent-soft)] px-4 text-sm font-semibold text-[var(--navy)]"
                : "inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--navy)]/25"
          }
        >
          {watching ? "Watching" : "Watch this contractor"}
        </button>
        {mounted && watching && !compact ? (
          <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
            Saved on this device
          </span>
        ) : null}
      </div>
      {showExplain ? (
        <p className="max-w-md text-xs leading-relaxed text-[var(--muted)]">
          {watching
            ? "Saved on this device so you can re-check this Trust Report later. Not continuous live board monitoring."
            : "Save this profile on this device to re-check evidence later or keep a finalist in hand. Not continuous live board monitoring."}
          {" "}
          <Link
            href="/watch"
            className="font-medium text-[var(--navy)] no-underline hover:underline"
          >
            View watched list
          </Link>
        </p>
      ) : null}
      {flash ? (
        <p className="text-[11px] font-medium text-amber-900" role="status">
          {flash}
        </p>
      ) : null}
    </div>
  );
}
