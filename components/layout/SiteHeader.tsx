import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { AskNetworkBar } from "@/components/network/AskNetworkBar";
import { SwitchHubMenu } from "@/components/network/SwitchHubMenu";

/** Top-level nav aligned to homepage journey (verify / plan / tools / records). */
const primaryNav = [
  { href: "/verify", label: "Verify", shortLabel: "Verify" },
  { href: "/plan", label: "Plan", shortLabel: "Plan" },
  { href: "/tools", label: "Tools", shortLabel: "Tools" },
  { href: "/projects", label: "Projects", shortLabel: "Jobs" },
  { href: "/passport", label: "Passport", shortLabel: "Pass" },
] as const;

const moreNav = [
  { href: "/florida", label: "Research FL" },
  { href: "/arizona", label: "Explore AZ" },
  { href: "/oregon", label: "Explore OR" },
  { href: "/washington", label: "Explore WA" },
  { href: "/guides", label: "Guides" },
  { href: "/studios", label: "Studios" },
  { href: "/account", label: "Account" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 shadow-[var(--shadow-sm)] backdrop-blur-md">
      <AskNetworkBar />

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="min-w-0 max-w-[42%] shrink no-underline sm:max-w-none"
          aria-label="Contractor Trust Hub home"
        >
          <BrandLogo height={34} priority surface="onLight" />
        </Link>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <nav
            className="hidden items-center gap-0.5 md:flex md:gap-0.5"
            aria-label="Primary"
          >
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-2 text-xs font-medium text-[var(--muted)] no-underline transition hover:bg-[var(--navy-soft)] hover:text-[var(--navy)] lg:px-2.5 lg:text-sm"
              >
                {item.label}
              </Link>
            ))}
            {moreNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-2 text-xs font-medium text-[var(--muted)] no-underline transition hover:bg-[var(--navy-soft)] hover:text-[var(--navy)] lg:px-2.5 lg:text-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Compact product links on small screens */}
          <nav className="flex items-center gap-0.5 md:hidden" aria-label="Primary">
            {primaryNav.slice(0, 4).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-1.5 py-2 text-[11px] font-medium text-[var(--muted)] no-underline hover:text-[var(--navy)]"
              >
                {item.shortLabel}
              </Link>
            ))}
          </nav>

          <SwitchHubMenu className="hidden sm:block" />
          <SwitchHubMenu className="sm:hidden" compact />

          <Link
            href="/verify"
            data-entry-path="header-verify"
            className="ml-0.5 inline-flex min-h-9 items-center rounded-lg bg-[var(--accent)] px-2.5 py-2 text-xs font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)] hover:brightness-105 sm:ml-1 sm:px-3.5 sm:text-sm"
          >
            Verify
          </Link>
        </div>
      </div>
    </header>
  );
}
