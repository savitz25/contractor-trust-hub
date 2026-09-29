import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";
import data from "@/lib/maryland-intelligence/discipline.json";

export const metadata: Metadata = pageMetadata({
  title: "Maryland MHIC contractor licenses and public actions",
  description: "Verify Maryland home improvement licenses and review MHIC disciplinary orders and Guaranty Fund awards with their source dates and limits.",
  path: "/maryland",
});

type Props = { searchParams: Promise<{ license?: string }> };
const fmt = (n: number) => n.toLocaleString("en-US");
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fund = data.rows.filter((row) => row.guarantyFundAwardDollars !== null);
const total = fund.reduce((n, row) => n + (row.guarantyFundAwardDollars ?? 0), 0);
const VERIFY = "https://www.dllr.state.md.us/cgi-bin/ElectronicLicensing/OP_search/OP_search.cgi?calling_app=HIC%3A%3AHIC_qselect";

export default async function MarylandPage({ searchParams }: Props) {
  const params = await searchParams;
  const license = typeof params.license === "string" && /^(?:MHIC\s*)?(?:0[15]-)?\d{4,8}(?:-0[1-9])?$/i.test(params.license) ? params.license : "";
  return <main className="th-shell py-10 sm:py-14">
    <p className="cth-intel-eyebrow">Maryland / MHIC regulator evidence</p>
    <h1>Maryland contractor licensing and public actions</h1>
    <p className="mt-3 max-w-3xl text-[var(--muted)]">The Maryland Home Improvement Commission (MHIC), within Maryland Department of Labor, licenses home improvement contractors and salespersons separately. Verify a contractor&apos;s current license before hiring. MHIC&apos;s Home Improvement Guaranty Fund covers eligible losses tied to work by licensed contractors.</p>

    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Maryland evidence summary">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-2xl">KNOWN</strong><p className="mt-1 text-sm">MHIC active contractor and salesperson verification by exact license number or name</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(data.rows.length)}</strong><p className="mt-1 text-sm">Public MHIC action table rows, FY2022–FY2025; decree types vary</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(fund.length)}</strong><p className="mt-1 text-sm">Rows printing a Guaranty Fund award amount; {money(total)} in printed amounts, not confirmed disbursements</p></div>
    </section>

    <section className="mt-10" id="licenses"><h2>License classes and verification</h2>
      <p className="mt-2 text-sm">MHIC&apos;s <a className="underline" href={VERIFY}>public active-license search</a> supports contractor personal name, trade name, location, salesperson name and contractor license number. The statewide contractor roster, distinct license count, status and expiration snapshot are <strong>NOT_ACQUIRED</strong>; no roster clock or contractor-company count is claimed. The salesperson roster is also <strong>NOT_ACQUIRED</strong>. A <a className="underline" href="https://www.labor.maryland.gov/license/mhic/mhiclicreq.shtml">salesperson may represent up to two licensed contractors</a>; a salesperson is a person credential, not a contractor company.</p>
      <form action="/maryland" className="mt-4 flex max-w-xl gap-2"><label className="sr-only" htmlFor="license">Explicit MHIC license number</label><input id="license" name="license" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2" placeholder="MHIC license number" defaultValue={license}/><button className="rounded-xl bg-[var(--navy)] px-4 py-2 text-white">Review source</button></form>
      {license && <p className="mt-3 text-sm">For MHIC license {license}, check current status in the <a className="underline" href={VERIFY}>official MHIC search</a>. No license row was frozen here; this number is not matched to the action tables or a company.</p>}
      <p className="mt-3 text-sm">Electrical, plumbing and HVACR credentials are separate Maryland Labor classes. Their statewide rosters and counts are <strong>NOT_ACQUIRED</strong>; use <a className="underline" href="https://labor.maryland.gov/license/">Maryland Labor occupational licensing</a> for the applicable trade.</p>
    </section>

    <section className="mt-10" id="enforcement"><h2>MHIC disciplinary-action tables</h2>
      <p className="mt-2 text-sm">The <a className="underline" href={data.indexUrl}>official MHIC index</a> currently links FY2022 through FY2025 in this window. Proposed Orders, Final Orders, Proposed Decisions, combined orders and other decree types retain their printed labels. A proposed action is not presented as a final finding. These are table events, not a count of unique contractors or violations.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">{data.sources.map((source) => <a key={source.fiscalYear} className="rounded-xl border border-[var(--border)] bg-white p-4 text-sm underline" href={source.url}>FY{source.fiscalYear}: {source.rows} rows</a>)}</div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[690px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Date</th><th className="pr-3">Complaint</th><th className="pr-3">Decree as printed</th><th className="pr-3">Action summary</th><th>Case / source</th></tr></thead><tbody>{data.rows.slice(-30).reverse().map((row, i) => <tr key={`${row.fiscalYear}-${row.complaintNumber}-${i}`} className="border-t border-[var(--border)]"><td className="py-2 pr-3 whitespace-nowrap">{row.date}</td><td className="pr-3">{row.complaintNumber}</td><td className="pr-3">{row.decree}</td><td className="pr-3">{row.actionSummary}</td><td>{row.documentUrl ? <a className="underline" href={row.documentUrl}>{row.caseName}</a> : <a className="underline" href={row.sourcePage}>{row.caseName}</a>}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-sm text-[var(--muted)]">Showing the 30 latest table rows. Follow each official fiscal-year page for the complete bounded window.</p>
    </section>

    <section className="mt-10" id="guaranty"><h2>Home Improvement Guaranty Fund</h2><p className="mt-2 text-sm">The {fmt(fund.length)} award rows above preserve complaint number, case, date, decree status and printed dollar amount. A Guaranty Fund award is a compensation order, not a license revocation or a generic violation. Proposed award amounts are included in the printed total and must not be treated as paid claims. MHIC says the <a className="underline" href="https://labor.maryland.gov/license/mhic/mhicfaqgf.shtml">Fund applies to eligible losses involving licensed contractors</a>.</p></section>

    <section className="mt-10" id="complaints"><h2>Complaint histories</h2><p className="mt-2 text-sm">MHIC <a className="underline" href="https://labor.maryland.gov/license/mhic/mhiccomp.shtml">accepts complaints</a> against contractors and salespersons. <a className="underline" href="https://labor.maryland.gov/license/mhic/mhicfaqcomp.shtml">Closed complaint history is available by request</a> from MHIC. Open complaints are not publicly reportable. A bulk provider-level complaint corpus and complaint counts are <strong>NOT_ACQUIRED</strong>. A complaint is not a finding.</p></section>

    <section className="mt-10" id="sources"><h2>Source clocks and limits</h2><p className="mt-2 text-sm">MHIC active-license status requires a live search; no license roster/status snapshot clock exists here. Disciplinary source years: {data.sources.map((s) => `FY${s.fiscalYear}`).join(", ")}; individual action dates span {data.rows[0]?.date} to {data.rows.at(-1)?.date}. Guaranty Fund order dates and decree status are preserved on each row. Retrieved {data.retrievedAt}; snapshot generated {data.generatedAt}. FY2026 action table is <strong>NOT_ACQUIRED</strong> because it is not linked from the official index.</p><p className="mt-3 text-sm">The published action index lacks exact MHIC license identifiers. Exact enforcement attachments: 0; exact Guaranty Fund attachments: 0; name-only adverse joins: 0; new canonical companies: 0; graph writes: 0; claim eligibility changes: 0. Contractor, person, salesperson, action, award and complaint grains remain separate.</p><p className="mt-3 text-sm"><Link className="underline" href="/ask?q=Maryland%20contractor%20license">Ask about Maryland MHIC evidence</Link></p></section>
  </main>;
}
