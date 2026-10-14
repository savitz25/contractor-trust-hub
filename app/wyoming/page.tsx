import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";

const sources = [
  {
    title: "Wyoming Secretary of State contractor licensing FAQ",
    url: "https://sos.wyo.gov/FAQS.aspx?root=BUS",
  },
  {
    title: "Wyoming State Fire Marshal electrical licensing",
    url: "https://wsfm.wyo.gov/electrical-safety/licensing",
  },
  {
    title: "Electrical licensing public portal",
    url: "https://wyelectrician.imagetrendlicense.com/lms/public/portal",
  },
  {
    title: "Wyoming DWS resident contractor certificate program",
    url: "https://dws.wyo.gov/dws-division/labor-standards/resident-contractor-resources/",
  },
];

export const metadata: Metadata = pageMetadata({
  title: "Wyoming contractor and trade credential evidence",
  description:
    "Wyoming statewide electrical credentials and the limits of contractor licensing, kept separate by licensee and business class.",
  path: "/wyoming",
});

export default function WyomingContractorPage() {
  return (
    <main className="state-page">
      <h1>Wyoming contractor and trade credentials</h1>
      <p>
        Wyoming does not issue a universal statewide general-contractor license. The Secretary of
        State directs general-contractor licensing questions to local jurisdictions; no local
        licensing survey is included here.
      </p>
      <section aria-labelledby="electrical">
        <h2 id="electrical">State electrical credentials</h2>
        <p>
          The State Fire Marshal administers statewide electrical licensing. Its credential classes
          include individual technician, journeyman, and master licensees, as well as electrical
          contractor businesses. A contractor business has a qualifying-person requirement; the
          qualifying person and business are different records. Current roster rows and counts by
          class are <strong>NOT_ACQUIRED</strong>; the regulator links a public portal, but no
          dated bulk export was acquired in this pass.
        </p>
      </section>
      <section aria-labelledby="other-programs">
        <h2 id="other-programs">Other statewide programs</h2>
        <p>
          The Department of Workforce Services Resident Contractor Certificate is a public-works
          preference program, not a construction license. It is not counted as a contractor
          credential population. No statewide general-contractor roster or universal license count
          is inferred.
        </p>
      </section>
      <section aria-labelledby="boundaries">
        <h2 id="boundaries">Keep the grains separate</h2>
        <ul>
          <li>Electrical contractor businesses are separate from technicians, journeymen, and masters.</li>
          <li>A qualifying party does not become a second business license.</li>
          <li>Local building permits and local contractor rules are outside this statewide review.</li>
          <li>Applications, licenses, inspections, and discipline are separate observations.</li>
        </ul>
      </section>
      <section aria-labelledby="sources">
        <h2 id="sources">Official sources and clocks</h2>
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
          State pages and live portal checked October 14, 2026. No dated electrical roster was
          acquired. No local jurisdiction data is included.
        </p>
      </section>
    </main>
  );
}
