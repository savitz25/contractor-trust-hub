import Link from "next/link";

const groups = [
  {
    title: "Decision tools",
    items: [
      { href: "/tools/scope-builder", label: "Scope Builder" },
      { href: "/tools/quote-analyzer", label: "Quote Analyzer" },
      { href: "/tools/compare-bids", label: "Compare Bids" },
      { href: "/tools/pre-hire-checklist", label: "Pre-Hire Checklist" },
    ],
  },
  {
    title: "Protection",
    items: [
      { href: "/tools/contract-analyzer", label: "Contract Analyzer" },
      { href: "/projects", label: "Projects Dashboard" },
      { href: "/projects", label: "Watch a contractor" },
    ],
  },
  {
    title: "Records",
    items: [
      { href: "/passport", label: "Home Passport" },
      { href: "/account", label: "Saved projects / account" },
      { href: "/tools/coverage", label: "Permit coverage" },
    ],
  },
] as const;

/**
 * Compact secondary tool groups — scannable, not a studio dump.
 */
export function ToolDiscovery() {
  return (
    <section
      id="tools"
      aria-labelledby="tools-heading"
      className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-xl">
            <h2
              id="tools-heading"
              className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl"
            >
              Tools when you need them
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Decision, protection, and records — educational research only, not legal advice.
            </p>
          </div>
          <Link
            href="/tools"
            className="text-sm font-semibold text-[var(--navy)] no-underline hover:underline"
          >
            All tools →
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {groups.map((g) => (
            <div
              key={g.title}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 sm:px-5"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {g.title}
              </p>
              <ul className="mt-3 space-y-2">
                {g.items.map((item) => (
                  <li key={`${g.title}-${item.label}`}>
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-[var(--text)] no-underline hover:text-[var(--navy)] hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm text-[var(--muted)]">
          Need a detailed studio?{" "}
          <Link href="/studio/kitchen" className="font-semibold text-[var(--navy)]">
            Kitchen calculator
          </Link>
          {" · "}
          <Link href="/studio/bathroom" className="font-semibold text-[var(--navy)]">
            Bathroom calculator
          </Link>
          {" · "}
          <Link href="/studio/roofing" className="font-semibold text-[var(--navy)]">
            Roofing calculator
          </Link>
          {" · "}
          <Link href="/studios" className="font-semibold text-[var(--navy)]">
            All studios
          </Link>
        </p>
      </div>
    </section>
  );
}
