import Link from "next/link";

/**
 * Homepage hero — message hierarchy + primary CTAs.
 * data-entry-path attributes support future analytics without new deps.
 */
export function HomeHero() {
  return (
    <section className="relative border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Before you hire, verify.
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-5xl sm:leading-[1.1]">
          Plan clearly. Verify thoroughly. Hire with confidence.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Independent Florida contractor research from official public records — plus tools to
          plan scope, compare quotes, and protect your project.
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--navy)]">
          Not a marketplace. No paid rankings. Evidence only.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Florida full journey ·{" "}
          <a href="/verify?state=nj" className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline">
            New Jersey verification pilot
          </a>
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/verify"
            data-entry-path="verify"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 text-center text-sm font-semibold text-[var(--navy)] no-underline shadow-[var(--shadow-sm)] hover:brightness-105 sm:min-h-11"
          >
            Verify a contractor
          </Link>
          <Link
            href="/plan"
            data-entry-path="plan"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--navy)]/20 bg-[var(--navy)] px-6 py-3 text-center text-sm font-semibold text-white no-underline shadow-[var(--shadow-sm)] hover:brightness-110 sm:min-h-11"
          >
            Plan a project
          </Link>
          <Link
            href="/property"
            data-entry-path="property"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-6 py-3 text-center text-sm font-semibold text-[var(--navy)] no-underline hover:border-[var(--navy)]/30 sm:min-h-11"
          >
            Check my address
          </Link>
        </div>
      </div>
    </section>
  );
}
