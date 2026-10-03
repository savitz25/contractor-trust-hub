"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SAVED_CHANGE_EVENT, listSavedContractors, unsaveContractor, type SavedContractor } from "@/lib/saved/store";

/** Saved contractors on this device. Management list: a Remove action per row
 * is appropriate here; the Trust Report itself uses the single Save toggle. */
export function SavedContractorsClient() {
  const [rows, setRows] = useState<SavedContractor[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setRows(listSavedContractors());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(SAVED_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SAVED_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  if (!ready) return <p className="text-sm text-[var(--muted)]">Loading saved contractors…</p>;
  if (rows.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        No saved contractors on this device yet. Open a Trust Report and choose{" "}
        <strong className="font-semibold text-[var(--text)]">Save</strong> to keep it here.{" "}
        <Link href="/verify" className="font-medium text-[var(--navy)] no-underline hover:underline">
          Verify a contractor
        </Link>
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white" data-saved-count={rows.length}>
      {rows.map((row) => (
        <li key={row.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Link href={`/contractors/${row.slug}`} className="font-semibold text-[var(--navy)] no-underline hover:underline">
              {row.name}
            </Link>
            <p className="text-xs text-[var(--muted)]">Saved on this device</p>
          </div>
          <button
            type="button"
            onClick={() => unsaveContractor(row.slug)}
            aria-label={`Remove ${row.name} from saved contractors`}
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
