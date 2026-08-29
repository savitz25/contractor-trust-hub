import Link from "next/link";

export function MarketCompare() {
  return (
    <section id="compare" className="scroll-mt-24">
      <p className="cth-intel-eyebrow">Compare markets</p>
      <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
        Broward County vs Palm Beach County
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Both counties have Florida County Intelligence pages. We only compare coverage that exists
        on both sides. Permit volume is not compared here.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <article className="cth-intel-card">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--navy)]">
            County intelligence available
          </p>
          <h3 className="mt-2 text-lg font-semibold">Broward County</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Florida DBPR mailing/HQ county is not service area. Confirm the jobsite AHJ.
          </p>
          <p className="mt-3">
            <Link href="/florida/broward" className="font-semibold text-[var(--navy)] hover:underline">
              Open Broward Intelligence
            </Link>
          </p>
        </article>
        <article className="cth-intel-card">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--navy)]">
            County intelligence available
          </p>
          <h3 className="mt-2 text-lg font-semibold">Palm Beach County</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Same state-credential grain. Permit metrics are not treated as equivalent coverage.
          </p>
          <p className="mt-3">
            <Link href="/florida/palm-beach" className="font-semibold text-[var(--navy)] hover:underline">
              Open Palm Beach Intelligence
            </Link>
          </p>
        </article>
      </div>
    </section>
  );
}
