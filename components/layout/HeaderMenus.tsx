"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { DESKTOP_GROUPS, MOBILE_GROUPS, type HeaderGroup } from "@/lib/nav/header-nav";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
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
        className={[
          "inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium no-underline transition",
          open
            ? "bg-[var(--navy-soft)] text-[var(--navy)]"
            : "text-[var(--muted)] hover:bg-[var(--navy-soft)] hover:text-[var(--navy)]",
        ].join(" ")}
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
          className="absolute left-0 z-[80] mt-1.5 min-w-[16.5rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-white py-1.5 shadow-[var(--shadow-lg)]"
        >
          {group.links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className="block px-3.5 py-2 no-underline transition-colors hover:bg-[var(--navy-soft)]"
              onClick={() => setOpen(false)}
            >
              <span className="block text-sm font-semibold text-[var(--navy)]">{item.label}</span>
              {item.hint ? (
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{item.hint}</span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileSheet() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--navy)]"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        Menu
        <Chevron open={open} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] bg-black/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="fixed inset-x-0 bottom-0 z-[110] max-h-[min(88vh,36rem)] overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-white pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-lg)]"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-white px-4 py-3">
              <p className="text-base font-semibold text-[var(--navy)]">Menu</p>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] text-[var(--navy)]"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <span className="text-lg leading-none" aria-hidden>
                  ×
                </span>
              </button>
            </div>
            <div className="px-2 py-2">
              <Link
                href="/verify"
                data-entry-path="header-mobile-verify"
                className="mx-2 mb-2 flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--navy)] no-underline"
                onClick={() => setOpen(false)}
              >
                Verify a contractor
              </Link>
              {MOBILE_GROUPS.map((group) => (
                <div key={group.id} className="py-1.5">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {group.label}
                  </p>
                  {group.links.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-xl px-3 py-2.5 no-underline hover:bg-[var(--navy-soft)]"
                      onClick={() => setOpen(false)}
                    >
                      <span className="block text-sm font-semibold text-[var(--navy)]">
                        {item.label}
                      </span>
                      {item.hint ? (
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">{item.hint}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function HeaderMenus() {
  return (
    <>
      <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
        {DESKTOP_GROUPS.slice(0, 2).map((group) => (
          <DesktopDropdown key={group.id} group={group} />
        ))}
        <Link
          href="/verify"
          className="inline-flex min-h-9 items-center rounded-lg px-2.5 py-2 text-sm font-semibold text-[var(--navy)] no-underline hover:bg-[var(--navy-soft)]"
        >
          Verify
        </Link>
        {DESKTOP_GROUPS.slice(2).map((group) => (
          <DesktopDropdown key={group.id} group={group} />
        ))}
      </nav>
      <MobileSheet />
    </>
  );
}
