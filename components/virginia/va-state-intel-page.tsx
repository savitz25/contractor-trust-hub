import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import {
  DPOR_BOARD,
  DPOR_COMPLAINT,
  DPOR_LISTS,
  DPOR_LOOKUP,
  DPOR_NEWS,
  DPOR_RECOVERY,
  DPOR_TOWN_HALL,
} from "@/lib/virginia-intelligence/publication";
import { fmtInt, type VirginiaContractorSnapshot } from "@/lib/virginia-intelligence/snapshot";

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

export function VirginiaIntelPage({ snapshot }: { snapshot: VirginiaContractorSnapshot }) {
  const s = snapshot;
  const r = s.business_roster;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Virginia research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · Virginia · no city/county pages
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        Virginia Contractor License &amp; Regulatory Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official Virginia DPOR Board for Contractors Class A, B, and C business licenses,
        classification/specialty scopes, License Lookup verification, revocation releases, and the
        Contractor Transaction Recovery Fund. This is not a ranking, recommendation, or Trust Score.
        Class A is not safer. A tradesman is not a contractor business. A complaint is not a
        disciplinary case.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · source as of {s.clocks.regulant_lists_sourceAsOf} · retrieved{" "}
        {s.clocks.regulant_lists_retrievedAt} · publication gate {s.gate.passed ? "passed" : "blocked"}
      </p>

      <section className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" aria-labelledby="va-model">
        <h2 id="va-model" className="text-sm font-semibold text-[var(--navy)]">
          Statewide contractor-business licensing
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          Virginia licenses contractor <strong>businesses</strong> statewide. A contractor license has
          two parts: license class (A, B, or C) for the monetary value of contracts, and
          classification/specialty for the type of work allowed. That is not a specialty-only state
          and not a person-tradesman census. Confirm current status on{" "}
          <Official href={DPOR_LOOKUP} label="DPOR License Lookup" />.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric value={fmtInt(s.hero.universe_value)} label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric value={fmtInt(s.hero.class_a_value)} label={s.hero.class_a_label} hint={s.hero.class_a_hint} />
          <Metric value={fmtInt(s.hero.class_b_value)} label={s.hero.class_b_label} />
          <Metric value={fmtInt(s.hero.class_c_value)} label={s.hero.class_c_label} />
          <Metric
            value={fmtInt(s.hero.discipline_value)}
            label={s.hero.discipline_label}
            hint={s.hero.discipline_hint}
          />
          <Metric value={String(s.hero.as_of_value)} label={`As-of · ${s.hero.as_of_label}`} />
        </div>
        <Trace
          source={DPOR_LISTS}
          sourceDate={s.clocks.regulant_lists_sourceAsOf}
          denominator={`${fmtInt(r.distinct_class_abc_licenses)} distinct Class A/B/C license numbers`}
          calculation="2705A + 2701 Class A files, plus 2705B and 2705C. Classes are disjoint. Temporary, tradesman, and RBEA files are not added."
          grain="contractor-business license number"
          coverage="Official DPOR regulant lists updated every 5 business days"
          caveat="A license row is not proof of a unique company. Specialty tokens on a row are not extra contractors. Missing is not zero."
        />
      </section>

      <section className="mt-10" aria-labelledby="class-heading">
        <h2 id="class-heading" className="text-lg font-semibold text-[var(--navy)]">
          Class A / B / C
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Current Code of Virginia § 54.1-1100 (retrieved 2026-09-10). Class is a statutory
          contract-value threshold, not a quality tier.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          <li>
            <strong>Class A</strong> — single contract $150,000 or more, or $1 million or more in a
            12-month period. {fmtInt(r.class_a_distinct)} licenses.
          </li>
          <li>
            <strong>Class B</strong> — $30,000 to less than $150,000, or $250,000 to less than $1
            million in 12 months. {fmtInt(r.class_b_distinct)} licenses.
          </li>
          <li>
            <strong>Class C</strong> — over $1,000 but less than $30,000, and less than $250,000 in
            12 months. {fmtInt(r.class_c_distinct)} licenses.
          </li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="classif-heading">
        <h2 id="classif-heading" className="text-lg font-semibold text-[var(--navy)]">
          Classifications and specialties
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Official Board dictionary: {fmtInt(s.classifications.count)} classifications/specialties.
          Class is not classification. A license may carry more than one specialty;{" "}
          {fmtInt(r.class_a_rows_with_multiple_specialties)} Class A rows do. Do not sum specialty
          tokens as unique contractors.
        </p>
        <ul className="mt-3 columns-1 gap-x-8 text-sm sm:columns-2">
          {s.classifications.items.map((item) => (
            <li key={item.code} className="break-inside-avoid py-0.5">
              <span className="font-medium">{item.code}</span> — {item.official_name}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="lookup-heading">
        <h2 id="lookup-heading" className="text-lg font-semibold text-[var(--navy)]">
          Live DPOR verification
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          <Official href={DPOR_LOOKUP} label="DPOR License Lookup" /> is the official live path for
          license number, class, specialty, status, expiration, and disciplinary orders. Search-only
          is not zero. A lookup result is not a ContractorTrustHub public profile.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="trades-heading">
        <h2 id="trades-heading" className="text-lg font-semibold text-[var(--navy)]">
          Tradesman / person distinction
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          DPOR also licenses individual tradespeople ({fmtInt(s.tradesmen.combined_license_rows)}{" "}
          combined-license rows in the 2710 file). That is person grain. It is not added to the{" "}
          {fmtInt(r.distinct_class_abc_licenses)} contractor-business denominator. No person directory
          is published on this page. Qualified individual and designated employee are not the
          contractor business.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="disc-heading">
        <h2 id="disc-heading" className="text-lg font-semibold text-[var(--navy)]">
          Disciplinary actions and revocations
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          Bounded index of official DPOR contractor revocation releases from{" "}
          {s.discipline.earliest_meeting_this_index} through {s.discipline.latest_meeting_this_index}.{" "}
          {fmtInt(s.discipline.observation_rows)} observations, {fmtInt(s.discipline.distinct_cases)}{" "}
          distinct cases, {fmtInt(s.discipline.distinct_licenses)} distinct license numbers. All
          published rows use exact license numbers. Name-only is unsafe. A case is not a violation
          count. Revocation is not a criminal conviction. No result is not a clean history. This is
          not all Virginia contractor discipline — see{" "}
          <Official href={DPOR_NEWS} label="DPOR news releases" /> and{" "}
          <Official href={DPOR_TOWN_HALL} label="Regulatory Town Hall" /> (search/document research).
        </p>
        <Trace
          source={DPOR_NEWS}
          sourceDate={`${s.discipline.earliest_meeting_this_index} to ${s.discipline.latest_meeting_this_index}`}
          denominator={`${fmtInt(s.discipline.observation_rows)} revocation-release observations`}
          calculation="Exact DPOR license number + case number from official contractor revocation texts. Duplicate respondent/case blocks are retained as observations."
          grain="revocation observation row"
          coverage="Contractor revocation releases only"
          caveat="Not the complete Board discipline corpus. Observation row is not a unique contractor."
        />
      </section>

      <section className="mt-10" aria-labelledby="fund-heading">
        <h2 id="fund-heading" className="text-lg font-semibold text-[var(--navy)]">
          Contractor Transaction Recovery Fund
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          <Official href={DPOR_RECOVERY} label="Official Recovery Fund page" />. Filing a claim is
          not payment. An approved claim is not a license revocation. A Recovery Fund case is not a
          Board disciplinary case. A court judgment is not a criminal conviction. A fund payment is
          not total consumer loss. No structured bulk payment file was acquired — missing is not
          zero.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="complaint-heading">
        <h2 id="complaint-heading" className="text-lg font-semibold text-[var(--navy)]">
          Complaint process
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          <Official href={DPOR_COMPLAINT} label="File or research a DPOR complaint" />. A complaint
          is not a disciplinary case and not a violation. Filed is not substantiated.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="bond-heading">
        <h2 id="bond-heading" className="text-lg font-semibold text-[var(--navy)]">
          Bond / insurance verification context
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          Class A and Class B applicants must submit financial verification or a surety bond at
          application. That is not a public current bulk proof file. This page does not set bonded =
          true/false from license status. Coverage is UNKNOWN / VERIFY_PATH.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="pop-heading">
        <h2 id="pop-heading" className="text-lg font-semibold text-[var(--navy)]">
          Official monthly aggregate
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          DPOR Regulant Population List as of {s.population_list.sourceAsOf}: Class A{" "}
          {fmtInt(s.population_list.contractors_class_a)}, Class B{" "}
          {fmtInt(s.population_list.contractors_class_b)}, Class C{" "}
          {fmtInt(s.population_list.contractors_class_c)}. That dated monthly aggregate is not the{" "}
          {fmtInt(r.distinct_class_abc_licenses)}-license September 2026 row-level roster and is not
          used to create profiles.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="gaps-heading">
        <h2 id="gaps-heading" className="text-lg font-semibold text-[var(--navy)]">
          Coverage gaps
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Missing is not zero. Search-only is not zero.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {s.gaps.OPEN_SEARCH_ONLY.map((g) => (
            <li key={g}>OPEN_SEARCH_ONLY — {g}</li>
          ))}
          {s.gaps.SOURCE_NOT_ACQUIRED.map((g) => (
            <li key={g}>SOURCE_NOT_ACQUIRED — {g}</li>
          ))}
          {s.gaps.UNKNOWN.map((g) => (
            <li key={g}>UNKNOWN — {g}</li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs text-[var(--muted)]">
        Board home: <Official href={DPOR_BOARD} label="Virginia Board for Contractors" />. Independent
        research. You decide.
      </p>
    </main>
  );
}
