import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { SC_CLB_CATEGORIES, SC_RBC_CATEGORIES, SC_SNAPSHOT as data } from "@/lib/south-carolina-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "South Carolina LLR contractor board evidence",
  description:
    "South Carolina licenses commercial and residential construction through two LLR boards. The FY2025 annual report prints category counts. It is not one contractor census, and the license-row roster was not acquired.",
  path: "/south-carolina",
});

const fmt = (n: number) => n.toLocaleString("en-US");

export default function SouthCarolinaPage() {
  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">South Carolina / LLR regulator evidence</p>
      <h1>South Carolina contractor board evidence</h1>
      <p className="mt-3 max-w-3xl text-[var(--muted)]">
        The Department of Labor, Licensing and Regulation uses two boards. The Contractor&apos;s Licensing Board covers general and mechanical contracting, alarm businesses, and fire sprinkler contractors. The Residential Builders Commission covers residential builders, residential specialty trades, and firm certificates of authorization. Those boards are not one statewide contractor census.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="South Carolina evidence summary">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-3xl">{fmt(data.generalContractorRows)}</strong>
          <p className="mt-1 text-sm">General Contractor category rows on the Contractor&apos;s Licensing Board. Not a company count.</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-3xl">{fmt(data.mechanicalContractorRows)}</strong>
          <p className="mt-1 text-sm">Mechanical Contractor category rows. Electrical, plumbing, and HVAC classifications are not split on this table.</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-3xl">{fmt(data.homeBuildersRows)}</strong>
          <p className="mt-1 text-sm">Residential Home Builders category rows. Kept separate from the commercial board.</p>
        </div>
      </section>

      <section className="mt-10" id="boards">
        <h2>FY2025 annual report, two boards</h2>
        <p className="mt-2 text-sm">
          Source: <a className="underline" href={data.reportUrl}>{data.reportTitle}</a>, {data.reportPeriodStart} through {data.reportPeriodEnd}. Commercial statute {data.clbStatute}. Residential statute {data.rbcStatute}. The public lookup at <a className="underline" href={data.searchUrl}>verify.llronline.com</a> is search-only. No license-row roster was acquired. A residential licensee-list CD is offered for a fee on the <a className="underline" href={data.residentialListPage}>commission licensure page</a>. That request was {data.licenseeListRequest}.
        </p>
        <h3 className="mt-6 text-lg font-semibold">Contractor&apos;s Licensing Board</h3>
        <p className="mt-2 text-sm">
          The report prints a board total of {fmt(data.clbPrintedTotal)}. The listed category rows add to {fmt(data.clbListedCategorySum)}. Those two numbers are not equal, so neither one is treated as a corrected census. A qualifying party is not a contractor license. An alarm registered employee is not a company. Alarm and fire-sprinkler rows stay on this board and are not residential specialty licenses.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">Printed category</th>
                <th className="pr-3">Grain</th>
                <th>Rows</th>
              </tr>
            </thead>
            <tbody>
              {SC_CLB_CATEGORIES.map((row) => (
                <tr key={row.label} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="pr-3">{row.grain}</td>
                  <td>{fmt(row.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-6 text-lg font-semibold">Residential Builders Commission</h3>
        <p className="mt-2 text-sm">
          The report prints a commission total of {fmt(data.rbcPrintedTotal)}. The readable category rows below add to {fmt(data.rbcReadableCategorySum)}. The Home Inspector cell prints &quot;1,60&quot;, which is not a complete number, so it is not given a count. Residential electrical, HVAC, and plumbing rows are this commission&apos;s specialty licenses. They are not the Mechanical Contractor rows above. Specialty registrations are not the same credential as a residential builder license. A certificate of authorization is a firm record.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">Printed category</th>
                <th className="pr-3">Grain</th>
                <th>Rows</th>
              </tr>
            </thead>
            <tbody>
              {SC_RBC_CATEGORIES.map((row) => (
                <tr key={row.label} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="pr-3">{row.grain}</td>
                  <td>{fmt(row.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10" id="complaints">
        <h2>Complaints are not findings</h2>
        <p className="mt-2 text-sm">
          Contractor&apos;s Licensing Board: {fmt(data.clbComplaintsReceived)} complaints received, {fmt(data.clbInvestigations)} investigations, {fmt(data.clbDispositions)} dispositions. Residential Builders Commission: {fmt(data.rbcComplaintsReceived)} complaints received, {fmt(data.rbcInvestigations)} investigations, {fmt(data.rbcDispositions)} dispositions. A complaint is not a violation. A disposition is not a finding. The report does not print status, classification letters, expiration, or whether a contractor row is a business or a person.
        </p>
      </section>

      <section className="mt-10" id="geography">
        <h2>Local licenses stay local</h2>
        <p className="mt-2 text-sm">
          Charleston, Columbia, and Greenville are search context only. This page publishes no city or county route. A city or county business license is not an LLR credential. The Building Codes Council count was not used. No canonical company was created. Graph writes: {data.graphWrites}.
        </p>
      </section>

      <section className="mt-10" id="clocks">
        <h2>Source clocks</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Report period {data.reportPeriodStart} through {data.reportPeriodEnd}. That period is not a single roster effective date.</li>
          <li>Report retrieved {data.retrievedAt}. Page published {data.publishedAt}. Retrieval is not the license effective date.</li>
          <li>License-row roster: {data.licenseRoster}. Licensee-list request: {data.licenseeListRequest}.</li>
          <li>Classifications and expiration: {data.classifications}. Business versus person on contractor rows: {data.businessVersusPersonOnContractorRows}.</li>
        </ul>
      </section>
    </main>
  );
}
