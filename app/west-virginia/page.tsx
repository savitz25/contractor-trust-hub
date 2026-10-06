import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { WV_SNAPSHOT as data } from "@/lib/west-virginia-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "West Virginia contractor and elevator-inspector evidence",
  description:
    "West Virginia Division of Labor elevator inspector list, kept separate from contractor licenses, HVAC, plumbing, and manufactured housing. No combined contractor census.",
  path: "/west-virginia",
});

export default function WestVirginiaContractorPage() {
  const elev = data.elevatorInspectors;
  const n = (value: number) => value.toLocaleString("en-US");

  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">West Virginia / Division of Labor</p>
      <h1>West Virginia contractor evidence</h1>
      <p className="mt-3 max-w-3xl text-lg">
        The {data.licensingBoard} verifies contractor licenses through a search. That search was not
        acquired as a roster. The Division of Labor also publishes a current elevator-inspector
        list. An elevator inspector is not a contractor license. HVAC, plumbing, and manufactured
        housing stay separate. This page does not publish one combined contractor total.
      </p>

      <section className="mt-8" id="elevator-inspectors" aria-labelledby="wv-elevator">
        <h2 id="wv-elevator">Certified elevator inspectors</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          Source{" "}
          <a className="underline" href={elev.url}>
            {elev.title}
          </a>
          . Retrieved {data.retrievedAt}. HTTP Date {elev.httpDate}. Last-Modified {elev.httpLastModified}.
          Bytes {n(elev.bytes)}. SHA-256 {elev.sha256}. The page does not print a list-wide as-of
          date: {elev.listAsOfDate}.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="mb-2 text-left">
              Elevator-inspector rows. A person is not a company. Business-name strings were not
              resolved into companies. This list is not a contractor-license roster.
            </caption>
            <thead>
              <tr>
                <th className="pr-4 text-left">Observation</th>
                <th className="text-left">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">Inspector rows</th>
                <td className="py-2">{n(elev.inspectorRows)}</td>
              </tr>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">Distinct inspector-name strings</th>
                <td className="py-2">{n(elev.distinctInspectorNameStrings)}</td>
              </tr>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">Distinct business-name strings</th>
                <td className="py-2">{n(elev.distinctBusinessNameStrings)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed">
          Two of the {n(elev.inspectorRows)} rows include a status note on that same row. One note
          says the QEI failed to renew and the card was inactivated. One note says retired in 2024
          and will not be renewing. A status note was not removed from the row count and was not
          counted as another person. The business-name strings were not treated as resolved
          companies. An elevator inspector is not a contractor license.
        </p>
      </section>

      <section className="mt-10" id="other-credentials" aria-labelledby="wv-other">
        <h2 id="wv-other">Other credentials, not acquired</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          The contractor-license search at{" "}
          <a className="underline" href={data.verifySearchUrl}>
            wvclboard.wv.gov/verify
          </a>{" "}
          and the Division database search at{" "}
          <a className="underline" href={data.databaseSearchUrl}>
            labor.wv.gov/database-search
          </a>{" "}
          are search pages. A search page is not a bulk roster. Missing is not zero.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="mb-2 text-left">
              Separate populations. They are not added to the elevator-inspector rows.
            </caption>
            <thead>
              <tr>
                <th className="pr-4 text-left">Population</th>
                <th className="text-left">Roster</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">Contractor licenses</th>
                <td className="py-2">{data.contractorLicenseRoster}</td>
              </tr>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">HVAC certifications</th>
                <td className="py-2">{data.hvacCertificationRoster}</td>
              </tr>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">Plumbing certifications</th>
                <td className="py-2">{data.plumbingCertificationRoster}</td>
              </tr>
              <tr>
                <th className="py-2 pr-4 text-left font-semibold">Manufactured housing</th>
                <td className="py-2">{data.manufacturedHousingRoster}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 max-w-3xl space-y-4 text-sm leading-relaxed" id="limits">
        <h2>What this page does not claim</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>No combined contractor denominator is published.</li>
          <li>This page does not rank contractors.</li>
          <li>
            Net-new entities: {data.newCanonicalEntities}. Graph writes: {data.graphWrites}.
            Name-only adverse joins: {data.nameOnlyAdverseJoins}.
          </li>
          <li>
            Charleston, Morgantown, and Huntington are geography only. /west-virginia is the only
            new route. No local licensing list was collected.
          </li>
        </ul>
      </section>
    </main>
  );
}
