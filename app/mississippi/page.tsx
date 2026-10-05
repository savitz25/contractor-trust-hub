import type { Metadata } from "next";
import Link from "next/link";
import { MS_MAILING_STATES, MS_SNAPSHOT as data, MS_STATUS_BY_CLASS } from "@/lib/mississippi-intelligence/snapshot";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: "Mississippi State Board of Contractors licenses",
  description: "The saved Mississippi State Board of Contractors export has 3,425 Licensed rows and 8,242 unique keys. Expired, unlicensed, revoked, and suspended rows stay separate. This is not a new download.",
  path: "/mississippi",
});

const fmt = (n: number) => n.toLocaleString("en-US");

export default function MississippiContractorPage() {
  return <main className="th-shell py-10 sm:py-14">
    <p className="cth-intel-eyebrow">Mississippi / State Board of Contractors</p>
    <h1>Mississippi State Board of Contractors</h1>
    <p className="mt-3 max-w-3xl text-lg">This page recounts the official export already loaded as <code>ms_sbc</code>. The file is {data.fileName}, saved {data.fileDate}. It was not downloaded again on {data.recountedAt}. The database was not re-read, and no rows were inserted.</p>
    <p className="mt-3 max-w-3xl text-[var(--muted)]">Confirm a current license on the <a className="underline" href={data.searchUrl}>MSBOC consolidated search</a>. The existing ContractorTrustHub search of this load is <Link className="underline" href={data.verifyPath}>Verify Mississippi</Link>.</p>

    <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="MSBOC export summary">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(data.licensed)}</strong><p className="mt-1 text-sm">Unique keys whose printed status is Licensed. This is the active status on the {data.fileDate} file, not a live census.</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(data.uniqueKeys)}</strong><p className="mt-1 text-sm">Unique keys in the file, every status. This is the same {fmt(data.uniqueKeys)} already in the network cohort. It is not an active-contractor count.</p></div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5"><strong className="text-3xl">{fmt(data.listRows)}</strong><p className="mt-1 text-sm">List rows before {fmt(data.duplicateKeysDropped)} duplicate keys were dropped. Those two rows were not loaded twice.</p></div>
    </section>

    <section className="mt-10" id="status"><h2>Printed status on the {fmt(data.uniqueKeys)} keys</h2>
      <p className="mt-2 text-sm">These statuses partition the unique keys. They are not added to each other, and they are not added to the type labels below. Revoked and suspended are status values on this license list. They are not a violations file. Unlicensed is the board&apos;s printed status, not a separate enforcement action.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Printed status</th><th>Unique keys</th></tr></thead><tbody>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Licensed</td><td>{fmt(data.licensed)}</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Licensed Expired</td><td>{fmt(data.licensedExpired)}</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Unlicensed</td><td>{fmt(data.unlicensed)}</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Unlicensed Expired</td><td>{fmt(data.unlicensedExpired)}</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Revoked</td><td>{fmt(data.revoked)}</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Suspended</td><td>{fmt(data.suspended)}</td></tr>
      </tbody></table></div>
    </section>

    <section className="mt-10" id="type"><h2>Commercial and residential stay separate</h2>
      <p className="mt-2 text-sm">The Type column on the same {fmt(data.uniqueKeys)} keys uses four printed labels. Residential (Inactive) and Commercial (Inactive) are type labels. This file has no status value named Inactive. The two dropped duplicate keys were residential, so the list had {fmt(data.typeResidential + data.duplicateKeysDropped)} residential rows before that drop.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Printed type</th><th>Unique keys</th></tr></thead><tbody>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Commercial</td><td>{fmt(data.typeCommercial)}</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Residential</td><td>{fmt(data.typeResidential)}</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Residential (Inactive)</td><td>{fmt(data.typeResidentialInactiveLabel)}</td></tr>
        <tr className="border-t border-[var(--border)]"><td className="py-2 pr-3">Commercial (Inactive)</td><td>{fmt(data.typeCommercialInactiveLabel)}</td></tr>
      </tbody></table></div>
    </section>

    <section className="mt-10" id="class"><h2>License-number shape and status</h2>
      <p className="mt-2 text-sm">The export has no ClassCode column and no qualifying-party column. The codes below are derived from the type label and a -MC or -SC suffix on the license number. RES includes the Residential (Inactive) type label. COM includes the Commercial (Inactive) type label. A suffix is not the board&apos;s classification catalog. Cells in this table are the same {fmt(data.uniqueKeys)} keys, split a second way. Do not add them to the tables above.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Derived class</th><th className="pr-3">Printed status</th><th>Keys</th></tr></thead><tbody>
        {MS_STATUS_BY_CLASS.map((row) => <tr key={`${row.code}-${row.status}`} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{row.code}. {row.label}</td><td className="pr-3">{row.status}</td><td>{fmt(row.rows)}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="mt-10" id="mailing"><h2>Mailing address is not the license</h2>
      <p className="mt-2 text-sm">Mailing state is counted on the {fmt(data.listRows)} list rows, before the duplicate-key drop. {fmt(data.mailingMs)} print MS. {fmt(data.mailingBlank)} are blank. {fmt(data.mailingOther)} print another value. A mailing state is not a service area, and a non-Mississippi mailing address is still an MSBOC credential. Company-name strings on the unique keys: {fmt(data.distinctNameStrings)}. The file does not label a row as a business or a person, and a repeated name is not one company.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr><th className="py-2 pr-3">Printed mailing state</th><th>List rows</th></tr></thead><tbody>
        {MS_MAILING_STATES.map((row) => <tr key={row.value} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{row.value}</td><td>{fmt(row.rows)}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="mt-10" id="not-in-file"><h2>Not in this export</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>Classification catalog, qualifying party, county, expiration, and issue date: {data.classCodeColumn}. The public search can show fields this saved list view does not.</li>
        <li>Violations and enforcement orders: {data.violationsCorpus}. The revoked and suspended counts above are license-list statuses only.</li>
        <li>Factory-built-home credentials, elevator contractors, and electronic protection credentials: {data.secondaryBoards}. They are not rows in this MSBOC file.</li>
        <li>New canonical entities: {data.netNewEntities}. Graph writes: {data.graphWrites}. The {fmt(data.uniqueKeys)} keys were already the production load.</li>
      </ul>
      <p className="mt-3 text-sm">File SHA-256 {data.fileSha256}. {fmt(data.fileBytes)} bytes. File date {data.fileDate}. Recounted {data.recountedAt}. The file date is not a license effective date. Jackson, Gulfport, and Biloxi are geography only. This page publishes no city or county route.</p>
    </section>
  </main>;
}
