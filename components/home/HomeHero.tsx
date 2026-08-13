import Link from "next/link";

/**
 * Homepage hero — multi-state network identity + primary CTAs.
 * Florida remains the full-journey product; peers are Verify-first.
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
          Independent contractor research from official public records across a{" "}
          <strong className="font-medium text-[var(--text)]">multi-state evidence network</strong>.{" "}
          <strong className="font-medium text-[var(--text)]">Florida</strong> is the deepest product
          (verify, plan, browse, protect).{" "}
          <strong className="font-medium text-[var(--text)]">Texas, New Jersey, Oregon, Washington,
          California, and Arizona</strong>{" "}
          are Verify-first with honest board scope — not a nationwide contractor marketplace.
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--navy)]">
          Not a marketplace. No paid rankings. Evidence only.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          <Link
            href="/verify"
            className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
          >
            Florida
          </Link>
          <Link
            href="/verify?state=tx"
            className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
          >
            Texas
          </Link>
          <Link
            href="/verify?state=nj"
            className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
          >
            New Jersey
          </Link>
          <Link
            href="/verify?state=or"
            className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
          >
            Oregon
          </Link>
          <Link
            href="/verify?state=wa"
            className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
          >
            Washington
          </Link>
          <Link
            href="/verify?state=ca"
            className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
          >
            California
          </Link>
          <Link
            href="/verify?state=az"
            className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
          >
            Arizona
          </Link>
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/#search"
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
            <span className="ml-1.5 text-[11px] font-medium text-white/80">(Florida)</span>
          </Link>
          <a
            href="#research"
            data-entry-path="research"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-6 py-3 text-center text-sm font-semibold text-[var(--navy)] no-underline hover:border-[var(--navy)]/30 sm:min-h-11"
          >
            Research / browse
            <span className="ml-1.5 text-[11px] font-medium text-[var(--muted)]">(Florida)</span>
          </a>
        </div>
      </div>
    </section>
  );
}
