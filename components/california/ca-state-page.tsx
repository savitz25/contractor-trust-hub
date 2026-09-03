import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { CaliforniaInventorySearch } from "@/components/california/ca-inventory-search";
import {
  fmtHero,
  fmtInt,
  type CaliforniaContractorSnapshot,
} from "@/lib/california-intelligence/snapshot";
import { formatCaBoardCode } from "@/lib/states/ca-classifications";

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

export function CaliforniaContractorPage({ snapshot }: { snapshot: CaliforniaContractorSnapshot }) {
  const s = snapshot;
  const statusEntries = Object.entries(s.license_master.primary_status_counts).sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>California research</span>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
          Independent research · California
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
          California Contractor &amp; Construction Intelligence
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          This page organizes official CSLB public-data rows and exact-ID regulatory overlays. It is
          not a ranking, recommendation, or Trust Score. Acquired rows are not the complete
          California contractor universe.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Snapshot {s.version} · License Master as of {s.as_of} · coverage {s.coverage.status}
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

      <CaliforniaInventorySearch
        coverageLabel={s.coverage.inventory_label}
        rowCount={s.license_master.license_rows}
        statuses={statusEntries.map(([label]) => label)}
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">CSLB License Master coverage</h2>
        <p className="mt-2 text-sm">
          Official source:{" "}
          <Official href={s.coverage.source_url} label="CSLB Public Data Portal License Master" />
          . Universe in that file is currently renewed or expired-but-renewable (BPC 7141).
          Cancelled, revoked, and expired-nonrenewable licenses are excluded by CSLB even when the
          file is complete.
        </p>
        <p className="mt-2 text-sm">{s.coverage.truncation_note}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(s.license_master.license_rows)} label="Acquired license rows" hint="Not the complete renewable universe." />
          <Metric value={fmtInt(s.license_master.distinct_license_numbers)} label="Distinct license numbers" />
          <Metric value={fmtInt(s.license_master.distinct_business_name_address_zip)} label="Distinct name + mailing + ZIP5" />
          <Metric value="UNKNOWN" label="Complete renewable denominator" />
        </div>
        <Trace
          source="CSLB Public Data Portal License Master CSV"
          sourceDate={s.as_of}
          denominator="Acquired complete CSV rows after dropping the truncated last line. Complete portal file row count is UNKNOWN."
          calculation="Count LicenseNo rows that parse as digits."
          grain="LICENSE ROW — not a contractor-business census"
          coverage={s.coverage.status}
          caveat="Do not say California has this many contractors. Stream ended before the official file finished."
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Status education</h2>
        <p className="mt-2 text-sm">
          Labels below are source-native PrimaryStatus values. CLEAR is not TrustHub Verified and
          not an endorsement. A suspension is not a revocation. Expired-renewable is not cancelled.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Source-native status</th>
                <th className="py-2 font-medium">Acquired rows</th>
              </tr>
            </thead>
            <tbody>
              {statusEntries.map(([label, count]) => (
                <tr key={label} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{label}</td>
                  <td className="py-2 tabular-nums">{fmtInt(count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Classifications</h2>
        <p className="mt-2 text-sm">
          Official CSLB selectable classes/certifications: {fmtInt(s.classifications.official_option_count)}.
          Observed normalized tokens in this extract: {fmtInt(s.classifications.observed_token_count)}.
          {s.classifications.note}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Token</th>
                <th className="py-2 font-medium">Acquired rows holding class</th>
              </tr>
            </thead>
            <tbody>
              {s.classifications.top.map((row) => (
                <tr key={row.token} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{formatCaBoardCode(row.token)}</td>
                  <td className="py-2 tabular-nums">{fmtInt(row.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Public business contacts</h2>
        <p className="mt-2 text-sm">
          Business phone is PUBLIC_ELIGIBLE ({fmtInt(s.contacts.business_phone_public_eligible)} acquired
          rows). A business phone is not a personal phone. Emails are not provided (BPC 27):{" "}
          {fmtInt(s.contacts.email_rows)} public emails. Websites are not in this source. Mailing
          address is REVIEW_REQUIRED and is not published in the inventory — a mail address is not a
          proven service area.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Mailing geography in the extract</h2>
        <p className="mt-2 text-sm">
          {fmtInt(s.geography.named_counties)} named California counties appear in this extract, plus{" "}
          {fmtInt(s.geography.unknown_county_rows)} UNKNOWN county rows. This is mailing geography, not
          a service-area map. No California county pages are published in this ticket.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Mailing county</th>
                <th className="py-2 font-medium">Acquired rows</th>
              </tr>
            </thead>
            <tbody>
              {s.geography.top_counties.map((row) => (
                <tr key={row.county} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{row.county}</td>
                  <td className="py-2 tabular-nums">{fmtInt(row.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Personnel</h2>
        <p className="mt-2 text-sm">
          Coverage {s.personnel.coverage}. Personnel failure is not a page blocker. Qualifiers and
          other people are not published as profiles.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Workers&apos; compensation</h2>
        <p className="mt-2 text-sm">{s.workers_comp.note}</p>
        <p className="mt-2 text-sm">
          Source-native PrimaryStatus &ldquo;Work Comp Susp&rdquo;:{" "}
          {fmtInt(s.workers_comp.source_native_work_comp_susp)} acquired rows. CLEAR is not proof of
          current workers&apos; compensation.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Cal/OSHA asbestos overlay</h2>
        <p className="mt-2 text-sm">
          {fmtInt(s.asbestos.rows)} registrant rows / {fmtInt(s.asbestos.distinct_cslb_ids)} exact CSLB
          IDs; {fmtInt(s.asbestos.exact_joins_to_extract)} join this extract. {s.asbestos.semantics}{" "}
          {s.asbestos.attach_rule}
        </p>
        <p className="mt-2 text-sm">
          <Official href={s.asbestos.source} label="Cal/OSHA asbestos registrant table" />
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">DLSE public-works debarment overlay</h2>
        <p className="mt-2 text-sm">
          {fmtInt(s.dlse.distinct_cslb_ids)} exact CSLB IDs are stored from the official listing.{" "}
          {fmtInt(s.dlse.exact_joins_to_extract)} join this renewable extract. Currently-debarred
          count is not published (ambiguous order dates; stayed is not current). {s.dlse.semantics}
        </p>
        <p className="mt-2 text-sm">
          <Official href={s.dlse.source} label="DIR DLSE debarment listing" />
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Electrician certificates</h2>
        <p className="mt-2 text-sm">
          DIR ECU certified electricians {fmtInt(s.electrician.certified_rows)}; trainees{" "}
          {fmtInt(s.electrician.trainee_rows)}. {s.electrician.note}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">PWCR and vendor coverage</h2>
        <p className="mt-2 text-sm">
          Public Works Contractor Registration: {s.pwcr.coverage}. {s.pwcr.note}
        </p>
        <p className="mt-2 text-sm">
          Cal eProcure vendor data: {s.vendor.coverage}. {s.vendor.note}
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
              {s.evidence_depth.map((row) => (
                <tr key={row.family} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{row.family}</td>
                  <td className="py-2 pr-3">{row.grain}</td>
                  <td className="py-2">{row.public_treatment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">What we don&apos;t yet know</h2>
        <p className="mt-2 text-sm">Unknown is not zero. Missing is not zero.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {s.coverage_gaps.map((g) => (
            <li key={g.id}>
              {g.label}: {g.state}
            </li>
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
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Confirm live status</h2>
        <p className="mt-2 text-sm">
          Always confirm critical facts on{" "}
          <Official href={s.verify.instant_check} label="CSLB Instant License Check" />. This page
          does not replace the board.
        </p>
      </section>
    </main>
  );
}
