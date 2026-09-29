import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";
import { WI_SNAPSHOT as data } from "@/lib/wisconsin-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({ title: "Wisconsin DSPS contractor and trade credentials", description: "Wisconsin dwelling, electrical and HVAC contractor credential class counts, live DSPS verification, and public order and complaint capability.", path: "/wisconsin" });
type Props = { searchParams: Promise<{ credential?: string }> };
const fmt = (n: number) => n.toLocaleString("en-US");

export default async function WisconsinPage({ searchParams }: Props) {
  const raw = (await searchParams).credential;
  const credential = typeof raw === "string" && /^\d{2,10}\s*-\s*(?:DC|DCR|DCQ|EC|HVACCONT|HVACQ|ME|JE|PM)$/i.test(raw) ? raw : null;
  return <main className="th-shell py-10 sm:py-14">
    <p className="cth-intel-eyebrow">Wisconsin / DSPS regulator evidence</p>
    <h1>Wisconsin contractor and trade credentials</h1>
    <p className="mt-3 max-w-3xl text-[var(--muted)]">The Wisconsin Department of Safety and Professional Services (DSPS) credentials Dwelling Contractors and separate construction trades. A Dwelling Contractor credential relates to one- and two-family dwelling permits. Wisconsin does not issue one statewide commercial general-contractor license.</p>

    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Wisconsin evidence summary">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-2xl">KNOWN</strong><p className="mt-1 text-sm">Live DSPS LicensE credential verification</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(data.classes[0].active)}</strong><p className="mt-1 text-sm">Active Dwelling Contractor credentials in the DSPS class table, including in-state and out-of-state holders; not company profiles</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-2xl">KNOWN</strong><p className="mt-1 text-sm">Public DSPS order search and trade complaint intake; provider-level rows NOT_ACQUIRED</p></div>
    </section>

    <section className="mt-10" id="credentials"><h2>Published credential classes</h2>
      <p className="mt-2 text-sm">DSPS publishes <a className="underline" href={data.countsUrl}>monthly class totals</a>, dated {data.sourceDate}. These are active and inactive credential counts, not acquired licensee rows or a deduplicated Wisconsin contractor census. Business credentials and person credentials are shown separately. Status and expiration for individual credentials require <a className="underline" href={data.lookupUrl}>live LicensE verification</a>.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr><th className="py-2 pr-3">DSPS class</th><th className="pr-3">Holder grain</th><th className="pr-3">Active</th><th>Inactive</th></tr></thead><tbody>{data.classes.map(row => <tr key={row.code} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{row.label} ({row.code})</td><td className="pr-3">{row.grain}</td><td className="pr-3">{fmt(row.active)}</td><td>{fmt(row.inactive)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-sm"><strong>Dwelling Contractor Qualifier (DCQ) is a person credential.</strong> DSPS requires a Dwelling Contractor to hold or engage a qualifier for the relevant dwelling permit. The current count table duplicates its DCQ line and labels it as a firm; its count is withheld pending clarification. Qualifiers are never counted as contractor businesses.</p>
      <p className="mt-3 text-sm">DSPS lists Master and Journeyman Plumber as individual classes. A separate statewide plumbing-contractor business class was not identified in this count table; no plumbing-business total is claimed.</p>
      <p className="mt-3 text-sm">The <a className="underline" href={data.listUrl}>DSPS license-list service remains temporarily suspended</a>. Dwelling, electrical, HVAC and person-level credential rosters, exact credential numbers, names, row statuses and expiration dates are <strong>NOT_ACQUIRED</strong>. A missing row here says nothing about a contractor&apos;s license.</p>
    </section>

    <section className="mt-10" id="lookup"><h2>Verify a specific credential</h2>
      <form action="/wisconsin" className="mt-3 flex max-w-xl gap-2"><label className="sr-only" htmlFor="credential">DSPS credential number and suffix</label><input id="credential" name="credential" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2" placeholder="1234 - DC" defaultValue={credential ?? ""}/><button className="rounded-xl bg-[var(--navy)] px-4 py-2 text-white">Review source</button></form>
      {credential && <p className="mt-3 text-sm">For {credential}, check current class, status and expiration in the <a className="underline" href={data.lookupUrl}>official DSPS LicensE lookup</a>. No licensee row or disciplinary action is attached here.</p>}
    </section>

    <section className="mt-10" id="discipline"><h2>Orders and disciplinary actions</h2><p className="mt-2 text-sm">DSPS offers a <a className="underline" href={data.ordersUrl}>public Search Orders portal</a>. It cautions that not every order is formal discipline, records may change, and an appeal or stay may affect an order. A bounded 2022–2026 construction and trade order corpus is <strong>NOT_ACQUIRED</strong>; provider-level disciplinary rows and exact attachments are not counted as zero events.</p></section>
    <section className="mt-10" id="complaints"><h2>Complaints</h2><p className="mt-2 text-sm">DSPS <a className="underline" href={data.complaintsUrl}>accepts trade complaints</a> and may investigate or file discipline when warranted. Provider-level complaint rows and outcomes are <strong>NOT_ACQUIRED</strong>. A complaint is not a finding or an order.</p></section>
    <section className="mt-10" id="sources"><h2>Source clocks and limits</h2><p className="mt-2 text-sm">Credential class-count clock: {data.sourceDate}. Retrieved {data.retrievedAt}; generated {data.generatedAt}. Individual status and expiration have no snapshot clock because no licensee roster was acquired. Order dates are unavailable because no bounded order rows were acquired. The live lookup can change independently of the monthly table.</p><p className="mt-3 text-sm">Acquired business credential rows: 0; person credential rows: 0; exact disciplinary attachments: 0; name-only adverse joins: 0; new canonical companies: 0; graph writes: 0; claim eligibility changes: 0. Published class totals must not be read as zero licensees.</p><p className="mt-3 text-sm"><Link className="underline" href="/ask?q=Wisconsin%20contractor%20license">Ask about Wisconsin DSPS evidence</Link></p></section>
  </main>;
}
