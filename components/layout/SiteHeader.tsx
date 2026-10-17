"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { HeaderMenus } from "@/components/layout/HeaderMenus";
import { SwitchHubMenu } from "@/components/network/SwitchHubMenu";
import { MOBILE_GROUPS } from "@/lib/nav/header-nav";
const CANONICAL_ACCOUNT_HREF = "https://www.asktrusthub.com/my/sign-in";

function AccountMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M10 2.5 16 5v5.2c0 3.2-2.4 5.5-6 6.8-3.6-1.3-6-3.6-6-6.8V5l6-2.5Z" />
    </svg>
  );
}

function drawerPurpose(item: { href: string; label: string; hint?: string }) {
  if (item.href === "/account" && item.label === "Account") {
    return {
      label: "Contractor account",
      hint: "Optional local sign-in. Not My TrustHub.",
    };
  }
  if (item.href === "/my-contractor" && item.label === "Saved contractors") {
    return {
      label: "My Contractor",
      hint: "Local workspace on this device.",
    };
  }
  return { label: item.label, hint: item.hint };
}

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M2 5.75A.75.75 0 012.75 5h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 5.75zm0 4.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm.75 3.5a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header data-hub="contractor" className="th-header sticky top-0 z-50">
        <a href="#main-content" className="th-skip">
          Skip to content
        </a>
        <div className="th-header-inner th-shell">
          <Link
            href="/"
            className="th-logo-lockup no-underline"
            aria-label="Contractor Trust Hub home"
          >
            <BrandLogo
              className="th-header-logo"
              height={36}
              priority
              surface="onLight"
              lockup="compact"
            />
          </Link>

          <HeaderMenus />

          <div className="th-header-actions">
            <Link
              href="/verify"
              data-entry-path="header-verify"
              className="th-btn-primary"
            >
              Verify
            </Link>
            <a
              href={CANONICAL_ACCOUNT_HREF}
              data-entry-path="header-my-trusthub"
              data-mth-account-entry="sign-in"
              className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--navy)] no-underline"
            >
              My TrustHub
            </a>
            <SwitchHubMenu />
          </div>

          <div className="th-header-mobile-actions">
            <Link
              href="/verify"
              data-entry-path="header-verify-mobile"
              className="th-btn-primary"
            >
              Verify
            </Link>
            <a
              href={CANONICAL_ACCOUNT_HREF}
              data-entry-path="header-my-trusthub-mobile"
              data-mth-account-entry="sign-in"
              className="th-btn-icon"
              aria-label="My TrustHub"
              title="My TrustHub — sign in to your account"
            >
              <AccountMark />
            </a>
            <button
              ref={menuRef}
              type="button"
              className="th-btn-icon"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={drawerId}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <>
          <button
            type="button"
            className="th-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id={drawerId}
            className="th-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Contractor Trust Hub menu"
          >
            <nav aria-label="Mobile" className="flex flex-col">
              <Link
                href="/verify"
                data-entry-path="header-mobile-verify"
                className="th-btn-primary mb-3 w-full"
                onClick={() => setOpen(false)}
              >
                Verify a contractor
              </Link>
              <a
                href={CANONICAL_ACCOUNT_HREF}
                data-entry-path="header-my-trusthub-drawer"
                data-mth-account-entry="sign-in"
                className="th-drawer-link"
                onClick={() => setOpen(false)}
              >
                My TrustHub
              </a>
              {MOBILE_GROUPS.map((group) => (
                <div key={group.id} className="py-1.5">
                  <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {group.label}
                  </p>
                  {group.links.map((item) => {
                    const copy = drawerPurpose(item);
                    return (
                    <Link
                      key={`${group.id}-${item.href}`}
                      href={item.href}
                      className="th-drawer-link"
                      onClick={() => setOpen(false)}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span>{copy.label}</span>
                        {copy.hint ? (
                          <span className="text-xs font-medium text-[var(--muted)]">{copy.hint}</span>
                        ) : null}
                      </span>
                    </Link>
                    );
                  })}
                </div>
              ))}
              <div className="mt-4 border-t border-[var(--th-border)] pt-4">
                <SwitchHubMenu variant="embedded" />
              </div>
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}
