import type { Metadata } from "next";
import Link from "next/link";
import { lookupAlabamaLicense } from "@/lib/alabama-intelligence/lookup";
import { ALABAMA_INTELLIGENCE_GATE } from "@/lib/alabama-intelligence/publication";
import { AL_SNAPSHOT as data } from "@/lib/alabama-intelligence/snapshot";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Alabama general contractor licenses",
  description: ALABAMA_INTELLIGENCE_GATE.description,
  path: "/alabama",
});

type Props = { searchParams: Promise<{ license?: string }> };
const fmt = (n: number) => n.toLocaleString("en-US");

export default async function AlabamaPage({ searchParams }: Props) {
  const raw = (await searchParams).license;
  const query = typeof raw === "string" ? raw : "";
  const row = query ? lookupAlabamaLicense(query) : null;
  const mailing = data.mailingAddressStates.slice(0, 8);
  return <main className="th-shell py-10 sm:py-14">
    <p className="cth-intel-eyebrow">Alabama / Licensing Board for General Contractors</p>
    <h1>Alabama Licensing Board for General Contractors</h1>
    <p className="mt-3 max-w-3xl text-lg">This page publishes the board&apos;s <a className="underline" href={data.source.url}>FullRosterReport</a>, retrieved {data.source.retrievedAt}. The file prints no as-of date. It is one statewide board. It is not a roster of every Alabama contractor.</p>
    <p className="mt-3 max-w-3xl text-[var(--muted)]">Home builders, electrical contractors, HVAC contractors, and plumbers and gas fitters have their own boards. Those rosters were not acquired. Their absence is not a zero.</p>

    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="ALBGC roster summary">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(data.rows)}</strong><p className="mt-1 text-sm">Source rows, one license number each</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(data.explicitSubcontractorSpecialtyRows)}</strong><p className="mt-1 text-sm">Rows whose specialty text contains SUBCONTRACTOR</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(data.unclassifiedRows)}</strong><p className="mt-1 text-sm">Other rows. The source does not label these as prime contractors.</p></div>
    </section>

    <section className="mt-10" id="specialty"><h2>Specialty text</h2>
      <p className="mt-2 text-sm">Specialty stays as printed. Combined classifications and reciprocity clauses remain one specialty string. There are {fmt(data.specialtyDistinctStrings)} distinct specialty strings. Electrical, HVAC, and plumbing words in this field are ALBGC classifications, not the Electrical Contractors Board, the HVAC Board, or the Plumbers and Gas Fitters Board.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th className="py-2 pr-3">What the source supports</th><th className="pr-3">Rows</th><th>How it is identified</th></tr></thead><tbody>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Source-labelled subcontractor</td><td className="pr-3">{fmt(data.explicitSubcontractorSpecialtyRows)}</td><td>Specialty text contains SUBCONTRACTOR. Every one of these license numbers starts with S-, and every S- license has that specialty text.</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Specialty text exactly INACTIVE</td><td className="pr-3">{fmt(data.inactiveSpecialtyRows)}</td><td>Specialty text is INACTIVE. Every one of these license numbers starts with IA-. This is specialty text, not a status column.</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Other specialty text</td><td className="pr-3">{fmt(data.otherSpecialtyRows)}</td><td>Numeric license numbers. The source does not assign these rows a prime, business, or person class.</td></tr>
      </tbody></table></div>
      <p className="mt-3 text-sm">Three company names contain the word SUBCONTRACTORS and are not in the {fmt(data.explicitSubcontractorSpecialtyRows)} count, because their specialty text does not: {data.nameOnlySubcontractorText.map((item, i) => <span key={item.license}>{i ? "; " : ""}{item.license} {item.name}</span>)}.</p>
      <h3 className="mt-6 font-semibold">Most common exact specialty strings</h3>
      <p className="mt-2 text-sm">Strings below are printed at least 100 times. They are not a closed list of license classes.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Specialty text</th><th>Rows</th></tr></thead><tbody>{data.topSpecialtyStrings.map((item) => <tr key={item.specialty} className="border-t border-[var(--border)] align-top"><td className="py-2 pr-3">{item.specialty}</td><td>{fmt(item.count)}</td></tr>)}</tbody></table></div>
    </section>

    <section className="mt-10" id="bid-limit"><h2>Bid limit</h2>
      <p className="mt-2 text-sm">Bid limit is a separate attribute. It is not a license class, a status, or revenue.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Bid limit as printed</th><th>Rows</th></tr></thead><tbody>{data.bidLimits.map((item) => <tr key={item.label} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{item.label}</td><td>{fmt(item.count)}</td></tr>)}</tbody></table></div>
    </section>

    <section className="mt-10" id="grain"><h2>Grain the source does not provide</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>Business or person: {data.businessPersonGrain}. The file has one Name column.</li>
        <li>Status: {data.statusColumn}. Expiration date is present on {fmt(data.expirationDatePresent)} rows and is not treated as a status. Extension date is present on {fmt(data.extensionDatePresent)} rows.</li>
        <li>Prime contractor: {data.primeContractorLabel}.</li>
        <li>Mailing address is not a service area. The State column is the mailing address, not a second license. {fmt(mailing[0]?.count ?? 0)} rows show {mailing[0]?.value || "a blank state"}. Other mailing states stay in this same ALBGC roster.</li>
      </ul>
    </section>

    <section className="mt-10" id="lookup"><h2>Check an exact ALBGC license number</h2>
      <form action="/alabama" className="mt-3 flex max-w-xl gap-2"><label className="sr-only" htmlFor="license">ALBGC license number</label><input id="license" name="license" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2" placeholder="License number" defaultValue={query} /><button className="rounded-xl bg-[var(--navy)] px-4 py-2 text-white">Check</button></form>
      <p className="mt-2 text-xs text-[var(--muted)]">Use the license number as printed, including an S- or IA- prefix. A name is not looked up.</p>
      {query ? <div className="mt-3 text-sm">{row ? <p><strong>{row.license}</strong> {row.name}. {row.city}{row.state ? `, ${row.state}` : ""} {row.zip}. Specialty: {row.specialty || "blank"}. Bid limit: {row.bidLimit || "blank in source"}. Expiration date: {row.expiration}.{row.extension ? ` Extension date: ${row.extension}.` : ""} {/SUBCONTRACTOR/i.test(row.specialty) ? "Specialty text labels this row as a subcontractor." : "Specialty text does not label this row as a subcontractor."}</p> : <p>No ALBGC license in this snapshot is exactly {query}. That is not a clearance, and it does not say whether another Alabama board has issued a license.</p>}<p className="mt-2">Confirm the current record at the <a className="underline" href={data.source.portal}>ALBGC license search</a>.</p></div> : null}
    </section>

    <section className="mt-10" id="other-boards"><h2>Other statewide contractor boards</h2>
      <p className="mt-2 text-sm">These boards are not rows in the ALBGC file. Each public verification page found on {data.source.retrievedAt} is a search form. No bulk roster was downloaded. Row counts are unknown.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Board</th><th className="pr-3">Bulk roster</th><th className="pr-3">Rows</th><th>Grain</th></tr></thead><tbody>{data.otherBoards.map((board) => <tr key={board.id} className="border-t border-[var(--border)] align-top"><td className="py-2 pr-3"><a className="underline" href={board.site}>{board.name}</a></td><td className="pr-3">{board.bulkRoster}</td><td className="pr-3">NOT_ACQUIRED</td><td>{board.grain} {board.note}</td></tr>)}</tbody></table></div>
    </section>

    <section className="mt-10" id="sources"><h2>Source clocks and limits</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>Source: {data.regulator}, {data.source.name}, retrieved {data.source.retrievedAt}. sourceAsOf is null.</li>
        <li>Generated {data.generatedAt}. Street address, phone, and fax from the file are not republished.</li>
        <li>No discipline file was acquired.</li>
        <li>Existing canonical matches: {data.existingMatches}. Net-new canonical entities: {data.netNewCanonicalEntities}. Unresolved source rows: {fmt(data.unresolvedIdentities)}. Profile attachments: {data.profileAttachments}. Name-only adverse joins: {data.nameOnlyAdverseJoins}. Graph writes: {data.graphWrites}.</li>
        <li>No city or county pages. Birmingham, Montgomery, Huntsville, Mobile, and Tuscaloosa are not routes.</li>
      </ul>
      <p className="mt-3 text-sm"><Link className="underline" href="/ask?q=Alabama%20general%20contractor%20license">Ask about this ALBGC roster</Link></p>
    </section>
  </main>;
}
