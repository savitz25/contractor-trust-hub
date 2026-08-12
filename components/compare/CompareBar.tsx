"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearCompareSlugs,
  comparePageHref,
  MAX_COMPARE,
  readCompareSlugs,
  writeCompareSlugs,
} from "./compare-store";

export function CompareBar() {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setSlugs(readCompareSlugs());
    sync();
    window.addEventListener("cth-compare-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cth-compare-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (slugs.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border)] bg-white/95 px-3 py-3 shadow-[0_-8px_30px_rgba(10,37,64,0.1)] backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text)]">
            Compare tray · {slugs.length}/{MAX_COMPARE}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
            {slugs.join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => clearCompareSlugs()}
            className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            Clear
          </button>
          {slugs.length >= 2 ? (
            <Link
              href={comparePageHref(slugs)}
              className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--navy)] no-underline"
            >
              Compare {slugs.length} side-by-side
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm text-[var(--muted)]">
              Add one more to compare
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sync URL ?slugs= into storage when landing on compare page */
export function hydrateCompareFromUrl(slugs: string[]) {
  if (typeof window === "undefined" || slugs.length === 0) return;
  writeCompareSlugs(slugs);
}
