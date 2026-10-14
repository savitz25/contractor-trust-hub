import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";

const sources = [
  {
    title: "Vermont Division of Fire Safety licensing master list (CSV)",
    url: "https://data.vermont.gov/api/views/cy8e-89cz/rows.csv?accessType=DOWNLOAD",
  },
  {
    title: "Vermont Division of Fire Safety licensing programs",
    url: "https://firesafety.vermont.gov/licensing",
  },
  {
    title: "Vermont residential contractor registration",
    url: "https://sos.vermont.gov/residential-contractors/",
  },
  {
    title: "Residential contractor applications and renewals",
    url: "https://sos.vermont.gov/residential-contractors/apply-renew/",
  },
  {
    title: "OPR Find a Professional and profession roster downloads",
    url: "https://sos.vermont.gov/opr/find-a-professional/",
  },
];

const fireSafetyClasses = [
  ["Electrician", "4,396", "4,395"],
  ["Gas Installer", "3,017", "3,017"],
  ["Plumber", "1,982", "1,982"],
  ["Oil Installer", "969", "969"],
  ["Trade Qualified Person (TQP)", "796", "794"],
  ["Elevator Tradesman", "189", "189"],
  ["Boiler Inspector", "118", "118"],
  ["Sprinkler Designer", "53", "53"],
];

export const metadata: Metadata = pageMetadata({
  title: "Vermont contractor and trade credential evidence",
  description:
    "Vermont statewide residential contractor registration and separate Fire Safety trade license classes, with official source clocks and coverage limits.",
  path: "/vermont",
});

export default function VermontContractorPage() {
  return (
    <main className="state-page">
      <h1>Vermont contractor and trade credentials</h1>
      <p>
        Vermont does not have a universal general-contractor license. The state
        requires registration for residential contractors performing covered
        home-construction work, and separately licenses or certifies multiple
        construction-related trades through the Division of Fire Safety. These
        are distinct programs and source populations.
      </p>

      <section aria-labelledby="residential-contractors">
        <h2 id="residential-contractors">
          Residential contractor registration
        </h2>
        <p>
          OPR registration is required for residential contractors performing
          construction with an estimated value of at least $10,000, including
          labor and materials. OPR issues an individual registration when the
          contractor has no employees and a business registration when the
          contractor has employees. This is a threshold-based residential
          registration, not a general-contractor census.
        </p>
        <p>
          Current row-level OPR residential-contractor registrations and a
          frozen statewide count are <strong>NOT_ACQUIRED</strong>. OPR
          describes a public profession-roster download and lookup, but the
          official portal was unavailable to this retrieval environment. No
          roster access control was bypassed and no count is inferred.
        </p>
      </section>

      <section aria-labelledby="fire-safety-licenses">
        <h2 id="fire-safety-licenses">
          Division of Fire Safety license and certification classes
        </h2>
        <p>
          The official active-license master list was retrieved October 14,
          2026. Its source clock is October 14, 2026 at 20:00:09 UTC. The table
          reports raw source rows and distinct license-number identifiers within
          each class. Repeated identifiers remain visible in raw row counts;
          identifiers are not interpreted as unique people or companies.
        </p>
        <table>
          <caption>
            Active Vermont Division of Fire Safety records by source class
          </caption>
          <thead>
            <tr>
              <th scope="col">Source license class</th>
              <th scope="col">Raw rows</th>
              <th scope="col">Distinct license IDs</th>
            </tr>
          </thead>
          <tbody>
            {fireSafetyClasses.map(([licenseClass, rawRows, distinctIds]) => (
              <tr key={licenseClass}>
                <th scope="row">{licenseClass}</th>
                <td>{rawRows}</td>
                <td>{distinctIds}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          The source describes all records as active licenses. Electrical,
          plumbing, gas, oil, elevator, boiler, sprinkler, and TQP records
          remain in their original classes. No total across unlike license
          classes is published. Residential-contractor registrations, licensees,
          qualifying parties, applications, inspections, and discipline are not
          merged into these trade counts.
        </p>
      </section>

      <section aria-labelledby="source-clock">
        <h2 id="source-clock">Sources and coverage limits</h2>
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
          The Division of Fire Safety CSV has 11,520 raw rows across eight
          classes; the class-level counts above preserve its trade grain.
          Current OPR residential-contractor rows, application and renewal
          records, and discipline are separate and were not acquired as a dated
          roster. No local licensing is included.
        </p>
      </section>
    </main>
  );
}
