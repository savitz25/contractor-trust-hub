import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-meta";
import { LA_SNAPSHOT as data } from "@/lib/louisiana-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: "Louisiana LSLBC contractor certificate evidence",
  description:
    "Louisiana State Licensing Board for Contractors Active certificate rows for commercial, residential, home improvement, and mold credentials, kept separate. Not a company census.",
  path: "/louisiana",
});

type Props = { searchParams: Promise<{ license?: string }> };
const fmt = (n: number) => n.toLocaleString("en-US");

export default async function LouisianaPage({ searchParams }: Props) {
  const raw = (await searchParams).license;
  const license = typeof raw === "string" && /^\d{3,8}$/.test(raw) ? raw : null;
  return (
    <main className="th-shell py-10 sm:py-14">
      <p className="cth-intel-eyebrow">Louisiana / LSLBC regulator evidence</p>
      <h1>Louisiana contractor certificate evidence</h1>
      <p className="mt-3 max-w-3xl text-[var(--muted)]">
        The Louisiana State Licensing Board for Contractors (LSLBC) is the statewide contractor regulator. The public roster has four certificate types that stay separate. They are not one universal contractor population, and the row total is license-certificate rows, not a deduplicated company census.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Louisiana evidence summary">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-2xl">KNOWN</strong>
          <p className="mt-1 text-sm">Official Active Request Roster and live LSLBC lookup</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-3xl">{fmt(data.certificateRows)}</strong>
          <p className="mt-1 text-sm">Active license-certificate rows on the {data.retrievedAt} re-pull. Not a company census and not one Louisiana contractors total.</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <strong className="text-2xl">NOT_ACQUIRED</strong>
          <p className="mt-1 text-sm">Trade classifications, qualifying parties, and Louisiana State Plumbing Board person licenses</p>
        </div>
      </section>

      <section className="mt-10" id="credentials">
        <h2>Certificate types, counted separately</h2>
        <p className="mt-2 text-sm">
          Counts are from the official <a className="underline" href={data.rosterUrl}>Request Roster</a> re-pull retrieved {data.retrievedAt} ({data.retrievedAtUtc}). The public form only offers Active status. Every counted row is Active. Duplicate license keys: {data.duplicateLicenseKeys}. Skipped rows: {data.skippedRows}. These figures replace nothing in the 2026-08-14 production load; graph writes are {data.graphWrites}.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">Certificate type</th>
                <th className="pr-3">Code</th>
                <th className="pr-3">Status</th>
                <th>Certificate rows</th>
              </tr>
            </thead>
            <tbody>
              {data.certificates.map((row) => (
                <tr key={row.code} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="pr-3">{row.code}</td>
                  <td className="pr-3">{row.status}</td>
                  <td>{fmt(row.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm">
          <strong>Home Improvement Registration is not a commercial or residential construction license by itself.</strong> The Mold Remediation License Certificate is a specialty certificate, not a general construction license. Do not add CLC, RLC, HIR, and MRL into one Louisiana contractors total.
        </p>
        <p className="mt-3 text-sm">
          The combined Active certificate-row count is {fmt(data.certificateRows)}. That addition is a row total across separate certificate types, not a deduplicated company census. One business can hold more than one certificate number.
        </p>
      </section>

      <section className="mt-10" id="lookup">
        <h2>Verify a specific license</h2>
        <p className="mt-2 text-sm">
          An exact LSLBC license number is an identity. This page does not mint a contractor profile. Confirm current type, status, and classifications on the <a className="underline" href={data.lookupUrl}>official LSLBC lookup</a>. Board home: <a className="underline" href={data.homeUrl}>lslbc.gov</a>.
        </p>
        <form action="/louisiana" className="mt-3 flex max-w-xl gap-2">
          <label className="sr-only" htmlFor="license">LSLBC license number</label>
          <input id="license" name="license" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2" placeholder="68755" defaultValue={license ?? ""} />
          <button className="rounded-xl bg-[var(--navy)] px-4 py-2 text-white">Review source</button>
        </form>
        {license && (
          <p className="mt-3 text-sm">
            LA-LSLBC:{license} is a license-number identity only. No profile was created here, and no disciplinary action is attached. Check it on the official lookup.
          </p>
        )}
      </section>

      <section className="mt-10" id="geography">
        <h2>Geography</h2>
        <p className="mt-2 text-sm">
          New Orleans, Baton Rouge, Shreveport, and Lafayette are geography only. Parish on the roster is an address field, not a service area. No parish pages are published. A city or parish name does not select a contractor population.
        </p>
      </section>

      <section className="mt-10" id="not-acquired">
        <h2>Not acquired</h2>
        <p className="mt-2 text-sm">
          Classifications on the interactive lookup were <strong>NOT_ACQUIRED</strong>. Qualifying-party names were <strong>NOT_ACQUIRED</strong>. Louisiana State Plumbing Board person licenses are a separate grain and were <strong>NOT_ACQUIRED</strong>. Expired and inactive credentials are not in the Active export, so missing is not zero. No disciplinary corpus was acquired; acquired attachments are not a count of zero events, and nothing is joined by name.
        </p>
      </section>

      <section className="mt-10" id="sources">
        <h2>Source clock and limits</h2>
        <p className="mt-2 text-sm">
          {data.clockLabel} Retrieved {data.retrievedAt}; generated {data.generatedAt}. Status in this export: Active {fmt(data.statusCounts.Active)}. Individual expiration still has to be confirmed on the live lookup. The live lookup can change independently of this roster pull.
        </p>
        <p className="mt-3 text-sm">
          New canonical companies: {data.newCanonicalCompanies}; graph writes: {data.graphWrites}; claim eligibility changes: {data.claimEligibilityChanges}; name-only adverse joins: {data.nameOnlyAdverseJoins}.
        </p>
        <p className="mt-3 text-sm">
          <Link className="underline" href="/ask?q=Louisiana%20contractor%20license">Ask about Louisiana LSLBC evidence</Link>
        </p>
      </section>
    </main>
  );
}
