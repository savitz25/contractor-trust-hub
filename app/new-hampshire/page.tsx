import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";

const OPLC = "https://www.oplc.nh.gov/";
const VERIFY = "https://www.oplc.nh.gov/sites/g/files/ehbemt441/files/inline-documents/verification-letter-request.pdf";
const ELECTRICIAN_RULES = "https://gc.nh.gov/rules/state_agencies/elec100-400.html";
const MECHANICAL_RULES = "https://gc.nh.gov/rules/state_agencies/mec300.html";

export const metadata: Metadata = pageMetadata({
  title: "New Hampshire contractor and construction trade credentials",
  description: "New Hampshire statewide construction trade licensing sources, separate credential classes, and acquisition limits.",
  path: "/new-hampshire",
});

const official = (url: string, label: string) => <a className="underline underline-offset-2" href={url} rel="noopener noreferrer" target="_blank">{label}</a>;

export default function NewHampshireContractorPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm"><Link className="underline" href="/">Home</Link> / New Hampshire research</nav>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">New Hampshire · statewide credential sources</p>
      <h1 className="mt-2 text-3xl font-bold">New Hampshire contractor and construction trade credentials</h1>
      <p className="mt-4 text-sm leading-relaxed">The sources reviewed identify statewide licenses for specific regulated trades; they do not establish a universal general-contractor license census. A trade person, licensed business entity, and general contractor are different populations. No municipal permitting or local license records are included.</p>

      <section className="mt-8 space-y-5">
        <article className="rounded-xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Electricians</h2><p className="mt-2 text-sm">The Electricians’ Board regulates separate person classes including master, journeyman, apprentice, and high- or medium-voltage electricians. Credential class and licensee are preserved as issued; counts and dated current rows are NOT_ACQUIRED.</p><p className="mt-2 text-sm">{official(OPLC, "New Hampshire Office of Professional Licensure and Certification")} · {official(ELECTRICIAN_RULES, "Official Electrical rules")}</p></article>
        <article className="rounded-xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Plumbing and gas fitting</h2><p className="mt-2 text-sm">The Mechanical Safety and Licensing Board regulates distinct master and journeyman plumber, apprentice, fuel-gas fitter, and related trainee credentials. Current licensee rows and class counts are NOT_ACQUIRED; individual credentials are not combined with businesses.</p><p className="mt-2 text-sm">{official(OPLC, "New Hampshire Office of Professional Licensure and Certification")} · {official(MECHANICAL_RULES, "Official plumbing and gas-fitting rules")}</p></article>
        <article className="rounded-xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Business entities and other professions</h2><p className="mt-2 text-sm">Some trade rules separately require business-entity licenses. Such entities are not individual licensees. Other construction-related professions must be reviewed under their own board and statutory scope before being included. No statewide general-contractor total is asserted.</p><p className="mt-2 text-sm">{official(OPLC, "Office of Professional Licensure and Certification")} · {official(VERIFY, "OPLC license verification and separate board-actions guidance")}</p></article>
      </section>

      <section className="mt-8 border-t border-slate-200 pt-5"><h2 className="text-xl font-semibold">Source clock and limits</h2><p className="mt-2 text-sm">Official OPLC license-verification guidance and currently published board rules checked October 12, 2026. OPLC documents License Lookup and Board Actions as separate verification sources. No dated bulk extract was acquired in this pass; license rows, status counts, and distinct license numbers are NOT_ACQUIRED, not zero. Complaints and enforcement actions are not counted as licenses. No county or local licensing work is included.</p><p className="mt-3 text-sm"><Link className="underline" href="/ask?q=New%20Hampshire%20statewide%20construction%20trade%20licenses">Ask about New Hampshire construction credentials</Link></p></section>
    </main>
  );
}
