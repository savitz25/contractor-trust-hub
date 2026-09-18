import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import {
  OH_BBS_CERTS,
  OH_COMPANY_LOOKUP,
  OH_OCILB_BOARD,
  OH_OCILB_ROSTER,
  OH_OCILB_SEARCH,
  OH_ORC_4740,
  OH_PW_PORTAL,
  OH_SFM_CERT,
  OH_SFM_SEARCH,
} from "@/lib/ohio-intelligence/publication";
import { fmtInt, type OhioContractorSnapshot } from "@/lib/ohio-intelligence/snapshot";

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

export function OhioIntelPage({ snapshot }: { snapshot: OhioContractorSnapshot }) {
  const s = snapshot;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Ohio research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · Ohio · statewide only
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        Ohio Contractor &amp; Specialty-Trade Licensing Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Ohio does not have one universal statewide general-contractor license. The Ohio Construction Industry Licensing
        Board (OCILB) licenses five commercial specialty trades: Electrical, HVAC, Hydronics, Plumbing, and
        Refrigeration. The license holder is an individual. A company association on the roster is not a separate state
        company license. One license holder can hold multiple trade credentials on the same numeric identity. Residential
        and general contracting can involve local registration. Fire-protection installer and designer systems are
        separate. Missing or search-only evidence is not zero. This is not a ranking, recommendation, or Trust Score.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        No Columbus, Cleveland, Cincinnati, Toledo, Akron, Dayton, or other local Ohio contractor pages are published
        from this statewide page.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · fingerprint {s.fingerprint.slice(0, 12)} · retrieved {s.clocks.retrievedAt}. Retrieval is
        not a license effective date. The current no-fee listing is ACTIVE and ACTIVE IN RENEWAL; it is not a historical
        inactive/expired/suspended census.
      </p>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric
            value={fmtInt(s.hero.universe_value)}
            label={s.hero.universe_label}
            hint={s.hero.universe_hint}
          />
          <Metric
            value={fmtInt(s.hero.electrical_value)}
            label={s.hero.electrical_label}
            hint="Distinct EL. credentials. Not unique contractors across all trades."
          />
          <Metric
            value={fmtInt(s.hero.fire_installer_value)}
            label={s.hero.fire_installer_label}
            hint="Category rows are 30,042. Do not treat category rows as unique installers. SFM is not OCILB."
          />
          <Metric
            value={fmtInt(s.fire_protection.OH_FIRE_COMPANY_CERT_ROWS)}
            label="SFM fire-protection company certificates"
            hint="Company certification is not installer certification and not an OCILB contracting-company license."
          />
        </div>
        <Trace
          source="OCILB eLicense no-fee Generate Roster; SFM Testing and Registration no-fee Generate Roster"
          sourceDate={s.clocks.snapshotAsOf}
          denominator="Separate official datasets. Trades, fire certificates, and discipline are not added."
          calculation="Numeric OCILB license identity is the hero grain. Trade-credential rows are kept distinct. SFM individual certificates collapse category repeats."
          grain="OCILB formatted credential / numeric identity; SFM certificate ID"
          coverage="Statewide Ohio intelligence only. No Columbus or Cleveland pages."
          caveat="ACTIVE IN RENEWAL is not expired. Search-only discipline is not zero. Local registration is not an OCILB license."
        />
      </section>

      <section className="mt-10" aria-labelledby="ocilb-heading">
        <h2 id="ocilb-heading" className="text-lg font-semibold text-[var(--navy)]">
          OCILB commercial specialty-trade licensing
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Chapter 4740 licenses an individual for a licensed construction project and excludes a residential building as
          defined under the building-code chapter. OCILB is not a statewide general-contractor license and not a
          universal residential-contractor license. Statewide general-contractor roster status is UNSUPPORTED. Verify on{" "}
          <Official href={OH_OCILB_SEARCH} label="OCILB License Lookup" />. No-fee roster generation:{" "}
          <Official href={OH_OCILB_ROSTER} label="Generate Roster(s)" />. Board:{" "}
          <Official href={OH_OCILB_BOARD} label="Ohio Construction Industry Licensing Board" />. Statute:{" "}
          <Official href={OH_ORC_4740} label="ORC Chapter 4740" />.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>Electrical (EL.): {fmtInt(s.electrical.OH_OCILB_ELECTRICAL_DISTINCT_CREDENTIALS)} distinct credentials / {fmtInt(s.electrical.OH_OCILB_ELECTRICAL_ROWS)} listing rows</li>
          <li>HVAC (HV.): {fmtInt(s.hvac.OH_OCILB_HVAC_DISTINCT_CREDENTIALS)} / {fmtInt(s.hvac.OH_OCILB_HVAC_ROWS)}</li>
          <li>Hydronics (HY.): {fmtInt(s.hydronics.OH_OCILB_HYDRONICS_DISTINCT_CREDENTIALS)} / {fmtInt(s.hydronics.OH_OCILB_HYDRONICS_ROWS)}</li>
          <li>Plumbing (PL.): {fmtInt(s.plumbing.OH_OCILB_PLUMBING_DISTINCT_CREDENTIALS)} / {fmtInt(s.plumbing.OH_OCILB_PLUMBING_ROWS)}</li>
          <li>Refrigeration (RE.): {fmtInt(s.refrigeration.OH_OCILB_REFRIGERATION_DISTINCT_CREDENTIALS)} / {fmtInt(s.refrigeration.OH_OCILB_REFRIGERATION_ROWS)}</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          All-trade listing rows: {fmtInt(s.ocilb.OH_OCILB_ALL_TRADE_CREDENTIAL_ROWS)}. Distinct formatted credentials:{" "}
          {fmtInt(s.ocilb.OH_OCILB_DISTINCT_FORMATTED_CREDENTIALS)}. Distinct numeric license identities:{" "}
          {fmtInt(s.ocilb.OH_OCILB_DISTINCT_LICENSE_HOLDERS)}. Distinct licensee person keys:{" "}
          {fmtInt(s.ocilb.OH_OCILB_DISTINCT_LICENSEE_PERSONS)}. Distinct associated company names (ESCROW excluded):{" "}
          {fmtInt(s.ocilb.OH_OCILB_DISTINCT_ASSOCIATED_COMPANY_NAMES)}. Do not publish the all-trade row sum as unique
          contractors. Training Agency (TA) was excluded.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="identity-heading">
        <h2 id="identity-heading" className="text-lg font-semibold text-[var(--navy)]">
          Person, credential, and company
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          The license belongs to an individual. The roster may name a contracting company associated with that
          individual. That association is not a separate OCILB company license. {fmtInt(s.multi_trade.OH_OCILB_MULTI_TRADE_NUMERIC_HOLDERS)}{" "}
          numeric identities appear in more than one trade prefix (example: HY.10621 and PL.10621). Person keys are not
          merged by name: {fmtInt(s.multi_trade.person_key_with_multiple_numeric_ids)} name keys map to more than one
          numeric identity. Exact roster person-to-company bridges:{" "}
          {fmtInt(s.company_relationships.OH_OCILB_EXACT_LICENSEE_COMPANY_RELATIONSHIPS)}. The dedicated{" "}
          <Official href={OH_COMPANY_LOOKUP} label="Company Licensee Lookup" /> remains OPEN_SEARCH_ONLY; this ticket
          did not reconstruct employers by fuzzy name matching. Public address is not headquarters. Company string is not
          a proven legal entity. Licensee address is not service territory.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-lg font-semibold text-[var(--navy)]">
          Status / active / renewal
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Source-native statuses in the current listing: ACTIVE {fmtInt(s.status.OH_OCILB_ACTIVE_CREDENTIAL_ROWS)}{" "}
          credential rows; ACTIVE IN RENEWAL {fmtInt(s.status.OH_OCILB_ACTIVE_IN_RENEWAL_ROWS)}. ACTIVE IN RENEWAL is
          not expired and not inactive. Expired, suspended, and revoked counts in this current listing are 0 because
          those records are not in the no-fee current roster — that is not proof Ohio has zero inactive licenses. Some
          rows encode ESCROW as the company string ({fmtInt(s.ocilb.escrow_encoded_as_company_string_rows)} rows);
          ESCROW is not a contracting company. Do not add incompatible trade rows into an “active contractors” total
          without deduping the license holder.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="local-heading">
        <h2 id="local-heading" className="text-lg font-semibold text-[var(--navy)]">
          General / residential gap and local registration
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Local jurisdictions may separately regulate or register contractors. Local contractor registration is not an
          OCILB license. Municipal general-contractor registration is not a statewide contractor license. A Columbus or
          Cleveland contractor is not a statewide credential. No local Ohio intelligence routes are authorized in this
          ticket.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="discipline-heading">
        <h2 id="discipline-heading" className="text-lg font-semibold text-[var(--navy)]">
          OCILB discipline and unlicensed enforcement
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Specialty sections may suspend, revoke, refuse to issue, require additional continuing education, or fine.
          This ticket found no bounded public structured statewide discipline catalog, so coverage is OPEN_SEARCH_ONLY —
          not zero. A complaint is not a disciplinary action. A notice of proposed action is not a final order. A fine is
          not a revocation. Additional CE is not a suspension. A criminal conviction is not an administrative action.
          Name-only attachment is unsafe.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Ohio law permits the attorney general, on request of a specialty section, to seek an injunction against a
          person acting as a Chapter 4740 contractor without required licensure. No structured public injunction catalog
          was acquired. Unlicensed enforcement rows remain null / OPEN_SEARCH_ONLY. This hub does not publish a
          news-derived blacklist.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="fire-heading">
        <h2 id="fire-heading" className="text-lg font-semibold text-[var(--navy)]">
          Fire-protection installers, companies, and designers
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          The Ohio State Fire Marshal separately certifies persons and companies engaged for profit in installing,
          testing, repairing, or maintaining fire-protection equipment. That is not an OCILB electrical contractor
          license. Individual installer certification is not company certification. Current no-fee SFM listing:{" "}
          {fmtInt(s.fire_protection.OH_FIRE_INSTALLER_DISTINCT_CERT_IDS)} distinct individual certificate IDs (
          {fmtInt(s.fire_protection.OH_FIRE_INSTALLER_ROWS)} category rows) and{" "}
          {fmtInt(s.fire_protection.OH_FIRE_COMPANY_CERT_ROWS)} company certificates. Largest individual category is Fire
          Alarms / Detection ({fmtInt(s.fire_protection.largest_individual_category_rows)} category rows). Verify on{" "}
          <Official href={OH_SFM_SEARCH} label="SFM License Lookup" />. Certification rules:{" "}
          <Official href={OH_SFM_CERT} label="Fire Protection Certification" />.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Low-voltage firewall: ORC 4740.13(D) excludes certain systems using less than fifty volts — including
          qualifying fire alarm, burglar alarm, cabling, tele-data, sound, communication, and landscape lighting /
          irrigation — from OCILB electrical-contractor licensure. Absence of an EL. credential does not automatically
          prove a low-voltage fire-alarm contractor is unlicensed. Research the SFM certification path.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Board of Building Standards fire-protection system designer certifications (water-based, fire alarm, special
          hazards) are not contractor licenses. Public license lookup for BBS certifications is a future portal update;
          designer rows remain null / OPEN_SEARCH_ONLY. Designer is not installer is not OCILB contractor. BBS:{" "}
          <Official href={OH_BBS_CERTS} label="Board of Building Standards certifications" />.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="pw-heading">
        <h2 id="pw-heading" className="text-lg font-semibold text-[var(--navy)]">
          Prevailing wage and permits
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          The Commerce Prevailing Wage Portal publishes commercial public-works rates and requires OHID for rate access.
          No public structured contractor debarment or enforcement catalog was acquired. Prevailing-wage debarment rows
          remain null. Rates are not contractor identities. Portal: <Official href={OH_PW_PORTAL} label="Prevailing Wage Portal" />.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Building permits are LOCAL_OR_FRAGMENTED. This ticket does not begin local permit acquisition.
        </p>
      </section>
    </main>
  );
}
