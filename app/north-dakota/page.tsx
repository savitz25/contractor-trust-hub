import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";

const sources = [
  { title: "North Dakota Secretary of State — Contractors", url: "https://www.sos.nd.gov/business/licensing-registration/contractors" },
  { title: "North Dakota FirstStop contractor search", url: "https://firststop.sos.nd.gov/search/contractor" },
  { title: "North Dakota State Electrical Board", url: "https://www.ndseb.com/" },
  { title: "North Dakota State Plumbing Board", url: "https://www.ndplumbingboard.gov/" },
  { title: "North Dakota Department of Environmental Quality — asbestos program", url: "https://deq.nd.gov/WM/asbestos/" },
];

export const metadata: Metadata = pageMetadata({
  title: "North Dakota Contractor Licensing | Contractor TrustHub",
  description: "North Dakota statewide contractor licensing framework, FirstStop roster access, and separate trade credentials, with current row-level counts marked NOT_ACQUIRED.",
  path: "/north-dakota",
});

export default function NorthDakotaContractorPage() {
  return (
    <main className="state-page">
      <h1>North Dakota contractor licensing</h1>
      <p>North Dakota requires a state contractor license for construction work when the cost, value, or price of a job exceeds $4,000. The Secretary of State administers this statewide contractor-license population, including general contractors, subcontractors, public contractors, and nonresident contractors.</p>

      <section aria-labelledby="contractor-license">
        <h2 id="contractor-license">Secretary of State contractor license</h2>
        <p>The state publishes Class A, B, C, and D license classes based on contract value per job. Contractor licenses renew annually on or before March 1. These are license-class categories, not separate specialties to add into a total.</p>
        <p>The official FirstStop portal provides a contractor search. Its public search page was reachable during this retrieval, but no downloadable statewide roster was available through the source page. Current license rows, distinct licensees, status distribution, and expiration population are <strong>NOT_ACQUIRED</strong>; no zero or estimated count is asserted.</p>
        <p>The available source describes a license issued to the contractor and requires alignment with a business registration when applicable. Without acquired roster rows, this publication cannot reliably classify each license record as a person or business.</p>
      </section>

      <section aria-labelledby="specialty-credentials">
        <h2 id="specialty-credentials">Specialty credentials remain separate</h2>
        <ul>
          <li>Electrical licenses are administered by the North Dakota State Electrical Board.</li>
          <li>Plumbing licenses are administered by the North Dakota State Plumbing Board.</li>
          <li>Asbestos abatement licenses and permits are administered separately by the Department of Environmental Quality.</li>
        </ul>
        <p>These specialty credentials are not the Secretary of State contractor license. Their populations are not combined with the construction-contractor population.</p>
        <p>The DEQ asbestos page reports 55 licensed companies and more than 600 certified persons across asbestos disciplines. This is the regulator page's undated summary observed October 14, 2026, not a row-level current roster. Company licenses and person certificates remain separate grains; no total is calculated from them.</p>
      </section>

      <section aria-labelledby="separate-evidence">
        <h2 id="separate-evidence">Other records are not license counts</h2>
        <p>Business registration, contractor licensing, specialty credentials, complaints, and discipline are separate source populations. Insurance documentation submitted with a license application is a requirement, not independent evidence of current insurance coverage. The NDDOT registered-contractor list concerns its own transportation-construction program and is not used as a statewide general-contractor census.</p>
      </section>

      <section aria-labelledby="sources">
        <h2 id="sources">Official sources and clocks</h2>
        <ul>
          {sources.map((source) => (
            <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>
          ))}
        </ul>
        <p>Secretary of State contractor framework and FirstStop search checked October 14, 2026. No license roster rows, distinct licensees, current statuses, specialty-license rows, complaint counts, or discipline counts were acquired.</p>
      </section>
    </main>
  );
}
