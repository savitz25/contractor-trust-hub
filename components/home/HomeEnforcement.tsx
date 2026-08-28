import Link from "next/link";
import { formatIntelCount } from "@/lib/home/intel-v2";
import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";

export function HomeEnforcement({ intel }: { intel: ContractorHubIntelV2 }) {
  const ev = intel.regulatoryEvidence;
  return (
    <section id="enforcement" className="scroll-mt-24 border-b border-[var(--border)] bg-[var(--bg-elevated)]/60">
      <div className="th-shell py-10 sm:py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Regulatory &amp; enforcement intelligence
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          {formatIntelCount(ev.totalActionRows)} regulatory &amp; enforcement records indexed
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          These are source records, not a count of “bad contractors.” A stop-work order, unlicensed
          activity row, licensing discipline row, and recovery-fund claim are different evidence
          families. Canonical observations ({formatIntelCount(ev.canonicalObservations)}) and
          occurrences ({formatIntelCount(ev.occurrences)}) are different grains and are not added
          into this total.
        </p>
        <ul className="mt-6 space-y-2">
          {ev.byEvidenceFamily.map((f) => (
            <li
              key={f.key}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3"
            >
              <span className="text-sm text-[var(--text)]">{f.label}</span>
              <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
                {formatIntelCount(f.rows)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--muted)]">
          {ev.grainNote}{" "}
          <Link href="/methodology" className="font-medium text-[var(--navy)] hover:underline">
            Methodology
          </Link>
        </p>
      </div>
    </section>
  );
}
