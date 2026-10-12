import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";

const CRLB = "https://crb.ri.gov/";
const FAQ = "https://crb.ri.gov/contractor-registration/faqs";
const ROSTER = "https://ridbrprod.state-reg-eastern.tylerapp.com/portal/public/online-reports";
const DBR_ROSTER_GUIDANCE = "https://dbr.ri.gov/about-dbr/frequently-asked-questions-departments-e-licensing-system";
const DBR_LOOKUP = "https://dbr.ri.gov/about-dbr/lookup-license";

export const metadata: Metadata = pageMetadata({
  title: "Rhode Island contractor registration and specialty licenses",
  description: "Verify Rhode Island CRLB contractor registration and separately licensed construction specialties through official state sources.",
  path: "/rhode-island",
});

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="underline underline-offset-2" href={href} rel="noopener noreferrer" target="_blank">{children}</a>;
}

function Population({ title, description }: { title: string; description: string }) {
  return (
    <article className="rounded-xl border border-slate-200 p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed">{description}</p>
      <p className="mt-3 text-sm"><strong>Roster rows and status counts:</strong> NOT_ACQUIRED.</p>
    </article>
  );
}

export default function RhodeIslandContractorPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm"><Link className="underline" href="/">Home</Link> / Rhode Island research</nav>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Rhode Island · statewide contractor regulation</p>
      <h1 className="mt-2 text-3xl font-bold">Rhode Island contractor registration and specialty licenses</h1>
      <p className="mt-4 text-sm leading-relaxed">Rhode Island requires contractors and subcontractors in the business of building or repairing structures to register with the Contractors’ Registration and Licensing Board (CRLB). CRLB general contractor registration is a distinct population from the specialty licenses it issues. These populations are reported separately; no combined contractor total is presented.</p>

      <section aria-labelledby="registration-heading" className="mt-8 space-y-5">
        <h2 id="registration-heading" className="text-2xl font-semibold">General Contractor Registration</h2>
        <p className="text-sm leading-relaxed">CRLB’s FAQ states that covered contractors and subcontractors must register and that registrations are valid for one year. This registration is not a specialized professional license. Current roster rows, distinct registration IDs, and status distribution: NOT_ACQUIRED.</p>
        <Population title="General Contractor Registration roster" description="The official public roster generator was checked at the source clock below. It returned the Tyler Access application shell without roster controls or downloadable rows in this retrieval. No contractor records or registration status were inferred." />
      </section>

      <section aria-labelledby="specialty-heading" className="mt-8 space-y-5">
        <h2 id="specialty-heading" className="text-2xl font-semibold">Separate CRLB specialty-license populations</h2>
        <p className="text-sm leading-relaxed">CRLB identifies these license classes separately from General Contractor Registration. Each class requires its own source-native roster and status counts. No rows or cross-class total are asserted.</p>
        <div className="space-y-4">
          <Population title="Commercial Roofer" description="CRLB commercial roofing license population; not combined with general contractor registrations." />
          <Population title="Home Inspector and Associate Home Inspector" description="CRLB lists home inspectors and associate home inspectors as licensure classes. Their roster counts and statuses are not acquired." />
          <Population title="Underground Utility" description="CRLB underground utility license population; separate credential class." />
          <Population title="Water Filtration Contractor and Installer" description="CRLB distinguishes water-filtration contractor and installer license types; no class counts are acquired." />
          <Population title="Well Drilling and Pump Installer" description="CRLB separately identifies well-drilling and pump-installer license types; no class counts are acquired." />
        </div>
      </section>

      <section aria-labelledby="limits-heading" className="mt-8 border-t border-slate-200 pt-5">
        <h2 id="limits-heading" className="text-xl font-semibold">Source clock and acquisition limits</h2>
        <p className="mt-2 text-sm leading-relaxed">Official CRLB and DBR source pages and the public roster-generator URL were checked October 12, 2026. In the ordinary public browser flow, the generator opened DBR’s Online Rosters list, but CRLB was not among the available roster boards and no CRLB roster download was offered. The separate public search flow presented “Verify Public Search”; no verification control was bypassed. Therefore, all CRLB statewide roster populations are NOT_ACQUIRED; this is not a zero count. Enforcement records are a separate evidence population and were not used as a registration or license census. No local Providence or other municipal licensing is included.</p>
        <p className="mt-3 text-sm">Verify current records directly with {<SourceLink href={CRLB}>CRLB</SourceLink>} and {<SourceLink href={DBR_LOOKUP}>Rhode Island DBR lookup services</SourceLink>}. CRLB scope and one-year registration term are described in the {<SourceLink href={FAQ}>official FAQ</SourceLink>}. DBR’s roster guidance describes the intended public download flow: {<SourceLink href={DBR_ROSTER_GUIDANCE}>DBR e-Licensing FAQ</SourceLink>}. Open the {<SourceLink href={ROSTER}>official public roster generator</SourceLink>}.</p>
      </section>
    </main>
  );
}
