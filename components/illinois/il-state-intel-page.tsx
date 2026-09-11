import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { IL_IDFPR_LOOKUP, IL_IDFPR_ROOFING, IL_IDPH_PLUMBING, IL_OPEN_DATA } from "@/lib/illinois-intelligence/publication";
import { fmtInt, type IllinoisContractorSnapshot } from "@/lib/illinois-intelligence/snapshot";

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

export function IllinoisIntelPage({ snapshot }: { snapshot: IllinoisContractorSnapshot }) {
  const s = snapshot;
  const b = s.business_licenses;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Illinois research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · Illinois · roofing only · no city or county pages
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">Illinois Roofing License Research</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official IDFPR licensed roofing contractor credentials from Professional Licensing Open Data. Illinois does
        not use this dataset as a statewide general-contractor or home-improvement roster. A qualifying party is a
        person credential, not a roofing business. Confirm current status on{" "}
        <Official href={IL_IDFPR_LOOKUP} label="IDFPR License Look Up" />.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · source updated {s.clocks.sourceUpdatedAt} · retrieved {s.clocks.retrievedAt}
      </p>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(s.hero.universe_value)} label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric value={fmtInt(s.hero.rows_value)} label={s.hero.rows_label} hint={s.hero.rows_hint} />
          <Metric value={fmtInt(s.hero.qp_value)} label={s.hero.qp_label} hint={s.hero.qp_hint} />
          <Metric value={String(s.hero.as_of_value)} label={`As-of · ${s.hero.as_of_label}`} />
        </div>
        <Trace
          source={IL_OPEN_DATA}
          sourceDate={s.clocks.sourceUpdatedAt}
          denominator={`${fmtInt(b.active_business_y_rows)} ACTIVE + business=Y licensed-roofing rows collapse to ${fmtInt(b.active_business_y_distinct_license_ids)} distinct license numbers`}
          calculation={b.headline_definition}
          grain="distinct IDFPR licensed roofing contractor license_number"
          coverage="Statewide roofing credentials, including out-of-state mailing addresses"
          caveat="Not unique companies. Not qualifying parties. Not all Illinois contractors. Repeated rows are extra disciplinary actions."
        />
      </section>

      <section className="mt-10" aria-labelledby="biz-heading">
        <h2 id="biz-heading" className="text-lg font-semibold text-[var(--navy)]">
          Source-reported business-license status
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Description <strong>LICENSED ROOFING CONTRACTOR</strong> is the business class. Source-native ACTIVE plus
          business=Y yields {fmtInt(b.active_business_y_rows)} rows and {fmtInt(b.active_business_y_distinct_license_ids)}{" "}
          distinct license IDs. Status does not conflict on repeated IDs; extra rows carry additional disciplinary
          action values such as Fine versus Reprimand. A frozen ACTIVE observation is not a live license check.{" "}
          <Official href={IL_IDFPR_ROOFING} label="Official IDFPR roofing program page" />
        </p>
      </section>

      <section className="mt-10" aria-labelledby="qp-heading">
        <h2 id="qp-heading" className="text-lg font-semibold text-[var(--navy)]">
          Qualifying parties — person grain
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Qualifying-party credentials are not roofing businesses and are not added to {fmtInt(s.hero.universe_value)}.
          This page does not publish a person directory. A person may hold more than one credential. Business-to-party
          relationships are not inferred from names or addresses.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="disc-heading">
        <h2 id="disc-heading" className="text-lg font-semibold text-[var(--navy)]">
          Same-source discipline observations
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {fmtInt(s.discipline.flag_rows)} roofing rows carry ever_disciplined=Y on {fmtInt(s.discipline.flag_distinct_license_ids)}{" "}
          distinct license IDs. {fmtInt(s.discipline.case_rows)} rows have a case number across {fmtInt(s.discipline.distinct_case_ids)}{" "}
          distinct case IDs. A flag is not a case. A case is not a violation count. An observation is not a conviction.
          Missing is not a clean history. These are roofing-slice counts, not the master professional-licensing
          discipline totals.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="text-lg font-semibold text-[var(--navy)]">
          Coverage limitations
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>This snapshot is roofing only. It is not a statewide GC or HIC universe.</li>
          <li>Absence from this slice does not mean an unrelated residential contractor is operating illegally.</li>
          <li>Illinois mailing address is not service territory. Out-of-state addresses remain when they hold an Illinois roofing credential.</li>
          <li>
            Plumbing contractor registration is a separate IDPH program: <Official href={IL_IDPH_PLUMBING} label="IDPH Plumbing Program" />.
          </li>
          <li>Chicago, Cook County, and other local contractor licenses are not acquired here.</li>
          <li>No Trust Score, paid ranking, or best/safest/vetted conclusions.</li>
        </ul>
      </section>
    </main>
  );
}
