import Link from "next/link";
import { Trace } from "@/components/new-jersey/trace";
import {
  OR_BCD_FINAL_ORDERS,
  OR_BCD_PORTAL,
  OR_BCD_SEARCH,
  OR_CCB_HOME,
  OR_CCB_PORTAL,
  OR_CCB_PUBLIC_CONTRACTS,
  OR_CCB_SEARCH,
} from "@/lib/oregon-intelligence/publication";
import { fmtInt, type OregonContractorSnapshot } from "@/lib/oregon-intelligence/snapshot";

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

export function OregonIntelPage({ snapshot }: { snapshot: OregonContractorSnapshot }) {
  const s = snapshot;
  return (
    <main className="mx-auto w-full max-w-[880px] overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="underline underline-offset-2">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Oregon research</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">
        Independent research · Oregon · statewide only
      </p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        Oregon Contractor License &amp; Regulatory Intelligence
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Official Oregon Construction Contractors Board active licenses plus a separate Building Codes
        Division trade-credential layer. A CCB license is not a BCD credential. A license row is not a
        unique company. A complaint is not discipline. This is not a ranking, recommendation, or Trust
        Score.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Snapshot {s.version} · CCB source as of {s.clocks.ccb_sourceAsOf} · retrieved {s.clocks.ccb_retrievedAt}
      </p>

      <section className="mt-8" aria-labelledby="hero-metrics">
        <h2 id="hero-metrics" className="sr-only">
          Snapshot metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric value={fmtInt(s.hero.universe_value)} label={s.hero.universe_label} hint={s.hero.universe_hint} />
          <Metric value={fmtInt(s.hero.rows_value)} label={s.hero.rows_label} hint={s.hero.rows_hint} />
          <Metric
            value={fmtInt(s.hero.bcd_business_value)}
            label={s.hero.bcd_business_label}
            hint={s.hero.bcd_business_hint}
          />
        </div>
        <Trace
          source="Oregon CCB Active Licenses g77e-6bhs and BCD vhbr-cuaq"
          sourceDate={s.clocks.ccb_sourceAsOf}
          denominator="CCB Active Licenses extract; BCD active licenses extract"
          grain="CCB distinct license_number; CCB rows; BCD business/contractor LicNbr"
          coverage="Statewide official open data. Not unique companies."
          calculation={`${fmtInt(s.ccb.DISTINCT_NONEMPTY_LICENSE_IDS)} distinct CCB IDs from ${fmtInt(s.ccb.SOURCE_ROWS)} rows. BCD business IDs ${fmtInt(s.bcd.ENTITY_GRAIN_DISTINCT_IDS.BUSINESS)} are not added to CCB.`}
          caveat="Do not sum CCB, BCD, complaints, or final orders into one Oregon contractor total."
        />
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-8">
        <h2 className="text-xl font-semibold">Oregon CCB active licenses</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          CCB publishes contractors who can legally work in Oregon, daily, as Active Licenses. This extract
          has no per-row status column; membership is the source-native current-active grain. Do not infer
          ACTIVE from expiration dates. Residential General Contractor ({fmtInt(s.ccb.LICENSE_TYPE_COUNTS.RGC)})
          is not the only Oregon contractor class. Confirm a specific license on{" "}
          <Official href={OR_CCB_SEARCH} label="CCB license search" />.
        </p>
        <p className="mt-3 text-sm">
          <Official href={OR_CCB_PORTAL} label="CCB Active Licenses open data" />
          {" · "}
          <Official href={OR_CCB_HOME} label="oregon.gov/ccb" />
        </p>
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-8">
        <h2 className="text-xl font-semibold">BCD trade credentials</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Building Codes Division licenses electrical, plumbing, boiler, elevator, manufactured-dwelling,
          prefab, combo, and inspector certifications. Business/contractor credentials (
          {fmtInt(s.bcd.ENTITY_GRAIN_DISTINCT_IDS.BUSINESS)}) are not person credentials (
          {fmtInt(s.bcd.ENTITY_GRAIN_DISTINCT_IDS.PERSON)}) and not inspector certifications (
          {fmtInt(s.bcd.ENTITY_GRAIN_DISTINCT_IDS.INSPECTOR)}). BCD is not added to the CCB denominator.
        </p>
        <p className="mt-3 text-sm">
          <Official href={OR_BCD_PORTAL} label="BCD active licenses open data" />
          {" · "}
          <Official href={OR_BCD_SEARCH} label="BCD license holder search" />
        </p>
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-8">
        <h2 className="text-xl font-semibold">Adverse evidence</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          BCD final orders remain posted for three years after case closure on an interactive table. No
          stable bulk extract was acquired. Related cases are not extra violations. CCB complaint and
          disciplinary history is official search, about 10 years per license — missing bulk is not zero
          complaints. Complaint is not discipline.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          CCB&apos;s list of contractors not qualified to hold public contracts currently states: no
          contractors are listed at this time. That is not proof that no Oregon contractor has ever been
          debarred.
        </p>
        <p className="mt-3 text-sm">
          <Official href={OR_BCD_FINAL_ORDERS} label="BCD final orders" />
          {" · "}
          <Official href={OR_CCB_PUBLIC_CONTRACTS} label="CCB public-contract ineligibility list" />
        </p>
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-8">
        <h2 className="text-xl font-semibold">What these numbers do not mean</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>There is no combined Oregon contractors total.</li>
          <li>45,501 distinct CCB IDs are not 45,501 unique companies.</li>
          <li>BCD person and inspector credentials are not contractor-business licenses.</li>
          <li>Bond or insurance fields as published are not a live certificate of insurance.</li>
          <li>Portland and Multnomah County are not separate intelligence routes on this ticket.</li>
          <li>No Trust Score. No ranking.</li>
        </ul>
      </section>
    </main>
  );
}
