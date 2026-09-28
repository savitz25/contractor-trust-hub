import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";
import snapshot from "@/lib/connecticut-intelligence/snapshot.json";

export const metadata: Metadata = pageMetadata({
  title: "Connecticut contractor credentials and DCP decisions",
  description: "Connecticut DCP home-improvement, new-home and trade credential classes, exact eLicense verification, and recent administrative-decision evidence.",
  path: "/connecticut",
});

type Props = { searchParams: Promise<{ credential?: string }> };
const fmt = (n: number) => n.toLocaleString("en-US");
const classes = snapshot.classes.map((name) => {
  const active = snapshot.grouped.filter((row) => row.class === name && row.status === "ACTIVE");
  return {
    name,
    rows: active.reduce((n, row) => n + row.rows, 0),
    individual: active.filter((row) => row.holderType === "INDIVIDUAL").reduce((n, row) => n + row.rows, 0),
    other: active.filter((row) => row.holderType !== "INDIVIDUAL").reduce((n, row) => n + row.rows, 0),
  };
});
const count = (name: string) => classes.find((row) => row.name === name)?.rows ?? 0;

export default async function ConnecticutPage({ searchParams }: Props) {
  const params = await searchParams;
  const number = typeof params.credential === "string" && /^(?:HIC|NHC|ELC|PLM|HTG|SMT|FSP|ELV)\.\d{5,8}(?:[.-][A-Z0-9]+)?$/i.test(params.credential)
    ? params.credential.toUpperCase() : "";
  const record = number ? snapshot.core.find((row) => row.number === number) : null;
  const decisions = number ? snapshot.decisions.filter((row) => row.credentialNumber === number) : [];
  return <main className="th-shell py-10 sm:py-14">
    <p className="cth-intel-eyebrow">Connecticut / DCP regulator evidence</p>
    <h1>Connecticut contractor credentials and decisions</h1>
    <p className="mt-3 max-w-3xl text-[var(--muted)]">The Connecticut Department of Consumer Protection (DCP) registers home-improvement and new-home contractors and licenses skilled trades. A registration, a person-level trade license, and an administrative decision are different records; none is a statewide count of contractor companies.</p>

    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Connecticut evidence summary">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(count("HOME IMPROVEMENT CONTRACTOR"))}</strong><p className="mt-1 text-sm">Home Improvement Contractor credential rows with DCP status exactly ACTIVE</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(count("NEW HOME CONSTRUCTION CONTRACTOR"))}</strong><p className="mt-1 text-sm">Separate New Home Construction Contractor credential rows with status ACTIVE</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{snapshot.decisions.length}</strong><p className="mt-1 text-sm">Relevant DCP administrative-decision index rows dated 2022–2026; not a census of all enforcement</p></div>
    </section>

    <section className="mt-10" id="credentials"><h2>Statewide eLicense credential classes</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Counts are separate DCP credential-class rows whose printed status is ACTIVE. “Individual” is a person-level record even when its credential class says contractor. “Other” includes corporate and other non-individual holder types, not a deduplicated company census. The separate Home Improvement Salesperson class is not a contractor registration. DCP’s `active` flag also appears on records with other status labels; this table deliberately uses the exact ACTIVE label.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr><th className="py-2 pr-3">DCP class as printed</th><th className="pr-3">ACTIVE rows</th><th className="pr-3">Individual</th><th>Other holder types</th></tr></thead><tbody>{classes.map((row) => <tr key={row.name} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{row.name}</td><td className="pr-3">{fmt(row.rows)}</td><td className="pr-3">{fmt(row.individual)}</td><td>{fmt(row.other)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-sm">These classes are never added together. Home Improvement Contractor registration does not authorize separately licensed electrical, plumbing, heating/cooling, or other skilled-trade work. <a className="underline" href="https://portal.ct.gov/dcp/home-improvement">DCP consumer guidance</a> · <a className="underline" href={snapshot.source.url}>Official daily-updated credential dataset</a> · <a className="underline" href="https://www.elicense.ct.gov/">Current eLicense verification</a>.</p>
    </section>

    <section className="mt-10" id="credential-lookup"><h2>Exact credential lookup</h2>
      <p className="mt-2 text-sm">This snapshot stores {fmt(snapshot.core.length)} HIC/NHC rows with DCP’s `active` flag, preserving their exact status and credential dates. For skilled trades, use eLicense to verify the exact number; only class-level counts are frozen here. Person names, residential addresses and phone numbers are not republished.</p>
      <form action="/connecticut" className="mt-4 flex max-w-xl gap-2"><label className="sr-only" htmlFor="credential">Full DCP credential number</label><input id="credential" name="credential" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2" defaultValue={number} placeholder="HIC.0123456 or ELC.0123456-E1"/><button className="rounded-xl bg-[var(--navy)] px-4 py-2 text-white">Check</button></form>
      {number && <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-5"><h3>{number}</h3>{record ? <p className="mt-2 text-sm">{record.class} · holder type {record.holderType} · status {record.status} · issued {record.issueDate ?? "not printed"} · expires {record.expirationDate ?? "not printed"}{record.businessName ? ` · ${record.businessName}` : ""}</p> : <p className="mt-2 text-sm">No current-flag HIC/NHC snapshot row. This is not proof of no credential; verify current status in DCP eLicense.</p>}{decisions.length > 0 && <p className="mt-2 text-sm">{decisions.length} exact-number administrative-decision index row(s) below. A decision is not a current credential-status check.</p>}</div>}
    </section>

    <section className="mt-10" id="enforcement"><h2>DCP administrative decisions, 2022–2026</h2>
      <p className="mt-2 text-sm">The official DCP Legal Administrative Decisions index supplies case number, decision date, respondent, printed credential number and document link. {snapshot.decisions.length} relevant HIC/new-home and construction-trade index rows were captured; all {snapshot.decisions.filter((row) => row.exactCredentialMatch).length} link by exact number to the credential dataset. The index is not a census of every DCP complaint, settlement, penalty or violation. Specific outcomes and findings require reading the linked decision; they are not inferred from the index.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[670px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Date</th><th className="pr-3">Case</th><th className="pr-3">Exact credential</th><th className="pr-3">Holder class</th><th>Decision</th></tr></thead><tbody>{(number ? decisions : snapshot.decisions.slice(0, 20)).map((row) => <tr key={`${row.caseNumber}-${row.credentialNumber}-${row.decisionDate}`} className="border-t border-[var(--border)]"><td className="py-2 pr-3 whitespace-nowrap">{row.decisionDate}</td><td className="pr-3">{row.caseNumber}</td><td className="pr-3"><Link className="underline" href={`/connecticut?credential=${encodeURIComponent(row.credentialNumber ?? "") }#enforcement`}>{row.credentialNumber}</Link></td><td className="pr-3">{row.matchedClass} ({row.matchedHolderType})</td><td>{row.decisionUrl ? <a className="underline" href={row.decisionUrl}>DCP document</a> : "Index only"}</td></tr>)}</tbody></table></div>
      {!number && <p className="mt-2 text-sm text-[var(--muted)]">Showing 20 most recent index rows. Use a full credential number to see its exact rows; the <a className="underline" href={snapshot.decisionSource.url}>official index</a> contains the full bounded set.</p>}
    </section>

    <section className="mt-10" id="consumer-protection"><h2>Complaints and guaranty funds</h2><p className="mt-2 text-sm">DCP accepts <a className="underline" href="https://portal.ct.gov/dcp/trade-practices-division/home-improvement-for-consumers">home-improvement complaints</a>; provider-level complaint records and outcomes are NOT_ACQUIRED here. A complaint is not a finding. DCP administers separate <a className="underline" href="https://portal.ct.gov/dcp/consumer/guaranty-fund">Home Improvement and New Home Construction Guaranty Funds</a> for eligible consumers; provider-level payout rows are NOT_ACQUIRED. A fund claim is not automatically an enforcement finding.</p></section>

    <section className="mt-10" id="sources"><h2>Source clocks and limits</h2><p className="mt-2 text-sm">DCP credential dataset rows updated {snapshot.source.rowsUpdatedAt}; retrieved {snapshot.source.retrievedAt}. DCP decision index rows updated {snapshot.decisionSource.rowsUpdatedAt}; retrieved {snapshot.decisionSource.retrievedAt}; decision dates span {snapshot.decisionSource.windowStart} to {snapshot.decisionSource.windowEnd}. Each credential has its own issue/expiration dates. No universal Connecticut as-of date is asserted.</p><p className="mt-3 text-sm">Trade-class row-level snapshot, a comprehensive enforcement corpus, provider-level complaints and guaranty payments are NOT_ACQUIRED. There are zero name-only adverse joins, new canonical companies, graph writes or claim-eligibility changes. Exact DCP credential identity is kept separate from a canonical company identity.</p><p className="mt-3 text-sm"><Link className="underline" href="/ask?q=Connecticut%20contractor%20license">Ask about Connecticut contractor credentials</Link></p></section>
  </main>;
}
