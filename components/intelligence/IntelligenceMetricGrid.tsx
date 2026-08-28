import type { IntelligenceMetricValue } from "@/lib/intelligence/florida-snapshot";
import { formatAsOf, formatIntelNumber } from "./format";

const SNAPSHOT_IDS = [
  "trade_credentials_tracked",
  "active_trade_credentials",
  "trade_categories_tracked",
  "florida_counties_represented",
  "regulatory_observations_researched",
] as const;

export function IntelligenceMetricGrid({
  metrics,
  timedOut,
  asOf,
}: {
  metrics: IntelligenceMetricValue[];
  timedOut: boolean;
  asOf: string | null;
}) {
  const byId = new Map(metrics.map((m) => [m.id, m]));
  const cards = SNAPSHOT_IDS.map((id) => byId.get(id)).filter(
    (m): m is IntelligenceMetricValue => Boolean(m)
  );
  const totalDbpr = byId.get("dbpr_credentials_tracked");
  const asOfLabel = formatAsOf(asOf);

  return (
    <section id="snapshot" aria-labelledby="snapshot-heading" className="scroll-mt-24">
      <h2 id="snapshot-heading" className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
        State of the record
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        These figures count <strong className="font-medium text-[var(--text)]">credentials</strong>{" "}
        and <strong className="font-medium text-[var(--text)]">research observations</strong>, not
        distinct companies or people. Active means DBPR secondary status Active.
      </p>

      {timedOut || cards.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
          Live credential counts are temporarily unavailable. County and trade browse links below still work. We do not
          display zeros for a failed snapshot.
        </p>
      ) : null}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((m) => (
          <li
            key={m.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4 shadow-[var(--shadow-sm)]"
          >
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--text)]">
              {formatIntelNumber(m.value, timedOut)}
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">{m.label}</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{m.disclosure}</p>
          </li>
        ))}
      </ul>

      {totalDbpr && !timedOut ? (
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          The Florida research system also tracks{" "}
          <span className="tabular-nums font-medium text-[var(--text)]">
            {formatIntelNumber(totalDbpr.value, timedOut)}
          </span>{" "}
          total DBPR credentials, including financially responsible officer and
          course/provider rows that are not trade licenses.
        </p>
      ) : null}
      {asOfLabel ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          As of {asOfLabel} (credential extract). Not a live DBPR session.
        </p>
      ) : null}
    </section>
  );
}
