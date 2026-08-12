import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

/** Single primary CTA + secondary links — no Verify/Search or Methodology/Method duplicates. */
const secondaryNav = [
  { href: "/about", label: "How it works", shortLabel: "About" },
  { href: "/methodology", label: "Methodology", shortLabel: "Method" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link href="/" className="min-w-0 shrink no-underline" aria-label="Contractor Trust Hub home">
          <BrandLogo height={36} priority surface="onDark" />
        </Link>
        <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1.5" aria-label="Primary">
          {secondaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-2 py-1.5 text-sm text-[var(--muted)] no-underline transition hover:bg-[var(--panel)] hover:text-[var(--text)] sm:px-3"
            >
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
          <Link
            href="/verify"
            className="ml-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--navy)] no-underline shadow-sm hover:brightness-105"
          >
            Verify
          </Link>
        </nav>
      </div>
    </header>
  );
}
