import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import {
  PA_ASBESTOS_CONTRACTORS,
  PA_DEBARMENTS,
  PA_DLI_CONTRACTOR_LICENSING,
  PA_HIC_CONSUMER,
  PA_HIC_SEARCH,
  PA_LEAD_CONTRACTORS,
} from "@/lib/pennsylvania-intelligence/publication";
import { fmtInt, type PennsylvaniaContractorSnapshot } from "@/lib/pennsylvania-intelligence/snapshot";

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

export function PennsylvaniaIntelPage({ snapshot }: { snapshot: PennsylvaniaContractorSnapshot }) {
  const s = snapshot;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Pennsylvania research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · Pennsylvania · statewide only
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        Pennsylvania Contractor &amp; Home Improvement Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Pennsylvania does not have a universal statewide general-contractor license. The primary statewide
        residential credential is HICPA Home Improvement Contractor registration with the Office of Attorney
        General. Registration is not an endorsement, recommendation, or competency finding. Asbestos and lead
        certifications are separate specialty credentials. Public-works debarment is a separate adverse grain.
        Municipal contractor licensing is decentralized. Missing or search-only evidence is not zero. This is not
        a ranking, recommendation, or Trust Score.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · retrieved {s.clocks.retrievedAt} · HICPA sourceAsOf unknown
      </p>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric value="—" label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric
            value={fmtInt(s.hero.asbestos_value)}
            label={s.hero.asbestos_label}
            hint="Firm certification. Not HICPA. Not unique companies."
          />
          <Metric
            value={fmtInt(s.hero.lead_value)}
            label={s.hero.lead_label}
            hint="Firm certification. Not HICPA and not asbestos."
          />
          <Metric
            value={fmtInt(s.hero.debarment_value)}
            label={s.hero.debarment_label}
            hint="Public-works debarment rows. Not complaints and not HICPA."
          />
        </div>
        <Trace
          source="PA OAG HIC search; DLI asbestos/lead contractor lists; DLI prevailing-wage debarments"
          sourceDate={s.clocks.snapshotAsOf}
          denominator="Separate official datasets. Classes are not added."
          calculation="HICPA bulk is OPEN_SEARCH_ONLY. Specialty firm counts are distinct certification numbers."
          grain="HICPA registration number; DLI contractor CERT #; debarment listing row"
          coverage="Statewide Pennsylvania intelligence only. No Philadelphia or Pittsburgh pages."
          caveat="Search-only is not zero. Daily specialty-list cadence is not a row-level sourceAsOf."
        />
      </section>

      <section className="mt-10" aria-labelledby="hicpa-title">
        <h2 id="hicpa-title" className="text-lg font-semibold text-[var(--navy)]">
          HICPA registration is not a general contractor license
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Contractors performing at least $5,000 of home-improvement work a year generally must register. The
          public search displays active registrations and can export a completed search as Excel, but Search is
          gated by Cloudflare Turnstile. A statewide HICPA row census was not acquired. Confirm an exact PA
          registration number on{" "}
          <Official href={PA_HIC_SEARCH} label="Home Improvement Contractor Search" />. Registration under HICPA
          is not an endorsement. See also{" "}
          <Official href={PA_HIC_CONSUMER} label="OAG consumer guidance" />.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          The OAG registration system had an extended outage beginning August 2025. Online search was restored in
          March 2026, the replacement PA-HICRS application became operational on April 24, 2026, and a
          transition/grace period ended June 8, 2026. Retrieval date is not registration effective date. System
          restoration is not sourceAsOf. Gaps during the transition are not historical non-registration.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Type of Work is a newer field and incomplete for much of the existing population. Missing Type of Work
          does not mean the contractor does not perform that trade. Business name is not the primary applicant.
          An address row is not a unique company.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="specialty-title">
        <h2 id="specialty-title" className="text-lg font-semibold text-[var(--navy)]">
          Asbestos and lead contractor certifications stay separate
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          DLI certified asbestos abatement contractor firms: {fmtInt(s.asbestos.PA_ASBESTOS_CONTRACTOR_DISTINCT_IDS)}{" "}
          distinct CERT #s from {fmtInt(s.asbestos.PA_ASBESTOS_CONTRACTOR_ROWS)} list rows. Individual asbestos
          certifications: {fmtInt(s.asbestos.PA_ASBESTOS_INDIVIDUAL_ROWS)} person rows. Firm certification is not
          person certification. Official list:{" "}
          <Official href={PA_ASBESTOS_CONTRACTORS} label="Certified Asbestos Abatement Contractors" />.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          DLI certified lead abatement contractor firms: {fmtInt(s.lead.PA_LEAD_CONTRACTOR_DISTINCT_IDS)} distinct
          CERT #s from {fmtInt(s.lead.PA_LEAD_CONTRACTOR_ROWS)} list rows. Individual lead certifications:{" "}
          {fmtInt(s.lead.PA_LEAD_INDIVIDUAL_ROWS)} person rows. Lead contractor certification is not HICPA
          registration. Official list:{" "}
          <Official href={PA_LEAD_CONTRACTORS} label="Certified Lead Abatement Contractors" />.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="debar-title">
        <h2 id="debar-title" className="text-lg font-semibold text-[var(--navy)]">
          Prevailing-wage debarment is not a HICPA profile
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Current DLI listing: {fmtInt(s.debarment.PA_PREVAILING_WAGE_DEBARMENT_ROWS)} debarment rows,{" "}
          {fmtInt(s.debarment.PA_PREVAILING_WAGE_FIRM_ROWS)} firm respondents and{" "}
          {fmtInt(s.debarment.PA_PREVAILING_WAGE_PERSON_ROWS)} person respondents. Listed persons and firms are
          barred from public contracts for the statutory period after the listed date. A debarment is not a
          complaint and not a criminal conviction. Firm is not person. No name-only attachment to HICPA
          identities. Official list: <Official href={PA_DEBARMENTS} label="Debarments and Settlements" />.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Settlements: current source observation is none. That is not a historical clearance that Pennsylvania
          has never had prevailing-wage settlements.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="local-title">
        <h2 id="local-title" className="text-lg font-semibold text-[var(--navy)]">
          Municipal licensing and UCC permits are not statewide
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          DLI states the Commonwealth currently has no licensure or certification requirements for most
          construction contractors. Some of Pennsylvania’s 2,562 municipalities establish local contractor,
          electrical, or plumbing requirements. The state does not maintain a universal municipal repository.
          Philadelphia licensing is not statewide. Pittsburgh licensing is not statewide. Absence from this page
          is not zero. Official note:{" "}
          <Official href={PA_DLI_CONTRACTOR_LICENSING} label="DLI contractor licensing" />.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Uniform Construction Code permit functions are mostly municipal or third-party. There is no comparable
          statewide building-permit census on this page. No manufactured permit total.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="limits-title">
        <h2 id="limits-title" className="text-lg font-semibold text-[var(--navy)]">
          What these numbers do not mean
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--muted)]">
          <li>HICPA registration != general contractor license != specialty certification.</li>
          <li>Asbestos contractor firm != asbestos-certified person. Lead contractor != lead-certified person.</li>
          <li>Debarment row != HICPA registration. Public-work eligibility != residential quality.</li>
          <li>No Trust Score. No star-rating markup. No best or safest contractor ranking.</li>
        </ul>
      </section>
    </main>
  );
}
