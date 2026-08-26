import type { IntelligenceEvidenceSource } from "@/lib/intelligence/florida-snapshot";
import { formatAsOf, formatIntelNumber } from "./format";

export function IntelligenceEvidenceScale({
  sources,
  observationTotal,
  timedOut,
}: {
  sources: IntelligenceEvidenceSource[];
  observationTotal: number | null;
  timedOut: boolean;
}) {
  const research = sources.filter((s) => s.observationCount != null);

  return (
    <section id="regulatory" aria-labelledby="regulatory-heading" className="scroll-mt-24">
      <h2 id="regulatory-heading" className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
        Regulatory &amp; enforcement research
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        Trust Hub collects Florida public regulatory records so you can research them on an
        individual due-diligence path. This is <strong className="font-medium text-[var(--text)]">research
        coverage</strong>, not a blacklist.
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-5">
        <p className="text-3xl font-semibold tabular-nums text-[var(--text)]">
          {formatIntelNumber(timedOut ? null : observationTotal, timedOut)}
        </p>
        <p className="mt-1 text-sm font-medium text-[var(--text)]">
          Florida regulatory/public-record observations researched
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
          A regulatory record is not the same as a finding against a contractor. Records may
          include complaints, notices, administrative actions, claims, enforcement rows, and
          multiple actions associated with the same matter. Trust Hub does not publish “contractors
          with violations” lists.
        </p>
        <ol className="mt-4 flex flex-wrap gap-2 text-xs">
          <li className="rounded-full border border-[var(--border)] bg-white px-3 py-1 font-medium text-[var(--text)]">
            1. Records collected
          </li>
          <li className="rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-[var(--muted)]">
            Later stages (resolved identity, distinct businesses, final outcomes) appear when those
            metrics are ready
          </li>
        </ol>
      </div>

      <ul className="mt-6 grid gap-3 lg:grid-cols-2">
        {research.map((s) => (
          <li key={s.id}>
            <details className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
              <summary className="cursor-pointer">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--text)]">{s.label}</span>
                  <span className="tabular-nums text-sm text-[var(--muted)]">
                    {formatIntelNumber(timedOut ? null : s.observationCount, timedOut)} observations
                  </span>
                </span>
              </summary>
              <dl className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <div>
                  <dt className="font-medium text-[var(--text)]">Agency</dt>
                  <dd>{s.agency}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text)]">What it contains</dt>
                  <dd>{s.whatItContains}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text)]">Coverage period</dt>
                  <dd>
                    {s.coveragePeriod}
                    {s.lastExtractedAt
                      ? ` · last extract ${formatAsOf(s.lastExtractedAt)}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text)]">Attribution</dt>
                  <dd>{s.attributionStatus}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text)]">Limitation</dt>
                  <dd>{s.limitation}</dd>
                </div>
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
