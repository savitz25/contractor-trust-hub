import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { ColoradoContractorLookup } from "@/components/colorado/co-contractor-lookup";
import type { CoLookupResult } from "@/lib/colorado-intelligence/lookup";
import { DORA_CIM, DORA_HOME, DORA_ROSTER, DORA_VERIFY } from "@/lib/colorado-intelligence/publication";
import { fmtInt, type ColoradoContractorSnapshot } from "@/lib/colorado-intelligence/snapshot";

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

export function ColoradoIntelPage({
  snapshot,
  lookup,
}: {
  snapshot: ColoradoContractorSnapshot;
  lookup: CoLookupResult;
}) {
  const s = snapshot;
  const ec = s.business_credentials.EC;
  const pc = s.business_credentials.PC;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Colorado research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · Colorado · no city/county pages
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        Colorado Contractor License &amp; Regulatory Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official Colorado DORA electrical contractor and plumbing contractor registrations, licensed
        trades, AELS professional credentials, and discipline attached only by exact license prefix plus
        number. Colorado does not issue one statewide general-contractor license. This is not a ranking,
        recommendation, or Trust Score. Active is not recommended. A license row is not a unique company.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · retrieved {s.source.retrieved_at} · publication gate{" "}
        {s.gate.passed ? "passed" : "blocked"}
      </p>

      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" aria-labelledby="gc-limit">
        <h2 id="gc-limit" className="text-sm font-semibold text-[var(--navy)]">
          No statewide general-contractor license
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          DORA statewide contractor-business evidence is Electrical Contractor (EC) and Plumbing
          Contractor (PC). General contracting, roofing, HVAC/mechanical, and many construction trades
          are primarily local. Absence from DORA EC/PC is not proof that a general contractor is
          unlicensed.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            value={fmtInt(s.hero.ec_active_value)}
            label={s.hero.ec_active_label}
            hint={s.hero.ec_active_hint}
          />
          <Metric
            value={fmtInt(s.hero.pc_active_value)}
            label={s.hero.pc_active_label}
            hint={s.hero.pc_active_hint}
          />
          <Metric
            value={fmtInt(s.hero.discipline_rows_value)}
            label={s.hero.discipline_rows_label}
            hint={s.hero.discipline_rows_hint}
          />
          <Metric
            value={fmtInt(s.hero.discipline_cases_value)}
            label={s.hero.discipline_cases_label}
            hint={s.hero.discipline_cases_hint}
          />
          <Metric value={String(s.hero.as_of_value)} label={`As-of · ${s.hero.as_of_label}`} />
          <Metric
            value={fmtInt(s.source.master_rows)}
            label="DORA master license rows (all professions)"
            hint="Not a contractor universe. Includes nurses, pharmacists, and other boards."
          />
        </div>
      </section>
      <Trace
        source="Colorado Information Marketplace / DORA 7s5z-vewr"
        sourceDate={s.as_of}
        grain="license row = prefix + number; EC/PC are business credentials"
        coverage="Statewide DORA professional/occupational extract"
        denominator="Active EC and Active PC separately"
        calculation={`Active EC ${fmtInt(ec.active_exact)} · all EC ${fmtInt(ec.all_rows)}. Active PC ${fmtInt(pc.active_exact)} · all PC ${fmtInt(pc.all_rows)}. Adding Active EC+PC (${fmtInt(s.business_credentials.combined_active_exact_if_shown.value)}) is electrical + plumbing contractor credential rows, not unique companies.`}
        caveat="No statewide GC. Active is not recommended. Missing discipline is not a clean record. Missing bond/insurance is unknown, not zero."
      />

      <ColoradoContractorLookup result={lookup} />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Market findings</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {s.findings.map((f) => (
            <li key={f.id}>{f.text}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">How do I verify a Colorado contractor?</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Confirm on official{" "}
          <Official href={DORA_VERIFY} label="DORA license lookup" /> using the license prefix and number.
          Generate a roster from <Official href={DORA_ROSTER} label="DORA Generate Roster" />. This page
          organizes the CIM extract. It does not replace DORA.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Regulatory map</h2>
        <p className="mt-2 text-sm">
          Model {s.regulatory_map.model}. Primary regulator:{" "}
          <Official href={DORA_HOME} label={s.regulatory_map.primary_regulator.name} />.{" "}
          {s.regulatory_map.primary_regulator.role} Source:{" "}
          <Official href={DORA_CIM} label="CIM dataset 7s5z-vewr" />.
        </p>
        <p className="mt-2 text-sm">Identity {s.identity.namespace}. licenseNumber alone is not globally unique.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Electrical and plumbing contractor businesses</h2>
        <p className="mt-2 text-sm">
          EC is a business registration ({fmtInt(ec.active_exact)} Active of {fmtInt(ec.all_rows)} rows). PC
          is a business registration ({fmtInt(pc.active_exact)} Active of {fmtInt(pc.all_rows)} rows). EC is
          not ME. PC is not MP. {fmtInt(s.identity.ec_pc_names_with_multiple_credentials)} normalized names
          hold more than one EC/PC credential.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Individual trades and AELS</h2>
        <p className="mt-2 text-sm">
          Master/journeyman/residential electrician and plumber licenses are person-grain research
          evidence. They do not automatically create public person profiles. Apprentice records (APE, AP)
          are internal. Professional engineer, architect, land surveyor, and landscape architect licenses
          are not general contractors and are not construction businesses.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Prefix</th>
                <th className="py-2 pr-3">Grain</th>
                <th className="py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["ME", "person", s.individual_trades.prefixes.ME.active_exact],
                  ["JW", "person", s.individual_trades.prefixes.JW.active_exact],
                  ["RW", "person", s.individual_trades.prefixes.RW.active_exact],
                  ["MP", "person", s.individual_trades.prefixes.MP.active_exact],
                  ["JP", "person", s.individual_trades.prefixes.JP.active_exact],
                  ["RP", "person", s.individual_trades.prefixes.RP.active_exact],
                  ["PE", "AELS professional", s.aels.prefixes.PE.active_exact],
                  ["ARC", "AELS professional", s.aels.prefixes.ARC.active_exact],
                  ["PLS", "AELS professional", s.aels.prefixes.PLS.active_exact],
                  ["LA", "AELS professional", s.aels.prefixes.LA.active_exact],
                ] as const
              ).map(([prefix, grain, active]) => (
                <tr key={prefix} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{prefix}</td>
                  <td className="py-2 pr-3">{grain}</td>
                  <td className="py-2 tabular-nums">{fmtInt(active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Discipline</h2>
        <p className="mt-2 text-sm">
          Contractor-relevant prefixes have {fmtInt(s.discipline.contractor_relevant_rows)} observation
          rows and {fmtInt(s.discipline.contractor_distinct_cases)} distinct case numbers. Attach only
          with exact licensePrefix + licenseNumber. Name-only is unsafe. A discipline row is not a unique
          case. A case is not a criminal conviction. No action found is not a clean record. The full DORA
          file has {fmtInt(s.discipline.all_prefix_flagged_rows)} flagged rows across all professions —
          do not call that a contractor discipline count.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">What the sources do not establish</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>Bond/insurance bulk evidence: {s.bond_insurance.coverage}. Missing is not zero.</li>
          <li>Statewide building permits were not identified. Denver was not ingested. Permits are local/AHJ.</li>
          <li>
            Public works / debarment: {s.public_works_debarment.access}. Do not claim zero debarred
            contractors.
          </li>
          <li>Secretary of State entities were not ingested in this ticket. Name-only SOS joins are unsafe.</li>
        </ul>
      </section>
    </main>
  );
}
