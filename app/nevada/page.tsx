import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import {
  NEVADA_INTELLIGENCE_GATE,
  NV_CLASSIFICATIONS,
  NV_COMPLAINTS,
  NV_DISCIPLINE,
  NV_LICENSE_SEARCH,
  NV_LISTING,
} from "@/lib/nevada-intelligence/publication";
import { assertNevadaSnapshot } from "@/lib/nevada-intelligence/snapshot";
import { findNvLicense, nvClassificationLabel, nvEventsForLicense } from "@/lib/nevada-intelligence/lookup";
import events from "@/lib/nevada-intelligence/events.json";

export const metadata: Metadata = pageMetadata({
  title: NEVADA_INTELLIGENCE_GATE.title,
  description: NEVADA_INTELLIGENCE_GATE.description,
  path: NEVADA_INTELLIGENCE_GATE.path,
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type NvEvent = (typeof events)[number];

const fmt = (n: number) => n.toLocaleString("en-US");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function EventTable({ rows }: { rows: NvEvent[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-600">
          <tr>
            <th className="py-2 pr-3">Date</th>
            <th className="py-2 pr-3">Licensee (as published)</th>
            <th className="py-2 pr-3">License number</th>
            <th className="py-2">Action type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t border-[var(--border)] align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{e.actionDate}</td>
              <td className="py-2 pr-3">{e.respondent}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{e.licenseNumberPrinted ?? "not printed"}</td>
              <td className="py-2">{e.actionType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function NevadaContractorPage({ searchParams }: Props) {
  const params = await searchParams;
  const s = assertNevadaSnapshot();
  const c = s.contractor_licenses;
  const k = s.classifications;
  const m = s.monetary_limits;
  const d = s.discipline;
  const licenseQuery = one(params.license).trim().slice(0, 20);
  const found = licenseQuery ? await findNvLicense(licenseQuery) : null;
  const foundEvents = found ? nvEventsForLicense(found.license) : [];
  const recent = [...events].reverse();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Nevada · statewide</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Nevada contractor licensing</h1>
      <p className="mt-4 text-sm leading-relaxed">
        The Nevada State Contractors Board (NSCB) licenses contracting businesses statewide. A license belongs to the
        business, carries one or more classifications, and has a monetary limit set by the Board. Each license is qualified
        by a person — the qualified individual — who is not the license holder. This page does not count Nevada contractors
        and is not a ranking or Trust Score.
      </p>
      <p className="mt-2 text-xs text-slate-600">
        Page generated {s.generated_at.slice(0, 10)}. Active directory downloaded {c.retrievedAt.slice(0, 10)}; the Board
        prints &quot;Information current as of {c.sourceAsOfPrinted}&quot;. Discipline rows keep their own dates. The Board&apos;s
        license search is the live check for current status.
      </p>

      <h2 id="license" className="mt-10 text-xl font-semibold">
        Nevada contractor license ({fmt(c.distinctLicenseNumbers)} active license numbers)
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        From the Board&apos;s public Contractor Listing Search with every county and every classification selected — the
        &quot;Active Directory of Licensed Contractors&quot;. It lists active licenses only (status as published:{" "}
        {Object.entries(c.statusCounts).map(([key, v]) => `${key} ${fmt(v)}`).join(" · ")}); expired, suspended, revoked,
        and inactive licenses are not in it. {fmt(c.letterSuffixedLicenseNumbers)} license numbers end in a letter; they are
        separate licenses and are kept exactly as printed. {fmt(c.licensesWithNevadaAddress)} licensees list a Nevada address
        and {fmt(c.licensesWithOutOfStateAddress)} an out-of-state address; an address is not a service area. Phones and
        street addresses are not republished. <a className="underline" href={NV_LISTING}>Board listing</a> ·{" "}
        <a className="underline" href={NV_LICENSE_SEARCH}>Verify a license</a>
      </p>

      <form id="license-lookup" method="get" action="/nevada#license-lookup" className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="nv-license" className="sr-only">
          Nevada contractor license number
        </label>
        <input
          id="nv-license"
          name="license"
          defaultValue={licenseQuery}
          maxLength={20}
          placeholder="License number, e.g. 0095506"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">
          Look up
        </button>
      </form>
      {licenseQuery ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] p-4 text-sm" data-testid="nv-license-lookup">
          {found ? (
            <>
              <p className="font-semibold">
                {found.name} · License {found.license}
              </p>
              <p className="mt-1">
                Status as published: {found.status}
                {found.expires ? ` · expires ${found.expires}` : ""} · {found.city}, {found.state}
              </p>
              <p className="mt-1">Monetary limit: {found.monetaryLimit ?? "not printed"}</p>
              <p className="mt-1">
                Classifications: {found.classifications.map(nvClassificationLabel).join("; ") || "none printed"}
              </p>
              {found.limitation ? <p className="mt-1">Limitation as printed: {found.limitation}</p> : null}
              <p className="mt-1">
                Board actions printed with this exact license number ({d.window.replace(/^NSCB Public Disciplinary and Board Actions Search, /, "")}):{" "}
                {foundEvents.length ? foundEvents.map((e) => `${e.actionDate} ${e.actionType}`).join("; ") : "none"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Qualified individuals and principals are on the Board&apos;s license search. Status is from the download date;
                confirm there.
              </p>
            </>
          ) : (
            <p>
              No active license {licenseQuery} is in the downloaded directory. That does not mean the business is unlicensed
              or never was: expired, suspended, and revoked licenses are not in the active directory, and status changes
              daily. Check the Board&apos;s license search.
            </p>
          )}
        </div>
      ) : null}

      <h2 id="classifications" className="mt-10 text-xl font-semibold">Classifications</h2>
      <ul className="mt-4 space-y-3">
        {s.license_model.classes.map((r) => (
          <li key={r.id} className="rounded-xl border border-[var(--border)] p-4">
            <p className="font-semibold">{r.label}</p>
            <p className="mt-1 text-sm">{r.rule}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed">
        One license can carry several classifications. The directory lists {fmt(k.relationships)} license-to-classification
        links across {fmt(c.distinctLicenseNumbers)} licenses and {fmt(k.distinctClassificationLabels)} classification labels;
        links are not contractors and are never added to license counts. Codes and descriptions are kept exactly as the Board
        prints them. <a className="underline" href={NV_CLASSIFICATIONS}>Board classification list</a>
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">Most common classifications</summary>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {k.topClassifications.map((t) => (
            <li key={t.classification}>
              {t.classification}: {fmt(t.licenses)} licenses
            </li>
          ))}
        </ul>
      </details>

      <h2 id="monetary-limit" className="mt-10 text-xl font-semibold">Monetary limit</h2>
      <p className="mt-2 text-sm leading-relaxed">{s.license_model.monetaryLimit}</p>
      <p className="mt-2 text-sm leading-relaxed">
        As printed in the directory: {Object.entries(m.counts).map(([key, v]) => `${key} (${fmt(v)})`).join(" · ")}.{" "}
        {s.license_model.bondAndFinancialResponsibility}
      </p>

      <h2 id="qualifying-party" className="mt-10 text-xl font-semibold">Qualified individual</h2>
      <p className="mt-2 text-sm leading-relaxed">
        A qualified individual is {s.license_model.qualifiedIndividual}. The active directory does not print principals or qualified individuals, so no
        list of them was loaded and none is counted as a contractor. The Board&apos;s license search can be searched by principal
        or qualified individual, one license at a time. <a className="underline" href={NV_LICENSE_SEARCH}>License search</a>
      </p>

      <h2 id="discipline" className="mt-10 text-xl font-semibold">Disciplinary and Board actions ({fmt(d.rows)} rows)</h2>
      <p className="mt-2 text-sm leading-relaxed">
        From the Board&apos;s public Disciplinary and Board Actions Search, {d.firstActionDate} through {d.lastActionDate} (PARTIAL):{" "}
        {Object.entries(d.actionTypes).map(([key, v]) => `${key} ${fmt(v)}`).join(" · ")}. {fmt(d.rowsWithLicenseNumberPrinted)}{" "}
        rows print a license number; {fmt(d.rowsAttachedByExactLicenseNumber)} of those match a license in the active directory
        exactly and show in the lookup above. The other {fmt(d.rowsWithLicenseNotInActiveDirectory)} name licenses that are no
        longer in the active directory, and {fmt(d.rowsWithoutLicenseNumber)} print no number; those stay standalone. Nothing is
        matched by name. Penalty details sit on the Board&apos;s per-action page and were not loaded. Unlicensed-contractor
        enforcement is separate and is not in this search. <a className="underline" href={NV_DISCIPLINE}>Board search</a>
      </p>
      <EventTable rows={recent.slice(0, 40)} />
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">Show all {fmt(d.rows)} rows</summary>
        <EventTable rows={recent} />
      </details>

      <h2 className="mt-10 text-xl font-semibold">Complaints</h2>
      <p className="mt-2 text-sm leading-relaxed">
        The Board takes complaints against licensed contractors and, separately, against unlicensed contractors. Complaint
        records are not published and none were loaded; a complaint is not discipline. Only actions the Board takes appear
        above. <a className="underline" href={NV_COMPLAINTS}>File a complaint</a>
      </p>

      <h2 className="mt-10 text-xl font-semibold">What is not claimed</h2>
      <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">
        <li>No count of Nevada contractors. License numbers, classification links, qualified individuals, and discipline rows are different things and are never added.</li>
        <li>A monetary limit, bond, or financial-responsibility requirement is not revenue, size, or quality.</li>
        <li>Missing from the active directory is not the same as unlicensed; expired and inactive licenses were not loaded.</li>
        <li>No record is attached to a contractor by name. No Las Vegas, Reno, or Henderson pages; city and county licensing and permits are not covered.</li>
        <li>No ranking, recommendation, or Trust Score.</li>
      </ul>
    </main>
  );
}
