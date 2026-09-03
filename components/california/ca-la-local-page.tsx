import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { CaLocalLicenseLookup } from "@/components/california/ca-local-lookup";
import type { CaliforniaLocalSnapshot } from "@/lib/california-intelligence/local/snapshot";
import { fmtInt } from "@/lib/california-intelligence/local/snapshot";
import { CSLB_VERIFY } from "@/lib/california-intelligence/local/publication";
import type { ExactLocalActivity } from "@/lib/california-intelligence/local/lookup";

export function CaliforniaLosAngelesPage({
  snapshot,
  query,
  hit,
}: {
  snapshot: CaliforniaLocalSnapshot;
  query: string;
  hit: ExactLocalActivity | null;
}) {
  const la = snapshot.los_angeles;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/california" className="underline underline-offset-2">California research</Link>
        <span aria-hidden="true"> / </span>
        <span>Los Angeles</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        City of Los Angeles — not Los Angeles County
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        City of Los Angeles Contractor &amp; Permit Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official LADBS certificates of occupancy, a stale PCIS contractor-license extract, and current
        2020+ issued-permit activity. This is City of Los Angeles evidence. It is not Los Angeles County
        permit data. Not a ranking or Trust Score.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider">Current weekly CofO</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{fmtInt(la.cofo.rows)}</p>
          <p className="text-xs text-[var(--muted)]">as of {la.cofo.as_of}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider">Current 2020+ permits</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{fmtInt(la.current_permits_2020_present.rows)}</p>
          <p className="text-xs text-[var(--muted)]">no contractor/license fields · as of {la.current_permits_2020_present.as_of}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider">Stale PCIS extract</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{fmtInt(la.pcis.rows)}</p>
          <p className="text-xs text-[var(--muted)]">source clock {la.pcis.as_of} — not current weekly activity</p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Which sources include exact CSLB numbers?</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          <li>
            Current weekly CofO: {fmtInt(la.cofo.source_native_cslb_rows)} rows with a source-native CSLB
            number, {fmtInt(la.cofo.exact_acquired_cslb_licenses)} distinct IDs in the acquired spine,
            {fmtInt(la.cofo.outside_partial_licenses)} exact IDs outside the partial extract.
          </li>
          <li>
            Stale PCIS ({la.pcis.as_of}): {fmtInt(la.pcis.source_native_cslb_rows)} source-native CSLB rows,
            {fmtInt(la.pcis.exact_acquired_cslb_licenses)} acquired-spine licenses, {fmtInt(la.pcis.outside_partial_licenses)} outside the partial extract.
          </li>
          <li>
            Current 2020+ issued-permit extract ({fmtInt(la.current_permits_2020_present.rows)} rows) has no
            contractor/license fields. It is not joined to PCIS by address.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          Union of exact acquired-spine licenses: {fmtInt(la.union.exact_acquired_cslb_licenses)}.
          Exact local license IDs outside the partial state spine: {fmtInt(la.union.outside_partial_spine_licenses)}.
          Those identifiers are not unlicensed. CofO and PCIS rows are reported separately
          ({fmtInt(la.union.safely_attributable_acquired_spine_rows.cofo)} + {fmtInt(la.union.safely_attributable_acquired_spine_rows.pcis)}) and are not double-counted as one permit universe.
        </p>
        <Trace
          source="LADBS Certificate of Occupancy + PCIS Permit Information d9aa-v8bm"
          sourceDate={`CofO ${la.cofo.as_of}; PCIS ${la.pcis.as_of}`}
          grain="CofO row vs PCIS permit application — kept separate"
          coverage="City of Los Angeles only"
          denominator="source-native License # tokens"
          calculation="Normalize License #; match to acquired 75,572-row CSLB spine"
          caveat="Outside-partial exact IDs remain official CSLB numbers. PCIS clock is 2023-05-22."
        />
      </section>

      <CaLocalLicenseLookup action="/california/los-angeles" query={query} hit={hit} geography="los-angeles" />

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Inspections</h2>
        <p className="mt-2 text-sm">
          {fmtInt(la.inspections.rows)} inspection events exist on the official source. This page does not
          ship an 11.7 million-row runtime file. Where a permit number is present, inspections may be
          described as inspection events associated with that permit — not “contractor passed N inspections.”
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">What this does not tell us about Los Angeles County</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>Unincorporated Los Angeles County and other cities are not in these files.</li>
          <li>Current weekly permits without a license field are not contractor-attributed.</li>
          <li>Permit activity is not quality, revenue, or completeness of work.</li>
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
