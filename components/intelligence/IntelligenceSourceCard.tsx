import type { IntelligenceEvidenceSource } from "@/lib/intelligence/florida-snapshot";
import { formatAsOf } from "./format";

export function IntelligenceSourceSection({
  sources,
}: {
  sources: IntelligenceEvidenceSource[];
}) {
  if (sources.length === 0) return null;

  return (
    <section id="sources" aria-labelledby="sources-heading" className="scroll-mt-24">
      <h2 id="sources-heading" className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
        Source transparency
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        Official public records. Refresh dates are extract times, not a live board session.
        Fiscal-year files stay labeled as fiscal-year coverage — we do not invent rolling 12-month
        windows.
      </p>
      <ul className="mt-6 space-y-3">
        {sources.map((s) => (
          <li key={s.id}>
            <details className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">
                {s.label}
              </summary>
              <dl className="mt-3 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-[var(--text)]">Agency</dt>
                  <dd>{s.agency}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text)]">Contribution</dt>
                  <dd>{s.whatItContains}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text)]">Coverage / freshness</dt>
                  <dd>
                    {s.coveragePeriod}
                    {s.lastExtractedAt ? ` · last extract ${formatAsOf(s.lastExtractedAt)}` : ""}
                    <span className="block mt-1">{s.cadence}</span>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text)]">Limitation</dt>
                  <dd>{s.limitation}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-medium text-[var(--text)]">Attribution methodology</dt>
                  <dd>{s.attributionStatus}</dd>
                </div>
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
