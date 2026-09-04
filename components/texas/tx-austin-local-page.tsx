import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { TxAustinIdentityLookup } from "@/components/texas/tx-austin-lookup";
import type { AustinLookupResult } from "@/lib/texas-intelligence/local/lookup";
import { TDLR_VERIFY, TSBPE_VERIFY } from "@/lib/texas-intelligence/local/publication";
import { fmtInt, type TexasAustinLocalSnapshot } from "@/lib/texas-intelligence/local/snapshot";

function Official({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="font-medium underline underline-offset-2" rel="noopener noreferrer" target="_blank">
      {label}
    </a>
  );
}

export function TexasAustinLocalPage({
  snapshot,
  lookup,
}: {
  snapshot: TexasAustinLocalSnapshot;
  lookup: AustinLookupResult;
}) {
  const a = snapshot.austin;
  const statusMix = a.status_mix
    .filter((row) => row.name && row.name !== "(blank)")
    .slice(0, 5)
    .map((row) => `${row.name} (${fmtInt(row.rows)})`)
    .join(", ");
  const joinPct = Math.round(snapshot.tcad.join_rate * 1000) / 10;

  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/texas" className="underline underline-offset-2">
          Texas research
        </Link>
        <span aria-hidden="true"> / </span>
        <span>City of Austin</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        City of Austin · not Travis County · not Austin metro
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        City of Austin Contractor &amp; Permit Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official City of Austin issued construction permits. Local contractor company and phone on a
        permit row are a local identity, not a state license. Texas has no statewide
        general-contractor license. This page is not a ranking, recommendation, or Trust Score.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {snapshot.version} · source clock {snapshot.source_clock.harvest_generated_at} · grain{" "}
        {a.grain}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{fmtInt(a.rows)}</p>
          <p className="text-sm">Issued construction permits</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{fmtInt(a.distinct_normalized_company_plus_phone)}</p>
          <p className="text-sm">Public company+phone identities</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{fmtInt(a.contacts.phones)}</p>
          <p className="text-sm">Permit rows with contractor phone</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
          <p className="text-2xl font-bold tabular-nums">{fmtInt(snapshot.tcad.exact_geo_id_joins)}</p>
          <p className="text-sm">Exact TCAD geo_id joins</p>
        </div>
      </div>
      <Trace
        source="City of Austin Issued Construction Permits 3syk-w9eu"
        sourceDate={snapshot.source_clock.harvest_generated_at}
        grain={a.grain}
        coverage="City of Austin issued construction permits — not Travis County, not Austin metro"
        denominator="official issued-permit CSV rows"
        calculation="Count CSV rows; distinct normalized company+phone where both exist"
        caveat="Permit count is not quality. Local contractor identity is not a TDLR or TSBPE license."
      />

      <section className="mt-10">
        <h2 className="text-xl font-semibold">What official local contractor evidence is available?</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>
            {fmtInt(a.rows)} issued-permit rows (1921–2026). Grain: one row = one issued permit.
          </li>
          <li>
            {fmtInt(a.rows_with_contractor_company)} rows name a contractor company;{" "}
            {fmtInt(a.distinct_contractor_company_values)} distinct company values.
          </li>
          <li>
            {fmtInt(a.rows_with_contractor_trade)} rows carry contractor trade. Top trades:{" "}
            {a.contractor_trades.map((t) => `${t.name} (${fmtInt(t.rows)})`).join(", ")}.
          </li>
          <li>
            Permit types: {a.permit_types.map((t) => `${t.name} (${fmtInt(t.rows)})`).join(", ")}.
          </li>
          <li>Status mix includes {statusMix}.</li>
          <li>
            Source-native TDLR/TSBPE ID: none. Source-native city contractor number: none.
            EXACT_STATE_CREDENTIAL = 0.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          FINAL is a permit status, not proof that inspections passed. EXPIRED is not discipline.
          VOID is not misconduct. Valuation on {fmtInt(a.rows_with_valuation)} rows is not revenue.
        </p>
      </section>

      <TxAustinIdentityLookup result={lookup} />

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Public contacts</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Contractor phone is published only with a company/business context ({fmtInt(a.contacts.phones)}{" "}
          rows). Provenance {a.contacts.provenance_phone}. Contractor address provenance{" "}
          {a.contacts.provenance_address} ({fmtInt(a.contacts.addresses)} rows). Email and website are{" "}
          {a.contacts.email_website}. Person-name-only contacts stay REVIEW_REQUIRED and are not
          listed here. These permit-row contacts do not overwrite TDLR or TSBPE contacts.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">State-credential treatment</h2>
        <p className="mt-2 text-sm leading-relaxed">
          This City of Austin file has no source-native TDLR, TSBPE, or city contractor number.
          EXACT_STATE_CREDENTIAL is {fmtInt(snapshot.state_credential.exact_state_credential)}.{" "}
          {fmtInt(snapshot.state_credential.high_confidence_business_match_rows)} HIGH_CONFIDENCE
          business-name matches exist in the harvest crosswalk. That count is internal only. It is
          not license verification, not a licensed roster, and not a state-matched public badge.
        </p>
        <p className="mt-2 text-sm">
          Always confirm a trade credential on{" "}
          <Official href={TDLR_VERIFY} label="TDLR License Search" /> and{" "}
          <Official href={TSBPE_VERIFY} label="TSBPE" />.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Local-only contractor treatment</h2>
        <p className="mt-2 text-sm leading-relaxed">
          {fmtInt(snapshot.local_only.rows)} rows are LOCAL_ONLY_CONTRACTOR_IDENTITY, including{" "}
          {fmtInt(snapshot.local_only.general)} general-contractor trade rows. Local-only is not
          unlicensed. Texas does not issue a statewide general-contractor license. A City of Austin
          permit contractor without a TDLR specialty or TSBPE plumbing match is not published as
          unlicensed.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">TCAD property linkage</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Austin <span className="font-medium">tcad_id</span> joins Travis CAD PROP.TXT{" "}
          <span className="font-medium">geo_id</span>. {fmtInt(snapshot.tcad.exact_geo_id_joins)} exact
          joins of {fmtInt(snapshot.tcad.distinct_permit_tcad_ids)} distinct permit TCAD IDs ({joinPct}
          %). {fmtInt(snapshot.tcad.unmatched_permit_tcad_ids)} permit TCAD IDs did not join. Owner
          fields were not exported. Appraisal value is not a sale price. This is not an owner dossier.
        </p>
        <Trace
          source="Travis Central Appraisal District 2026 certified appraisal export PROP.TXT"
          sourceDate="2026 certified / harvest 2026-09-04"
          grain="geo_id parcel identifier, not owner"
          coverage="Travis CAD parcels matched from City of Austin tcad_id"
          denominator="distinct permit tcad_id values"
          calculation="Exact string join Austin tcad_id == PROP.TXT geo_id (layout positions 547-596)"
          caveat="Appraisal is not a sale. Parcel join is not an owner dossier. Unmatched is not zero value."
        />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Evidence depth</h2>
        <div className="mt-3 overflow-x-auto text-sm">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Family</th>
                <th className="py-2 pr-3">Rows / keys</th>
                <th className="py-2">Limitation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 pr-3">Issued permits</td>
                <td className="py-2 pr-3">{fmtInt(a.rows)}</td>
                <td className="py-2">City of Austin only; permit ≠ quality</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-3">Public company+phone identities</td>
                <td className="py-2 pr-3">{fmtInt(a.distinct_normalized_company_plus_phone)}</td>
                <td className="py-2">Not a state license; person-name-only excluded</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-3">Contractor phones / addresses</td>
                <td className="py-2 pr-3">
                  {fmtInt(a.contacts.phones)} / {fmtInt(a.contacts.addresses)}
                </td>
                <td className="py-2">Permit-row provenance; not TDLR/TSBPE contacts</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-3">EXACT_STATE_CREDENTIAL</td>
                <td className="py-2 pr-3">{fmtInt(a.exact_state_credential)}</td>
                <td className="py-2">No source-native TDLR/TSBPE/city contractor number</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-3">HIGH_CONFIDENCE (internal)</td>
                <td className="py-2 pr-3">{fmtInt(a.match_class.HIGH_CONFIDENCE_BUSINESS_MATCH)}</td>
                <td className="py-2">Not license verification; not a public badge</td>
              </tr>
              <tr>
                <td className="py-2 pr-3">TCAD exact geo_id joins</td>
                <td className="py-2 pr-3">{fmtInt(snapshot.tcad.exact_geo_id_joins)}</td>
                <td className="py-2">Appraisal ≠ sale; no owner dossiers</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Findings</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            City of Austin is the only Texas local page. Fort Worth, Tarrant, San Antonio, Bexar,
            Houston, and Harris stay data-only.
          </li>
          <li>
            The issued-permit file is a contractor-activity source with company, phone, address, and
            trade — and with no source-native state license ID.
          </li>
          <li>
            {fmtInt(snapshot.local_only.general)} local-only general-contractor rows cannot be read as
            unlicensed: Texas has no statewide GC license.
          </li>
          <li>
            HIGH_CONFIDENCE name matching ({fmtInt(a.match_class.HIGH_CONFIDENCE_BUSINESS_MATCH)} rows)
            stays internal. It is not turned into license verification.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">What we don&apos;t know</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>Complete Texas contractor denominator remains UNKNOWN. There is no statewide GC roster.</li>
          <li>Person-name-only permit contacts are not published.</li>
          <li>No local record is not proof of no work.</li>
          <li>This lookup is not a complete permit-number directory.</li>
        </ul>
        <p className="mt-3 text-sm">
          <Official href={TDLR_VERIFY} label="Verify with TDLR" />
          {" · "}
          <Official href={TSBPE_VERIFY} label="Verify with TSBPE" />
          {" · "}
          <Link href="/texas" className="underline underline-offset-2">
            Texas state research
          </Link>
        </p>
      </section>
    </main>
  );
}
