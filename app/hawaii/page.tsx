import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";

const roster = "https://cca.hawaii.gov/wp-content/uploads/2026/04/PVL_Report_Contractors_Current_Licenses_By_Class_2026-04-06.xlsx";
const board = "https://www.cca.hawaii.gov/pvl/boards/contractor/";
const search = "https://mypvl.dcca.hawaii.gov/public-license-search/";

export const metadata: Metadata = pageMetadata({
  title: "Hawaii contractor licenses and classifications",
  description: "Hawaii DCCA Contractors License Board license and classification evidence, with source dates and separate credential classes.",
  path: "/hawaii",
});

export default function HawaiiContractorPage() {
  return <main className="mx-auto max-w-3xl px-4 py-10">
    <nav aria-label="Breadcrumb" className="mb-4 text-sm"><Link className="underline" href="/">Home</Link> / Hawaii research</nav>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Hawaii · statewide contractor licensing</p>
    <h1 className="mt-2 text-3xl font-bold">Hawaii contractor licenses and classifications</h1>
    <p className="mt-4 text-sm leading-relaxed">The Hawaii Department of Commerce and Consumer Affairs Professional and Vocational Licensing Division administers the Contractors License Board. The Board licenses contractor businesses and persons by defined classification. A licensee may hold more than one classification, so class observations are not added into a contractor census.</p>
    <section className="mt-8 rounded-xl border border-slate-200 p-5">
      <h2 className="text-xl font-semibold">Published statewide roster snapshot</h2>
      <p className="mt-2 text-sm leading-relaxed">The official workbook contains 8,667 license-class observations representing 5,628 distinct CT license numbers/licensees. It lists 8,254 class observations marked “Current, Valid & In Good Standing” and 413 marked “Current, Valid & In Good Standing/Maint. Requirement Due” as of April 6, 2026. These are source snapshot statuses, not a refreshed assertion of current status.</p>
      <p className="mt-3 text-sm leading-relaxed">General Building (BC) is one classification population. The workbook also reports general engineering and specialty classifications, including electrical, plumbing, roofing, and other trade classes. Classifications may overlap within one CT license; no cross-class sum is presented as a statewide contractor total. The source does not provide a reliable person-versus-business type field in this extract. RME/qualifying-person relationships and disciplinary actions are not included in these counts.</p>
      <p className="mt-3 text-sm"><strong>Source clock:</strong> April 6, 2026, 11:22 HST. <strong>Observations:</strong> 8,667. <strong>Distinct CT licensees:</strong> 5,628.</p>
      <p className="mt-3 text-sm">Download the <a className="underline" href={roster} rel="noopener noreferrer" target="_blank">official DCCA roster workbook</a> or check a record in the <a className="underline" href={search} rel="noopener noreferrer" target="_blank">official public license search</a>. Board scope and licensing information: <a className="underline" href={board} rel="noopener noreferrer" target="_blank">Contractors License Board</a>.</p>
    </section>
    <section className="mt-8 border-t border-slate-200 pt-5">
      <h2 className="text-xl font-semibold">Evidence limits</h2>
      <p className="mt-2 text-sm leading-relaxed">This is a dated licensing snapshot. It does not establish that a license remains active today, project quality, insurance coverage, or absence of discipline. Class rows and CT licensees remain distinct grains. No enforcement records were joined by name, and no local licensing populations are included.</p>
    </section>
  </main>;
}
