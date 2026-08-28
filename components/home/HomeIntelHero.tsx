import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";
import { formatIntelCount } from "@/lib/home/intel-v2";
import type { ContractorHubIntelV2 } from "@/lib/home/intel-v2";

export function HomeIntelHero({ intel }: { intel: ContractorHubIntelV2 }) {
  const live = intel.publicCoverage;
  const actions = intel.regulatoryEvidence.totalActionRows;
  const cards = [
    {
      href: "/#search",
      value: formatIntelCount(live.credentialRecords),
      label: "Official contractor & trade credential records",
      grain: `Across ${live.liveStates} currently live researched states. Credential rows from published board extracts — not a U.S. contractor census.`,
    },
    {
      href: "/#search",
      value: formatIntelCount(live.activeCurrentCredentialRecords),
      label: "Active/current credentials",
      grain: "status_normalized is active or current in that same live-state cohort. Expired or inactive is not misconduct.",
    },
    {
      href: "/#enforcement",
      value: formatIntelCount(actions),
      label: "Regulatory & enforcement records indexed",
      grain: "Source rows in discipline_actions. Not “bad contractors.” Families differ — open the breakdown below.",
    },
    {
      href: "/#states",
      value: formatIntelCount(live.liveStates),
      label: "Live researched states",
      grain: `${live.liveStateCodes.join(" · ")}. Geographic context, not the principal proof of coverage depth.`,
    },
  ];

  return (
    <section className="relative border-b border-[var(--border)]">
      <div className="th-shell pb-10 pt-10 sm:pb-12 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Official records, organized for research
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-4xl sm:leading-[1.12] lg:text-5xl">
          Research a contractor before you hire.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Licensing, status, regulatory, enforcement, and public-record research — without paid
          rankings or pay-to-play placement. Not every U.S. contractor is here. Missing evidence is
          not a clean record.
        </p>

        <div id="search" className="mt-8 scroll-mt-24">
          <div className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-md)] sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Search by company name or license number
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Uses the same Verify search as the rest of the site. Choose a live state, then search.
            </p>
            <div className="mt-4">
              <SearchForm size="hero" showStatePicker />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="text-[var(--muted)]">Try:</span>
              <Link href="/verify?q=CBC015082" className="text-[var(--navy)] hover:underline">
                FL CBC015082
              </Link>
              <Link href="/verify?state=tx&q=10001" className="text-[var(--navy)] hover:underline">
                TX 10001
              </Link>
              <Link href="/verify?state=or&q=259513" className="text-[var(--navy)] hover:underline">
                OR 259513
              </Link>
            </div>
          </div>
        </div>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <li key={c.label}>
              <Link
                href={c.href}
                className="block h-full rounded-2xl border border-[var(--border)] bg-white p-4 no-underline shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--navy)]/30"
              >
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--text)] sm:text-4xl">
                  {c.value}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--text)]">{c.label}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{c.grain}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
