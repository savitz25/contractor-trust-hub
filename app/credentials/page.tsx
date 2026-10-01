import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { credentialsPublished, searchCredentials, credentialLabel, credentialJurisdiction, credentialRegulator, credentialGrain } from "@/lib/credentials/certified";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Credential Lookup", description: "Look up government regulatory credentials separately from Contractor Trust Hub business profiles." };

type Search = Promise<{ q?: string; state?: string; type?: string; status?: string }>;

export default async function CredentialLookup({ searchParams }: { searchParams: Search }) {
  if (!credentialsPublished()) notFound();
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const rows = await searchCredentials(sp);
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <nav className="flex gap-4 text-sm" aria-label="Search type"><Link href="/verify" className="underline">Businesses</Link><strong aria-current="page">Credentials</strong></nav>
    <h1 className="mt-5 text-3xl font-semibold">Credential Lookup</h1>
    <p className="mt-2 max-w-3xl text-[var(--muted)]">Search government credential records by license number or holder name. A credential is not a verified canonical business profile.</p>
    <form action="/credentials" method="get" role="search" className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
      <label className="text-sm font-medium">Number or holder name<input name="q" type="search" required minLength={2} defaultValue={q} className="mt-1 w-full rounded-lg border border-[var(--border)] p-2" /></label>
      <label className="text-sm font-medium">Regulator state<select name="state" defaultValue={sp.state || ""} className="mt-1 w-full rounded-lg border border-[var(--border)] p-2"><option value="">All</option><option value="FL">Florida</option><option value="NY">New York</option></select></label>
      <label className="text-sm font-medium">Credential type<select name="type" defaultValue={sp.type || ""} className="mt-1 w-full rounded-lg border border-[var(--border)] p-2"><option value="">All</option><option value="fl_dbpr_eclb_08">FL Electrical</option><option value="fl_mrsa">FL Mold Assessor</option><option value="fl_mrsr">FL Mold Remediator</option><option value="fl_dbpr_home_04">FL Home Inspector</option><option value="ny_dol_mold">NY Mold</option><option value="ny_elevator">NY Elevator</option></select></label>
      <label className="text-sm font-medium">Source status<input name="status" defaultValue={sp.status || ""} placeholder="e.g. Expired" className="mt-1 w-full rounded-lg border border-[var(--border)] p-2" /></label>
      <button type="submit" className="self-end rounded-lg bg-[var(--navy)] px-4 py-2 font-semibold text-white">Search</button>
    </form>
    {q ? <section className="mt-7" aria-live="polite"><h2 className="text-xl font-semibold">Credential results</h2><p className="text-sm text-[var(--muted)]">Showing up to 50 matching credential records. These are not business results.</p>
      {rows.length ? <ul className="mt-4 grid gap-3 md:grid-cols-2">{rows.map(row => <li key={row.id} className="rounded-xl border border-[var(--border)] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{credentialGrain(row)}</p><h3 className="mt-1 font-semibold">{row.licensee_name_raw || "Holder name not reported"}</h3><p>{credentialLabel(row)} · <span className="font-mono">{row.license_number}</span></p><p className="text-sm">{credentialRegulator(row)} · {credentialJurisdiction(row)}</p><p className="text-sm font-semibold">Source status: {row.primary_status || "Not reported"}</p><p className="mt-1 text-xs text-[var(--muted)]">Source: {row.source_dataset}</p><Link href={`/credentials/${row.id}`} className="mt-2 inline-block font-semibold text-[var(--accent)] underline">View credential detail</Link></li>)}</ul> : <p className="mt-4">No matching credentials in this certified release.</p>}
    </section> : <p className="mt-7 text-[var(--muted)]">Enter a credential number or holder name to begin.</p>}
  </main>;
}
