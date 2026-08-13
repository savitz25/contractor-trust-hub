import Link from "next/link";

const states = [
  {
    id: "fl",
    name: "Florida",
    badge: "Full journey",
    href: "/verify",
    summary:
      "Full construction verification plus planning tools: licenses, Sunbiz entity links, discipline, discovery, plan, studios, and guides.",
    paths: [
      { href: "/verify", label: "Verify" },
      { href: "/plan", label: "Plan" },
      { href: "/#research", label: "Browse" },
    ],
    accent: "border-[var(--accent)]/50 bg-[var(--accent-soft)]",
  },
  {
    id: "tx",
    name: "Texas",
    badge: "Specialty verify",
    href: "/verify?state=tx",
    summary:
      "TDLR specialty trades and TSBPE plumbing. No statewide general contractor license — not a full builder directory.",
    paths: [{ href: "/verify?state=tx", label: "Texas Verify" }],
    accent: "border-[var(--border)] bg-white",
  },
  {
    id: "nj",
    name: "New Jersey",
    badge: "HIC + specialty",
    href: "/verify?state=nj",
    summary:
      "Home Improvement Contractor registrations plus specialty boards (electrical, plumbing, HVACR, and related). No single statewide GC license.",
    paths: [{ href: "/verify?state=nj", label: "New Jersey Verify" }],
    accent: "border-violet-200 bg-violet-50/80",
  },
  {
    id: "ca",
    name: "California",
    badge: "CSLB counties",
    href: "/verify?state=ca",
    summary:
      "Statewide CSLB licensing. Current dataset prioritizes top high-impact counties from official list extracts — always confirm on Instant License Check.",
    paths: [{ href: "/verify?state=ca", label: "California Verify" }],
    accent: "border-amber-200 bg-amber-50/80",
  },
  {
    id: "az",
    name: "Arizona",
    badge: "ROC statewide",
    href: "/verify?state=az",
    summary:
      "Statewide ROC licensing from the official current active contractor posting list — always confirm on ROC contractor search.",
    paths: [{ href: "/verify?state=az", label: "Arizona Verify" }],
    accent: "border-sky-200 bg-sky-50/80",
  },
] as const;

/**
 * Early homepage framing: FL full journey + TX/NJ/CA verify scopes.
 */
export function StateLandscape() {
  return (
    <section
      id="states"
      aria-labelledby="states-heading"
      className="border-b border-[var(--border)] bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="max-w-2xl">
          <h2
            id="states-heading"
            className="text-lg font-semibold tracking-tight text-[var(--text)] sm:text-xl"
          >
            Where we have evidence today
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Coverage differs by state. Florida is the deepest product. Texas, New Jersey, California,
            and Arizona are verification-focused with honest scope limits — not “all contractors
            everywhere.”
          </p>
        </div>

        <ul className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {states.map((s) => (
            <li
              key={s.id}
              className={`flex flex-col rounded-2xl border px-4 py-4 shadow-[var(--shadow-sm)] sm:px-5 sm:py-5 ${s.accent}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-[var(--text)]">{s.name}</p>
                <span className="rounded-full border border-[var(--border)] bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--navy)]">
                  {s.badge}
                </span>
              </div>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
                {s.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.paths.map((p) => (
                  <Link
                    key={p.href + p.label}
                    href={p.href}
                    className="inline-flex min-h-9 items-center rounded-xl border border-[var(--navy)]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline hover:border-[var(--navy)]/35"
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
