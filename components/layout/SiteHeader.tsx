import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { AskNetworkBar } from "@/components/network/AskNetworkBar";
import { SwitchHubMenu } from "@/components/network/SwitchHubMenu";

const secondaryNav = [
  { href: "/studios", label: "Studios", shortLabel: "Studios" },
  { href: "/passport", label: "Passport", shortLabel: "Home" },
  { href: "/projects", label: "Projects", shortLabel: "Jobs" },
  { href: "/tools", label: "Tools", shortLabel: "Tools" },
  { href: "/account", label: "Account", shortLabel: "Acct" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 shadow-[var(--shadow-sm)] backdrop-blur-md">
      <AskNetworkBar />

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="min-w-0 max-w-[48%] shrink no-underline sm:max-w-none"
          aria-label="Contractor Trust Hub home"
        >
          <BrandLogo height={34} priority surface="onLight" />
        </Link>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <nav
            className="hidden items-center gap-0.5 sm:flex sm:gap-1"
            aria-label="Primary"
          >
            {secondaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-2 text-xs font-medium text-[var(--muted)] no-underline transition hover:bg-[var(--navy-soft)] hover:text-[var(--navy)] sm:px-3 sm:text-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Compact product links on small screens (Switch Hub covers network) */}
          <nav className="flex items-center gap-0.5 sm:hidden" aria-label="Primary">
            {secondaryNav.slice(0, 3).map((item) => (
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
            className="ml-0.5 inline-flex min-h-9 items-center rounded-lg bg-[var(--accent)] px-2.5 py-2 text-xs font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)] hover:brightness-105 sm:ml-1 sm:px-3.5 sm:text-sm"
          >
            Verify
          </Link>
        </div>
      </div>
    </header>
  );
}
