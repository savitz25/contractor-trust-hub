"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { DESKTOP_GROUPS, type HeaderGroup } from "@/lib/nav/header-nav";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
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

function DesktopDropdown({ group }: { group: HeaderGroup }) {
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`th-nav-link ${open ? "th-nav-link-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {group.label}
        <Chevron open={open} />
      </button>
      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label={group.label}
          className="th-network-panel absolute left-0 z-[80] mt-1.5 min-w-[16.5rem]"
        >
          {group.links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className="th-drawer-link"
              onClick={() => setOpen(false)}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-[var(--th-navy)]">{item.label}</span>
                {item.hint ? (
                  <span className="mt-0.5 text-xs font-medium text-[var(--muted)]">{item.hint}</span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HeaderMenus() {
  return (
    <nav className="th-header-nav" aria-label="Primary">
      {DESKTOP_GROUPS.map((group) => (
        <DesktopDropdown key={group.id} group={group} />
      ))}
    </nav>
  );
}
