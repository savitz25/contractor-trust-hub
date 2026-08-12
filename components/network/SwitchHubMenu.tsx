"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SWITCH_HUB_LINKS } from "@/lib/network/network-links";

type Props = {
  className?: string;
  compact?: boolean;
};

/**
 * Switch Hub dropdown — same interaction pattern as Move / Lender / Insurance.
 */
export function SwitchHubMenu({ className = "", compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className={[
          "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--navy)] transition-colors",
          "hover:border-[var(--navy)]/25 hover:bg-[var(--navy-soft)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
          open ? "border-[var(--navy)]/30 bg-[var(--navy-soft)]" : "",
        ].join(" ")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {compact ? "Hubs" : "Switch Hub"}
        <svg
          className={`h-3.5 w-3.5 text-[var(--navy)] transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label="Switch Trust Hub"
          className="absolute right-0 z-[80] mt-2 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white py-2 shadow-[var(--shadow-lg)]"
        >
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--navy)]">
            Ask network
          </p>
          <ul className="space-y-0.5 px-1.5">
            {SWITCH_HUB_LINKS.map((hub) => (
              <li key={hub.id}>
                {hub.current ? (
                  <div
                    role="menuitem"
                    aria-current="page"
                    className="flex items-start gap-2 rounded-xl bg-[var(--accent-soft)] px-2.5 py-2.5 ring-1 ring-[var(--accent)]/35"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="block text-sm font-semibold text-[var(--navy)]">
                          {hub.label}
                        </span>
                        <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--navy)]">
                          Current
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">
                        {hub.blurb}
                      </span>
                    </span>
                  </div>
                ) : (
                  <a
                    role="menuitem"
                    href={hub.href}
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 rounded-xl px-2.5 py-2.5 no-underline transition-colors hover:bg-[var(--navy-soft)]"
                    onClick={() => setOpen(false)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--navy)]">
                        {hub.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">
                        {hub.blurb}
                      </span>
                    </span>
                    <span
                      className="mt-0.5 shrink-0 text-[var(--muted)]"
                      aria-hidden
                      title="Opens external site"
                    >
                      ↗
                    </span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 border-t border-[var(--border)] px-3 pt-2 text-[11px] leading-relaxed text-[var(--muted)]">
            You are on Contractor Trust Hub — Florida license verification &amp; planning.
          </p>
        </div>
      ) : null}
    </div>
  );
}
