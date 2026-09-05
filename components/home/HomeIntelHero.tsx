import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";
import { loadContractorNetworkMetrics } from "@/lib/metrics/load-network-metrics";

export function HomeIntelHero({ intel: _intel }: { intel: ContractorHubIntelV2 }) {
  const network = loadContractorNetworkMetrics();
  const generatedDay = network.generatedAt.slice(0, 10);
  return (
    <section className="cth-intel-hero" aria-labelledby="home-title">
      <p className="cth-intel-eyebrow">Official-source contractor intelligence</p>
      <h1 id="home-title">Research the contractor. Then research the evidence behind them.</h1>
      <p className="cth-intel-lede">
        Connect a contractor identity to licensing, status, trade classifications, bonds, insurance,
        permits, enforcement, and public business records—where each jurisdiction publishes them.
      </p>
      <p className="cth-intel-signal">Licensing · Bonds · Insurance · Permits · Enforcement · Public records</p>
      <div className="cth-intel-actions">
        <a className="cth-intel-btn cth-intel-btn--primary" href="#contractor-search">Research a contractor</a>
        <a className="cth-intel-btn cth-intel-btn--secondary" href="#states">Explore state intelligence</a>
      </div>
      <p className="mt-5 max-w-3xl text-sm text-[var(--muted)]">
        Independent of contractors and built from public sources. Source dates vary by agency;
        newest documented source date <strong>{network.newestDocumentedSourceAsOf ?? "varies"}</strong>.
        Network rollup generated {generatedDay}. This generation date is not an agency source date. Confirm time-sensitive facts with the linked agency.
      </p>
    </section>
  );
}
