import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import { KS_SNAPSHOT as data } from "@/lib/kansas-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "Kansas contractor credential research",
  description:
    "Kansas construction licensing is divided across local requirements and specific statewide credentials. State elevator directory entries are kept separate by company and person.",
  path: "/kansas",
});

export default function KansasContractorPage() {
  const n = (value: number) => value.toLocaleString("en-US");

  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">Kansas / Contractor credentials</p>
      <h1>Kansas contractor credentials</h1>
      <p className="mt-3 max-w-3xl text-lg">
        Kansas does not publish a universal statewide general-contractor license census. The
        state directs construction businesses to city and county licensing requirements, and
        specific construction trades have separate rules. This page reports the statewide
        elevator directory entries acquired; it does not turn them into a general-contractor
        population.
      </p>

      <section className="mt-8" id="elevator" aria-labelledby="elevator-heading">
        <h2 id="elevator-heading">State elevator credentials</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          Source: Kansas State Fire Marshal, {data.elevator.sourceTitle}. {data.elevator.sourceClock}.
          The directory lists licensed elevator contractors, inspectors, and mechanics. Some
          approved municipal elevator programs create jurisdiction-specific exceptions. These
          entries are directory observations, not a count of general contractors or all people
          doing elevator work statewide.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="mb-2 text-left">
              Elevator directory rows by source grain. Do not add person and company rows.
            </caption>
            <thead>
              <tr>
                <th className="pr-4 text-left">Directory class</th>
                <th className="pr-4 text-left">Rows</th>
                <th className="text-left">Grain and limit</th>
              </tr>
            </thead>
            <tbody>
              {data.elevator.rows.map((row) => (
                <tr key={row.id}>
                  <th className="py-2 pr-4 text-left font-semibold">
                    <a className="underline" href={row.sourceUrl}>
                      {row.label}
                    </a>
                  </th>
                  <td className="py-2 pr-4">{n(row.rows)}</td>
                  <td className="py-2">
                    {row.grain} SHA-256 {row.sha256}.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm">{data.elevator.exceptions}</p>
      </section>

      <section className="mt-10 max-w-3xl space-y-4 text-sm leading-relaxed" id="scope">
        <h2>Other Kansas construction licensing</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <a className="underline" href={data.sources.construction}>
              Kansas Business Center construction guide
            </a>
            : cities and counties set contractor licensing requirements; trade requirements may
            also be local. No local license populations were acquired for this page.
          </li>
          <li>
            <a className="underline" href={data.sources.roofing}>
              Attorney General roofing registration
            </a>
            : statewide registration generally applies to fee-based roofing, subject to legal
            exemptions. The directory is an interactive lookup; a bulk roster was not acquired.
          </li>
          <li>
            <a className="underline" href={data.sources.roofingDirectory}>
              Roofing directory and status definitions
            </a>
            : registration status is not an endorsement. No statewide roofer total is claimed.
          </li>
          <li>
            Statewide electrical, plumbing, mechanical/HVAC, fire-related credentials, and other
            construction profession censuses: {data.additionalStatewideTradeCensuses}.
          </li>
          <li>
            Enforcement orders: {data.enforcement}. No adverse record was joined by name.
            Existing entity matches: {data.existingMatches}. New canonical entities: {data.newCanonicalEntities}.
            Evidence attachments: {data.evidenceAttachments}. Graph writes: {data.graphWrites}.
          </li>
        </ul>
      </section>
    </main>
  );
}
