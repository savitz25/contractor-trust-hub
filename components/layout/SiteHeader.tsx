import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const nav = [
  { href: "/verify", label: "Verify" },
  { href: "/about", label: "How it works" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <BrandLogo height={40} priority surface="onDark" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--muted)] no-underline transition hover:bg-[var(--panel)] hover:text-[var(--text)] sm:px-3"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/verify"
            className="ml-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--navy)] no-underline shadow-sm hover:brightness-105"
          >
            Search FL
          </Link>
        </nav>
      </div>
    </header>
  );
}
