import Link from "next/link";
import { formatIntelCount } from "@/lib/home/intel-v2";
import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";

export function HomeIntelHero({ intel }: { intel: ContractorHubIntelV2 }) {
  const live = intel.publicCoverage;
  const snapshotDay = intel.generatedAt.slice(0, 10);
  const metrics = [
    {
      href: "#findings",
      kicker: "Research universe",
      value: formatIntelCount(live.credentialRecords),
      label: "Credential records in live researched states",
    },
    {
      href: "#findings",
      kicker: "Currently active/current",
      value: formatIntelCount(live.activeCurrentCredentialRecords),
      label: "Credentials with status_normalized active or current",
    },
    {
      href: "#findings",
      kicker: "Evidence records",
      value: formatIntelCount(intel.regulatoryEvidence.totalActionRows),
      label: "Indexed regulatory and enforcement source rows",
    },
    {
      href: "#states",
      kicker: "Geographies researched",
      value: formatIntelCount(live.liveStates),
      label: "Live researched states in this product",
    },
    {
      href: "#methodology",
      kicker: "Last official update",
      value: snapshotDay,
      label: "Research snapshot date — board extract dates vary",
    },
  ];

  return (
    <section className="cth-intel-hero" aria-labelledby="home-title">
      <p className="cth-intel-eyebrow">Contractor market intelligence</p>
      <h1 id="home-title">Research contractor licensing and regulatory records before you hire.</h1>
      <p className="cth-intel-lede">
        ContractorTrustHub organizes public licensing, credential status, trade class, and
        regulatory-history records. It is not a directory ranking and not a recommendation engine.
        Understand the market, then research a specific contractor.
      </p>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Latest official contractor datasets in this research snapshot include records updated through{" "}
        <strong className="font-medium text-[var(--text)]">{snapshotDay}</strong>. Confirm live status
        on the official board before you hire.
      </p>
      <div className="cth-intel-actions">
        <a className="cth-intel-btn cth-intel-btn--primary" href="#findings">
          Explore contractor intelligence
        </a>
        <a className="cth-intel-btn cth-intel-btn--secondary" href="#verify">
          Research a contractor
        </a>
      </div>
      <ul className="cth-intel-metrics mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((m) => (
          <li key={m.kicker}>
            <Link href={m.href} className="cth-intel-card block h-full no-underline">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--navy)]">
                {m.kicker}
              </p>
              <p className="cth-intel-metric-value mt-2 text-[1.65rem] sm:text-2xl">{m.value}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{m.label}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
