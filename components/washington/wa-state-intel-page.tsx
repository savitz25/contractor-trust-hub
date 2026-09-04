import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { WaContractorLookup } from "@/components/washington/wa-contractor-lookup";
import type { WaLookupResult } from "@/lib/washington-intelligence/lookup";
import { LNI_DEBAR, LNI_HOME, LNI_REPORT, LNI_VERIFY } from "@/lib/washington-intelligence/publication";
import { fmtHero, fmtInt, type WashingtonContractorSnapshot } from "@/lib/washington-intelligence/snapshot";

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

export function WashingtonIntelPage({
  snapshot,
  lookup,
}: {
  snapshot: WashingtonContractorSnapshot;
  lookup: WaLookupResult;
}) {
  const s = snapshot;
  const gph = s.graph;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">Home</Link>
        <span aria-hidden="true"> / </span>
        <span>Washington research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · Washington · no city/county permit pages
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        Washington Contractor Registration, Bond &amp; Insurance Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official Labor &amp; Industries contractor registrations joined to bond filings and
        liability-insurance filings by exact contractor number. This is not a ranking,
        recommendation, or Trust Score. A bond record is not an endorsement. An insurance record is
        not safety.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · L&amp;I source clock {s.as_of} · publication gate {s.gate.passed ? "passed" : "blocked"}
      </p>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">Snapshot metrics</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          <Metric value={fmtHero(s.hero.universe_value)} label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric value={fmtHero(s.hero.current_value)} label={s.hero.current_label} hint={s.hero.current_hint} />
          <Metric value={fmtHero(s.hero.observations_value)} label={s.hero.observations_label} hint={s.hero.observations_hint} />
          <Metric value={fmtHero(s.hero.geography_value)} label={s.hero.geography_label} hint={s.hero.geography_hint} />
          <Metric value={String(s.hero.as_of_value)} label={`As-of · ${s.hero.as_of_label}`} />
        </div>
      </section>
      <Trace
        source="L&I Contractor License Data — General m8qx-ubtq"
        sourceDate={s.general.source_clock}
        grain={s.general.grain}
        coverage="Statewide L&I contractor businesses in the acquired extract"
        denominator="official CSV rows"
        calculation="Count rows; distinct ContractorLicenseNumber"
        caveat="Registration is not quality. ACTIVE is not TrustHub Verified."
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Market findings</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {s.findings.map((f) => (
            <li key={f.id}>{f.text}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Regulatory map</h2>
        <p className="mt-2 text-sm">
          Model {s.regulatory_map.model}. Primary regulator:{" "}
          <Official href={s.regulatory_map.primary_regulator.url} label={s.regulatory_map.primary_regulator.name} />.
          {s.regulatory_map.primary_regulator.role}
        </p>
        <p className="mt-2 text-sm">{s.regulatory_map.terminology.consumer_term}</p>
        <p className="mt-2 text-sm">Construction contractors are registered under RCW 18.27. The Socrata files still label the unique ID ContractorLicenseNumber. Electrical and plumbing contractor businesses in this extract are licensed contractor businesses, not person certificates.</p>
      </section>

      <WaContractorLookup result={lookup} />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">General vs specialty</h2>
        <p className="mt-2 text-sm">
          Source-native types: {s.general.types.map((t) => `${t.name} (${fmtInt(t.rows)})`).join(" · ")}.
          Specialty values: {fmtInt(s.general.specialty_value_count)}. GENERAL is the dominant construction specialty.
          Product families are labels only — they are not a ranking.
        </p>
        <div className="mt-3 overflow-x-auto text-sm">
          <table className="w-full min-w-[28rem] text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Family</th>
                <th className="py-2">Rows</th>
              </tr>
            </thead>
            <tbody>
              {s.general.families.map((row) => (
                <tr key={row.name} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{row.name}</td>
                  <td className="py-2 tabular-nums">{fmtInt(row.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Status</h2>
        <p className="mt-2 text-sm">
          Source-native field {s.status_model.source_native_field}. ACTIVE is not Verified. SUSPENDED is not
          permanent revocation. EXPIRED is not discipline. Registration status is not quality.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm">
          {s.general.status.map((row) => (
            <li key={row.name}>{row.name}: {fmtInt(row.rows)}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Bond evidence</h2>
        <p className="mt-2 text-sm">
          {fmtInt(s.bond.rows)} bond rows for {fmtInt(s.bond.distinct_contractor_ids)} contractor IDs.
          {fmtInt(s.bond.multiple_record_ids)} IDs have multiple bond records. {fmtInt(s.graph.orphan_bond_ids)}{" "}
          orphan bond IDs are kept. No bond row is not unbonded.
        </p>
        <p className="mt-2 text-sm">{s.bond.current_filing_rule}</p>
        <Trace
          source="L&I Contractor License Data — Bond bzff-4fmt"
          sourceDate={s.bond.source_clock}
          grain={s.bond.grain}
          coverage="Bond filings L&I published in this extract"
          denominator="bond CSV rows joined on ContractorLicenseNumber"
          calculation="Distinct license numbers; current filing from official dates and BondImpaired"
          caveat="Bond record is not an endorsement. Missing row is not unbonded."
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Liability insurance evidence</h2>
        <p className="mt-2 text-sm">
          {fmtInt(s.insurance.rows)} insurance rows for {fmtInt(s.insurance.distinct_contractor_ids)} contractor IDs.
          {s.insurance.file_skew_note} No insurance row is not uninsured.
        </p>
        <p className="mt-2 text-sm">{s.insurance.current_filing_rule}</p>
        <Trace
          source="L&I Contractor License Data — Insurance ciwg-agsx"
          sourceDate={s.insurance.source_clock}
          grain={s.insurance.grain}
          coverage="Liability-insurance filings L&I published in this extract"
          denominator="insurance CSV rows joined on ContractorLicenseNumber"
          calculation="Distinct license numbers; current filing from official effective/expiration/cancel dates"
          caveat="Insurance record is not safety. Missing row is not uninsured."
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Three-layer exact graph</h2>
        <p className="mt-2 text-sm">
          Join key: {gph.join_key}. Name matching is not used. Bond + insurance is not a Trust Score.
        </p>
        <div className="mt-3 overflow-x-auto text-sm">
          <table className="w-full min-w-[28rem] text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Layer</th>
                <th className="py-2">Count</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="py-2 pr-3">General IDs</td><td className="py-2 tabular-nums">{fmtInt(gph.general_ids)}</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">With bond source evidence</td><td className="py-2 tabular-nums">{fmtInt(gph.ids_with_bond_evidence)}</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">With insurance source evidence</td><td className="py-2 tabular-nums">{fmtInt(gph.ids_with_insurance_evidence)}</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">With both</td><td className="py-2 tabular-nums">{fmtInt(gph.ids_with_both)}</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">With neither</td><td className="py-2 tabular-nums">{fmtInt(gph.ids_with_neither)}</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">Orphan bond IDs</td><td className="py-2 tabular-nums">{fmtInt(gph.orphan_bond_ids)}</td></tr>
              <tr><td className="py-2 pr-3">Orphan insurance IDs</td><td className="py-2 tabular-nums">{fmtInt(gph.orphan_insurance_ids)}</td></tr>
            </tbody>
          </table>
        </div>
        <Trace
          source="Exact ContractorLicenseNumber across General, Bond, and Insurance extracts"
          sourceDate={s.as_of}
          grain="one ContractorLicenseNumber"
          coverage="Statewide acquired L&I contractor identities"
          denominator="distinct general ContractorLicenseNumber values"
          calculation="Set intersection on the exact registration ID"
          caveat="A three-layer join is evidence depth, not a Trust Score."
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">UBI / business identity</h2>
        <p className="mt-2 text-sm">
          UBI is on {fmtInt(s.business_ubi_source.lni_ubi_coverage_rows)} L&amp;I general rows
          ({fmtInt(s.general.distinct_ubi)} distinct). UBI is not a contractor registration. Business
          active is not registration current. Department of Revenue Business Lookup is open search only
          — no bulk file was acquired.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Principals</h2>
        <p className="mt-2 text-sm">
          {fmtInt(s.principals.rows)} principal rows on {fmtInt(s.principals.distinct_contractor_ids)} contractor
          IDs. {s.principals.relationship} People are not published as profiles. A business principal is
          not a qualifying license unless the source says so.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Enforcement / public works</h2>
        <p className="mt-2 text-sm">
          Debarment: {fmtInt(s.enforcement.debarment.records_stated_on_page)} records on the official L&amp;I
          list, with License and UBI columns. Attach only on exact identity. Name-only is UNSAFE.
          Debarment is not an all-purpose contractor ban.{" "}
          <Official href={LNI_DEBAR} label="Debarred contractors list" />.
        </p>
        <p className="mt-2 text-sm">
          Public-works project details: {fmtInt(s.public_works.project_details.rows)} rows keyed by prime UBI.
          Affidavits: {fmtInt(s.public_works.affidavit_project_details.rows)} rows, {fmtInt(s.public_works.affidavit_project_details.rows_with_prime_license)} with a prime license.
          Award is not quality. Vendor is not contractor registration.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Consumer process</h2>
        <p className="mt-2 text-sm">
          Confirm live status on <Official href={LNI_VERIFY} label="L&I Verify" />. Report unregistered
          or fraudulent contracting via <Official href={LNI_REPORT} label="Report a contractor" /> or
          {s.consumer_process.report_fraud_phone}. Complaint bulk was not found. A complaint is not a
          violation. No complaint found is not a clean record.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Public business contacts</h2>
        <p className="mt-2 text-sm">
          Phones PUBLIC_ELIGIBLE: {fmtInt(s.contacts.phone_public_eligible)} ({s.contacts.provenance_phone}).
          Addresses PUBLIC_ELIGIBLE: {fmtInt(s.contacts.address_public_eligible)} ({s.contacts.provenance_address}).
          Email/website: {s.contacts.email_website}. Principal names are relationship evidence, not person contact pages.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Evidence depth</h2>
        <div className="mt-3 overflow-x-auto text-sm">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Family</th>
                <th className="py-2 pr-3">Rows / IDs</th>
                <th className="py-2">Limitation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="py-2 pr-3">L&amp;I general</td><td className="py-2 pr-3">{fmtInt(s.general.rows)}</td><td className="py-2">Registration ≠ quality</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">L&amp;I bond</td><td className="py-2 pr-3">{fmtInt(s.bond.rows)}</td><td className="py-2">Missing ≠ unbonded</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">L&amp;I insurance</td><td className="py-2 pr-3">{fmtInt(s.insurance.rows)}</td><td className="py-2">Missing ≠ uninsured</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">Principals</td><td className="py-2 pr-3">{fmtInt(s.principals.rows)}</td><td className="py-2">No person profiles</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">DOR business lookup</td><td className="py-2 pr-3">search only</td><td className="py-2">No bulk file</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">Debarment list</td><td className="py-2 pr-3">{fmtInt(s.enforcement.debarment.records_stated_on_page)}</td><td className="py-2">Exact ID only</td></tr>
              <tr><td className="py-2 pr-3">Public-works affidavits</td><td className="py-2 pr-3">{fmtInt(s.public_works.affidavit_project_details.rows)}</td><td className="py-2">Award ≠ quality</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">What we don&apos;t know</h2>
        <p className="mt-2 text-sm">Unknown is not zero. Missing is not zero.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {s.coverage_gaps.map((gap) => (
            <li key={gap.id}>{gap.label}: {gap.state}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Semantic rules</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {s.semantics.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm">No Trust Score. No paid ranking.</p>
        <p className="mt-3 text-sm">
          Always confirm on <Official href={LNI_VERIFY} label="L&I Verify" />.{" "}
          <Official href={LNI_HOME} label="Labor & Industries" />.
        </p>
      </section>
    </main>
  );
}
