const LINKS = [
  { href: "#identity", label: "Identity" },
  { href: "#licenses", label: "Licenses" },
  { href: "#caution", label: "Caution" },
  { href: "#entity", label: "Entity" },
  { href: "#related-entity", label: "Related" },
  { href: "#insurance", label: "Insurance" },
  { href: "#activity", label: "Activity" },
  { href: "#next-actions", label: "Next" },
] as const;

export function TrustReportNav() {
  return (
    <nav
      aria-label="Trust Report sections"
      className="sticky top-[4.5rem] z-20 -mx-1 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white/95 px-2 py-2 shadow-[var(--shadow-sm)] backdrop-blur-md sm:top-[5rem]"
    >
      <ul className="flex min-w-max gap-1">
        {LINKS.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="inline-flex rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] no-underline hover:bg-[var(--navy-soft)] hover:text-[var(--navy)]"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
