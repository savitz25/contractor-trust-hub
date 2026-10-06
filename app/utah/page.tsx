import type { Metadata } from "next";
import Link from "next/link";
import { UTAH_DOPL_SNAPSHOT as s } from "@/lib/utah-intelligence/snapshot";
import { pageMetadata } from "@/lib/seo/page-meta";

const fmt = (value: number) => value.toLocaleString("en-US");

export const metadata: Metadata = pageMetadata({
  title: "Utah Contractor and Trade License Evidence",
  description:
    "Utah DOPL active credential counts for contractors, electricians, and plumbers, with person/business and expiration detail clearly marked NOT_ACQUIRED.",
  path: "/utah",
});

export default function UtahContractorPage() {
  const e = s.activeLicenseeCounts.electrician;
  const p = s.activeLicenseeCounts.plumber;
  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">
        Utah / Division of Professional Licensing
      </p>
      <h1>Utah contractor and trade license evidence</h1>
      <p className="mt-3 max-w-3xl text-lg">
        The Utah Division of Professional Licensing (DOPL) issues construction
        and trade credentials. Its active-license count page reports credential
        counts as of {s.asOf}. These are counts of active licensee records by
        printed license type. They are not a deduplicated company census: a
        person may hold more than one credential, and the source count does not
        split people from businesses.
      </p>
      <p className="mt-3 max-w-3xl text-[var(--muted)]">
        Verify a specific current record with{" "}
        <a className="underline" href={s.lookup}>
          DOPL Licensee Search
        </a>
        . The Construction Business Registry (CBR) is opt-in and shows only
        active licensees who chose to appear; it is not a statewide census.
      </p>

      <section className="mt-8" aria-labelledby="contractors">
        <h2 id="contractors">Contractor credential</h2>
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-3xl">
            {fmt(s.activeLicenseeCounts.contractor)}
          </strong>
          <p className="mt-1 text-sm">
            Active DOPL licensee count for the printed Contractor credential.
            This is a count of licensees, not companies, construction
            businesses, or distinct contractor entities. License-row identifiers
            and the individual/business field were not acquired.
          </p>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="trades">
        <h2 id="trades">Electrician and plumber credentials</h2>
        <p className="mt-2 text-sm">
          Each credential count is kept separate. Apprentices, journeymen,
          masters, and residential credentials are distinct source classes. Do
          not add trade credentials to the contractor count or treat the sum as
          distinct people or businesses.
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-2 text-left font-semibold">
                Electrician active licensees
              </caption>
              <thead>
                <tr>
                  <th className="py-2 pr-3">DOPL license name</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="py-2 pr-3">Apprentice Electrician</td>
                  <td>{fmt(e.apprentice)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 pr-3">Journeyman Electrician</td>
                  <td>{fmt(e.journeyman)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 pr-3">Master Electrician</td>
                  <td>{fmt(e.master)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 pr-3">
                    Residential Journeyman Electrician
                  </td>
                  <td>{fmt(e.residentialJourneyman)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 pr-3">Residential Master Electrician</td>
                  <td>{fmt(e.residentialMaster)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-2 text-left font-semibold">
                Plumber active licensees
              </caption>
              <thead>
                <tr>
                  <th className="py-2 pr-3">DOPL license name</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="py-2 pr-3">Apprentice Plumber</td>
                  <td>{fmt(p.apprentice)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 pr-3">Journeyman Plumber</td>
                  <td>{fmt(p.journeyman)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 pr-3">Master Plumber</td>
                  <td>{fmt(p.master)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 pr-3">Residential Journeyman Plumber</td>
                  <td>{fmt(p.residentialJourneyman)}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 pr-3">Residential Master Plumber</td>
                  <td>{fmt(p.residentialMaster)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="limits">
        <h2 id="limits">Coverage and source limits</h2>
        <p className="mt-2 text-sm">
          The{" "}
          <a className="underline" href={s.source}>
            DOPL Active Licensee Count
          </a>{" "}
          page was retrieved {s.retrievedAt}. Its displayed clock is {s.asOf}.
          DOPL license-row identifiers, company/person designation, construction
          classification codes, issue dates, expiration dates, and status
          history are NOT_ACQUIRED. The counts above are limited to license
          types printed on that official page. CBR count is excluded from every
          count here because participation is opt-in.
        </p>
        <p className="mt-2 text-sm">
          Existing canonical matches: {s.existingMatches}. Net-new entities:{" "}
          {s.netNewEntities}. Evidence attachments: {s.evidenceAttachments}.
          Production graph writes: {s.graphWrites}. County and city research
          routes are not published.
        </p>
        <p className="mt-3">
          <Link className="underline" href="/verify">
            Verify a license
          </Link>
        </p>
      </section>
    </main>
  );
}
