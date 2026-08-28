import Link from "next/link";
import { formatIntelCount } from "@/lib/home/intel-v2";
import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";

export function HomeMethodology({ intel }: { intel: ContractorHubIntelV2 }) {
  const live = intel.publicCoverage;
  const graph = intel.researchGraph;
  return (
    <section id="methodology" className="border-b border-[var(--border)] bg-white">
      <div className="th-shell py-10 sm:py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          How these numbers are calculated
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          Methodology and limits
        </h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Currently live public coverage</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              <li>
                {formatIntelCount(live.credentialRecords)} credential rows from{" "}
                {live.liveSourceSystems.join(", ")}
              </li>
              <li>
                {formatIntelCount(live.activeCurrentCredentialRecords)} of those are
                status_normalized active or current
              </li>
              <li>
                Live states: {live.liveStateCodes.join(", ")} ({live.liveStates})
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Broader research graph (not a census)</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              <li>{formatIntelCount(graph.contractorIdentityRows)} contractor identity rows</li>
              <li>
                <strong>
                  {formatIntelCount(graph.licenseRows)} license records across{" "}
                  {formatIntelCount(graph.populatedLicenseSourceSystems)} regulatory source systems
                  in the broader research graph
                </strong>
              </li>
              <li>
                {formatIntelCount(graph.entityLinks)} contractor–entity relationship rows
              </li>
              <li>
                {formatIntelCount(graph.publicContactObservations)} public contact observations
              </li>
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{graph.note}</p>
          </div>
        </div>
        <p className="mt-5 text-sm text-[var(--muted)]">
          Snapshot {intel.schemaVersion}, generated {intel.generatedAt.slice(0, 10)}. Source
          datasets, exact denominators, and included systems are in this section — not Git SHAs on
          the homepage.{" "}
          <Link href="/methodology" className="font-medium text-[var(--navy)] hover:underline">
            Full methodology
          </Link>
          {" · "}
          <Link href="/independence" className="font-medium text-[var(--navy)] hover:underline">
            Independence
          </Link>
          {" · "}
          <Link href="/disclaimer" className="hover:underline">
            Disclaimer
          </Link>
        </p>
      </div>
    </section>
  );
}
