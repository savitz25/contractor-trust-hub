import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const nav = [
  { href: "/verify", label: "Verify" },
  { href: "/about", label: "How it works" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link href="/" className="min-w-0 shrink no-underline">
          <BrandLogo height={36} priority surface="onDark" />
        </Link>
        <nav className="flex shrink-0 items-center gap-0.5 sm:gap-2" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden rounded-lg px-2.5 py-1.5 text-sm text-[var(--muted)] no-underline transition hover:bg-[var(--panel)] hover:text-[var(--text)] sm:inline-block sm:px-3"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/methodology"
            className="rounded-lg px-2 py-1.5 text-xs text-[var(--muted)] no-underline hover:text-[var(--text)] sm:hidden"
          >
            Method
          </Link>
          <Link
            href="/verify"
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--navy)] no-underline shadow-sm hover:brightness-105"
          >
            Search
          </Link>
        </nav>
      </div>
    </header>
  );
}
