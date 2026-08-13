import Link from "next/link";

const proofs = [
  {
    title: "Florida full journey",
    body: "DBPR construction licenses, high-confidence Sunbiz links, discipline extracts, plan, studios, and guides.",
  },
  {
    title: "Texas specialty verify",
    body: "TDLR specialty trades plus TSBPE plumbing. Not a statewide GC directory.",
  },
  {
    title: "New Jersey HIC + specialty",
    body: "Home Improvement Contractor registrations and specialty boards from DCA Standard Files — no single statewide GC.",
  },
  {
    title: "Discipline / enforcement when present",
    body: "Florida board actions and NJ public discipline flags with source attribution — not reviews or rankings.",
  },
] as const;

/**
 * Restrained credibility strip — factual, no mismatched vanity metrics.
 */
export function ProofStrip() {
  return (
    <section
      aria-labelledby="proof-heading"
      className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/50"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="max-w-2xl">
          <h2
            id="proof-heading"
            className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl"
          >
            Built for evidence, not opinions
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Official sources: Florida DBPR + Sunbiz (full journey), Texas TDLR / TSBPE specialty,
            and New Jersey DCA HIC + specialty boards. Coverage differs by state — confirm on the
            official board before you hire.
          </p>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {proofs.map((p) => (
            <li
              key={p.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4"
            >
              <p className="text-sm font-semibold text-[var(--text)]">{p.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{p.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
          <Link href="/methodology" className="text-[var(--navy)] no-underline hover:underline">
            Methodology
          </Link>
          <Link href="/independence" className="text-[var(--navy)] no-underline hover:underline">
            Independence
          </Link>
          <Link href="/tools/coverage" className="text-[var(--navy)] no-underline hover:underline">
            Permit coverage
          </Link>
          <Link href="/disclaimer" className="text-[var(--muted)] no-underline hover:underline">
            Disclaimer
          </Link>
        </div>
      </div>
    </section>
  );
}
