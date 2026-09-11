import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import {
  NY_ASBESTOS,
  NY_EDLIST,
  NY_MOLD,
  NY_OPEN_DATA,
  NY_PW_FAQ,
  NY_PW_LANDING,
} from "@/lib/new-york-intelligence/publication";
import { fmtInt, type NewYorkContractorSnapshot } from "@/lib/new-york-intelligence/snapshot";

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

export function NewYorkIntelPage({ snapshot }: { snapshot: NewYorkContractorSnapshot }) {
  const s = snapshot;
  const r = s.registry;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>New York research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · New York · statewide only · no city or county pages
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        New York Public-Work Contractor Registration Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official NYSDOL public-work contractor and subcontractor registration evidence. This is
        registration for public work and covered private projects under Article 8. It is not a
        statewide general-contractor license, not a residential home-improvement roster, and not a
        ranking, recommendation, or Trust Score. A contractor missing from this registry is not
        automatically unlicensed for ordinary private residential work.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · source as of {s.clocks.sourceAsOf} · retrieved {s.clocks.retrievedAt} ·
        publication gate {s.gate.passed ? "passed" : "blocked"}
      </p>

      <section className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" aria-labelledby="ny-scope">
        <h2 id="ny-scope" className="text-sm font-semibold text-[var(--navy)]">
          Which New York contractor evidence is covered?
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          This page covers the NYSDOL Contractor Registry Certificate for public-work contractors and
          subcontractors. Confirm current registration on{" "}
          <Official href={NY_PW_LANDING} label="the official NYSDOL registry landing page" /> and the{" "}
          <Official href={NY_OPEN_DATA} label="New York Open Data dataset" />. Local home-improvement
          licensing, including New York City, is a separate check.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric value={fmtInt(s.hero.universe_value)} label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric
            value={fmtInt(s.hero.distinct_ids_value)}
            label={s.hero.distinct_ids_label}
            hint={s.hero.distinct_ids_hint}
          />
          <Metric
            value={fmtInt(s.hero.ny_address_value)}
            label={s.hero.ny_address_label}
            hint={s.hero.ny_address_hint}
          />
          <Metric value={String(s.hero.as_of_value)} label={`As-of · ${s.hero.as_of_label}`} />
        </div>
        <Trace
          source={NY_OPEN_DATA}
          sourceDate={s.clocks.sourceAsOf}
          denominator={`${fmtInt(r.parsed_rows)} registry certificate rows; ${fmtInt(r.distinct_certificate_ids)} distinct Certificate Numbers`}
          calculation="Complete official CSV export. No NY-address filter. Status is the source-native Status field, not a date-derived Active flag."
          grain="public-work contractor registry certificate"
          coverage="Statewide NYSDOL public-work registration, including out-of-state businesses"
          caveat="This is not all New York contractors. Do not add specialty licenses. Missing from this registry is not proof a residential contractor is illegal."
        />
      </section>

      <section className="mt-10" aria-labelledby="pw-heading">
        <h2 id="pw-heading" className="text-lg font-semibold text-[var(--navy)]">
          Public-work contractor registration
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          NYSDOL Bureau of Public Work and Prevailing Wage Enforcement. Source-native status on this
          extract is Active for every row ({fmtInt(r.source_status_counts.Active)}). That is the
          published Status field, not a status we calculated from issue or expiration dates.
          Certificate issue dates run {r.issued_min} to {r.issued_max}. An application is not an
          issued certificate. A certificate number is not a unique legal organization. Registration
          jurisdiction is not the mailing address — {fmtInt(s.geography.out_of_state_mailing_address_rows)}{" "}
          rows list an out-of-state address and remain in the statewide universe.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          <Official href={NY_PW_FAQ} label="Official NYSDOL contractor registry FAQ" />
        </p>
      </section>

      <section className="mt-10" aria-labelledby="specialty-heading">
        <h2 id="specialty-heading" className="text-lg font-semibold text-[var(--navy)]">
          State specialty licensing
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Statewide mold and asbestos business licenses were not acquired as bulk lists. Those
          programs remain official search/verification paths. A mold assessment business is not a
          remediation business. An asbestos contractor license is not a worker certificate of
          competence. Specialty licensees are not general contractors and are not added to the{" "}
          {fmtInt(r.parsed_rows)} public-work certificates.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          <li>
            Mold Program: OPEN_SEARCH_ONLY.{" "}
            <Official href={NY_MOLD} label="Official NY DOL Mold Program" />
          </li>
          <li>
            Asbestos Control Bureau: OPEN_SEARCH_ONLY.{" "}
            <Official href={NY_ASBESTOS} label="Official NY DOL Asbestos Control Bureau" />
          </li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="debar-heading">
        <h2 id="debar-heading" className="text-lg font-semibold text-[var(--navy)]">
          Debarment research and scope
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          The official EDList remains a search-only verification path. This snapshot did not scrape
          it. The public-work registry itself includes a source-native “has been debarred” field on{" "}
          {fmtInt(s.debarment.registry_field_has_been_debarred_yes)} certificate rows. On this extract,
          all of those listed periods had already ended before the snapshot date — historical
          debarment is not current exclusion. Debarment is not a criminal conviction. A public-work
          exclusion is not a ban on ordinary private work. Name-only joins to other lists are unsafe.
          No profile attachments were written.
        </p>
        <p className="mt-2 text-sm">
          <Official href={NY_EDLIST} label="Official NY DOL employer debarment list search" />
        </p>
      </section>

      <section className="mt-10" aria-labelledby="local-heading">
        <h2 id="local-heading" className="text-lg font-semibold text-[var(--navy)]">
          Where local home-improvement licensing must be checked
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          New York City, counties, and some municipalities license home-improvement work separately.
          This statewide page does not acquire NYC DCWP, DOB, PLUTO, ACRIS, or suburban contractor
          lists. A later local phase is approved only after all six New York specialist hubs and Ask
          New York statewide are Production-verified. It is not started here.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="ny-mean">
        <h2 id="ny-mean" className="text-lg font-semibold text-[var(--navy)]">
          What these numbers do not mean
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>Public-work registration is not a statewide GC or HIC license.</li>
          <li>Registry absence is not automatically an illegal residential contractor.</li>
          <li>New York registration jurisdiction is not a New York mailing address.</li>
          <li>A certificate row is not a unique company.</li>
          <li>A specialty business license is not a person certificate.</li>
          <li>Historical debarment is not current exclusion.</li>
          <li>Search-only and missing evidence is not zero.</li>
          <li>No Trust Score, paid ranking, or best/safest/vetted conclusions.</li>
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="ny-gaps">
        <h2 id="ny-gaps" className="text-lg font-semibold text-[var(--navy)]">
          Coverage and gaps
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>
            <strong>Grabbed — high yield.</strong> {s.juice_squeeze.GRABBED_HIGH_YIELD.join("; ")}.
          </li>
          <li>
            <strong>Grabbed — easy secondary.</strong> {s.juice_squeeze.GRABBED_EASY_SECONDARY.join("; ")}.
          </li>
          <li>
            <strong>Left — search only.</strong> {s.juice_squeeze.LEFT_SEARCH_ONLY.join("; ")}.
          </li>
          <li>
            <strong>Left — local / future.</strong> {s.juice_squeeze.LEFT_LOCAL_FUTURE.join("; ")}.
          </li>
        </ul>
      </section>
    </main>
  );
}
