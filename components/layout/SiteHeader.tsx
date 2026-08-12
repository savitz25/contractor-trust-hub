import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const secondaryNav = [
  { href: "/studios", label: "Studios", shortLabel: "Studios" },
  { href: "/plan", label: "Plan", shortLabel: "Plan" },
  { href: "/florida", label: "Florida", shortLabel: "FL" },
  { href: "/about", label: "How it works", shortLabel: "About" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 shadow-[var(--shadow-sm)] backdrop-blur-md">
      {/* Network strip — matches Move / Lender / Insurance hubs */}
      <div className="border-b border-[var(--navy)]/10 bg-[var(--navy)] text-[11px] text-white/90 sm:text-xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-1.5 sm:px-6">
          <p>
            Part of the{" "}
            <a
              href="https://www.asktrusthub.com"
              className="font-medium text-[var(--accent)] no-underline hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Ask Trust Hub
            </a>{" "}
            network
          </p>
          <a
            href="https://www.asktrusthub.com/methodology"
            className="text-white/75 no-underline hover:text-white hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Shared research standard
          </a>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3.5">
        <Link
          href="/"
          className="min-w-0 max-w-[58%] shrink no-underline sm:max-w-none"
          aria-label="Contractor Trust Hub home"
        >
          <BrandLogo height={34} priority surface="onLight" />
        </Link>
        <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1" aria-label="Primary">
          {secondaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-2 py-2 text-xs font-medium text-[var(--muted)] no-underline transition hover:bg-[var(--navy-soft)] hover:text-[var(--navy)] sm:px-3 sm:text-sm"
            >
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
          <Link
            href="/verify"
            className="ml-0.5 rounded-lg bg-[var(--accent)] px-2.5 py-2 text-xs font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)] hover:brightness-105 sm:ml-1 sm:px-3.5 sm:text-sm"
          >
            Verify
          </Link>
        </nav>
      </div>
    </header>
  );
}
