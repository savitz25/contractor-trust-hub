import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";
import { IN_DISCIPLINE as disc, IN_PLUMBING_LICENSE, IN_SNAPSHOT as data } from "@/lib/indiana-intelligence/snapshot";
import { indianaDisciplineRows } from "@/lib/ask/indiana";

export const metadata: Metadata = pageMetadata({
  title: "Indiana contractor licensing: statewide plumbing credentials",
  description: "Indiana licenses plumbers as its only statewide construction contractors. Plumbing Commission class totals, business and person grain, discipline documents, and the local licensing boundary.",
  path: "/indiana",
});

type Props = { searchParams: Promise<{ license?: string }> };
const fmt = (n: number) => n.toLocaleString("en-US");
const LABEL: Record<string, string> = {
  final_order: "Findings of Fact and Order",
  board_probation_on_application: "Probation issued on application or renewal",
  administrative_charging_complaint: "Administrative complaint (charging document)",
  procedural: "Procedural filings (hearing notices, motions, show-cause, proposed default or settlement, exhibits)",
};

export default async function IndianaPage({ searchParams }: Props) {
  const raw = (await searchParams).license;
  const match = typeof raw === "string" ? raw.match(IN_PLUMBING_LICENSE) : null;
  const license = match && match[0].replace(/[\s-]+/g, "").length === raw!.replace(/[\s-]+/g, "").length ? `${match[1].toUpperCase()}${match[2]}` : null;
  const matched = license ? indianaDisciplineRows(license) : [];
  const s = disc.summary;
  const business = disc.rows.filter((row) => row.grain === "business");
  return <main className="th-shell py-10 sm:py-14">
    <p className="cth-intel-eyebrow">Indiana / Professional Licensing Agency evidence</p>
    <h1>Indiana contractor licensing</h1>
    <p className="mt-3 max-w-3xl text-lg"><strong>Indiana does not license most construction contractors statewide.</strong> The state&apos;s <a className="underline" href={data.businessGuideUrl}>Business Owner&apos;s Guide</a> says: &ldquo;{data.structuralRule}&rdquo; General, electrical and HVAC contractors are commonly licensed by cities and counties, not by the state.</p>
    <p className="mt-3 max-w-3xl text-[var(--muted)]">This page covers the statewide layer that exists: the Indiana Plumbing Commission within the Professional Licensing Agency (PLA). A missing statewide general, electrical or HVAC roster is a structural fact, not a zero.</p>

    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Indiana evidence summary">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(data.professionTotal.indiana)}</strong><p className="mt-1 text-sm">Active Plumbing Commission licenses at Indiana addresses in PLA&apos;s Active Licenses view (classes listed below; Plumbing Contractor not shown there)</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(s.documentRows)}</strong><p className="mt-1 text-sm">Plumbing Commission discipline documents dated 2022–2026, attached only by exact license number</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-2xl">LOCAL</strong><p className="mt-1 text-sm">General, electrical and HVAC contractor licensing: exists locally, out of scope here</p></div>
    </section>

    <section className="mt-10" id="plumbing"><h2>Statewide plumbing credentials</h2>
      <p className="mt-2 text-sm">Counts are active-license class totals displayed in PLA&apos;s public <a className="underline" href={data.activeLicensesUrl}>Indiana Active Licenses</a> view, observed {data.activeClock.observedAt}; the view states no as-of date. They are not acquired licensee rows or a deduplicated contractor census, and they are never summed into &ldquo;Indiana contractors.&rdquo;</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th className="py-2 pr-3">PLA license type</th><th className="pr-3">Holder grain</th><th className="pr-3">Active, Indiana address</th><th className="pr-3">Active, out of state</th><th>Note</th></tr></thead><tbody>{data.classes.map((row) => <tr key={row.label} className="border-t border-[var(--border)] align-top"><td className="py-2 pr-3">{row.label}</td><td className="pr-3">{row.grain}</td><td className="pr-3">{row.indiana === null ? "NOT_ACQUIRED" : fmt(row.indiana)}</td><td className="pr-3">{row.outOfState === null ? "NOT_ACQUIRED" : fmt(row.outOfState)}</td><td>{row.note}</td></tr>)}</tbody></table></div>
      <h3 className="mt-6 font-semibold">Business versus person</h3>
      <p className="mt-2 text-sm"><strong>A Plumbing Contractor license is held by an individual.</strong> A corporation engaged in the plumbing contracting business must hold its own Plumbing Corporation license and be associated with a licensed Plumbing Contractor. Journeyman Plumbers and Apprentices are individual credentials, not contracting businesses. ContractorTrustHub does not convert licensed individuals into companies or create company identities from qualifier data.</p>
      <p className="mt-3 text-sm">Licensee rows, names, numbers, row-level status, issue dates and expirations are <strong>NOT_ACQUIRED</strong>. PLA&apos;s <a className="underline" href={data.verifyUrl}>Free Search &amp; Verify</a> checks one record at a time behind a CAPTCHA, and its <a className="underline" href={data.downloadUrl}>bulk license files</a> are a paid download that was not purchased. PLA also offers <a className="underline" href={data.licenseWatchUrl}>LicenseWatch</a>.</p>
    </section>

    <section className="mt-10" id="lookup"><h2>Check an exact plumbing license</h2>
      <form action="/indiana" className="mt-3 flex max-w-xl gap-2"><label className="sr-only" htmlFor="license">PLA plumbing license number</label><input id="license" name="license" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2" placeholder="PC12345678" defaultValue={license ?? ""}/><button className="rounded-xl bg-[var(--navy)] px-4 py-2 text-white">Check</button></form>
      <p className="mt-2 text-xs text-[var(--muted)]">Use the PLA prefix (PC, JP, PA or CO) and eight digits. Bare numbers are not matched.</p>
      {license && <div className="mt-3 text-sm">{matched.length ? <><p>{matched.length} Plumbing Commission discipline document{matched.length === 1 ? "" : "s"} dated 2022–2026 carry exactly {license}. <a className="underline" href={`https://www.in.gov/apps/pla/litigation/pdfs.aspx?lic=${license}`}>Open the PLA documents for {license}</a>.</p><ul className="mt-2 list-disc pl-5">{matched.map((row, i) => <li key={i}>{row.date}: {row.documentType} ({row.credentialClass})</li>)}</ul></> : <p>No 2022–2026 Plumbing Commission discipline document in this snapshot carries exactly {license}. That is not a clearance.</p>}<p className="mt-2">Confirm current class, status and expiration in <a className="underline" href={data.verifyUrl}>PLA Search &amp; Verify</a>.</p></div>}
    </section>

    <section className="mt-10" id="discipline"><h2>Plumbing Commission discipline, 2022–2026</h2>
      <p className="mt-2 text-sm">From PLA&apos;s public <a className="underline" href={data.disciplineUrl}>Discipline Search</a> (Board = Plumbing Commission, {disc.source.window[0]} to {disc.source.window[1]}), retrieved {disc.retrievedAt.slice(0, 10)}. PLA refreshes this information weekly and notes that most board actions take effect only when a written order is issued. {s.documentRows} documents cite {s.distinctLicenses} distinct license numbers. Each document names an exact license; nothing is attached by name.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Document category</th><th>Rows</th></tr></thead><tbody>{Object.entries(s.rowsByCategory).map(([k, v]) => <tr key={k} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{LABEL[k]}</td><td>{fmt(v)}</td></tr>)}</tbody></table></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Credential class (from license prefix)</th><th className="pr-3">Documents</th><th className="pr-3">Final orders</th><th>Distinct licenses</th></tr></thead><tbody>{Object.entries(s.rowsByClass).map(([k, v]) => <tr key={k} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{k}</td><td className="pr-3">{fmt(v)}</td><td className="pr-3">{fmt((s.finalOrderRowsByClass as Record<string, number>)[k] ?? 0)}</td><td>{fmt((s.distinctLicensesByClass as Record<string, number>)[k] ?? 0)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-sm">An administrative complaint is a charging document, not a finding; procedural filings are not outcomes. The Discipline Search does not print a credential class, so classes are read from the license prefix. Individual respondents are not named here; check an exact license above.</p>
      <p className="mt-3 text-sm">Plumbing Corporation (business) documents: {business.map((row, i) => <span key={i}>{i ? "; " : ""}{row.licenseNumber} — {row.date}, <a className="underline" href={`https://www.in.gov/apps/pla/litigation/viewer.aspx?id=${row.documentId}`}>{row.documentType}</a></span>)}.</p>
    </section>

    <section className="mt-10" id="public-works"><h2>State public-works prequalification</h2><p className="mt-2 text-sm">The IDOA <a className="underline" href={data.publicWorksUrl}>Public Works Certification Board</a> prequalifies contractors and subcontractors before they bid on state public-works contracts valued at more than $150,000. Prequalification is a bidding eligibility status, <strong>not a contractor license</strong>. IDOA&apos;s Certified Contractors Lookup is filter-driven and describes its list as a reference, not final; its list service failed during retrieval. Prequalification rows and counts are <strong>NOT_ACQUIRED</strong>.</p></section>

    <section className="mt-10" id="complaints"><h2>Complaints</h2><p className="mt-2 text-sm">PLA accepts <a className="underline" href={data.complaintUrl}>complaints about licensed professionals</a>. Complaint intake is KNOWN; provider-level complaint rows and outcomes are <strong>NOT_ACQUIRED</strong> (available, if at all, through a public records request). A complaint is not a disciplinary finding.</p></section>

    <section className="mt-10" id="local-licensing"><h2>Local contractor licensing boundary</h2><p className="mt-2 text-sm">LOCAL_CONTRACTOR_LICENSING = EXISTS / OUT_OF_SCOPE. Cities and counties such as Indianapolis, Fort Wayne, Evansville and South Bend run their own contractor licensing and permitting. ContractorTrustHub does not ingest those rosters, publish city pages, or infer a local license from state data. Check the local government where the work is done.</p></section>

    <section className="mt-10" id="sources"><h2>Source clocks and limits</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>Active-license class totals: PLA Active Licenses view, observed {data.activeClock.observedAt}; no as-of date shown.</li>
        <li>License verification: live at PLA (real time); no licensee snapshot, so no row status or expiration clock.</li>
        <li>Discipline: document dates {disc.rows[0]?.date} to {disc.rows[disc.rows.length - 1]?.date}; retrieved {disc.retrievedAt.slice(0, 10)}.</li>
        <li>Public-works list: no clock (not acquired). Generated {data.generatedAt}.</li>
      </ul>
      <p className="mt-3 text-sm">Business plumbing credential rows: 0; person plumbing credential rows: 0; public-works rows: 0; discipline documents: {s.documentRows} ({s.rowsByGrain.business} business, {s.rowsByGrain.person} person); profile attachments: {disc.limits.exactProfileAttachments}; name-only adverse joins: {disc.limits.nameOnlyAdverseJoins}; new canonical companies: {data.newCanonicalCompanies}; graph writes: {data.graphWrites}; claim eligibility changes: {data.claimEligibilityChanges}.</p>
      <p className="mt-3 text-sm"><Link className="underline" href="/ask?q=Indiana%20plumbing%20contractor%20license">Ask about Indiana plumbing evidence</Link></p>
    </section>
  </main>;
}
