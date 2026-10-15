import Link from "next/link";
import { loadContractorNetworkMetrics } from "@/lib/metrics/load-network-metrics";
import { PUBLISHED_STATE_COUNT } from "@/lib/states/published-coverage";

const METRIC_KEYS = [
  ["live_credential_records", "contractor credential records searchable in Verify"],
  ["regulatory_discipline_action_rows", "regulatory and enforcement source rows"],
  ["indexed_permit_source_records", "indexed permit source records"],
] as const;

/** Published roster depth already accepted in the network metrics. Counts are not handwritten. */
const FEATURED_ROSTERS = [
  { key: "evidence_wa_registrations", href: "/washington", name: "Washington", grain: "L&I contractor license numbers" },
  { key: "evidence_az_current", href: "/arizona", name: "Arizona", grain: "current ROC license rows" },
  { key: "evidence_va_class_abc", href: "/virginia", name: "Virginia", grain: "Class A, B, and C contractor-business licenses" },
  { key: "evidence_tx_business_credentials", href: "/texas", name: "Texas", grain: "TDLR specialty business credentials" },
] as const;

/** Upper-homepage depth band: state footprint, a few source-native metrics, and a route into the states. */
export function HomeNetworkDepth() {
  const network = loadContractorNetworkMetrics();
  const metrics = METRIC_KEYS.flatMap(([key, label]) => {
    const value = network.metrics.find((m) => m.key === key)?.value;
    return typeof value === "number" ? [{ key, label, value }] : [];
  });
  const featured = FEATURED_ROSTERS.flatMap((item) => {
    const metric = network.metrics.find((m) => m.key === item.key);
    if (!metric || metric.publicationStatus !== "PUBLIC" || typeof metric.value !== "number") return [];
    const clock = metric.sourceAsOf ?? metric.snapshotAsOf ?? null;
    return [{ ...item, value: metric.value, clock, limit: metric.description }];
  });
  return (
    <section id="network-depth" aria-labelledby="network-depth-title" className="scroll-mt-24">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="cth-intel-eyebrow">Research footprint</p>
        <h2 id="network-depth-title" className="text-2xl font-bold sm:text-3xl">{PUBLISHED_STATE_COUNT} states with published contractor intelligence</h2>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          This count is every published state research page. It includes pages whose license rosters are not acquired.
          Each page keeps its own licensing, registration, and enforcement sources.
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
        <p className="mt-5 text-sm font-semibold text-[var(--text)]">Featured published rosters</p>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Chosen for roster depth customers can open. License rows are not unique businesses.
          States without an acquired roster stay in the full list below and are not shown as zero.
        </p>
        <ul className="mt-3 grid list-none gap-3 p-0 sm:grid-cols-2" aria-label="Featured state intelligence">
          {featured.map((item) => (
            <li key={item.key} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-sm font-semibold text-[var(--navy)]">{item.name}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--navy)]">{item.value.toLocaleString("en-US")}</p>
              <p className="mt-1 text-sm text-[var(--text)]">{item.grain}</p>
              {item.clock ? <p className="mt-1 text-xs text-[var(--muted)]">Source as of {item.clock}</p> : null}
              {item.limit ? <p className="mt-1 text-xs text-[var(--muted)]">Does not count: {item.limit}</p> : null}
              <Link href={item.href} className="mt-3 inline-block text-sm font-semibold text-[var(--navy)] underline underline-offset-2">
                Review the published evidence
              </Link>
            </li>
          ))}
        </ul>
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
