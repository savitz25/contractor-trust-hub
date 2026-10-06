import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Missouri contractor credential research",
  description: "Missouri has no unified statewide general contractor license. Research the optional statewide electrical contractor credential and other specific state regulated trades without conflating local licenses.",
  path: "/missouri",
});

const electrical = "https://pr.mo.gov/electricalcontractors.asp";
const downloads = "https://mopro.mo.gov/license/s/license-downloads";
const search = "https://mopro.mo.gov/license/s/license-search";

export default function MissouriContractorPage() {
  return <main className="th-shell py-10 sm:py-14">
    <p className="cth-intel-eyebrow">Missouri / Division of Professional Registration</p>
    <h1>Missouri contractor credentials</h1>
    <p className="mt-3 max-w-3xl text-lg">Missouri does not issue a single statewide general contractor license. General contracting is governed largely through local rules. This statewide page therefore covers only credentials issued by Missouri regulators; it does not turn local license lists into a Missouri contractor census.</p>

    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Missouri credential scope">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong>Statewide electrical contractor</strong><p className="mt-2 text-sm">The Office of Statewide Electrical Contractors offers a statewide license. It is optional for someone who already meets the rules of the places where they work. A company using the state license needs a licensed electrical contractor in a supervisory role.</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong>Professional design credentials</strong><p className="mt-2 text-sm">Architect, professional engineer, land surveyor and landscape architect licenses have their own board and person or firm grain. They are not general contractor licenses.</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong>Lead abatement contractor</strong><p className="mt-2 text-sm">The Department of Health and Senior Services licenses lead abatement contractors for regulated lead work. This narrow credential is separate from general construction.</p></div>
    </section>

    <section className="mt-10 max-w-3xl space-y-4 text-sm leading-relaxed">
      <h2>Verify the issuing credential</h2>
      <p>The <a className="underline" href={electrical}>Office of Statewide Electrical Contractors</a> explains the state license and local recognition. The <a className="underline" href={search}>Missouri professional license search</a> is the current source for a named licensee. Search by license number and board, and confirm the printed status and expiration. A business name alone is insufficient to attach a person&apos;s license to a contractor business.</p>
      <p>The Missouri professional registration portal offers an <a className="underline" href={downloads}>active-license download</a> for Electrical Contractors. Its file is a credential list, not a list of every general contractor operating in Missouri. The portal displayed the Electrical Contractors / ELC.ZIP selection on October 6, 2026. The download did not complete during this acquisition; therefore raw credential rows, distinct licensees, person-to-business links and net-new entities are <strong>NOT_ACQUIRED</strong>. There is no zero-count claim.</p>
      <p><a className="underline" href="https://health.mo.gov/business-professionals/lead-licensing/how-become-licensed-lead-professional-missouri">DHSS lead licensing</a> describes a separate lead abatement contractor license. <a className="underline" href="https://pr.mo.gov/apelsla-online.asp">Design professional licenses</a> belong to a different board and must remain separate. Neither a lead credential nor an architect or engineer license is general contractor authority. A license application is not an issued license. No disciplinary order was attached by name.</p>
      <h2>Evidence clock and limits</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Regulatory pages and the portal selection checked October 6, 2026. No Missouri active-license file was acquired, so no record-level source date exists here.</li>
        <li>Electrical license rows and current status observations: NOT_ACQUIRED. Statewide general contractor roster: NOT_APPLICABLE.</li>
        <li>Existing matches, new canonical entities and evidence attachments: NOT_ACQUIRED. No local or county licensing work was performed.</li>
        <li>A missing Missouri state credential does not establish that a contractor cannot work under applicable local rules.</li>
      </ul>
    </section>
  </main>;
}
