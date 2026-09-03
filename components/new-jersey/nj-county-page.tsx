import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";
import { Trace } from "@/components/new-jersey/trace";
import type { NjCountySnapshot, NjsaviVendorRow } from "@/lib/new-jersey-intelligence/counties/load";
import { fmtInt } from "@/lib/new-jersey-intelligence/snapshot";

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

export function NewJerseyCountyPage({
  snapshot,
  vendors,
}: {
  snapshot: NjCountySnapshot;
  vendors: NjsaviVendorRow[];
}) {
  const s = snapshot;
  const C = s.construction;
  const M = s.municipalities;
  const local = s.local as Record<string, unknown>;
  const preview = vendors.slice(0, 25);
  const countyLabel = `${s.county} County`;

  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/new-jersey" className="underline underline-offset-2">
          New Jersey
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{countyLabel}</span>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
          Independent research · {countyLabel}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
          {countyLabel} Contractor &amp; Construction Intelligence
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          This page organizes official construction source records, municipality reporting, and
          county-specific program or GIS context for {countyLabel}. It is not a ranking,
          recommendation, or Trust Score. A business address in {countyLabel} is not evidence that a
          contractor serves all of {countyLabel}.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Snapshot {s.version} · FIPS {s.county_fips} · as of {s.as_of}
        </p>
      </header>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          <Metric value={fmtInt(s.hero.universe_value)} label={`Universe · ${s.hero.universe_label}`} hint={s.hero.universe_hint} />
          <Metric value={String(s.hero.current_value)} label={`Current · ${s.hero.current_label}`} hint={s.hero.current_hint} />
          <Metric value={fmtInt(s.hero.observations_value)} label={`Observations · ${s.hero.observations_label}`} hint={s.hero.observations_hint} />
          <Metric value={fmtInt(s.hero.geography_value)} label={`Geography · ${s.hero.geography_label}`} hint={s.hero.geography_hint} />
          <Metric value={String(s.hero.as_of_value)} label={`As-of · ${s.hero.as_of_label}`} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">County findings</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {s.findings.map((f) => (
            <li key={f.id}>{f.text}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10" id="construction">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Construction activity</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{C.caveat}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(C.total_source_records)} label="Total source records" hint="Not permits. Not projects." />
          <Metric value={fmtInt(C.permit_issued_records)} label="Permit-issued records (P)" />
          <Metric value={fmtInt(C.certificate_issued_records)} label="Certificate-issued records (C)" />
          <Metric value={fmtInt(M.observed_reporters)} label="Observed reporting municipalities" hint={`${fmtInt(M.canonical_current)} current municipalities in this county.`} />
        </div>
        <p className="mt-3 text-sm">{C.cost_note}</p>
        <p className="mt-2 text-sm">{C.unit_change_note}</p>
        <p className="mt-2 text-sm">
          Statewide construction rows have no contractor attribution. A construction record is not a
          contractor finding.
        </p>
        <p className="mt-2 text-sm">
          <Official href={C.landing_url} label="NJ Construction Permit Data (DCA / data.nj.gov)" />
        </p>
        <Trace
          source="NJ DCA Division of Codes & Standards Socrata dataset w9se-dmra, projected from NJ-CON-002B municipality reconciliation"
          sourceDate={s.as_of}
          denominator={`${fmtInt(C.total_source_records)} source records with county=${s.county.toUpperCase()}`}
          calculation="Count of source rows. Status P and Status C counted separately. Costs not summed."
          grain="SOURCE RECORD COUNT — not project count"
          coverage={`${fmtInt(M.observed_reporters)} reporters; ${fmtInt(M.known_non_reporters)} known non-reporters`}
          caveat={C.caveat}
        />
      </section>

      <section className="mt-10" id="municipalities">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Municipality coverage</h2>
        <p className="mt-2 text-sm">
          {fmtInt(M.observed_reporters)} of {fmtInt(M.canonical_current)} current municipalities are
          observed reporters. A municipality with no rows is a coverage gap, not zero construction.
          STATE rows are not municipalities and are not in this table.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Municipality</th>
                <th className="py-2 pr-3 font-medium">Code</th>
                <th className="py-2 pr-3 font-medium">P records</th>
                <th className="py-2 font-medium">C records</th>
              </tr>
            </thead>
            <tbody>
              {M.rows.map((row) => (
                <tr key={row.municipality_code} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">
                    {row.name}
                    {row.classification === "CURRENT_NON_REPORTING" ? " (non-reporter)" : ""}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{row.municipality_code}</td>
                  <td className="py-2 pr-3 tabular-nums">{fmtInt(row.permit_issued_records)}</td>
                  <td className="py-2 tabular-nums">{fmtInt(row.certificate_issued_records)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" id="credentials">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Contractor / credential landscape</h2>
        <p className="mt-2 text-sm">
          {fmtInt(s.contractor_discovery.public_profiles_with_deterministic_county_address)} public
          ContractorTrustHub profiles are deterministically assigned to {countyLabel} by an official
          business address in this snapshot. Missing profiles are unknown, not a clean or empty
          market. Statewide public-works lists remain statewide families and are not inferred onto
          this county by name.
        </p>
        <p className="mt-2 text-sm">
          PWCR coverage is {s.regulatory.pwcr.coverage}. A missing roster is not zero registrants.
        </p>
      </section>

      <section className="mt-10" id="specialty">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Specialty contractor evidence</h2>
        <p className="mt-2 text-sm">{s.specialty.note}</p>
        <p className="mt-2 text-sm">
          <Official href={s.specialty.lead_evaluation_url} label="Lead evaluation" />
          {" · "}
          <Official href={s.specialty.lead_abatement_url} label="Lead abatement" />
          {" · "}
          <Official href={s.specialty.asbestos_url} label="ASCM" />
          {" · "}
          <Official href={s.specialty.fire_url} label="Fire protection" />
        </p>
      </section>

      <section className="mt-10" id="local">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Local county intelligence</h2>
        {s.county_slug === "middlesex-county" ? (
          <MiddlesexLocal local={local} />
        ) : s.county_slug === "somerset-county" ? (
          <SomersetLocal local={local} />
        ) : s.county_slug === "union-county" ? (
          <UnionLocal local={local} />
        ) : (
          <MonmouthLocal local={local} />
        )}
        {s.regulatory.safe_house_novs_in_county.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-base font-semibold">Safe House / HIC notices in this county inventory</h3>
            <p className="mt-1 text-sm">
              A notice of violation is not a final order. Names are source-inventory rows, not
              contractor profiles.
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {s.regulatory.safe_house_novs_in_county.map((row) => (
                <li key={row.company}>
                  {row.company} · {row.town} · {row.violation} (NOV, proposed)
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {s.regulatory.consumer_affairs.bulk_rows === 0 ? (
          <p className="mt-4 text-sm">
            County consumer-affairs complaint history is lookup or request coverage only. This page
            does not show zero complaints and does not call the absence a clean record. A complaint
            is not a violation.
          </p>
        ) : null}
      </section>

      <section className="mt-10" id="public-works">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Public works / regulatory evidence</h2>
        <p className="mt-2 text-sm">{s.regulatory.note}</p>
        <p className="mt-2 text-sm">
          Research statewide WALL, Wage Watchlist, and Treasury lists from the{" "}
          <Link href="/new-jersey" className="underline underline-offset-2">
            New Jersey construction page
          </Link>
          . Absence from a snapshot is not a clean record.
        </p>
      </section>

      <section className="mt-10" id="contractors">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Find contractors</h2>
        <p className="mt-2 text-sm">
          Geography on this page means <strong>business address in {countyLabel}</strong> — not
          “serves all of {countyLabel}.” Vendor or program participation is not a contractor license.
        </p>
        <div className="mt-4 max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <SearchForm
            size="default"
            stateSlug="nj"
            intent="research"
            label={`Research a New Jersey contractor`}
            placeholder="Registration number or company name"
          />
        </div>
        <p className="mt-3 text-sm">
          <Link href="/verify?state=nj" className="underline underline-offset-2">
            Open New Jersey Verify
          </Link>
          {" · "}
          <Link href="/new-jersey" className="underline underline-offset-2">
            Statewide construction intelligence
          </Link>
        </p>
        <h3 className="mt-6 text-base font-semibold">NJSAVI construction-related certified vendors</h3>
        <p className="mt-2 text-sm">
          {fmtInt(vendors.length)} rows with a published business city in {countyLabel} and a
          construction-class commodity or name. This is a certified-vendor dataset, not a license
          roster. Phone and email are published business contacts. Contact names are omitted.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Business name</th>
                <th className="py-2 pr-3 font-medium">City</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 font-medium">Business phone</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={`${row.business_name}-${row.business_city}-${row.business_zip}`} className="border-b border-[var(--border)] align-top">
                  <td className="py-2 pr-3">{row.business_name}</td>
                  <td className="py-2 pr-3">{row.business_city}</td>
                  <td className="py-2 pr-3">{row.trade_or_category}</td>
                  <td className="py-2 tabular-nums">{row.primary_phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {vendors.length > preview.length ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Showing {preview.length} of {fmtInt(vendors.length)} research rows. Not a ranking.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Source: NJSAVI ({s.source_clocks.njsavi}). Match method: city-to-county crosswalk. No
          name-only profile attachment.
        </p>
      </section>

      <section className="mt-10" id="depth">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Evidence depth</h2>
        <p className="mt-2 text-sm">
          Authoritative source families in this snapshot: {s.publication_gate.family_count}. This is
          evidence coverage, not contractor quality.
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {s.publication_gate.authoritative_source_families.map((f) => (
            <li key={f}>{f.replace(/_/g, " ")}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10" id="unknown">
        <h2 className="text-lg font-semibold text-[var(--navy)]">What we don&apos;t know</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {s.coverage_gaps.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function MonmouthLocal({ local }: { local: Record<string, unknown> }) {
  return (
    <div className="text-sm leading-relaxed">
      <p>{String(local.note || "")}</p>
      <p className="mt-2">
        <Official href={String(local.geohub)} label="Monmouth GeoHub" />
        {" · "}
        <Official href={String(local.property_viewer)} label="Property Viewer" />
      </p>
      <p className="mt-2">
        NJGIN parcel features referenced for this county: {fmtInt(Number(local.njgin_parcel_count))}.
        Parcel geometry is not a legal survey. OPRS was not scraped.
      </p>
    </div>
  );
}

function MiddlesexLocal({ local }: { local: Record<string, unknown> }) {
  const zoning = local.zoning as { feature_count: number; municipalities_represented: number; note: string };
  const incentives = local.incentives as { layers: { name: string; count: number }[]; note: string };
  return (
    <div className="text-sm leading-relaxed">
      <p>
        County zoning FeatureServer: {fmtInt(zoning.feature_count)} polygons across{" "}
        {fmtInt(zoning.municipalities_represented)} municipalities. {zoning.note}
      </p>
      <p className="mt-2">{incentives.note}</p>
      <ul className="mt-2 list-disc pl-5">
        {incentives.layers.map((layer) => (
          <li key={layer.name}>
            {layer.name}: {fmtInt(layer.count)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SomersetLocal({ local }: { local: Record<string, unknown> }) {
  const sewer = local.sewer_service_areas as { feature_count: number; note: string };
  const hub = local.gis_hub as { datasets_indexed: number; note: string };
  return (
    <div className="text-sm leading-relaxed">
      <p>
        Sewer service areas: {fmtInt(sewer.feature_count)} polygons. {sewer.note}
      </p>
      <p className="mt-2">
        County GIS Hub: {fmtInt(hub.datasets_indexed)} datasets indexed. {hub.note}
      </p>
    </div>
  );
}

function UnionLocal({ local }: { local: Record<string, unknown> }) {
  const towns = local.participating_municipalities as string[];
  const independent = local.independent_municipal_rehab as string[];
  return (
    <div className="text-sm leading-relaxed">
      <h3 className="text-base font-semibold text-[var(--navy)]">UNION_COUNTY_HOME_IMPROVEMENT_PROGRAM</h3>
      <p className="mt-2">
        This is a CDBG rehabilitation program for owner-occupied 1- and 2-family homes. It is{" "}
        <strong>not a Union County contractor license</strong>. Program staff prepare work write-ups,
        review contractor bids, and inspect work. That is program administration, not licensure.
      </p>
      <p className="mt-2">{String(local.benefit_note)}</p>
      <p className="mt-2">
        Participating municipalities: {towns.join(", ")}. Independent municipal rehab programs:{" "}
        {independent.join(", ")}.
      </p>
      <p className="mt-2">
        No public participant list was acquired. If a list arrives later, rows would be labeled{" "}
        <code>UNION_COUNTY_HOME_IMPROVEMENT_PROGRAM_PARTICIPANT</code> — still not a county license.
      </p>
      <p className="mt-2">
        <Official href={String(local.source_url)} label="Official Home Improvement Program page" />
      </p>
    </div>
  );
}
