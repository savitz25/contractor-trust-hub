"use client";

import { useEffect, useState } from "react";
import {
  MAX_COMPARE,
  readCompareSlugs,
  toggleCompareSlug,
} from "./compare-store";

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
      title={
        full && !selected
          ? `Compare is full (${MAX_COMPARE} max). Remove one first.`
          : selected
            ? "Remove from compare"
            : "Add to compare"
      }
      className={
        compact
          ? selected
            ? "rounded-lg border border-[var(--accent)]/50 bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--accent)]"
            : "rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
          : selected
            ? "inline-flex min-h-10 items-center rounded-xl border border-[var(--accent)]/50 bg-[var(--accent-soft)] px-4 text-sm font-medium text-[var(--accent)]"
            : "inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text)] hover:border-[var(--accent)]/40"
      }
    >
      {selected ? "In compare" : full ? "Compare full" : "Compare"}
    </button>
  );
}
