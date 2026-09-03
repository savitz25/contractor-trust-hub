import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import {
  fmtHero,
  fmtInt,
  type NewJerseyContractorSnapshot,
} from "@/lib/new-jersey-intelligence/snapshot";

function Metric({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
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

export function NewJerseyContractorPage({ snapshot }: { snapshot: NewJerseyContractorSnapshot }) {
  const s = snapshot;
  const C = s.construction;
  const M = s.municipalities;
  const R = s.regulatory;
  const counties = s.counties.filter((c) => !c.is_state_category);
  const stateCat = s.counties.find((c) => c.is_state_category);

  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>New Jersey research</span>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
          Independent research · New Jersey
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
          New Jersey Contractor &amp; Construction Intelligence
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          This page organizes official state evidence about construction source records, municipality
          reporting, public-works lists, specialty credentials, and enforcement notices. It is not a
          ranking, recommendation, or Trust Score.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Snapshot {s.version} · as of {s.as_of}
        </p>
      </header>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          <Metric value={fmtHero(s.hero.universe_value)} label={`Universe · ${s.hero.universe_label}`} hint={s.hero.universe_hint} />
          <Metric value={fmtHero(s.hero.current_value)} label={`Current · ${s.hero.current_label}`} hint={s.hero.current_hint} />
          <Metric value={fmtHero(s.hero.observations_value)} label={`Observations · ${s.hero.observations_label}`} hint={s.hero.observations_hint} />
          <Metric value={fmtHero(s.hero.geography_value)} label={`Geography · ${s.hero.geography_label}`} hint={s.hero.geography_hint} />
          <Metric value={String(s.hero.as_of_value)} label={`As-of · ${s.hero.as_of_label}`} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Market findings</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {s.findings.map((f) => (
            <li key={f.id}>{f.text}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Four-county research</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          County pages project statewide construction source records onto four New Jersey counties.
          They are not municipality directories and not service-area maps.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm">
          <li>
            <Link href="/new-jersey/monmouth-county" className="underline underline-offset-2">
              Monmouth County
            </Link>
          </li>
          <li>
            <Link href="/new-jersey/middlesex-county" className="underline underline-offset-2">
              Middlesex County
            </Link>
          </li>
          <li>
            <Link href="/new-jersey/somerset-county" className="underline underline-offset-2">
              Somerset County
            </Link>
          </li>
          <li>
            <Link href="/new-jersey/union-county" className="underline underline-offset-2">
              Union County
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Construction source records</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{C.caveat}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(C.total_source_records)} label="Total source records" hint="Not permits. Not projects." />
          <Metric value={fmtInt(C.permit_issued_records)} label="Permit-issued records (P)" />
          <Metric value={fmtInt(C.certificate_issued_records)} label="Certificate-issued records (C)" />
          <Metric value={fmtInt(C.state_rows)} label="STATE special records" hint="Not an extra municipality." />
        </div>
        <p className="mt-3 text-sm">
          Coverage: data received as of 2026-08-07. Stated retention is {C.stated_retention_months} months
          after receipt; observed process dates run {C.process_date_min.slice(0, 10)} through{" "}
          {C.process_date_max.slice(0, 10)}, so this extract is not a simple 60-month file. Recent months
          are unaudited. Statewide construction rows are MARKET ONLY and have no contractor attribution.
        </p>
        <p className="mt-2 text-sm">
          <Official href={C.landing_url} label="NJ Construction Permit Data (DCA / data.nj.gov)" />
        </p>
        <Trace
          source="NJ DCA Division of Codes & Standards Socrata dataset w9se-dmra"
          sourceDate={s.as_of}
          denominator={`${fmtInt(C.total_source_records)} source records in the acquired extract`}
          calculation="Count of source rows. Status P and Status C counted separately. STATE rows counted separately."
          grain="SOURCE RECORD COUNT — not project count"
          coverage="Most municipalities; 8 agency-named non-reporters; historical process dates retained"
          caveat={C.caveat}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Permit / certificate relationship</h2>
        <p className="mt-2 text-sm">
          Candidate permit/certificate relationship based on source fields ({s.linkage.candidate_key}):{" "}
          {fmtInt(s.linkage.p_records_with_candidate_c)} P records with a candidate C and{" "}
          {fmtInt(s.linkage.one_to_one_candidate_groups)} one-to-one candidate groups. This is not a
          canonical project identity and is not {fmtInt(s.linkage.one_to_one_candidate_groups)} projects.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">{s.linkage.reason}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Construction cost</h2>
        <p className="mt-2 text-sm">{s.cost.reason}</p>
        <p className="mt-2 text-sm">
          Combined P+C construction value is not published. P-stage and C-stage sums are not published as
          statewide construction value. {fmtInt(s.cost.extreme_unresolved_rows)} unresolved extreme
          (≥ $500M) source rows stay in the evidence layer and out of approved metrics.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Housing-unit change</h2>
        <p className="mt-2 text-sm">{s.units.label}. Negative values are net losses/demolitions where the source uses them that way — not data corruption. This is not a fabricated “homes built” total.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(s.units.p_sale_pos)} label="Permit-issued gross positive sale units" />
          <Metric value={fmtInt(s.units.p_sale_neg)} label="Permit-issued gross negative sale units" />
          <Metric value={fmtInt(s.units.p_rent_pos)} label="Permit-issued gross positive rental units" />
          <Metric value={fmtInt(s.units.p_rent_neg)} label="Permit-issued gross negative rental units" />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Municipality coverage</h2>
        <p className="mt-2 text-sm">{M.state_semantics} Do not infer that all {fmtInt(M.canonical_current)} municipalities report data.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(M.canonical_current)} label="Canonical current municipalities" />
          <Metric value={fmtInt(M.current_reporting)} label="Observed current reporters" />
          <Metric value={fmtInt(M.current_non_reporting)} label="Known non-reporters" hint="Coverage gap, not zero activity." />
          <Metric value={String(M.historical_or_inactive_codes.length)} label="Historical / inactive codes" />
        </div>
        <h3 className="mt-6 text-base font-semibold">Known non-reporters</h3>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {M.non_reporters.map((n) => (
            <li key={n.comu}>
              {n.name} ({n.county}, code {n.comu})
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-base font-semibold">Historical / inactive codes</h3>
        <p className="mt-2 text-sm">{M.historical_or_inactive_codes.join(", ")}</p>
        {stateCat ? (
          <p className="mt-3 text-sm">
            STATE category: {fmtInt(stateCat.permit_issued_records)} P and {fmtInt(stateCat.certificate_issued_records)} C
            records. Not folded into municipal totals.
          </p>
        ) : null}
        <h3 className="mt-6 text-base font-semibold">County source-record counts</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Permit-issued and certificate-issued counts by county. Not a construction-quality ranking.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">County</th>
                <th className="py-2 pr-3 font-medium">P records</th>
                <th className="py-2 font-medium">C records</th>
              </tr>
            </thead>
            <tbody>
              {counties.map((c) => (
                <tr key={c.name} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{c.name}</td>
                  <td className="py-2 pr-3 tabular-nums">{fmtInt(c.permit_issued_records)}</td>
                  <td className="py-2 tabular-nums">{fmtInt(c.certificate_issued_records)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Construction Reporter reconciliation</h2>
        <p className="mt-2 text-sm">{s.reconciliation.note}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 font-medium">Measure</th>
                <th className="py-2 pr-3 font-medium">Difference</th>
                <th className="py-2 font-medium">Publication</th>
              </tr>
            </thead>
            <tbody>
              {s.reconciliation.rows
                .filter((r) => r.period.startsWith("202") && r.difference_percentage)
                .map((r) => (
                  <tr key={`${r.period}-${r.measure}`} className="border-b border-[var(--border)] align-top">
                    <td className="py-2 pr-3">{r.period}</td>
                    <td className="py-2 pr-3">{r.measure.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3">{r.difference_percentage}%</td>
                    <td className="py-2">{r.publication_approved}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm">
          <Official href={C.reporter_url} label="Official Construction Reporter" />
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Public-works regulatory evidence</h2>
        <p className="mt-2 text-sm">
          These families are distinct. This is not a “bad contractor list.” Absence from a current snapshot
          is not a clean record.
        </p>
        <div className="mt-4 space-y-3">
          {[R.wall, R.wage_watchlist, R.treasury_construction, R.treasury_vendor].map((item) => (
            <article key={item.label} className="rounded-xl border border-[var(--border)] p-4">
              <h3 className="font-semibold text-[var(--navy)]">{item.label}</h3>
              <p className="mt-1 text-sm">
                Source rows {fmtInt(item.rows)}
                {"distinct" in item ? ` · distinct ${fmtInt(item.distinct)}` : null} · as of {item.as_of}
              </p>
              <p className="mt-1 text-sm">
                <Official href={item.url} label="Official source" />
              </p>
            </article>
          ))}
          <article className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="font-semibold text-[var(--navy)]">Public Works Contractor Registration</h3>
            <p className="mt-1 text-sm">
              Coverage {R.pwcr.coverage}. A missing roster is not zero registrants. {R.pwcr.barrier}
            </p>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Specialty credentials</h2>
        <p className="mt-2 text-sm">
          These are distinct program identities, not a general contractor license. Counts are source-list
          observations. Exact official identifiers may attach later; name-only rows do not create profiles.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(s.specialty.lead_evaluation.count)} label="Lead evaluation contractors" />
          <Metric value={fmtInt(s.specialty.lead_abatement.count)} label="Lead abatement contractors" hint="Not lead evaluation." />
          <Metric value={fmtInt(s.specialty.asbestos_ascm.count)} label="Asbestos safety-control monitors" hint="Not a DOL asbestos-abatement contractor license." />
          <Metric
            value={fmtInt(s.specialty.fire_protection.count)}
            label="Fire-protection permitted businesses"
            hint={`Official classes ${s.specialty.fire_protection.classes_preserved.join(", ")} preserved. Subclass counts are not in this public snapshot.`}
          />
        </div>
        <p className="mt-3 text-sm">
          <Official href={s.specialty.lead_evaluation.url} label="Lead evaluation" />
          {" · "}
          <Official href={s.specialty.lead_abatement.url} label="Lead abatement" />
          {" · "}
          <Official href={s.specialty.asbestos_ascm.url} label="ASCM" />
          {" · "}
          <Official href={s.specialty.fire_protection.url} label="Fire protection" />
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Safe House / HIC notices of violation</h2>
        <p className="mt-2 text-sm">
          {fmtInt(s.safe_house.novs)} NOVs: {fmtInt(s.safe_house.failure_to_renew)} failure-to-renew and{" "}
          {fmtInt(s.safe_house.failure_to_register)} failure-to-register. Proposed penalty ${fmtInt(s.safe_house.proposed_penalty_usd)} each.
          A notice of violation is not a final order. A proposed penalty is not a paid fine. Failure to
          register or renew is not a criminal conviction. Names below are source-inventory rows, not
          contractor profiles.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Source name</th>
                <th className="py-2 pr-3 font-medium">Town</th>
                <th className="py-2 font-medium">Notice</th>
              </tr>
            </thead>
            <tbody>
              {s.safe_house.inventory.map((row) => (
                <tr key={row.company} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{row.company}</td>
                  <td className="py-2 pr-3">{row.town}</td>
                  <td className="py-2">{row.violation} (NOV, proposed)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">OCP / other enforcement</h2>
        <p className="mt-2 text-sm">
          Office of Consumer Protection legal filings: {fmtInt(s.ocp.documents)} acquired PDFs. Coverage is
          partial. This is not a complete OCP history and cannot support “no other enforcement record found.”
          Board-action and new-home bulk families are not acquired.
        </p>
        <p className="mt-2 text-sm">
          <Official href={s.ocp.url} label="OCP legal filings" />
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Profile evidence modules</h2>
        <p className="mt-2 text-sm">
          Public profile links rendered from this page: {fmtInt(s.profile_modules.public_profile_links_rendered)}.
          Statewide construction rows remain MARKET ONLY — no permit activity is attached to contractors.
          Name-only and review-required identities are withheld. Absence is not shown as “no enforcement
          history” or a clean record.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Current snapshot</h2>
        <p className="mt-2 text-sm">
          One audited construction extract and current public-works/specialty snapshots. This is a current
          snapshot, not a change series derived from retrieval timestamps.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Evidence depth</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Family</th>
                <th className="py-2 pr-3 font-medium">Grain</th>
                <th className="py-2 font-medium">Public treatment</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">Construction source records</td>
                <td className="py-2 pr-3">P/C source row</td>
                <td className="py-2">Published as source records; MARKET ONLY</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">Municipality universe</td>
                <td className="py-2 pr-3">Current municipality</td>
                <td className="py-2">564 canonical; 8 non-reporters preserved</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">WALL / Watchlist / Treasury</td>
                <td className="py-2 pr-3">Source list row</td>
                <td className="py-2">Published at family grain; unresolved not profile-attached</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">Specialty lists</td>
                <td className="py-2 pr-3">Program identity</td>
                <td className="py-2">Counts + official URLs; not general licenses</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">Safe House NOVs</td>
                <td className="py-2 pr-3">Notice of violation</td>
                <td className="py-2">Source inventory; proposed ≠ paid</td>
              </tr>
              <tr>
                <td className="py-2 pr-3">OCP / PWCR / board actions</td>
                <td className="py-2 pr-3">Partial / not acquired</td>
                <td className="py-2">Coverage statement; unknown ≠ zero</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">What we don&apos;t yet know</h2>
        <p className="mt-2 text-sm">Unknown is not zero.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {s.coverage_gaps.map((g) => (
            <li key={g.id}>
              {g.label}: {g.state}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Data quality</h2>
        <p className="mt-2 text-sm">
          Invalid years {fmtInt(s.quality.invalid_years)}; future-date review records{" "}
          {fmtInt(s.quality.future_date_review)}; historical permit dates{" "}
          {fmtInt(s.quality.valid_historical_permit_dates)}; old permit date with recent process date{" "}
          {fmtInt(s.quality.old_permit_recent_process)}. Invalid and future dates are not treated as
          current completed activity.
        </p>
      </section>
    </main>
  );
}
