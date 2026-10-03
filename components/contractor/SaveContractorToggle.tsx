"use client";

import { useEffect, useState } from "react";
import { SAVED_CHANGE_EVENT, isContractorSaved, saveContractor, unsaveContractor } from "@/lib/saved/store";

/**
 * One Save toggle for a Trust Report: Save -> Saved -> Save.
 *
 * Selecting the control while it reads Saved removes the Save; there is no
 * separate Unsave control. Device-first and device-only today: it writes the
 * local saved list and nothing else. It never starts or changes a Watch and
 * makes no request to My TrustHub. The visible word and aria-pressed carry the
 * state; the filled heart only reinforces it.
 */
export function SaveContractorToggle({ slug, name, profileId }: { slug: string; name: string; profileId?: string | null }) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setSaved(isContractorSaved(slug));
    setMounted(true);
    sync();
    window.addEventListener(SAVED_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 3000);
    return () => window.clearTimeout(timer);
  }, [note]);

  const toggle = () => {
    if (saved) {
      unsaveContractor(slug);
      setSaved(false);
      setNote("Removed from saved contractors on this device");
    } else {
      const row = saveContractor({ slug, name, profileId });
      setSaved(Boolean(row));
      setNote(row ? "Saved on this device" : "Could not save on this device");
    }
  };

  return (
    <span className="inline-flex flex-col gap-1" data-save-state={mounted && saved ? "saved" : "unsaved"}>
      <button
        type="button"
        onClick={toggle}
        data-save-toggle="true"
        aria-pressed={mounted ? saved : undefined}
        aria-label={saved ? `Saved: ${name}. Select to remove from your saved contractors.` : `Save ${name}`}
        title={saved ? "Saved on this device — select to unsave" : "Save on this device"}
        className={
          saved
            ? "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--navy)]/30 bg-[var(--accent-soft)] px-4 text-sm font-semibold text-[var(--navy)]"
            : "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--text)] hover:border-[var(--navy)]/25"
        }
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" data-heart={saved ? "filled" : "outline"}
          fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {saved ? "Saved" : "Save"}
      </button>
      <span role="status" aria-live="polite" className="min-h-0 text-[11px] font-medium text-[var(--muted)]">
        {note}
      </span>
    </span>
  );
}
