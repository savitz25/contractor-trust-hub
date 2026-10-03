"use client";

import { useEffect, useState } from "react";
import {
  MAX_COMPARE,
  readCompareSlugs,
  toggleCompareSlug,
} from "./compare-store";

/**
 * Add / remove a contractor on the device compare shortlist (max 3 → Compare).
 * localStorage only — not a marketplace ranking.
 *
 * It reads "Compare", not "Save": Save is the saved-contractors toggle
 * (SaveContractorToggle). The shortlist behaviour and storage are unchanged.
 */
export function CompareToggle({
  slug,
  compact = false,
}: {
  slug: string;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const sync = () => {
      const slugs = readCompareSlugs();
      setSelected(slugs.includes(slug));
      setFull(slugs.length >= MAX_COMPARE && !slugs.includes(slug));
    };
    sync();
    window.addEventListener("cth-compare-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cth-compare-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const res = toggleCompareSlug(slug);
        setSelected(res.slugs.includes(slug));
        setFull(res.full);
      }}
      aria-pressed={selected}
      data-compare-toggle="true"
      title={
        full && !selected
          ? `Shortlist is full (${MAX_COMPARE} max). Remove one first.`
          : selected
            ? "Remove from compare shortlist (on this device)"
            : "Add to compare shortlist (on this device)"
      }
      className={
        compact
          ? selected
            ? "rounded-lg border border-[var(--navy)]/25 bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--navy)]"
            : "rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-[var(--navy)]/25 hover:text-[var(--text)]"
          : selected
            ? "inline-flex min-h-10 items-center rounded-xl border border-[var(--navy)]/25 bg-[var(--accent-soft)] px-4 text-sm font-medium text-[var(--navy)]"
            : "inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--text)] hover:border-[var(--navy)]/25"
      }
    >
      {selected ? "Comparing" : full ? "Compare full" : "Compare"}
    </button>
  );
}
