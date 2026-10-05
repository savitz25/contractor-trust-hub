import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { KY_SNAPSHOT as data } from "@/lib/kentucky-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "Kentucky DHBC specialty contractor evidence",
  description:
    "Kentucky does not issue a statewide general contractor license. DHBC electrical, HVAC, and plumbing business licenses stay separate in the recorded production Verify load.",
  path: "/kentucky",
});

const fmt = (n: number) => n.toLocaleString("en-US");

export default function KentuckyPage() {
  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">Kentucky / DHBC regulator evidence</p>
      <h1>Kentucky specialty contractor evidence</h1>
      <p className="mt-3 max-w-3xl text-[var(--muted)]">
        Kentucky does not issue a statewide general contractor license. The Department of Housing, Buildings and Construction licenses specialty trades. The live Verify product already holds three business-license classes. This page cites that recorded load. It does not add a new roster.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Kentucky evidence summary">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-2xl">No statewide GC</strong>
          <p className="mt-1 text-sm">A city or county permit is not a DHBC statewide license.</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-3xl">{fmt(data.recordedLicenseRows)}</strong>
          <p className="mt-1 text-sm">Recorded Active license rows across three classes. Not a company census and not re-extracted on {data.publishedAt}.</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-2xl">NOT_ACQUIRED</strong>
          <p className="mt-1 text-sm">Fire credentials, manufactured housing, discipline, and local license rosters</p>
        </div>
      </section>

      <section className="mt-10" id="credentials">
        <h2>Business-license classes, counted separately</h2>
        <p className="mt-2 text-sm">
          Source: {data.productRecord}. {data.productRecordNote} Official search: <a className="underline" href={data.searchUrl}>DHBC licensee list</a>. Existing Verify: <a className="underline" href={data.verifyPath}>/verify?state=ky</a>.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">License class</th>
                <th className="pr-3">Code</th>
                <th className="pr-3">Status</th>
                <th className="pr-3">Recorded rows</th>
                <th>Sample key</th>
              </tr>
            </thead>
            <tbody>
              {data.classes.map((row) => (
                <tr key={row.code} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="pr-3">{row.code}</td>
                  <td className="pr-3">{row.status}</td>
                  <td className="pr-3">{fmt(row.rows)}</td>
                  <td>{row.sampleKey}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm">
          The {fmt(data.recordedLicenseRows)} figure adds the three recorded license-row counts. It is not a count of Kentucky companies, and it is not a count of every construction credential in the state. Master Electrician individuals, apprentices, journeymen, and inspectors are outside this load. Fire credentials and manufactured-housing credentials were not acquired for this page.
        </p>
      </section>

      <section className="mt-10" id="geography">
        <h2>Local licenses stay local</h2>
        <p className="mt-2 text-sm">
          Louisville and Lexington are search context only. This page publishes no city or county route. A municipal contractor list is not the DHBC statewide load. No open-records request was filed. The public request path is <a className="underline" href={data.openRecordsUrl}>Kentucky open records</a>.
        </p>
      </section>

      <section className="mt-10" id="limits">
        <h2>What this page does not claim</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Discipline and enforcement rows: {data.discipline}.</li>
          <li>List-view classifications, bond, insurance, and street address: {data.classificationsOnListView}.</li>
          <li>New canonical companies: {data.newCanonicalCompanies}. Graph writes: {data.graphWrites}.</li>
          <li>Publication date {data.publishedAt}. That date is when this page was published. It is not a new roster effective date.</li>
        </ul>
      </section>
    </main>
  );
}
