import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import fixture from "@/data/preview/contractor-credential-lookup.json";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Credential lookup preview",
  robots: { index: false, follow: false },
};

type Params = Promise<{ q?: string; jurisdiction?: string; type?: string; record?: string }>;

function detailUrl(recordId: string, q: string, jurisdiction: string, type: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (jurisdiction) params.set("jurisdiction", jurisdiction);
  if (type) params.set("type", type);
  params.set("record", recordId);
  return `/credential-lookup-preview?${params.toString()}`;
}

export default async function CredentialLookupPreview({ searchParams }: { searchParams: Params }) {
  // This route is intentionally unavailable on production builds and deployments.
  if (process.env.NODE_ENV !== "development") notFound();
  const sp = await searchParams;
  const q = (sp.q || "").trim().toLocaleLowerCase();
  const jurisdiction = sp.jurisdiction || "";
  const type = sp.type || "";
  const rows = fixture.filter((row) =>
    (!jurisdiction || row.jurisdiction === jurisdiction) &&
    (!type || row.dataset === type) &&
    (!q || [row.native_id, row.holder_text, row.label, row.credential_type, row.jurisdiction]
      .some((value) => value.toLocaleLowerCase().includes(q)))
  );
  const selected = rows.find((row) => row.id === sp.record) || rows[0];
  const jurisdictions = [...new Set(fixture.map((row) => row.jurisdiction))];
  const types = [...new Map(fixture.map((row) => [row.dataset, row.label])).entries()];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Local Founder preview · certified fixtures</p>
      <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">Regulatory credential lookup</h1>
      <p className="mt-3 max-w-3xl text-[var(--muted)]">
        Search source records by credential number, holder text, jurisdiction, or type. These examples are not canonical business profiles.
      </p>
      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text)]">
        <strong>Credential record — not a verified canonical business profile.</strong> The six results below are representative preview fixtures, not a complete public search index.
      </div>

      <form action="/credential-lookup-preview" method="get" role="search" className="mt-7 grid gap-3 rounded-2xl border border-[var(--border)] p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="text-sm font-medium text-[var(--text)]">
          Credential number or holder text
          <input name="q" type="search" defaultValue={sp.q || ""} placeholder="Enter a license number or name" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]" />
        </label>
        <label className="text-sm font-medium text-[var(--text)]">
          Jurisdiction
          <select name="jurisdiction" defaultValue={jurisdiction} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
            <option value="">All preview jurisdictions</option>
            {jurisdictions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-[var(--text)]">
          Credential type
          <select name="type" defaultValue={type} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
            <option value="">All preview types</option>
            {types.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <button type="submit" className="self-end rounded-lg bg-[var(--navy)] px-5 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">Search credentials</button>
      </form>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-labelledby="preview-results-heading">
          <h2 id="preview-results-heading" className="text-xl font-semibold text-[var(--text)]">Credential examples ({rows.length})</h2>
          {rows.length === 0 ? <p className="mt-3 text-[var(--muted)]">No preview fixture matches. Try another type or search term.</p> : null}
          <ul className="mt-3 space-y-3">
            {rows.map((row) => <li key={row.id}>
              <Link href={detailUrl(row.id, sp.q || "", jurisdiction, type)} aria-current={selected?.id === row.id ? "page" : undefined} className={`block rounded-xl border p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${selected?.id === row.id ? "border-[var(--accent)] bg-[var(--surface)]" : "border-[var(--border)]"}`}>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{row.grain}</span>
                <span className="mt-1 block font-semibold text-[var(--text)]">{row.label}</span>
                <span className="block text-sm text-[var(--muted)]">{row.holder_text} · {row.native_id}</span>
                <span className="mt-1 block text-sm text-[var(--text)]">Source status: {row.source_status}</span>
              </Link>
            </li>)}
          </ul>
        </section>

        <section aria-labelledby="credential-detail-heading" className="self-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <h2 id="credential-detail-heading" className="text-xl font-semibold text-[var(--text)]">Credential detail</h2>
          {selected ? <>
            <p className="mt-2 text-sm font-semibold text-[var(--accent)]">{selected.grain} — not a verified canonical business profile</p>
            <h3 className="mt-3 text-2xl font-semibold text-[var(--text)]">{selected.label}</h3>
            <dl className="mt-5 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
              <dt className="font-semibold text-[var(--muted)]">Regulator</dt><dd className="break-words">{selected.regulator}</dd>
              <dt className="font-semibold text-[var(--muted)]">Jurisdiction</dt><dd>{selected.jurisdiction}</dd>
              <dt className="font-semibold text-[var(--muted)]">Number</dt><dd className="break-all font-mono">{selected.native_id}</dd>
              <dt className="font-semibold text-[var(--muted)]">Type</dt><dd>{selected.credential_type}</dd>
              <dt className="font-semibold text-[var(--muted)]">Holder text as sourced</dt><dd>{selected.holder_text}</dd>
              {selected.registrant_text ? <><dt className="font-semibold text-[var(--muted)]">Registrant as sourced</dt><dd>{selected.registrant_text}</dd></> : null}
              <dt className="font-semibold text-[var(--muted)]">Source status</dt><dd>{selected.source_status}</dd>
              <dt className="font-semibold text-[var(--muted)]">{selected.source_date_basis}</dt><dd>{selected.source_date}</dd>
              <dt className="font-semibold text-[var(--muted)]">Source hash</dt><dd className="break-all font-mono text-xs">{selected.source_sha256}</dd>
              <dt className="font-semibold text-[var(--muted)]">Business identity linkage</dt><dd>Not established</dd>
            </dl>
            <p className="mt-5 text-sm"><a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent)] underline underline-offset-2">Official source ↗</a></p>
          </> : <p className="mt-3 text-[var(--muted)]">Choose a credential example to view its source details.</p>}
        </section>
      </div>
    </main>
  );
}
