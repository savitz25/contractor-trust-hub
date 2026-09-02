import Link from "next/link";
import { DiscoverySearchForm } from "@/components/search/DiscoverySearchForm";

const examples = ["roofers in Broward County", "home improvement contractors in New Jersey", "HVAC contractors in Florida", "plumbers in New Jersey", "CCC1332036"];

export function HomeDiscoverySearch() {
  return (
    <section id="contractor-search" aria-labelledby="contractor-search-title" className="scroll-mt-24">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)] sm:p-8">
        <p className="cth-intel-eyebrow">Find / research contractors</p>
        <h2 id="contractor-search-title">Find and research a contractor</h2>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">Describe a trade and place. Results use source-backed credential classes and recorded regulatory geography—not rankings, recommendations, or proof of service territory.</p>
        <div className="mt-5"><DiscoverySearchForm /></div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Example contractor research queries">
          {examples.map((example) => <Link key={example} href={`/search?q=${encodeURIComponent(example)}`} className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm no-underline hover:border-[var(--navy)]/40">{example}</Link>)}
        </div>
        <div className="mt-6 border-t border-[var(--border)] pt-4 text-sm">Already know the business or license? <Link href="/verify" className="font-semibold text-[var(--navy)]">Verify a known business or license</Link>.</div>
      </div>
    </section>
  );
}
