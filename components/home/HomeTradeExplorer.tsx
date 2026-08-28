import Link from "next/link";
import { formatIntelCount } from "@/lib/home/intel-v2";
import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";

export function HomeTradeExplorer({ intel }: { intel: ContractorHubIntelV2 }) {
  const families = intel.tradeFamilies.families.filter((f) => f.credentialRows > 0);
  return (
    <section id="trades" className="border-b border-[var(--border)] bg-white">
      <div className="th-shell py-10 sm:py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Find a contractor type
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
          What type of contractor are you looking for?
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Counts are credential rows matching published occupation codes — not a national trade
          census, and not apprentices, bonds, or unlicensed registrations folded in by keyword.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {families.map((f) => (
            <li key={f.id}>
              <Link
                href={f.href}
                className="block h-full rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 no-underline hover:border-[var(--navy)]/30"
              >
                <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">
                  {formatIntelCount(f.activeCurrentRows)}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text)]">{f.label}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {formatIntelCount(f.credentialRows)} credential rows ·{" "}
                  {f.contributingSources.length} live source
                  {f.contributingSources.length === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--muted)]">
          {intel.tradeFamilies.note}
        </p>
      </div>
    </section>
  );
}
