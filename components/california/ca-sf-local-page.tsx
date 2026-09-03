import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { CaLocalLicenseLookup } from "@/components/california/ca-local-lookup";
import type { CaliforniaLocalSnapshot } from "@/lib/california-intelligence/local/snapshot";
import { fmtInt } from "@/lib/california-intelligence/local/snapshot";
import { CSLB_VERIFY } from "@/lib/california-intelligence/local/publication";
import type { ExactLocalActivity } from "@/lib/california-intelligence/local/lookup";

export function CaliforniaSanFranciscoPage({
  snapshot,
  query,
  hit,
}: {
  snapshot: CaliforniaLocalSnapshot;
  query: string;
  hit: ExactLocalActivity | null;
}) {
  const sf = snapshot.san_francisco;
  const statusMix = (sf.permits.status_top as Array<[string, number]>)
    .filter(([name]) => name && name !== "(blank)")
    .slice(0, 5)
    .map(([name, n]) => `${name} (${fmtInt(n)})`)
    .join(", ");
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/california" className="underline underline-offset-2">California research</Link>
        <span aria-hidden="true"> / </span>
        <span>San Francisco</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        City and County of San Francisco
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        City and County of San Francisco Contractor &amp; Permit Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official DBI permits, permit-contact CSLB numbers, inspections, and Treasurer registered
        businesses. Exact license identifiers only. Not a ranking, Trust Score, or complete CSLB roster.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{fmtInt(sf.permits.rows)}</p>
          <p className="text-sm">Permit-at-address rows</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{fmtInt(sf.contacts.with_license)}</p>
          <p className="text-sm">Permit contacts with License1/2</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{fmtInt(sf.contacts.exact_acquired_cslb_licenses)}</p>
          <p className="text-sm">Exact IDs in acquired CSLB spine</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{fmtInt(sf.contacts.outside_partial_spine_licenses)}</p>
          <p className="text-sm">Exact IDs outside partial spine</p>
        </div>
      </div>
      <Trace
        source="DataSF Building Permits i98e-djp9"
        sourceDate={sf.permits.as_of}
        grain={sf.permits.grain}
        coverage="City and County of San Francisco DBI applications"
        denominator="official permit-at-address rows"
        calculation="Count CSV rows; distinct Permit Number separately"
        caveat="Permit count is not quality. Contractor license is on the contacts file, not this permit file."
      />

      <section className="mt-10">
        <h2 className="text-xl font-semibold">What official local contractor evidence is available?</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>{fmtInt(sf.permits.distinct_permit_numbers)} distinct permit numbers among {fmtInt(sf.permits.rows)} address rows.</li>
          <li>{fmtInt(sf.contacts.rows)} permit-contact rows; {fmtInt(sf.contacts.contractor_role_rows)} contractor-role rows.</li>
          <li>{fmtInt(sf.contacts.distinct_source_licenses)} distinct source-native license IDs.</li>
          <li>
            {fmtInt(sf.contacts.outside_partial_spine_licenses)} exact official CSLB identifiers sit outside
            TrustHub’s truncated state extract. They are not unlicensed.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          Status mix includes complete, issued, expired, cancelled, and filed
          {statusMix ? ` (${statusMix})` : ""}. Valuation present on {fmtInt(sf.permits.valuation_rows)} rows.
          Parcel/block-lot on every permit row. Completed date on {fmtInt(sf.permits.completed_date_rows)}.
        </p>
      </section>

      <CaLocalLicenseLookup action="/california/san-francisco" query={query} hit={hit} geography="san-francisco" />

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Registered businesses</h2>
        <p className="mt-2 text-sm leading-relaxed">
          {fmtInt(sf.business.rows)} registered business locations, {fmtInt(sf.business.accounts)} accounts,
          {fmtInt(sf.business.current)} current under the source rule. Construction-related: {fmtInt(sf.business.construction_locations)} locations / {fmtInt(sf.business.construction_accounts)} accounts.
          No source-native CSLB ID. High-confidence name+address matches ({fmtInt(sf.business.cslb_match.HIGH_CONFIDENCE)}) are not license verification.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">A registered business location is not a CSLB license and not proof of contractor authority.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Inspections</h2>
        <p className="mt-2 text-sm">
          {fmtInt(sf.inspections.rows)} inspection events associated with permit, complaint, or address grain
          ({fmtInt(sf.inspections.by_reference_type.permit)} permit · {fmtInt(sf.inspections.by_reference_type.complaint)} complaint · {fmtInt(sf.inspections.by_reference_type.address)} address).
        </p>
        <p className="mt-2 text-sm font-medium">
          This is inspection-event evidence associated with a permit or property. It does not establish that a contractor passed or failed an inspection.
        </p>
        <Trace
          source="DataSF Building Inspections vckc-dh2h"
          sourceDate="2026-09-03"
          grain="inspection event"
          coverage="DBI Building Inspection division events"
          denominator="official inspection rows"
          calculation="Count rows; group by reference_number_type and result"
          caveat="PASSED is not contractor quality. No contractor license field on this file."
        />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Evidence depth</h2>
        <div className="mt-3 overflow-x-auto text-sm">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Family</th>
                <th className="py-2 pr-3">Rows</th>
                <th className="py-2">Limitation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="py-2 pr-3">Permits</td><td className="py-2 pr-3">{fmtInt(sf.permits.rows)}</td><td className="py-2">Address grain; no CSLB on this file</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">Permit contacts</td><td className="py-2 pr-3">{fmtInt(sf.contacts.rows)}</td><td className="py-2">Exact License1/2 only</td></tr>
              <tr className="border-b"><td className="py-2 pr-3">Inspections</td><td className="py-2 pr-3">{fmtInt(sf.inspections.rows)}</td><td className="py-2">Permit/property grain</td></tr>
              <tr><td className="py-2 pr-3">Registered businesses</td><td className="py-2 pr-3">{fmtInt(sf.business.rows)}</td><td className="py-2">Not a license</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">What we don&apos;t know</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>Complete California licensed-mover/contractor denominator remains UNKNOWN.</li>
          <li>Name-only contacts are not attached.</li>
          <li>No local record is not proof of no work.</li>
        </ul>
        <p className="mt-3 text-sm">
          <a className="underline underline-offset-2" href={CSLB_VERIFY} rel="noopener noreferrer" target="_blank">Verify with CSLB</a>
          {" · "}
          <Link href="/california" className="underline underline-offset-2">California state research</Link>
        </p>
      </section>
    </main>
  );
}
