import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import {
  NYC_CHARGES,
  NYC_COMPLAINTS,
  NYC_HIC_TIPS,
  NYC_INSPECTIONS,
  NYC_ISSUED_LICENSES,
  NYC_VERIFY,
  NYC_VERIFY_LANDING,
  NYC_WALL_OF_SHAME,
} from "@/lib/new-york-city-intelligence/publication";
import {
  NYC_DOB_BIS,
  NYC_DOB_NOW,
  NYC_DOB_VERIFY,
  NYC_PLUTO,
} from "@/lib/new-york-city-dob-intelligence/publication";
import { fmtInt as fmtDob, type NycDobPlutoSnapshot } from "@/lib/new-york-city-dob-intelligence/snapshot";
import { fmtInt, type NycContractorSnapshot } from "@/lib/new-york-city-intelligence/snapshot";

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

export function NycIntelPage({ snapshot, dob }: { snapshot: NycContractorSnapshot; dob?: NycDobPlutoSnapshot }) {
  const s = snapshot;
  const L = s.licenses;
  const status = Object.entries(L.license_status_counts);
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/new-york" className="underline underline-offset-2">New York research</Link>
        <span aria-hidden="true"> / </span>
        <span>New York City</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · New York City · DCWP Home Improvement Contractor · no borough pages
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        New York City Home Improvement Contractor Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official NYC Department of Consumer and Worker Protection Home Improvement Contractor
        licenses, plus same-DCWP complaint, inspection, and charge observations joined only by
        exact Business Unique ID or license number, and a separate DOB permit / PLUTO property
        layer joined only by exact BBL or BIN. This is not a ranking, recommendation, Trust
        Score, or statewide NYSDOL public-work roster. A permit is not contractor quality.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · licenses as of {s.clocks.licenses.sourceAsOf} · complaints{" "}
        {s.clocks.complaints.sourceAsOf} · charges {s.clocks.charges.sourceAsOf} · inspections{" "}
        {s.clocks.inspections.sourceAsOf}
      </p>

      <section className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--navy)]">What does a DCWP HIC license cover?</h2>
        <p className="mt-2 text-sm leading-relaxed">
          NYC requires a Home Improvement Contractor license for defined remodeling or repair work
          costing more than $200 on residential buildings. Official guidance says this does not
          include new home construction, plumbing, or purely electrical work. Confirm current
          status on{" "}
          <Official href={NYC_VERIFY} label="DCWP Search Business" /> (
          <Official href={NYC_VERIFY_LANDING} label="license-check landing" />) and the{" "}
          <Official href={NYC_HIC_TIPS} label="official hiring tips" />. A frozen Open Data status
          is not live verification at the instant you view this page.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">Snapshot metrics</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(s.hero.universe_value)} label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric value={fmtInt(s.hero.buid_value)} label={s.hero.buid_label} hint={s.hero.buid_hint} />
          <Metric
            value={fmtInt(s.hero.complaint_exact_value)}
            label={s.hero.complaint_exact_label}
            hint="Complaint observations are not violations or a quality score."
          />
          <Metric
            value={fmtInt(s.hero.inspection_exact_value)}
            label={s.hero.inspection_exact_label}
            hint="An inspection is not a violation. Unable to Locate is not unlicensed."
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Current/source-reported HIC license universe</h2>
        <p className="mt-2 text-sm leading-relaxed">
          {fmtInt(L.parsed_rows)} Issued Licenses rows in the official{" "}
          <Official href={NYC_ISSUED_LICENSES} label="Home Improvement Contractor category" />.
          {fmtInt(L.distinct_license_ids)} distinct license numbers. {fmtInt(L.distinct_business_unique_ids)}{" "}
          distinct Business Unique IDs. {fmtInt(L.active_distinct_license_ids)} have source-native
          license_status Active. Status is taken from the source; expiration date was not used to
          manufacture Active.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {status.map(([name, n]) => (
            <li key={name}>
              {name}: {fmtInt(n)}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          One business may have multiple license rows ({fmtInt(L.duplicate_extra_business_unique_id_rows)} extra
          rows on reused Business Unique IDs). Active license IDs are not unique companies. Borough
          on the business address is not service territory. Absence from this slice does not mean
          illegal contractor for every type of construction work.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">How DCWP Business Unique ID links evidence</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Preferred identities are NYC-DCWP-LICENSE:{"{"}license_nbr{"}"} and
          NYC-DCWP-BUSINESS:{"{"}business_unique_id{"}"}. Exact Business Unique ID is the bridge for
          same-DCWP research association. It does not create a ContractorTrustHub canonical
          organization or public profile. Name-only matching is unsafe.
        </p>
        <p className="mt-2 text-sm">
          Exact BUID research associations across complaints, inspections, or charges:{" "}
          {fmtInt(s.linking.exact_buid_any_evidence)}. Exact license-number inspection associations:{" "}
          {fmtInt(s.linking.exact_license_nbr_license_inspection)}. Public profile attachments: 0.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Consumer complaints</h2>
        <p className="mt-2 text-sm leading-relaxed">
          {fmtInt(s.complaints.parsed_rows)} <Official href={NYC_COMPLAINTS} label="DCWP Consumer Complaints" />{" "}
          observations in the Home Improvement Contractor category ({s.complaints.intake_min} to{" "}
          {s.complaints.intake_max}). {fmtInt(s.complaints.exact_buid_overlap_with_hic_licenses)} of those
          businesses also appear in the current HIC license slice by exact Business Unique ID. A
          complaint is not a violation, not a substantiated finding, and not company quality. No
          complaint row is not a clean history.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Inspections</h2>
        <p className="mt-2 text-sm leading-relaxed">
          {fmtInt(s.inspections.parsed_rows)} <Official href={NYC_INSPECTIONS} label="DCWP Inspections" />{" "}
          observations in Home Improvement Contractor category variants. {fmtInt(s.inspections.rows_with_bbl)}{" "}
          include BBL and {fmtInt(s.inspections.rows_with_bin)} include BIN; those parcels are not the
          business identity. Inspection is not a violation. Closed is not business closure. Unable to
          Locate is not unlicensed.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Charges / enforcement process</h2>
        <p className="mt-2 text-sm leading-relaxed">
          {fmtInt(s.charges.parsed_rows)} <Official href={NYC_CHARGES} label="DCWP Charges" /> observations
          in the Home Improvement Contractor category. Outcomes are preserved separately (including
          blank, default decision, hearing decision, and settlement). A charge is not a violation
          finding and not a conviction. An investigation is not guilt.
        </p>
      </section>

      {dob ? (
        <section className="mt-10" aria-labelledby="property-permit">
          <h2 id="property-permit" className="text-xl font-semibold">Property &amp; Permit Intelligence</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Bounded {dob.window.start} to {dob.window.end}{" "}
            <Official href={NYC_DOB_NOW} label="DOB NOW: Build – Approved Permits" /> activity,
            complementary <Official href={NYC_DOB_BIS} label="legacy DOB Permit Issuance" /> rows in
            the same window, and <Official href={NYC_PLUTO} label="PLUTO 26v2" /> tax-lot context
            matched by exact BBL. PLUTO has no BIN column. Confirm current permits in{" "}
            <Official href={NYC_DOB_VERIFY} label="DOB NOW" />. Frozen Open Data is not live
            verification.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric value={fmtDob(dob.hero.dobnow_value)} label={dob.hero.dobnow_label} hint={dob.hero.dobnow_hint} />
            <Metric value={fmtDob(dob.hero.bbl_value)} label={dob.hero.bbl_label} hint="BBL is a tax lot. It is not a building and not a contractor." />
            <Metric value={fmtDob(dob.hero.bin_value)} label={dob.hero.bin_label} hint="BIN is a building identity from DOB. It is not a tax lot." />
            <Metric value={fmtDob(dob.hero.pluto_value)} label={dob.hero.pluto_label} hint={dob.hero.pluto_hint} />
          </div>
          <h3 className="mt-6 text-base font-semibold">What BBL and BIN mean</h3>
          <p className="mt-2 text-sm leading-relaxed">
            NYC-BBL is the tax lot. NYC-BIN is the building. A condo can have one building and many
            lots. {fmtDob(dob.pluto.condo_lots)} matched PLUTO rows have a condo number.{" "}
            {fmtDob(dob.pluto.addresses_with_multiple_bbls)} matched addresses map to more than one
            BBL and stay NEEDS_CLARIFICATION. Address-only auto-attachment is rejected.
          </p>
          <h3 className="mt-6 text-base font-semibold">Permit actors and identity limitations</h3>
          <p className="mt-2 text-sm leading-relaxed">
            Applicant is not contractor. Filing representative is not permittee. Owner is not
            contractor. PE/RA is not a general contractor. DOB GC license numbers are not DCWP HIC
            licenses. {fmtDob(dob.linking.exact_legacy_hic_to_dcwp_license)} legacy rows carry an
            HIC license number that exactly matches a DCWP HIC license core; those are research
            associations only. Public profile attachments remain 0. A permit at a property does not
            prove who performed the work, that the work was completed, or that it was code-compliant.
          </p>
          <h3 className="mt-6 text-base font-semibold">DCWP property overlap</h3>
          <p className="mt-2 text-sm leading-relaxed">
            {fmtDob(dob.linking.exact_dcwp_dob_bbl)} DCWP inspection BBLs also appear in the DOB
            permit window. That is a property-level research association. It does not mean the DCWP
            business pulled every permit at that lot.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Do not add DOB NOW rows, legacy rows, jobs, BBLs, BINs, and PLUTO lots into one records
            total. Legacy {fmtDob(dob.legacy.parsed_rows)} rows share {fmtDob(dob.legacy.shared_bbls_with_dobnow)} BBLs
            with DOB NOW and are not summed.
          </p>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Current official verification</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Confirm a contractor on <Official href={NYC_VERIFY} label="DCWP Search Business" /> before
          relying on this snapshot. Search Business is updated daily. This research page is a frozen
          Open Data capture.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">What this evidence does not mean</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          <li>Not a Trust Score, ranking, or recommendation.</li>
          <li>Not a general NYC contractor census or DOB general-contractor registry.</li>
          <li>Not NYSDOL public-work contractor registration. Those are different systems.</li>
          <li>Licenses, complaints, inspections, and charges are not one records total.</li>
          <li>High complaint counts do not mean unsafe or low-quality contractor.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Statewide NY vs NYC licensing</h2>
        <p className="mt-2 text-sm leading-relaxed">
          <Link href="/new-york" className="font-medium underline underline-offset-2">
            Statewide New York public-work registration
          </Link>{" "}
          is NYSDOL Article 8 evidence. NYC DCWP HIC is residential home-improvement licensing. A
          contractor may appear in both, one, or neither. Do not merge NY-DOL-PW certificate numbers
          with NYC-DCWP license numbers by name.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Coverage / gaps</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Official <Official href={NYC_WALL_OF_SHAME} label="Wall of Shame" /> is an HTML warning list
          (as of {s.wall_of_shame.sourceAsOf}, {s.wall_of_shame.name_count} names). It is not a
          TrustHub blacklist and is not name-matched into licensed-business records. Historical
          archives, ACRIS, HPD/DOB violations, and suburban counties were not acquired in this ticket.
        </p>
        <Trace
          source={NYC_ISSUED_LICENSES}
          sourceDate={s.clocks.licenses.sourceAsOf}
          denominator={`${fmtInt(s.expansion_ledger.NYC_DCWP_HIC_LICENSE_ROWS)} HIC license rows; ${fmtInt(s.expansion_ledger.NYC_DCWP_HIC_ACTIVE_DISTINCT_LICENSE_IDS)} active distinct license IDs`}
          calculation="Official Issued Licenses Home Improvement Contractor category. Status is source-native license_status. Exact Business Unique ID joins complaints, inspections, and charges."
          grain="dcwp_hic_license_row"
          coverage="New York City DCWP Home Improvement Contractor licenses, including out-of-NYC business addresses"
          caveat="Not unique companies, not NYSDOL public-work certificates, not DOB contractors. Exact BUID research associations are not public profile attachments. Graph writes remain 0."
        />
      </section>
    </main>
  );
}
