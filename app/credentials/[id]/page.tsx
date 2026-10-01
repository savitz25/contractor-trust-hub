import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { credentialById, credentialLabel, credentialJurisdiction, credentialRegulator, credentialGrain, credentialsPublished } from "@/lib/credentials/certified";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Regulatory credential detail" };

export default async function CredentialDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!credentialsPublished()) notFound();
  const { id } = await params;
  const row = await credentialById(id);
  if (!row) notFound();
  const facts = [
    ["Holder as sourced", row.licensee_name_raw],
    ["Credential number", row.license_number],
    ["Credential type", credentialLabel(row)],
    ["Source class", row.occupation_description || row.occupation_code],
    ["Regulator", credentialRegulator(row)],
    ["Jurisdiction", credentialJurisdiction(row)],
    ["Source status", row.primary_status],
    ["Issue date", row.original_licensure_date],
    ["Expiry date", row.expiration_date],
    ["Closed date", row.closed_date],
    ["TrustHub verification date", row.source_date],
    ["Business identity linkage", "Not established"],
  ];
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
    <Link href="/credentials" className="text-sm underline">← Credential Lookup</Link>
    <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{credentialGrain(row)}</p>
    <h1 className="mt-2 text-3xl font-semibold">{credentialLabel(row)}</h1>
    <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">This credential record is not a verified canonical business profile.</p>
    <dl className="mt-6 grid grid-cols-[minmax(0,9rem)_1fr] gap-3 break-words text-sm">{facts.filter(([, value]) => value).map(([name, value]) => <div key={name} className="col-span-2 grid grid-cols-subgrid border-b border-[var(--border)] py-2"><dt className="font-semibold">{name}</dt><dd>{value}</dd></div>)}</dl>
    {row.source_url ? <p className="mt-5"><a href={row.source_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">Official source ↗</a></p> : null}
  </main>;
}
