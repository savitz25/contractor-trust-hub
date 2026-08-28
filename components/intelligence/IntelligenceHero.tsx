import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";

const TASKS = [
  { href: "#snapshot", label: "Explore Florida contractor intelligence", hint: "State of the record" },
  { href: "/verify", label: "Research a contractor", hint: "Name or full license number" },
  { href: "/verify", label: "Verify a license", hint: "Full DBPR license identity" },
  { href: "/florida/roofers", label: "Find a roofer", hint: "CCC and RC credentials" },
  { href: "/florida/air-conditioning", label: "Find HVAC", hint: "CAC and RA credentials" },
  { href: "/florida/general-contractors", label: "Find a general contractor", hint: "CGC and RG" },
];

export function IntelligenceHero() {
  return (
    <header className="border-b border-[var(--border)] pb-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--navy)]">
        Florida · contractor intelligence
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
        Florida Contractor Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        Licensing, business identity, regulatory history, trade composition and local public records
        organized for consumers. Understand the market. Verify the contractor. You decide. Not a
        ranking, marketplace, or recommendation list.
      </p>

      <div className="mt-6 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <SearchForm
          size="default"
          stateSlug="fl"
          intent="research"
          label="Search a contractor"
          placeholder="Full license number (CCC1336585) or company name"
        />
      </div>

      <nav aria-label="Florida contractor tasks" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {TASKS.map((t) => (
            <li key={t.href + t.label}>
              <Link
                href={t.href}
                title={t.hint}
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] no-underline shadow-[var(--shadow-sm)] hover:border-[var(--navy)]/25"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
