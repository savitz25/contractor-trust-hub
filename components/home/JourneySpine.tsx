import Link from "next/link";

export const JOURNEY_STEPS = [
  {
    n: 1,
    title: "Plan your scope",
    body: "Define the work and get planning ranges before you talk to contractors.",
    href: "/plan/start",
    linkLabel: "Plan a project",
  },
  {
    n: 2,
    title: "Analyze & compare quotes",
    body: "Review one estimate, then line up bids so differences are visible.",
    href: "/tools/quote-analyzer",
    linkLabel: "Quote Analyzer",
  },
  {
    n: 3,
    title: "Verify license + business evidence",
    body: "Check DBPR licenses, high-confidence Sunbiz links, and discipline extracts.",
    href: "/verify",
    linkLabel: "Verify a contractor",
  },
  {
    n: 4,
    title: "Review contract carefully",
    body: "Spot missing protection items before you sign — educational, not legal advice.",
    href: "/tools/contract-analyzer",
    linkLabel: "Contract Analyzer",
  },
  {
    n: 5,
    title: "Protect payments & documents",
    body: "Track milestones, payments, and watches while the job is active.",
    href: "/projects",
    linkLabel: "Projects",
  },
  {
    n: 6,
    title: "Save records in Home Passport",
    body: "Keep property history, warranties, and documents for the long term.",
    href: "/passport",
    linkLabel: "Home Passport",
  },
] as const;

/**
 * Full consumer path — system spine, not a pile of pages.
 */
export function JourneySpine() {
  return (
    <section
      id="journey"
      aria-labelledby="journey-heading"
      className="border-b border-[var(--border)] bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Full path
          </p>
          <h2
            id="journey-heading"
            className="mt-2 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl"
          >
            From first idea to lasting records
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Use only the steps you need. This full spine is Florida-deep today — plan, studios,
            projects, and passport are Florida-first. Texas and New Jersey use Verify with honest
            specialty / HIC limits.
          </p>
        </div>

        {/* Mobile: vertical compact steps. Desktop: 2×3 grid */}
        <ol className="mt-6 space-y-3 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0 lg:grid-cols-3">
          {JOURNEY_STEPS.map((step) => (
            <li
              key={step.n}
              className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-4 sm:flex-col sm:gap-2"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-xs font-semibold text-white"
                aria-hidden
              >
                {step.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text)]">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
                  {step.body}
                </p>
                <Link
                  href={step.href}
                  className="mt-2 inline-block text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
                >
                  {step.linkLabel} →
                </Link>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-xs text-[var(--muted)]">
          Need a deeper studio for kitchen, bath, or roofing?{" "}
          <Link href="/studios" className="font-semibold text-[var(--navy)]">
            Open Project Studios
          </Link>
        </p>
      </div>
    </section>
  );
}
