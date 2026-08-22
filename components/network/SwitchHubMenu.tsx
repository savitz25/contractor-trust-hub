"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TH_HUB_ACCENT } from "@/lib/design/trusthub-visual-standard";
import {
  CURRENT_NETWORK_HUB_ID,
  NETWORK_REGISTRY,
  switcherEntries,
} from "@/lib/network/registry";

type Props = {
  className?: string;
  variant?: "dropdown" | "embedded";
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-[var(--th-navy)] transition-transform ${open ? "rotate-180" : ""}`}
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
  );
}

function HubRows({ onPick }: { onPick?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {switcherEntries().map((hub) => {
        const current = hub.id === CURRENT_NETWORK_HUB_ID;
        return (
          <li key={hub.id}>
            <a
              role="menuitem"
              href={hub.url}
              aria-current={current ? "page" : undefined}
              rel={current ? undefined : "noopener noreferrer"}
              className={[
                "flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors no-underline",
                "hover:bg-[var(--navy-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--th-navy)]",
                current ? "bg-[var(--navy-soft)]" : "",
              ].join(" ")}
              onClick={onPick}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: TH_HUB_ACCENT[hub.id] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--th-navy)]">{hub.name}</span>
                  {current ? (
                    <span className="rounded-md bg-[var(--th-navy)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Current
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-[var(--th-ink)]">
                  {hub.switcherLabel}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function SwitchHubMenu({ className = "", variant = "dropdown" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const current = NETWORK_REGISTRY[CURRENT_NETWORK_HUB_ID];

  useEffect(() => {
    if (variant !== "dropdown") return;
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
  }, [variant]);

  if (variant === "embedded") {
    return (
      <div className={`th-network-panel-embed ${className}`.trim()}>
        <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--th-navy)]">
          ASK TRUST HUB NETWORK
        </p>
        <HubRows />
        <p className="mt-2 border-t border-[var(--th-border)] px-1 pt-2 text-[11px] leading-relaxed text-[var(--th-ink)]">
          You are on {current.name} — {current.switcherLabel}.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        className={`th-btn-secondary ${open ? "th-btn-secondary-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        Switch Hub
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label="Ask Trust Hub Network"
          className="th-network-panel absolute right-0 z-[80] mt-2 w-[min(100vw-2rem,20.5rem)]"
        >
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--th-navy)]">
            ASK TRUST HUB NETWORK
          </p>
          <div className="px-1.5">
            <HubRows onPick={() => setOpen(false)} />
          </div>
          <p className="mt-1 border-t border-[var(--th-border)] px-3 pt-2 text-[11px] leading-relaxed text-[var(--th-ink)]">
            You are on {current.name} — {current.switcherLabel}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
