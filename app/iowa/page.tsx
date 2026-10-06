import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import snapshot from "@/data/iowa/ia-con-001/registration-snapshot.json";

export const metadata: Metadata = pageMetadata({
  title: "Iowa contractor registration and trade credentials",
  description: "Research Iowa's statewide construction contractor registrations separately from plumbing, mechanical, and electrical trade licenses.",
  path: "/iowa",
});

export default function IowaContractorPage() {
  return <main className="th-shell py-10 sm:py-14">
    <p className="cth-intel-eyebrow">Iowa / Department of Inspections, Appeals, and Licensing</p>
    <h1>Iowa contractor registration and trade credentials</h1>
    <p className="mt-3 max-w-3xl text-lg">Iowa requires construction contractors meeting the statutory $2,000 annual construction threshold to register with the state. Registration is a filing, not a plumbing, mechanical, or electrical license, a quality rating, or proof of current insurance.</p>

    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Iowa credential scope">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong>{snapshot.distinctRegistrationNumbers.toLocaleString("en-US")}</strong><p className="mt-2 text-sm">Distinct active registration numbers in {snapshot.rawRows.toLocaleString("en-US")} DIAL export rows. The release includes both individuals and businesses; this is not a count of distinct businesses.</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong>Separate trade licenses</strong><p className="mt-2 text-sm">Plumbing and mechanical contractors have a separate state contractor license requirement. Electrical credentials follow their own board rules. A registration does not establish either license.</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong>Source clock</strong><p className="mt-2 text-sm">Export retrieved {snapshot.retrievedAt.slice(0, 10)} UTC. The export has no single dataset-wide effective date. Recheck a named registration and trade license before hiring.</p></div>
    </section>

    <section className="mt-10 max-w-3xl space-y-4 text-sm leading-relaxed">
      <h2>Verify each credential at its own grain</h2>
      <p>The <a className="underline" href={snapshot.catalog}>DIAL active construction contractor registration dataset</a> is filtered to active registrations and updated by the state. Its registration number is the record key. The source includes business-name fields and person-name fields; a name alone does not establish whether two records belong to one business or link a trade license to a registration.</p>
      <p><a className="underline" href="https://dial.iowa.gov/licenses/building/contractors">DIAL contractor guidance</a> explains the construction threshold. <a className="underline" href="https://dial.iowa.gov/licenses/building/plumbing-mechanical/plumbing-licensure/contractor-license">DIAL plumbing and mechanical contractor licensing</a> describes a distinct state license. Electrical credentials, disciplinary actions, and insurance observations have not been acquired as statewide populations for this page.</p>
      <h2>Evidence and limits</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Raw release: {snapshot.rawRows.toLocaleString("en-US")} rows, {snapshot.distinctRegistrationNumbers.toLocaleString("en-US")} distinct registration numbers; SHA-256 {snapshot.downloadSha256}.</li>
        <li>Trade license rows and distinct trade licensees: NOT_ACQUIRED. Registration and trade license counts must not be added into one contractor total.</li>
        <li>Existing canonical matches and net-new entities: NOT_ACQUIRED. Graph writes and record-level attachments from this publication: 0.</li>
      </ul>
    </section>
  </main>;
}
