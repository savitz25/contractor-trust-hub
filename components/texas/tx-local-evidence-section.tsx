import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { loadTexasAustinLocalSnapshot } from "@/lib/texas-intelligence/local/load";
import { fmtInt } from "@/lib/texas-intelligence/local/snapshot";

export function TexasLocalEvidenceSection() {
  const local = loadTexasAustinLocalSnapshot();
  const a = local.austin;
  const parked = local.parked;
  return (
    <section className="mt-10" aria-labelledby="texas-local-evidence">
      <h2 id="texas-local-evidence" className="text-lg font-semibold text-[var(--navy)]">
        Texas local evidence
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        City of Austin is the only dedicated Texas local page. Other acquired city and county files
        stay data-only. There is no statewide Texas permit file. Local permit contractor identity is
        not a state license.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-1">
        <li className="rounded-xl border border-[var(--border)] p-4 text-sm">
          <p className="font-semibold">City of Austin</p>
          <p className="mt-1">
            {fmtInt(a.rows)} issued construction permits. {fmtInt(a.distinct_normalized_company_plus_phone)}{" "}
            public company+phone identities. Not Travis County. Not Austin metro.
          </p>
          <Link
            href="/texas/austin"
            className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
          >
            Open City of Austin research
          </Link>
        </li>
      </ul>

      <article className="mt-6 rounded-xl border border-[var(--border)] p-4 text-sm">
        <h3 className="font-semibold">Fort Worth — data only</h3>
        <p className="mt-2">
          {fmtInt(parked.fort_worth.rows)} development-permit rows. No contractor company, phone, or
          license field. Owner_Full_Name is the property owner, not a contractor. Permit-to-Tarrant
          CAD exact join is not available (no account or situs on the permit table).
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">No Fort Worth page. No fake navigation link.</p>
      </article>

      <article className="mt-4 rounded-xl border border-[var(--border)] p-4 text-sm">
        <h3 className="font-semibold">San Antonio — data only</h3>
        <p className="mt-2">
          {fmtInt(parked.san_antonio.permits_issued_rows)} issued permit rows (
          {fmtInt(parked.san_antonio.permits_issued_2020_2024_rows)} in the 2020–2024 extract).{" "}
          {fmtInt(parked.san_antonio.distinct_primary_contacts)} distinct primary contacts are
          name-only (UNSAFE). Contractor registration is open-search only. No credential IDs in the
          permit CSV.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">No San Antonio page. No fake navigation link.</p>
      </article>

      <article className="mt-4 rounded-xl border border-[var(--border)] p-4 text-sm">
        <h3 className="font-semibold">Houston / Harris — data only</h3>
        <p className="mt-2">
          City of Houston building-permit bulk: {parked.houston.building_permit_bulk}. That is not
          zero permits. Harris County permit bulk: {parked.harris.permit_bulk}. HCAD real_acct{" "}
          {fmtInt(parked.harris.hcad_real_acct_rows)} rows are Harris County appraisal accounts, not
          City of Houston contractor licenses.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          No Houston page. No Harris page. No fake navigation links.
        </p>
      </article>

      <Trace
        source="TX-CON-LOCAL-001A / 001B harvest artifacts"
        sourceDate={local.source_clock.harvest_generated_at}
        grain="city or county source file, not a statewide permit census"
        coverage="Austin published; Fort Worth, Tarrant, San Antonio, Bexar, Houston, Harris data-only"
        denominator="official acquired rows in each geography's harvest"
        calculation="Publish Austin; park remaining Texas local files without routes"
        caveat="Data-only is not a published market page. Missing bulk is not zero activity."
      />
    </section>
  );
}
