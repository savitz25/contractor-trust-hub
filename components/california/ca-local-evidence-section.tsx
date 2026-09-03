import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { loadCaliforniaLocalSnapshot } from "@/lib/california-intelligence/local/load";
import { fmtInt } from "@/lib/california-intelligence/local/snapshot";

export function CaliforniaLocalEvidenceSection() {
  const local = loadCaliforniaLocalSnapshot();
  const sd = local.san_diego.approvals_created_2024_2026;
  const sj = local.san_jose;
  return (
    <section className="mt-10" aria-labelledby="local-evidence">
      <h2 id="local-evidence" className="text-lg font-semibold text-[var(--navy)]">
        California local construction intelligence
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        Dedicated pages for geographies with exact CSLB work-activity evidence. City market modules
        stay on this state page. No California county permit pages.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        <li className="rounded-xl border border-[var(--border)] p-4 text-sm">
          <p className="font-semibold">San Francisco</p>
          <p className="mt-1">City and County dedicated local intelligence.</p>
          <Link href="/california/san-francisco" className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            Open San Francisco research
          </Link>
        </li>
        <li className="rounded-xl border border-[var(--border)] p-4 text-sm">
          <p className="font-semibold">Los Angeles</p>
          <p className="mt-1">City of Los Angeles dedicated intelligence — not countywide.</p>
          <Link href="/california/los-angeles" className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            Open City of Los Angeles research
          </Link>
        </li>
      </ul>

      <article className="mt-6 rounded-xl border border-[var(--border)] p-4 text-sm">
        <h3 className="font-semibold">City of San Diego — market module</h3>
        <p className="mt-2">
          {fmtInt(sd.rows)} created approval rows (2024–2026) across {fmtInt(sd.distinct_projects)} projects.
          {fmtInt(sd.with_permit_holder)} rows name a permit holder. Only {fmtInt(sd.source_native_exact_cslb_rows)} rows
          carry a source-native exact CSLB token ({fmtInt(sd.exact_acquired_cslb_rows)} in the acquired spine, {fmtInt(sd.outside_partial_rows)} outside it).
          Do not read this as broad contractor attribution. This is City of San Diego, not San Diego County.
        </p>
        <p className="mt-2">
          Also on file: {fmtInt(local.san_diego.business_tax_active)} active Business Tax Certificates
          (not trade licenses) and {fmtInt(local.san_diego.rental_unit_accounts)} Rental Unit Business Tax
          property rows.
        </p>
        <Trace
          source="City of San Diego Development Services created-approvals year files"
          sourceDate="2024-2026 created views"
          grain="one approval row, not one project"
          coverage="CITY_OF_SAN_DIEGO"
          denominator="created approval CSV rows"
          calculation="Count approval rows; distinct PROJECT_ID; parse license-like tokens in permit holder"
          caveat="Permit holder is a contact name. Not San Diego County permits."
        />
      </article>

      <article className="mt-4 rounded-xl border border-[var(--border)] p-4 text-sm">
        <h3 className="font-semibold">City of San Jose — market module</h3>
        <p className="mt-2">
          {fmtInt(sj.monthly_permit_rows)} current monthly permit rows, {fmtInt(sj.contractor_name_rows)} with a
          contractor name, {fmtInt(sj.source_native_cslb)} source-native CSLB numbers. Name-only identity is
          UNSAFE and is not auto-attached. This is City of San Jose, not Santa Clara Countywide permit coverage.
        </p>
        <Trace
          source="City of San Jose Permit Data file PDIssue_latest"
          sourceDate="latest month file"
          grain="issued or finaled permit row"
          coverage="CITY_OF_SAN_JOSE"
          denominator="official monthly/weekly extract rows"
          calculation="Count rows; contractor-name nonempty; CSLB column absent"
          caveat="No source-native CSLB. Name-only is UNSAFE."
        />
      </article>

      <p className="mt-4 text-xs text-[var(--muted)]">
        Parked: San Diego County (no county permit bulk), Santa Clara County ({fmtInt(local.parked["santa-clara-county"].parcels)} parcels / {fmtInt(local.parked["santa-clara-county"].development_records)} development records, no CSLB field), unincorporated Los Angeles County.
      </p>
    </section>
  );
}
