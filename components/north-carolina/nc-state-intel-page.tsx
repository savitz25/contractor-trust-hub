import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import {
  NC_DOA_DEBAR,
  NC_ELECTRICAL_SEARCH,
  NC_NCLBGC_CLASSIFICATIONS,
  NC_NCLBGC_FAQ,
  NC_NCLBGC_RECOVERY,
  NC_NCLBGC_SEARCH,
  NC_PHFS_ATTORNEY,
  NC_PHFS_SEARCH,
} from "@/lib/north-carolina-intelligence/publication";
import { fmtInt, type NorthCarolinaContractorSnapshot } from "@/lib/north-carolina-intelligence/snapshot";

function Metric({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-white px-4 py-3">
      <p className="break-words text-2xl font-bold tabular-nums text-[var(--navy)]">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

function Official({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="font-medium underline underline-offset-2" rel="noopener noreferrer" target="_blank">
      {label}
    </a>
  );
}

export function NorthCarolinaIntelPage({ snapshot }: { snapshot: NorthCarolinaContractorSnapshot }) {
  const s = snapshot;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>North Carolina research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · North Carolina · statewide only
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        North Carolina Contractor Licensing &amp; Regulatory Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        The North Carolina Licensing Board for General Contractors (NCLBGC) licenses general contractors when total
        project cost is $40,000 or more. That threshold is not a rule that every construction job requires an NCLBGC
        license. Specialty boards independently license electrical and plumbing/heating/fire-sprinkler work. A license
        number identifies the licensed entity. A qualifier is not the contracting business. Classification is not
        limitation. Unlimited is not best. Missing or search-only evidence is not zero. This is not a ranking,
        recommendation, or Trust Score.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        No Charlotte, Raleigh, Mecklenburg, Wake, or other local North Carolina contractor pages are published from this
        statewide page.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · fingerprint {s.fingerprint.slice(0, 12)} · retrieved {s.clocks.retrievedAt}. Retrieval is
        not a license status date. The April 2026 ~38,523 mixed-record Board figure is not a current active census.
      </p>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric value="—" label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric
            value={fmtInt(s.hero.discipline_value)}
            label={s.hero.discipline_label}
            hint="Distinct L. numbers in two recent Board PDFs. Not a complete 2022–2026 census."
          />
          <Metric
            value={fmtInt(s.hero.unlicensed_value)}
            label={s.hero.unlicensed_label}
            hint="Unlicensed respondents. Not NCLBGC licensees."
          />
          <Metric
            value={fmtInt(s.hero.debarment_value)}
            label={s.hero.debarment_label}
            hint="Source revised 6/1/2021. Not licensing discipline."
          />
        </div>
        <Trace
          source="NCLBGC public search; Board case-summary PDFs; NC DOA debarred vendors; PHFS Attorney’s Report"
          sourceDate={s.clocks.snapshotAsOf}
          denominator="Separate official datasets. Classes are not added."
          calculation="NCLBGC/NCBEEC/PHFS bulk rosters remain OPEN_SEARCH_ONLY. Numeric grains are named PDFs, the current PHFS attorney page, and the 2021 DOA CSV."
          grain="NCLBGC license number; complaint/case number; DOA vendor row"
          coverage="Statewide North Carolina intelligence only. No Charlotte or Raleigh pages."
          caveat="Search-only is not zero. Profile-linked discipline covers 2022+ complaints that resulted in discipline."
        />
      </section>

      <section className="mt-10" aria-labelledby="nclbgc-heading">
        <h2 id="nclbgc-heading" className="text-lg font-semibold text-[var(--navy)]">
          NCLBGC general-contractor licensing
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Current NCLBGC licensee and qualifier search is OPEN_SEARCH_ONLY. A complete active list is a paid mailing-list
          request; this ticket did not purchase data. Search-only is not zero contractors. Identity is the NCLBGC license
          number (example format L.53462). A qualifier’s examination credential supports a license; it is not a second
          contracting company. Core classifications are Building, Residential, Highway, Public Utilities, and Specialty
          (plus Unclassified). Building and Residential classifications can include work that also exists as a specialty,
          including roofing. Do not treat S(Roofing) as the only licensed roofing path. Limitations are Limited (single
          project up to $750,000), Intermediate (up to $1,500,000), and Unlimited (no single-project value restriction).
          Limitation is not quality. Verify on{" "}
          <Official href={NC_NCLBGC_SEARCH} label="NCLBGC Licensee and Qualifier Search" />. Consumer threshold:{" "}
          <Official href={NC_NCLBGC_FAQ} label="NCLBGC consumer FAQ" />. Classifications:{" "}
          <Official href={NC_NCLBGC_CLASSIFICATIONS} label="classifications and limitations" />.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="discipline-heading">
        <h2 id="discipline-heading" className="text-lg font-semibold text-[var(--navy)]">
          Discipline and unlicensed enforcement
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Starting July 2026, licensee profiles may link Consent Orders or Final Decisions for complaints filed in 2022
          or later that resulted in disciplinary action. No disciplinary link is not a clean historical record. A
          complaint is not discipline. Statewide profile-link census was not scraped. Recent Board PDFs name{" "}
          {fmtInt(s.licensed_summaries.NC_NCLBGC_LICENSED_CASE_SUMMARY_ROWS)} distinct licensed respondents in Oct–Dec
          2025 and Jan–Mar 2026 summaries — a partial period, not 2022–2026 completeness. Unlicensed injunctions are a
          separate grain ({fmtInt(s.unlicensed.NC_NCLBGC_UNLICENSED_UNIQUE_CASES)} unique cases in the Spring 2026 PDF).
          Do not attach unlicensed respondents to current licenses by name. The Homeowners Recovery Fund is last-resort
          consumer context, not a contractor-level adverse index (
          <Official href={NC_NCLBGC_RECOVERY} label="Recovery Fund" />). A hearing is not an award.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="specialty-heading">
        <h2 id="specialty-heading" className="text-lg font-semibold text-[var(--navy)]">
          Electrical and plumbing / heating / fire sprinkler
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Electrical contractors are licensed by NCBEEC, not NCLBGC. Active-license search is OPEN_SEARCH_ONLY; a paid
          listing exists and was not purchased. Person records are not business counts.{" "}
          <Official href={NC_ELECTRICAL_SEARCH} label="NCBEEC active-license search" />. Plumbing, heating, fuel piping,
          and fire sprinkler are a separate board. Contractor classes are not technician classes. Roster search is
          OPEN_SEARCH_ONLY. <Official href={NC_PHFS_SEARCH} label="PHFS license search" />. The current Attorney’s Report
          page lists {fmtInt(s.phfs_attorney.NC_PHFS_ATTORNEY_REPORT_ROWS)} allegation rows; licensed discipline is not
          an unlicensed injunction. <Official href={NC_PHFS_ATTORNEY} label="PHFS Attorney’s Report" />.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="doa-heading">
        <h2 id="doa-heading" className="text-lg font-semibold text-[var(--navy)]">
          State procurement debarment
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          NC DOA publishes {fmtInt(s.doa_debarment.NC_DOA_DEBARRED_VENDOR_ROWS)} debarred-vendor rows last revised{" "}
          {s.doa_debarment.NC_DOA_DEBARRED_VENDOR_SOURCE_AS_OF}. No later revision is not currently verified clean.
          Debarment is not contractor-license discipline. Vendor is not an NCLBGC licensee. Name-only attachment is
          unsafe. <Official href={NC_DOA_DEBAR} label="NC Debarred Vendors" />.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="permits-heading">
        <h2 id="permits-heading" className="text-lg font-semibold text-[var(--navy)]">
          Building permits
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          North Carolina building-permit administration is local and fragmented. This ticket does not publish a statewide
          permit census and does not start Charlotte, Raleigh, Mecklenburg, or Wake harvests.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="text-lg font-semibold text-[var(--navy)]">
          What these numbers do not mean
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>$40,000 threshold ≠ every construction job requires an NCLBGC license.</li>
          <li>~38,523 mixed Board-news records ≠ active contractors.</li>
          <li>Licensee ≠ qualifier. Classification ≠ limitation. Unlimited ≠ best.</li>
          <li>Roofing may be Building, Residential, or S(Roofing). Do not manufacture “all roofers in NC.”</li>
          <li>Electrical ≠ plumbing/HVAC/fire sprinkler ≠ general contractor.</li>
          <li>Complaint ≠ discipline. Unlicensed injunction ≠ licensed order. Debarment ≠ license action.</li>
          <li>Search-only and missing evidence is not zero. No Trust Score or best-contractor ranking.</li>
        </ul>
      </section>
    </main>
  );
}
