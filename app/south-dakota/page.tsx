import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import evidence from "@/data/evidence/south-dakota-contractor-v1.json";

type ClassPopulation = {
  rowsByClass: Array<{ class: string; rows: number }>;
};
type WastewaterPopulation = {
  rows: number;
};
const populations = evidence.populations as unknown as [
  ClassPopulation,
  ClassPopulation,
  WastewaterPopulation,
];

const sources = [
  {
    title: "South Dakota Plumbing Commission: Licensed Plumbers (as of July 31, 2026)",
    url: "https://dlr.sd.gov/plumbing/documents/List_of_licensed_plumbers.pdf",
  },
  {
    title: "South Dakota Plumbing Commission: Specialty Licensees (as of February 4, 2026)",
    url: "https://dlr.sd.gov/plumbing/documents/list_of_specialty_licensees.pdf",
  },
  {
    title: "South Dakota Plumbing Commission: Small Onsite Waste Water Installers (as of July 31, 2026)",
    url: "https://dlr.sd.gov/plumbing/documents/list_of_small_wastewater.pdf",
  },
  {
    title: "South Dakota plumbing licensing information",
    url: "https://dlr.sd.gov/plumbing/licensing.aspx",
  },
  {
    title: "South Dakota Electrical Commission",
    url: "https://dlr.sd.gov/electrical/default.aspx",
  },
  {
    title: "South Dakota contractors' excise tax license",
    url: "https://dor.sd.gov/businesses/taxes/contractors-excise-tax/",
  },
];

export const metadata: Metadata = pageMetadata({
  title: "South Dakota contractor and trade credential evidence",
  description:
    "South Dakota contractor excise-tax requirements and separate statewide plumbing and specialty-trade source lists, with source clocks and status limits.",
  path: "/south-dakota",
});

function SourceRows({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ class: string; rows: number }>;
}) {
  return (
    <table>
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Source class</th>
          <th scope="col">Listed name/class rows</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.class}>
            <th scope="row">{item.class}</th>
            <td>{item.rows.toLocaleString("en-US")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SouthDakotaContractorPage() {
  const [plumbers, specialties, wastewater] = populations;

  return (
    <main className="state-page">
      <h1>South Dakota contractor and trade credentials</h1>
      <p>
        South Dakota does not present a single universal general-contractor
        competency license in the reviewed statewide sources. Contractor excise
        tax licensing, professional trade credentials, and specialist
        registrations are separate regulatory populations.
      </p>

      <section aria-labelledby="contractor-tax-license">
        <h2 id="contractor-tax-license">Contractor excise-tax license</h2>
        <p>
          The Department of Revenue requires a contractor excise-tax license for
          covered construction services. This is a tax license and is not a
          competency license or a count of all construction businesses.
          Current statewide row-level license records are <strong>NOT_ACQUIRED</strong>.
        </p>
      </section>

      <section aria-labelledby="plumbing-licensees">
        <h2 id="plumbing-licensees">Plumbing Commission source lists</h2>
        <p>
          The public plumber list is dated July 31, 2026. It reports named
          licensee rows by the Commission's displayed license type. The source
          does not expose license identifiers or a current status field; these
          are source-row observations, not verified counts of active licenses,
          distinct people, or contractor businesses.
        </p>
        <SourceRows title="Licensed Plumbers source rows by license type" rows={plumbers.rowsByClass} />
        <p>
          The separate specialty list is dated February 4, 2026 and includes
          expiration dates. Most listed dates are June 30, 2026, before this
          retrieval on October 14, 2026. The source is shown as dated
          observations; current license status is <strong>NOT_ACQUIRED</strong>.
        </p>
        <SourceRows title="Specialty Licensees source rows by license type" rows={specialties.rowsByClass} />
        <p>
          The Small Onsite Waste Water Installer list is dated July 31, 2026.
          It contains {wastewater.rows.toLocaleString("en-US")} named installer
          rows, with employer names where supplied. Person and employer fields
          remain separate; no current-status field or unique business count is
          supplied.
        </p>
      </section>

      <section aria-labelledby="other-trades">
        <h2 id="other-trades">Other statewide credentials</h2>
        <p>
          The Electrical Commission administers statewide electrical
          credentials. A current bulk electrical roster was not acquired.
          Electrical credentials are not included in the plumbing lists.
          Specialist construction and trade populations remain separate from
          contractor excise-tax licensing.
        </p>
        <p>
          Current row-level electrical credentials, contractor tax-license
          records, a general-contractor business census, and discipline records
          are <strong>NOT_ACQUIRED</strong>. The missing rosters are not zero.
        </p>
      </section>

      <section aria-labelledby="source-clock">
        <h2 id="source-clock">Authoritative sources and clocks</h2>
        <ul>
          {sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
        <p>
          The listed rows retain the regulator's source class and published
          clock. Names are not used to merge credentials or connect adverse
          findings. Plumber, specialty, onsite wastewater, electrical, tax
          license, disciplinary, and business populations are not added into a
          combined contractor total.
        </p>
      </section>
    </main>
  );
}
