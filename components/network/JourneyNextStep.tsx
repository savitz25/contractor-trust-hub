import type { JourneyModule } from "@/lib/network/journey-handoff";

export function JourneyNextStep({ module }: { module: JourneyModule | null }) {
  if (!module) return null;
  return (
    <aside
      className="mx-auto my-8 max-w-6xl rounded-2xl border border-[var(--border)] bg-white px-4 py-5 sm:px-6"
      aria-labelledby="journey-next-heading"
      data-journey-handoff="contractor"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {module.eyebrow}
      </p>
      <h2
        id="journey-next-heading"
        className="mt-2 text-lg font-semibold text-[var(--navy)]"
      >
        {module.heading}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        {module.body}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a
          href={module.primary.href}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--navy)] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          rel="noopener noreferrer"
        >
          {module.primary.label}
        </a>
        {module.secondary ? (
          <a
            href={module.secondary.href}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--navy)] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            rel="noopener noreferrer"
          >
            {module.secondary.label}
          </a>
        ) : null}
      </div>
    </aside>
  );
}
