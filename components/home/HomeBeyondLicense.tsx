import Link from "next/link";
import { formatIntelCount } from "@/lib/home/intel-v2";
import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";

export function HomeBeyondLicense({ intel }: { intel: ContractorHubIntelV2 }) {
  return (
    <section id="beyond-license" className="border-b border-[var(--border)]">
      <div className="th-shell py-10 sm:py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Beyond the license
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          Public permit intelligence in enhanced local markets
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          {formatIntelCount(intel.permits.sourceRecords)} permit-source records researched/indexed.
          This is not nationwide contractor jobs, and not projects completed. Attribution is
          geographic and exact-identity only.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/florida" className="font-semibold text-[var(--navy)] hover:underline">
            Florida state &amp; county intelligence
          </Link>
        </p>
      </div>
    </section>
  );
}
