import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import {
  fmtHero,
  fmtInt,
  type TexasContractorSnapshot,
} from "@/lib/texas-intelligence/snapshot";

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

export function TexasContractorPage({ snapshot }: { snapshot: TexasContractorSnapshot }) {
  const s = snapshot;
  const tdlrBiz = s.tdlr.business_contractor;
  const rmp = s.tsbpe.responsible_master_plumber;
  const match = s.cmbl.match;

  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Texas research</span>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
          Independent research · Texas
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
          Texas Contractor &amp; Trade Intelligence
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          Texas does not use one statewide general-contractor licensing system. This page organizes
          official TDLR specialty-trade credentials, TSBPE plumbing credentials, Comptroller vendor
          rows, and TxDOT project rows. It is not a ranking, recommendation, or Trust Score. Acquired
          specialty credentials are not all Texas contractors.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Snapshot {s.version} · native TDLR files as of {s.as_of} · publication gate{" "}
          {s.gate.passed ? "passed" : "blocked"}
        </p>
      </header>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          <Metric value={fmtHero(s.hero.universe_value)} label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric value={fmtHero(s.hero.current_value)} label={s.hero.current_label} hint={s.hero.current_hint} />
          <Metric value={fmtHero(s.hero.observations_value)} label={s.hero.observations_label} hint={s.hero.observations_hint} />
          <Metric value={fmtHero(s.hero.geography_value)} label={s.hero.geography_label} hint={s.hero.geography_hint} />
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
        <h2 className="text-lg font-semibold text-[var(--navy)]">Regulatory map</h2>
        <p className="mt-2 text-sm">
          Model {s.regulatory_map.model}. Statewide general-contractor license:{" "}
          {s.regulatory_map.statewide_general_contractor_license ? "yes" : "no"}.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {s.regulatory_map.primary_business_regulators.map((r) => (
            <li key={r.id}>
              <Official href={r.url} label={r.name} /> — {r.role}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">Not a contractor license:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {s.regulatory_map.not_a_license.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm">{s.regulatory_map.local_note}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">TDLR business credentials</h2>
        <p className="mt-2 text-sm">
          Official native files:{" "}
          <Official href={s.tdlr.native_portal} label="TDLR Licensing Files Download Page" />. Identity
          namespace {s.tdlr.identity_namespace}. License numbers collide across types, so the type is
          part of the key. Socrata All Licenses ({fmtInt(s.tdlr.soda.row_count)} rows) is not a
          contractor census.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(tdlrBiz.distinct_keys)} label="Distinct TDLR business keys" hint="Specialty/company files. Not all Texas contractors." />
          <Metric value={fmtInt(s.tdlr.soda.grain_totals.PERSON_TRADE_CREDENTIAL)} label="Socrata person trade credentials" hint="Electricians, technicians, apprentices. Not contractor businesses." />
          <Metric value={fmtInt(s.tdlr.listing_status.CURRENT_BY_EXPIRATION)} label="Listing-file current by expiration" hint="Expiration vs as-of. Not a source-native CURRENT flag." />
          <Metric value={fmtInt(s.tdlr.listing_status.EXPIRED_BY_EXPIRATION)} label="Listing-file expired by expiration" hint="Expired is not disciplined." />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">TDLR business license type</th>
                <th className="py-2 font-medium">Acquired rows</th>
              </tr>
            </thead>
            <tbody>
              {tdlrBiz.trade_counts.map((row) => (
                <tr key={row.trade} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{row.trade}</td>
                  <td className="py-2 tabular-nums">{fmtInt(row.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Trace
          source="TDLR native specialty contractor CSVs plus Versa mold company files"
          sourceDate={s.tdlr.native_as_of}
          denominator="Rows in official contractor/company download files. TDLR All Licenses 983,494 is a multi-program universe."
          calculation="Count distinct TX-TDLR keys on BUSINESS_CONTRACTOR grains only."
          grain="BUSINESS LICENSE ROW — not a contractor-business census"
          coverage="ACQUIRED_NATIVE_SPECIALTY_FILES"
          caveat="Do not say Texas has this many contractors. There is no statewide general-contractor license."
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Business vs person</h2>
        <p className="mt-2 text-sm">
          A person trade license is not a contractor business. Master/journeyman/apprentice
          electricians, A/C technicians, and TSBPE journeyman/master plumbers are person credentials.
          People are not published as profiles.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(tdlrBiz.distinct_keys)} label="TDLR business contractor keys" />
          <Metric value={fmtInt(s.tdlr.business_adjacent.distinct_keys)} label="TDLR adjacent businesses" hint="Labs, solar retailers, EV supply providers." />
          <Metric value={fmtInt(s.tdlr.person_soda_count)} label="TDLR person credentials (Socrata)" />
          <Metric value={fmtInt(s.tsbpe.person_credentials.distinct_keys)} label="TSBPE person plumbing credentials" />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">TSBPE plumbing</h2>
        <p className="mt-2 text-sm">
          Plumbing is licensed by{" "}
          <Official href={s.tsbpe.source} label="TSBPE free licensee lists" />, not TDLR. A Responsible
          Master Plumber may contract with the public. A Master Plumber credential is a person license.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(rmp.distinct_keys)} label="Responsible Master Plumber rows" hint="Business-facing plumbing credential." />
          <Metric value={fmtInt(rmp.status_buckets.Current)} label="RMP source-native Current" hint="Current is not TrustHub Verified." />
          <Metric value={fmtInt(s.tsbpe.insurance_on_rmp_file.CURRENT_BY_EXPIRATION)} label="RMP insurance current by expiration" hint="Insurance expiry is not a TDLR license." />
          <Metric value={fmtInt(s.tsbpe.person_credentials.distinct_keys)} label="MP + JP + TP person rows" />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Status education</h2>
        <p className="mt-2 text-sm">
          TDLR listing files have expiration dates, not CURRENT/REVOKED flags. Versa files and TSBPE
          lists publish source-native status. Expired is not disciplined. Current is not an endorsement.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {s.status_distribution.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Public business contacts</h2>
        <p className="mt-2 text-sm">
          TDLR business phones PUBLIC_ELIGIBLE: {fmtInt(s.contacts.tdlr_business_phone_public_eligible)}{" "}
          (A/C native file rarely publishes a phone). TSBPE RMP phones PUBLIC_ELIGIBLE:{" "}
          {fmtInt(s.contacts.tsbpe_rmp_phone_public_eligible)}. CMBL vendor phones{" "}
          {fmtInt(s.contacts.cmbl_vendor_phone_public_eligible)} and emails{" "}
          {fmtInt(s.contacts.cmbl_vendor_email_public_eligible)} are vendor contacts, not license
          contacts. Person phones are not published. A mailing address is REVIEW_REQUIRED and is not a
          proven service area. Emails and websites are not inferred.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">CMBL / HUB / VetHUB</h2>
        <p className="mt-2 text-sm">
          {s.cmbl.semantics} Official downloads:{" "}
          <Official href={s.cmbl.source} label="Comptroller purchasing downloads" />.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(s.cmbl.web_name_rows)} label="Active CMBL vendor rows" hint="web_name.csv. Not contractor licenses." />
          <Metric value={fmtInt(s.cmbl.hub_name_rows)} label="HUB name rows" />
          <Metric value={fmtInt(s.cmbl.sdv_flag_counts.Y)} label="WEB_SDV_FLAG Y" hint="Service-disabled veteran flag. Not a license." />
          <Metric value={fmtInt(s.cmbl.construction_vendor_vids)} label="Construction-related vendors" hint="NIGP 909/910/912/913/914/968 or category 01/02." />
        </div>
        <p className="mt-3 text-sm">
          Category 01 ({fmtInt(s.cmbl.category_counts["01"])}) is “Building Construction, including
          General Contractors and Operative Builders” as a vendor self-class. That is not a statewide
          GC license.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Vendor → regulator identity</h2>
        <p className="mt-2 text-sm">
          {match.note} {s.cmbl.adverse_attach_rule} HIGH_CONFIDENCE is not attached as adverse evidence.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Match class</th>
                <th className="py-2 font-medium">Construction vendors</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">EXACT (license ID in vendor file)</td>
                <td className="py-2 tabular-nums">{fmtInt(match.EXACT)}</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">HIGH_CONFIDENCE (unique name + address)</td>
                <td className="py-2 tabular-nums">{fmtInt(match.HIGH_CONFIDENCE)}</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">REVIEW_REQUIRED (unique name only)</td>
                <td className="py-2 tabular-nums">{fmtInt(match.REVIEW_REQUIRED)}</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">UNSAFE (ambiguous name)</td>
                <td className="py-2 tabular-nums">{fmtInt(match.UNSAFE)}</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">NET_NEW_BUSINESS_CANDIDATES</td>
                <td className="py-2 tabular-nums">{fmtInt(match.NET_NEW_BUSINESS_CANDIDATES)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm">
          Net-new examples include firms such as JE Dunn Construction — often general contractors in a
          state that does not license GCs statewide. Unmatched is not unlicensed.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">TxDOT construction evidence</h2>
        <p className="mt-2 text-sm">
          {s.txdot.semantics} Official source:{" "}
          <Official href={s.txdot.source} label="TxDOT Project Information drau-zphx" />.{" "}
          {fmtInt(s.txdot.row_count)} project rows. Awarded-contractor field: none.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">TCEQ</h2>
        <p className="mt-2 text-sm">
          Coverage {s.tceq.coverage}. {s.tceq.semantics} Central Texas fragment:{" "}
          {fmtInt(s.tceq.row_count)} regulated-entity rows; {fmtInt(s.tceq.naics_23_rows_in_fragment)}{" "}
          NAICS 23* in that fragment. Construction NAICS is not a contractor license.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Enforcement</h2>
        <p className="mt-2 text-sm">
          TDLR license-ID disciplinary bulk file: {s.enforcement.tdlr_bulk_license_id_file}. FY
          {s.enforcement.tdlr_public_stats.fy} PDF stats cite {fmtInt(s.enforcement.tdlr_public_stats.agency_cases_opened)}{" "}
          agency cases opened and {fmtInt(s.enforcement.tdlr_public_stats.agency_total_licensees_cited_on_pdf)}{" "}
          total TDLR licensees across all programs. {s.enforcement.tdlr_public_stats.note} A complaint
          is not a violation.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Qualifier / business relationships</h2>
        <p className="mt-2 text-sm">{s.qualifier_relationships.tdlr_listing_name_vs_business_name}</p>
        <p className="mt-2 text-sm">{s.qualifier_relationships.tsbpe_rmp_person_and_company}</p>
        <p className="mt-2 text-sm">People are not published as profiles.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Statewide permits</h2>
        <p className="mt-2 text-sm">
          Coverage {s.statewide_permits.coverage}. {s.statewide_permits.note} No Texas city or county
          routes are published in this ticket.
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
          <Official href={s.verify.tdlr_search} label="TDLR License Search" /> and{" "}
          <Official href={s.verify.tsbpe} label="TSBPE" />. This page does not replace the boards.
        </p>
      </section>
    </main>
  );
}
