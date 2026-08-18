"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  ASK_TRUST_HUB,
  CURRENT_HUB_ID,
  SWITCH_HUB_LINKS,
} from "@/lib/network/network-links";
import { SwitchHubMenu } from "@/components/network/SwitchHubMenu";

/**
 * Top network bar — matches Move / Lender / Insurance:
 * light strip, “Ask Trust Hub network”, hub pills, Standards, mobile sheet.
 */
export function AskNetworkBar() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <div className="relative z-[60] border-b border-[var(--border)] bg-[var(--bg)] text-[12px] text-[var(--muted)]">
      <div className="mx-auto flex min-h-10 max-w-6xl items-center justify-between gap-2 px-3 py-1.5 sm:px-6">
        <a
          href={ASK_TRUST_HUB.url}
          className="inline-flex min-h-10 shrink-0 items-center font-semibold tracking-tight text-[var(--navy)] no-underline hover:text-[var(--navy)] hover:underline"
          rel="noopener noreferrer"
        >
          <span className="hidden sm:inline">Ask Trust Hub network</span>
          <span className="sm:hidden">Ask Trust Hub</span>
        </a>

        <div className="hidden items-center gap-2 sm:flex">
          <span
            className="rounded-md bg-white px-2.5 py-1.5 font-semibold text-[var(--navy)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--border)]"
            aria-current="page"
          >
            Contractor
          </span>
          <SwitchHubMenu />
          <a
            href={ASK_TRUST_HUB.standardsUrl}
            className="rounded-md px-2.5 py-1.5 font-medium text-[var(--muted)] no-underline hover:bg-white/80 hover:text-[var(--navy)]"
            rel="noopener noreferrer"
          >
            Standards
          </a>
        </div>

        <div className="sm:hidden">
          <button
            type="button"
            className="inline-flex min-h-10 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--navy)] shadow-[var(--shadow-sm)]"
            aria-expanded={open}
            aria-controls={menuId}
            aria-haspopup="dialog"
            onClick={() => setOpen((v) => !v)}
          >
            Switch hub
            <svg
              className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
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
        </div>
      </div>

      {open ? (
        <div className="sm:hidden">
          <button
            type="button"
            className="fixed inset-0 z-[100] bg-black/40"
            aria-label="Close hub switcher"
            onClick={close}
          />
          <div
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="Switch Trust Hub site"
            className="fixed inset-x-0 bottom-0 z-[110] max-h-[min(85vh,32rem)] overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-white pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-lg)]"
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-[var(--navy)]">All Trust Hub sites</p>
                <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
                  Independent research under the Ask Trust Hub network. You are on Contractor.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--navy)]"
                aria-label="Close"
                onClick={close}
              >
                <span className="text-lg leading-none" aria-hidden>
                  ×
                </span>
              </button>
            </div>

            <ul className="p-2" role="list">
              {SWITCH_HUB_LINKS.map((link) => {
                const rowClass = [
                  "flex min-h-[52px] w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors no-underline",
                  link.current
                    ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/40"
                    : "hover:bg-[var(--navy-soft)] active:bg-[var(--navy-soft)]",
                ].join(" ");

                const body = (
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-[var(--navy)]">
                        {link.label}
                      </span>
                      {link.current ? (
                        <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--navy)]">
                          You are here
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{link.blurb}</p>
                  </div>
                );

                if (link.current) {
                  return (
                    <li key={link.id}>
                      <div className={rowClass} aria-current="page">
                        {body}
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      className={rowClass}
                      rel="noopener noreferrer"
                      onClick={close}
                    >
                      {body}
                    </a>
                  </li>
                );
              })}
              <li>
                <a
                  href={ASK_TRUST_HUB.standardsUrl}
                  className="flex min-h-[52px] w-full items-start gap-3 rounded-xl px-3 py-3 text-left no-underline transition-colors hover:bg-[var(--navy-soft)]"
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[15px] font-semibold text-[var(--navy)]">
                      Standards
                    </span>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
                      Shared research standard · no paid placements
                    </p>
                  </div>
                </a>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
