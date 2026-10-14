import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";

const sources = [
  { title: "Montana Construction Contractor License", url: "https://boards.bsd.dli.mt.gov/construction-contractor/" },
  { title: "Montana Construction Contractor Licensing Act, § 37-45-201", url: "https://leg.mt.gov/bills/mca/title_0370/chapter_0450/part_0020/section_0010/0370-0450-0020-0010.html" },
  { title: "Montana Electrical Contractor License", url: "https://boards.bsd.dli.mt.gov/electrical/" },
  { title: "Montana Board of Plumbers", url: "https://boards.bsd.dli.mt.gov/plumbers/" },
  { title: "Montana Independent Contractor Central Unit", url: "https://erd.dli.mt.gov/work-comp-regulations/montana-contractor/" },
];

export const metadata: Metadata = pageMetadata({
  title: "Montana Contractor Licensing | Contractor TrustHub",
  description: "Montana construction contractor licensing, regulated trade credentials, and source limitations, kept as separate populations.",
  path: "/montana",
});

export default function MontanaContractorPage() {
  return (
    <main className="state-page">
      <h1>Montana contractor licensing</h1>
      <p>Montana’s statewide Construction Contractor License program took effect January 1, 2026. The Construction Contractor License is its own regulatory population. Montana law also defines exemptions; an exemption is not a license.</p>
      <section aria-labelledby="construction-contractors">
        <h2 id="construction-contractors">Construction Contractor License</h2>
        <p>The Montana Department of Labor &amp; Industry administers the statewide program. Current row-level license records and counts are <strong>NOT_ACQUIRED</strong>: the official public licensee-list portal returned HTTP 403 in the preflight. No verification control was bypassed and no name-by-name search was used.</p>
        <p>Current license status, expiration, classification, and business or person grain therefore cannot be reported from the acquired evidence.</p>
      </section>
      <section aria-labelledby="other-credentials">
        <h2 id="other-credentials">Other regulated credentials are separate</h2>
        <ul>
          <li>Electrical contractor credentials are a separate population from construction contractor licenses; the electrical contractor credential is associated with a master electrician.</li>
          <li>Plumbing credentials are administered in separate license classes. They are not added to construction contractor records.</li>
          <li>Independent Contractor Central Unit (ICEC) records concern worker/person workers’ compensation status, not a Construction Contractor License or a contractor-company census.</li>
        </ul>
        <p>Row-level current counts for these credential classes are <strong>NOT_ACQUIRED</strong>. Exemptions, individual credentials, business credentials, and worker/person certificates remain distinct.</p>
      </section>
      <section aria-labelledby="discipline">
        <h2 id="discipline">Discipline and enforcement</h2>
        <p>Disciplinary or enforcement actions are separate evidence from licenses and are not used as a license census. No name-only adverse matching is presented.</p>
      </section>
      <section aria-labelledby="sources">
        <h2 id="sources">Official sources and evidence limits</h2>
        <ul>{sources.map((source) => <li key={source.url}><a href={source.url} rel="noopener noreferrer">{source.title}</a></li>)}</ul>
        <p>Source review: G-B3 Montana evidence preflight; official public licensee-list access limitation recorded in that packet. No current roster clock or source-native population row count was acquired.</p>
      </section>
    </main>
  );
}
