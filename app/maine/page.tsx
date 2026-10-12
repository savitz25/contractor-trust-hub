import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";

const ELECTRICIAN = "https://www.maine.gov/pfr/professionallicensing/professions/electricians/online-services";
const PLUMBER = "https://www.maine.gov/pfr/professionallicensing/professions/plumbers-examining-board/online-services";
const PROFESSIONS = "https://www.maine.gov/pfr/professionallicensing/professions";
const LICENSE_SEARCH = "https://www.maine.gov/pfr/consumer/licensee-search";
const electricianPortal = "https://www.pfr.maine.gov/ALMSOnline/ALMSQuery/Welcome.aspx?board=4220";
const plumberPortal = "https://www.pfr.maine.gov/ALMSOnline/ALMSQuery/Welcome.aspx?board=4460";

export const metadata: Metadata = pageMetadata({
  title: "Maine contractor and construction trade licenses",
  description: "Maine statewide trade credential sources, license classes, and acquisition limits.",
  path: "/maine",
});

const official = (url: string, label: string) => <a className="underline underline-offset-2" href={url} rel="noopener noreferrer" target="_blank">{label}</a>;

export default function MaineContractorPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm"><Link className="underline" href="/">Home</Link> / Maine research</nav>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Maine · statewide credential sources</p>
      <h1 className="mt-2 text-3xl font-bold">Maine contractor and construction trade licenses</h1>
      <p className="mt-4 text-sm leading-relaxed">Maine does not have an established universal statewide general-contractor license census in the sources reviewed. Statewide trade credentials are issued in separate classes. A licensed trade person is not automatically a licensed contractor business, and this page does not add separate trades into one contractor total.</p>

      <section className="mt-8 space-y-5">
        <article className="rounded-xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Electricians</h2><p className="mt-2 text-sm">The Electricians' Examining Board recognizes master, journeyman, limited, apprentice, journeyman-in-training, and helper electrician license classes. The public service advertises a downloadable licensee list. Current bulk rows and class counts: NOT_ACQUIRED.</p><p className="mt-2 text-sm">{official(ELECTRICIAN, "Board online services and list download")} · {official(electricianPortal, "Open official license portal")}</p></article>
        <article className="rounded-xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Plumbers</h2><p className="mt-2 text-sm">The Plumbers' Examining Board licenses master, journeyman, trainee, and journeyman-in-training plumbers. These credential classes remain separate. Current bulk rows and class counts: NOT_ACQUIRED.</p><p className="mt-2 text-sm">{official(PLUMBER, "Board online services and list download")} · {official(plumberPortal, "Open official license portal")}</p></article>
        <article className="rounded-xl border border-slate-200 p-5"><h2 className="text-xl font-semibold">Other regulated construction professions</h2><p className="mt-2 text-sm">Maine PFR identifies statewide professions that may perform construction-related work, including architects, professional engineers, elevator mechanics, boiler operators, and fuel technicians. The governing scope and class-level license rosters need separate review before they can be represented as contractor credentials. Counts: NOT_ACQUIRED.</p><p className="mt-2 text-sm">{official(PROFESSIONS, "Maine PFR professions directory")} · {official(LICENSE_SEARCH, "Maine licensee search and download instructions")}</p></article>
      </section>

      <section className="mt-8 border-t border-slate-200 pt-5"><h2 className="text-xl font-semibold">Source clock and limits</h2><p className="mt-2 text-sm">Official board source pages checked October 12, 2026. The Maine license portal's cookie-detection redirect loop prevented bulk retrieval in this acquisition environment. No license rows, statuses, or distinct IDs are asserted. This is an acquisition gap, not a zero-license result. Complaint intake and discipline have not been acquired. No local licensing is included.</p><p className="mt-3 text-sm"><Link className="underline" href="/ask?q=Maine%20statewide%20contractor%20trade%20licenses">Ask about Maine construction credentials</Link></p></section>
    </main>
  );
}
