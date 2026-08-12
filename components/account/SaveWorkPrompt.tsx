"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Gentle prompt when local data exists and user is not clearly signed in. */
export function SaveWorkPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem("cth-save-prompt-dismissed");
      if (dismissed) return;
      const raw = localStorage.getItem("cth-projects-store-v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { projects?: unknown[] };
      if ((parsed.projects?.length || 0) > 0) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!show) return null;

  return (
    <div className="border-b border-[var(--accent)]/30 bg-[var(--accent-soft)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <p className="text-xs text-[var(--text)]">
          <strong>Save my work:</strong> projects on this device can be imported into an optional
          account for long-term Home Passport storage.
        </p>
        <div className="flex gap-2 text-xs font-semibold">
          <Link href="/account" className="text-[var(--navy)] no-underline hover:underline">
            Save / sign in
          </Link>
          <button
            type="button"
            className="text-[var(--muted)]"
            onClick={() => {
              sessionStorage.setItem("cth-save-prompt-dismissed", "1");
              setShow(false);
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
