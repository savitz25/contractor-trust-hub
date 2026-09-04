import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import { ROC_HOME, ROC_POSTING, ROC_UNLICENSED, ROC_VERIFY } from "@/lib/arizona-intelligence/publication";
import { fmtHero, fmtInt, type ArizonaContractorSnapshot } from "@/lib/arizona-intelligence/snapshot";

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

export function ArizonaIntelPage({ snapshot }: { snapshot: ArizonaContractorSnapshot }) {
  const s = snapshot;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Arizona research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · Arizona · no new city/county permit pages
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        Arizona Contractor License &amp; Regulatory Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official Arizona Registrar of Contractors current-posting licenses, class types, and overlap
        between commercial, residential, and dual files. This is not a ranking, recommendation, or Trust
        Score. A current posting is not a recommendation. A license row is not a unique company.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · posting-list header {s.current_posting.header_as_of} · publication gate{" "}
        {s.gate.passed ? "passed" : "blocked"}
      </p>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric value={fmtHero(s.hero.universe_value)} label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric
            value={fmtHero(s.hero.commercial_value)}
            label={s.hero.commercial_label}
            hint={s.hero.commercial_hint}
          />
          <Metric
            value={fmtHero(s.hero.residential_value)}
            label={s.hero.residential_label}
            hint={s.hero.residential_hint}
          />
          <Metric value={fmtHero(s.hero.dual_value)} label={s.hero.dual_label} hint={s.hero.dual_hint} />
          <Metric
            value={fmtHero(s.hero.discipline_value)}
            label={s.hero.discipline_label}
            hint={s.hero.discipline_hint}
          />
          <Metric value={String(s.hero.as_of_value)} label={`As-of · ${s.hero.as_of_label}`} />
        </div>
      </section>
      <Trace
        source="ROC Posting List — All Current Contractors header"
        sourceDate={s.current_posting.header_as_of}
        grain="official posting-list file header (not unique companies)"
        coverage="Statewide current posting as published by ROC"
        denominator="All Current Contractors file"
        calculation={`Header ${fmtInt(s.current_posting.all_current)}. Commercial ${fmtInt(s.current_posting.commercial_file)} + Residential ${fmtInt(s.current_posting.residential_file)} + Dual ${fmtInt(s.current_posting.dual_file)} = ${fmtInt(s.current_posting.additive_sum_if_mistaken)} if added — that sum is wrong.`}
        caveat="Current posting is not a recommendation. License row is not a unique company. Missing is not zero."
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Market findings</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {s.findings.map((f) => (
            <li key={f.id}>{f.text}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">How do I verify a contractor?</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Confirm on the official{" "}
          <Official href={ROC_VERIFY} label="ROC contractor search" /> using the ROC license number. This
          page organizes posting-list evidence. It does not replace ROC.
        </p>
        <form action="/search" method="get" className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            Business name or ROC license
            <input
              name="q"
              className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
              placeholder="License No or business name"
            />
          </label>
          <label className="text-sm">
            City or ZIP
            <input name="city" className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2" />
          </label>
          <button type="submit" className="mt-2 rounded-md bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white sm:col-span-2">
            Search ContractorTrustHub
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Search uses the existing az_roc graph. Results are not ranked by discipline, license age, or
          number of licenses.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Regulatory map</h2>
        <p className="mt-2 text-sm">
          Model {s.regulatory_map.model}. Primary regulator:{" "}
          <Official href={ROC_HOME} label={s.regulatory_map.primary_regulator.name} />.{" "}
          {s.regulatory_map.primary_regulator.role}
        </p>
        <p className="mt-2 text-sm">
          Identity {s.identity.namespace}. {s.regulatory_map.terminology.current_posting}.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>Commercial: {s.regulatory_map.classes.COMMERCIAL}</li>
          <li>Residential: {s.regulatory_map.classes.RESIDENTIAL}</li>
          <li>Dual: {s.regulatory_map.classes.DUAL}</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">License classes</h2>
        <p className="mt-2 text-sm">
          Last full All Current extract ({s.last_full_extract.file_created}): {fmtInt(s.last_full_extract.distinct_class_codes)}{" "}
          distinct class codes. Top codes include KB-2, B, KB-1, B-1, CR-11, CR-39. Product families follow
          source-native prefixes (A, B, B-1, KB, CR, C, R). Not a ranking.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Class</th>
                <th className="py-2">Rows in last extract</th>
              </tr>
            </thead>
            <tbody>
              {s.last_full_extract.top_classes.slice(0, 12).map((row) => (
                <tr key={row.code} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{row.code}</td>
                  <td className="py-2 tabular-nums">{fmtInt(row.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">New licenses, discipline, unlicensed activity</h2>
        <p className="mt-2 text-sm">
          New licenses CSV ({s.new_licenses.official_window}): SOURCE_NOT_ACQUIRED this ticket. A new-license row is
          not a new company until deduped by License No.
        </p>
        <p className="mt-2 text-sm">
          Disciplinary actions: {fmtInt(s.discipline.pre_ingest_graph_rows)} rows already in the graph.
          Current posting-list CSV {s.discipline.current_csv}. Attach only with an exact ROC license number.
          Name-only is unsafe. A disciplinary action is not a criminal conviction. No action found is not a
          clean record.
        </p>
        <p className="mt-2 text-sm">
          Unlicensed violations: {s.unlicensed.universe}. Official list{" "}
          <Official href={ROC_UNLICENSED} label="ROC unlicensed violators" />. Do not attach to a licensed
          profile by name. A historical violation is not current unlicensed status.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Qualifying party and contacts</h2>
        <p className="mt-2 text-sm">
          Qualifying-party name is on {fmtInt(s.qualifying_party.named)} last-extract rows;{" "}
          {fmtInt(s.qualifying_party.qp_exempt)} are QP Exempt. No qualifying-party ID. Person ≠ contractor
          business. Qualifying party ≠ owner unless the source says so. No automatic person profiles.
        </p>
        <p className="mt-2 text-sm">
          Business address is {s.contacts.business_address.class} ({fmtInt(s.contacts.business_address.count)}{" "}
          rows). Phone, email, and website are {s.contacts.phone.class}. No internet enrichment.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">Evidence depth</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Family</th>
                <th className="py-2 pr-3">Access</th>
                <th className="py-2">Limitation</th>
              </tr>
            </thead>
            <tbody>
              {s.evidence_depth.map((row) => (
                <tr key={row.family} className="border-b border-[var(--border)] align-top">
                  <td className="py-2 pr-3">{row.family}</td>
                  <td className="py-2 pr-3">{row.access}</td>
                  <td className="py-2">{row.limitations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--navy)]">What the data does not establish</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {s.coverage_gaps.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {s.semantics.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          Official files: <Official href={ROC_POSTING} label="ROC posting list" />. Missing is not zero.
        </p>
      </section>
    </main>
  );
}
