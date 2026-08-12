"use client";

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
}: {
  slug: string;
  name: string;
  licenseKey?: string | null;
  licenseStatus?: string | null;
  entityStatus?: string | null;
  disciplineCount?: number;
  projectId?: string;
  compact?: boolean;
}) {
  const [watching, setWatching] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setWatching(isWatching(slug));
    // On open: detect changes vs baseline
    if (isWatching(slug)) {
      const alerts = checkWatchAgainstSnapshot({
        slug,
        name,
        licenseStatus,
        entityStatus,
        disciplineCount,
      });
      if (alerts.length) {
        setFlash(`${alerts.length} new watch alert(s)`);
        setTimeout(() => setFlash(null), 3000);
      }
    }
  }, [slug, name, licenseStatus, entityStatus, disciplineCount]);

  const toggle = () => {
    if (watching) {
      unwatchContractor(slug);
      setWatching(false);
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
    }
  };

  return (
    <div className={compact ? "inline-flex flex-col" : ""}>
      <button
        type="button"
        onClick={toggle}
        className={
          compact
            ? watching
              ? "rounded-lg border border-[var(--navy)]/25 bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--navy)]"
              : "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--muted)]"
            : watching
              ? "inline-flex min-h-10 items-center rounded-xl border border-[var(--navy)]/25 bg-[var(--accent-soft)] px-4 text-sm font-medium text-[var(--navy)]"
              : "inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--text)]"
        }
      >
        {watching ? "Watching" : "Watch this contractor"}
      </button>
      {flash ? (
        <p className="mt-1 text-[11px] font-medium text-amber-900">{flash}</p>
      ) : null}
    </div>
  );
}
