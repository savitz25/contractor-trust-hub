import Link from "next/link";
import { loadContractorNetworkMetrics } from "@/lib/metrics/load-network-metrics";
import { PUBLISHED_STATE_COUNT, RECENT_PUBLISHED_STATES } from "@/lib/states/published-coverage";

const METRIC_KEYS = [
  ["live_credential_records", "contractor credential records searchable in Verify"],
  ["regulatory_discipline_action_rows", "regulatory and enforcement source rows"],
  ["indexed_permit_source_records", "indexed permit source records"],
] as const;

/** Upper-homepage depth band: state footprint, a few source-native metrics, and a route into the states. */
export function HomeNetworkDepth() {
  const network = loadContractorNetworkMetrics();
  const metrics = METRIC_KEYS.flatMap(([key, label]) => {
    const value = network.metrics.find((m) => m.key === key)?.value;
    return typeof value === "number" ? [{ key, label, value }] : [];
  });
  const recent = RECENT_PUBLISHED_STATES.slice(0, 6);
  return (
    <section id="network-depth" aria-labelledby="network-depth-title" className="scroll-mt-24">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="cth-intel-eyebrow">Research footprint</p>
        <h2 id="network-depth-title" className="text-2xl font-bold sm:text-3xl">{PUBLISHED_STATE_COUNT} states with published contractor intelligence</h2>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          Each state page is built from that state&apos;s own licensing, registration, and enforcement sources.
          Coverage keeps expanding state by state.
        </p>
        <ul className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4" aria-label="Evidence depth by separate grain">
          <li className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <p className="text-2xl font-bold text-[var(--navy)]">{PUBLISHED_STATE_COUNT}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">published state intelligence pages</p>
          </li>
          {metrics.map((m) => (
            <li key={m.key} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-2xl font-bold text-[var(--navy)]">{m.value.toLocaleString("en-US")}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{m.label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[var(--muted)]">
          These are different kinds of records and are never added into one total.
        </p>
        <p className="mt-5 text-sm font-semibold text-[var(--text)]">Recently added states</p>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Recently added state intelligence pages">
          {recent.map((s) => (
            <Link
              key={s.slug}
              href={s.href}
              title={s.recentSummary}
              className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm no-underline hover:border-[var(--navy)]/40"
            >
              {s.name}
            </Link>
          ))}
        </div>
        <div className="cth-intel-actions mt-5">
          <a className="cth-intel-btn cth-intel-btn--primary" href="#states">
            Explore all {PUBLISHED_STATE_COUNT} states
          </a>
          <a className="cth-intel-btn cth-intel-btn--secondary" href="#scale">
            See the full evidence inventory
          </a>
        </div>
      </div>
    </section>
  );
}
