import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";

const registry = "https://contractorregistry.delaware.gov/Certification_PublicLookup?f=name&t=j";
const labor = "https://onestop.delaware.gov/Operate_Contractors";
const electrical = "https://dpr.delaware.gov/boards/electrician/";
const plumbing = "https://dpr.delaware.gov/boards/plumbers/";
const licenseLookup = "https://dpr.delaware.gov/aboutagency/roster_request_insts/";
const official = (url: string, label: string) => <a className="underline underline-offset-2" href={url} rel="noopener noreferrer" target="_blank">{label}</a>;

export const metadata: Metadata = pageMetadata({
  title: "Delaware contractor registration and construction trade credentials",
  description: "Separate Delaware statewide construction-business registration from professional trade licenses and preserve each source population.",
  path: "/delaware",
});

export default function DelawareContractorPage() {
  return <main className="mx-auto max-w-3xl px-4 py-10">
    <nav aria-label="Breadcrumb" className="mb-4 text-sm"><Link className="underline" href="/">Home</Link> / Delaware research</nav>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Delaware · statewide credentials</p>
    <h1 className="mt-2 text-3xl font-bold">Delaware contractor registration and construction trade credentials</h1>
    <p className="mt-4 text-sm leading-relaxed">Delaware requires businesses performing construction services or maintenance for another party for profit in the State to register with the Department of Labor before work begins. This is a statewide business-registration class; it is not a professional trade license or evidence that a particular job complies with building codes. Individual and entity trade licenses remain separate.</p>

    <section className="mt-8 space-y-5">
      <article className="rounded-xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Construction-service businesses</h2><p className="mt-2 text-sm">The Department of Labor’s public registry displayed 518 results on October 12, 2026. Registry rows are certificates/business records with certificate numbers, expiration dates, NAICS codes, work category, and public/private work scope. This is a live search result count, not a frozen extract or a validated distinct-entity count; the underlying rows were not acquired for this publication. The public registry states it lists businesses considered compliant with applicable Delaware Department of Labor laws. A missing result does not itself establish a violation.</p><p className="mt-2 text-sm">{official(registry, "Delaware registered construction-contractor public lookup")} · {official(labor, "Delaware One Stop construction-services registration guidance")}</p></article>
      <article className="rounded-xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Electricians</h2><p className="mt-2 text-sm">The Delaware Board of Electrical Examiners licenses apprentice, journeyperson, residential, master, limited, and specialty electrician classes, and electrical inspection agencies. These person and agency license classes are distinct from contractor-registration businesses. Current class-level rows and distinct licensee totals are NOT_ACQUIRED.</p><p className="mt-2 text-sm">{official(electrical, "Delaware Board of Electrical Examiners")} · {official(licenseLookup, "DPR license roster and verification instructions")}</p></article>
      <article className="rounded-xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Plumbers and other regulated trades</h2><p className="mt-2 text-sm">Delaware DPR maintains a separate Board of Plumbing, Heating, Ventilation, Air Conditioning and Refrigeration Examiners. Its license classes and any separately licensed entities must remain independent of the construction-business registry and electrician roster. No current dated trade roster was acquired in this pass.</p><p className="mt-2 text-sm">{official(plumbing, "Delaware plumbing and HVAC board")} · {official(licenseLookup, "DPR license roster and verification instructions")}</p></article>
    </section>

    <section className="mt-8 border-t border-slate-200 pt-5"><h2 className="text-xl font-semibold">Source clock and limits</h2><p className="mt-2 text-sm">Official Delaware Department of Labor, public registry, One Stop, and DPR sources checked October 12, 2026. Public registry result count is a live interface observation from that date, not a downloaded dataset. Current license rows, expiry-status distributions, and distinct entity totals for board licenses are NOT_ACQUIRED, not zero. Business registration, trade person licenses, inspection-agency licenses, complaints, and enforcement are separate. No local or municipal permits were researched.</p><p className="mt-3 text-sm"><Link className="underline" href="/ask?q=Delaware%20contractor%20registration%20and%20trade%20licenses">Ask about Delaware contractor credentials</Link></p></section>
  </main>;
}
