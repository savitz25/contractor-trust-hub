import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";
import discipline from "@/lib/michigan-intelligence/discipline.json";

export const metadata: Metadata = pageMetadata({
  title: "Michigan contractor licenses and disciplinary evidence",
  description: "Michigan BCC residential builder and skilled-trade license classes, public disciplinary reports, exact credential lookup, and source limitations.",
  path: "/michigan",
});

type Props = { searchParams: Promise<{ license?: string }> };
const licenseClasses = [
  ["Individual Residential Builder", "individual"],
  ["Residential Building Company", "company"],
  ["Individual Maintenance & Alteration Contractor", "individual"],
  ["Maintenance & Alteration Contractor Company", "company"],
  ["Salesperson", "individual"],
  ["Branch Office", "office"],
] as const;
const trades = ["carpentry", "concrete", "excavation", "insulation", "masonry", "siding", "roofing", "screens and storm sash", "gutters", "tile and marble", "house wrecking", "swimming pools", "basement waterproofing"];
const reportCounts = discipline.sources.map((source) => ({ ...source, count: discipline.rows.filter((row) => row.report === source.report).length }));

export default async function MichiganPage({ searchParams }: Props) {
  const params = await searchParams;
  const number = typeof params.license === "string" && /^\d{7,12}$/.test(params.license) ? params.license : "";
  const matches = number ? discipline.rows.filter((row) => row.licenseNumber === number) : [];
  const generatedAt = new Date().toISOString();
  return <main className="th-shell py-10 sm:py-14">
    <p className="cth-intel-eyebrow">Michigan / regulator evidence</p>
    <h1>Michigan contractor license and discipline research</h1>
    <p className="mt-3 max-w-3xl text-[var(--muted)]">Michigan’s Bureau of Construction Codes (BCC) licenses residential builders, maintenance and alteration contractors, and construction trades. Individual credentials, company licenses, qualifying officers, and branch offices are distinct records.</p>

    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Michigan evidence summary">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{discipline.rows.length}</strong><p className="mt-1 text-sm">Residential Builder disciplinary report rows extracted with printed credential number, date, and action</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">5</strong><p className="mt-1 text-sm">BCC reports: FY2022–FY2026 YTD, each with its own orders-served period</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">0</strong><p className="mt-1 text-sm">Company profile or enforcement attachments. No name-only joins.</p></div>
    </section>

    <section className="mt-10" id="licenses"><h2>Statewide license classes</h2><p className="mt-2 text-sm text-[var(--muted)]">These are BCC license types, not an acquired license roster. Class counts and current status are unavailable in this snapshot.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr><th className="py-2">License class</th><th>Grain</th><th>Roster</th></tr></thead><tbody>{licenseClasses.map(([name, grain]) => <tr className="border-t border-[var(--border)]" key={name}><td className="py-2">{name}</td><td>{grain}</td><td>NOT_ACQUIRED</td></tr>)}</tbody></table></div>
      <p className="mt-4 text-sm">BCC also licenses electrical and fire-alarm/sign contractors, master electricians and other electrical classes; plumbing contractors and master plumbers; mechanical contractors; and boiler installers and repairers. Their statewide rosters and class counts are <strong>NOT_ACQUIRED</strong>. <a className="underline" href="https://www.michigan.gov/lara/bureau-list/bcc/sections/licensing-section">BCC licensing classes</a>.</p>
    </section>

    <section className="mt-10" id="qualifications"><h2>M&amp;A trade qualifications</h2><p className="mt-2 text-sm">An M&amp;A license lists its approved crafts. These are qualifications on a credential, not additional contractor entities. No individual trade endorsements were acquired.</p><p className="mt-3 text-sm text-[var(--muted)]">{trades.join(" · ")}</p><a className="mt-2 inline-block text-sm underline" href="https://www.michigan.gov/lara/bureau-list/bcc/sections/licensing-section/residential-builders/lic-info/maintenance-alteration-contractor-license-information">BCC M&amp;A license information</a></section>

    <section className="mt-10" id="enforcement"><h2>Disciplinary actions</h2><p className="mt-2 text-sm">The public BCC reports use “Residential Builder” as the profession label. That label does not establish whether a license belongs to an individual or a company. The rows here are report events, not a count of licensed contractors or findings about a matched business.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th className="py-2">Report</th><th>Orders served</th><th>Extracted rows</th><th>Source</th></tr></thead><tbody>{reportCounts.map((r) => <tr key={r.report} className="border-t border-[var(--border)]"><td className="py-2">{r.report}</td><td>{r.ordersServed}</td><td>{r.count}</td><td><a className="underline" href={r.url}>BCC PDF</a></td></tr>)}</tbody></table></div>
      <form action="/michigan" className="mt-6 flex max-w-xl gap-2"><label className="sr-only" htmlFor="license">Printed BCC license number</label><input className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2" id="license" name="license" defaultValue={number} placeholder="Exact printed license number" inputMode="numeric"/><button className="rounded-xl bg-[var(--navy)] px-4 py-2 text-white">Find actions</button></form>
      {number && <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><h3>Credential {number}</h3>{matches.length ? <ul className="mt-3 space-y-3">{matches.map((row) => <li key={`${row.report}-${row.page}-${row.effectiveDate}`}><span>{row.effectiveDate}: {row.actions.join(", ")}</span> <a className="underline" href={`${discipline.sources.find((s) => s.report === row.report)?.url}#page=${row.page}`}>{row.report}, page {row.page}</a></li>)}</ul> : <p className="mt-2 text-sm">No matching row in this extracted report window. This does not establish a clean disciplinary history or license status.</p>}</div>}
    </section>

    <section className="mt-10" id="sources"><h2>Source clocks and gaps</h2><p className="mt-2 text-sm">Discipline PDFs were retrieved {discipline.retrievedAt.slice(0, 10)} UTC. Each report’s orders-served period appears above. Page generated {generatedAt}. No Michigan license roster as-of clock exists because no roster was acquired.</p><p className="mt-3 text-sm">BCC directs list requests through FOIA. The public <a className="underline" href="https://www.michigan.gov/lara/bureau-list/bcc/list-requests">list-request guidance</a> names specific license classes and formats. Accordingly: company and individual license counts, M&amp;A qualification counts, skilled-trade roster counts, and roster-to-discipline attachment counts are unavailable. The <a className="underline" href="https://aca-prod.accela.com/lara/">BCC Accela portal</a> supports live credential verification.</p><p className="mt-3 text-sm">The 192 rows are a conservative extraction requiring a printed number, report class, effective date, and action. Other report rows may be omitted; the source PDFs remain authoritative. No personal contact or residence details are published here. No canonical company was created or matched.</p><p className="mt-3 text-sm"><Link className="underline" href="/ask?q=Michigan%20builder%20license">Ask about Michigan licensing</Link></p></section>
  </main>;
}
