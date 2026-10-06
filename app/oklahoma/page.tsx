import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { OK_SNAPSHOT as data } from "@/lib/oklahoma-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "Oklahoma Construction Industries Board credentials",
  description:
    "Oklahoma does not license general contractors statewide. CIB electrical, plumbing, mechanical, roofing, and inspector credentials stay separate. Bulk rosters were not acquired.",
  path: "/oklahoma",
});

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function OklahomaContractorPage() {
  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">Oklahoma / Construction Industries Board</p>
      <h1>Oklahoma Construction Industries Board</h1>
      <p className="mt-3 max-w-3xl text-lg">
        General contractors are not currently required to have a state license in Oklahoma. The Construction Industries Board regulates plumbing, electrical, mechanical, roofing, building and construction inspectors, and home inspectors. Those are separate credentials. This page does not invent a statewide general-contractor population.
      </p>
      <p className="mt-3 max-w-3xl text-[var(--muted)]">
        Confirm a current record on the <a className="underline" href={data.lookupUrl}>CIB licensee lookup</a>. Roofing uses a <a className="underline" href={data.roofingSearchUrl}>separate registration search</a>.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Oklahoma CIB summary">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-2xl">No statewide GC</strong>
          <p className="mt-1 text-sm">CIB FAQ last modified December 30, 2025. A missing statewide general-contractor license is not a count of zero businesses.</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-2xl">NOT_ACQUIRED</strong>
          <p className="mt-1 text-sm">Bulk roster for every CIB class below. The public tools are searches, not a downloaded census.</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-2xl">{money(data.bondRequirementUsd)} / {money(data.liabilityRequirementUsd)}</strong>
          <p className="mt-1 text-sm">Bond and commercial general liability required before an active plumbing, electrical, or mechanical contractor license. This is not observed coverage.</p>
        </div>
      </section>

      <section className="mt-10" id="general">
        <h2>General contracting stays outside CIB</h2>
        <p className="mt-2 text-sm">
          The <a className="underline" href={data.faqUrl}>CIB FAQ</a>, last modified {data.faqLastModified}, says general contractors are not currently required to have a state license. City and county licenses are not CIB statewide credentials. The CIB does not issue permits. A notification of work without a local permit is not a license. Other agencies, including the Corporation Commission, the Department of Labor, and the Liquefied Petroleum Gas Board, may regulate other construction work. Those rosters were not acquired.
        </p>
      </section>

      <section className="mt-10" id="credentials">
        <h2>Credential classes stay separate</h2>
        <p className="mt-2 text-sm">
          Contractor, journeyman, apprentice, inspector, and roofing registration are different levels. The renewal form publishes electrical, mechanical, and plumbing contractor and journeyman lines. The active-contractor page publishes electrical and mechanical apprentice ratios. Plumbing apprentice registration was not confirmed on the pages acquired for this sprint. Each row below has roster {data.bulkRosters}. Do not add the classes together.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">Credential</th>
                <th className="pr-3">Level</th>
                <th className="pr-3">Grain</th>
                <th className="pr-3">Where to check</th>
                <th>Bulk roster</th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)] align-top">
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="pr-3">{row.level}</td>
                  <td className="pr-3">{row.grain}</td>
                  <td className="pr-3">{row.search}</td>
                  <td>{row.roster}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm">
          Licensee lookup last modified {data.lookupLastModified}. Trade search: <a className="underline" href={data.tradeSearchUrl}>GLSuite public licensee search</a>. An application is not an issued license. An apprentice registration is not a contractor license.
        </p>
      </section>

      <section className="mt-10" id="requirements">
        <h2>Bond and insurance are requirements</h2>
        <p className="mt-2 text-sm">
          The <a className="underline" href={data.requirementsUrl}>active contractor requirements</a> page, last modified {data.requirementsLastModified}, says an active plumbing, electrical, or mechanical contractor license stays inactive until the CIB receives a {money(data.bondRequirementUsd)} corporate surety bond in the individual license holder&apos;s name and a certificate for at least {money(data.liabilityRequirementUsd)} commercial general liability. The bond must be continuous and give 30 days&apos; cancellation notice. Current bond or insurance status for any named holder is {data.observedBondOrInsurance}. Active electrical contractors must also provide proof of workers&apos; compensation coverage or an allowed exemption. That proof was not observed here.
        </p>
      </section>

      <section className="mt-10" id="geography">
        <h2>Cities are search context only</h2>
        <p className="mt-2 text-sm">
          Oklahoma City, Tulsa, Norman, Edmond, Lawton, and Broken Arrow are geography only. This page publishes no city or county route. A municipal license is not a CIB credential.
        </p>
      </section>

      <section className="mt-10" id="limits">
        <h2>What was not acquired</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Enforcement orders: {data.enforcementCorpus}. A complaint is not a finding. Complaint rows: {data.complaintCorpus}.</li>
          <li>License numbers, status, expiration, and person or business names: {data.bulkRosters}.</li>
          <li>New canonical entities: {data.newCanonicalEntities}. Graph writes: {data.graphWrites}.</li>
          <li>Retrieved {data.retrievedAt}. Page last-modified dates above are the CIB printed dates. Retrieval is not a license effective date.</li>
        </ul>
      </section>
    </main>
  );
}
