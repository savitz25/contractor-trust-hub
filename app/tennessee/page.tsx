import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import {
  TENNESSEE_INTELLIGENCE_GATE,
  TN_COMPLAINT,
  TN_DAR,
  TN_QA_DASHBOARD,
  TN_VERIFY,
} from "@/lib/tennessee-intelligence/publication";
import { assertTennesseeSnapshot } from "@/lib/tennessee-intelligence/snapshot";
import { classificationLabel, findTnLicense } from "@/lib/tennessee-intelligence/lookup";
import events from "@/lib/tennessee-intelligence/events.json";

export const metadata: Metadata = pageMetadata({
  title: TENNESSEE_INTELLIGENCE_GATE.title,
  description: TENNESSEE_INTELLIGENCE_GATE.description,
  path: TENNESSEE_INTELLIGENCE_GATE.path,
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type TnEvent = (typeof events)[number];

const fmt = (n: number) => n.toLocaleString("en-US");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function EventTable({ rows }: { rows: TnEvent[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-600">
          <tr>
            <th className="py-2 pr-3">Action date</th>
            <th className="py-2 pr-3">Respondent (as published)</th>
            <th className="py-2 pr-3">Location</th>
            <th className="py-2 pr-3">Violation</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t border-[var(--border)] align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{e.actionDate}</td>
              <td className="py-2 pr-3">{e.respondent}</td>
              <td className="py-2 pr-3">{e.location}</td>
              <td className="py-2 pr-3">{e.violation}</td>
              <td className="py-2">{e.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TennesseeContractorPage({ searchParams }: Props) {
  const params = await searchParams;
  const s = assertTennesseeSnapshot();
  const c = s.contractor_licenses;
  const q = s.qualifying_agents;
  const d = s.discipline;
  const licenseQuery = one(params.license).trim().slice(0, 20);
  const found = licenseQuery ? await findTnLicense(licenseQuery) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tennessee · statewide</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Tennessee contractor licensing</h1>
      <p className="mt-4 text-sm leading-relaxed">
        The Tennessee Board for Licensing Contractors, part of the Department of Commerce &amp; Insurance, issues four
        different credentials: the Contractor license, the Home Improvement license, the Limited Licensed Electrician (LLE)
        license, and the Limited Licensed Plumber (LLP) license. Which one a job needs depends on the project value, the
        trade, and sometimes the county or city. The $25,000 Contractor threshold is not the whole system: smaller jobs can
        still need a Home Improvement, LLE, LLP, or local license. This page does not count Tennessee contractors and is not
        a ranking or Trust Score.
      </p>
      <p className="mt-2 text-xs text-slate-600">
        Page generated {s.generated_at.slice(0, 10)}. Contractor data downloaded from the state dashboard on{" "}
        {c.retrievedAt.slice(0, 10)}; the dashboard does not print an as-of date. Discipline rows keep their own action
        dates. The state search is the live check for current status.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Which license covers what</h2>
      <ul className="mt-4 space-y-4">
        {s.credential_rules.map((r) => (
          <li key={r.id} id={r.id} className="rounded-xl border border-[var(--border)] p-4">
            <p className="font-semibold">{r.label}</p>
            <p className="mt-1 text-sm">{r.rule}</p>
            <p className="mt-1 text-xs text-slate-600">
              List in this hub: {r.bulk === "KNOWN" ? "acquired (below)" : "not acquired — check the state search"} ·{" "}
              <a className="underline" href={r.source}>
                Board rules
              </a>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed">
        The Home Improvement counties describe where the law applies, not where a contractor is based. City and county
        governments may have their own licenses; those are not covered here.
      </p>

      <h2 id="contractor-licenses" className="mt-10 text-xl font-semibold">
        Contractor licenses ({fmt(c.distinctLicenseNumbers)} license numbers)
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        From the Board&apos;s public Contractor &amp; Qualifying Agent dashboard (Download → Crosstab). It lists Contractor
        licenses only — no Home Improvement, LLE, or LLP licenses. {fmt(c.distinctLicenseNumbers)} license numbers, by status
        as published: {Object.entries(c.statusCounts).map(([k, v]) => `${k} ${fmt(v)}`).join(" · ")}. A further{" "}
        {fmt(c.applicationRowsWithoutLicense)} rows are applications without a license number and are not counted as
        licenses. Each license lists classifications (for example building, electrical, mechanical, roofing, or highway work)
        and an aggregate monetary limit, which is the largest job the license allows — not revenue, size, or quality.{" "}
        {fmt(c.licensesWithTennesseeAddress)} licensees list a Tennessee address and {fmt(c.licensesWithOutOfStateAddress)}{" "}
        an out-of-state address; an address is not a service area. <a className="underline" href={TN_QA_DASHBOARD}>State dashboard</a>{" "}
        · <a className="underline" href={TN_VERIFY}>Verify a license</a>
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">Most common classifications and limits</summary>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {c.topClassifications.map((t) => (
            <li key={t.classification}>
              {t.classification}: {fmt(t.licenses)} licenses
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          Monetary limits: {Object.entries(c.monetaryLimitCounts).map(([k, v]) => `${k} (${fmt(v)})`).join(" · ")}
        </p>
      </details>

      <form id="license-lookup" method="get" action="/tennessee#license-lookup" className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="tn-license" className="sr-only">
          Tennessee contractor license number
        </label>
        <input
          id="tn-license"
          name="license"
          defaultValue={licenseQuery}
          maxLength={20}
          placeholder="Contractor license number"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">
          Look up
        </button>
      </form>
      {licenseQuery ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] p-4 text-sm" data-testid="tn-license-lookup">
          {found ? (
            <>
              <p className="font-semibold">
                {found.name} · License {found.license}
              </p>
              <p className="mt-1">
                Status as published: {found.status}
                {found.expires ? ` · expires ${found.expires}` : ""}
                {found.originated ? ` · originated ${found.originated}` : ""} · {found.city}, {found.state}
              </p>
              <p className="mt-1">Monetary limit: {found.monetaryLimit ?? "not printed"}</p>
              <p className="mt-1">
                Classifications: {found.classifications.map(classificationLabel).join("; ") || "none printed"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {found.qualifyingAgents} qualifying agent{found.qualifyingAgents === 1 ? "" : "s"} listed; names are on the state
                dashboard. Status is from the download date; confirm on the state search.
              </p>
            </>
          ) : (
            <p>
              No Contractor license {licenseQuery} is in the downloaded dashboard. That does not mean the person or business
              is unlicensed: Home Improvement, LLE, and LLP licenses are not in this file. Check the state search.
            </p>
          )}
        </div>
      ) : null}

      <h2 className="mt-10 text-xl font-semibold">Qualifying agents</h2>
      <p className="mt-2 text-sm leading-relaxed">
        A qualifying agent is the person who qualifies a Contractor license; one license can have several. The dashboard
        lists {fmt(q.relationships)} license-to-agent links ({fmt(q.licensesWithMoreThanOneQA)} licenses have more than one).
        Qualifying agents are people, not contractor businesses, and are not counted as contractors. This page does not
        republish their names; look them up on the <a className="underline" href={TN_QA_DASHBOARD}>state dashboard</a>.
      </p>

      <h2 id="discipline" className="mt-10 text-xl font-semibold">Board discipline ({fmt(d.rows)} rows)</h2>
      <p className="mt-2 text-sm leading-relaxed">
        From the Department&apos;s monthly Disciplinary Action Reports, January 2024 through August 2026 (PARTIAL). The report
        lists one program for Contractors, Home Improvement, LLE, and LLP together, so a row does not say which credential
        was involved. {fmt(d.unlicensedActivityRows)} rows are unlicensed activity: many respondents never held a license and
        are not in the list above. No row prints a license number, so none is attached to a contractor record. Respondents
        are shown as published. <a className="underline" href={TN_DAR}>Source reports</a>
      </p>
      <EventTable rows={events.slice(0, 40)} />
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">Show all {fmt(d.rows)} rows</summary>
        <EventTable rows={events} />
      </details>

      <h2 className="mt-10 text-xl font-semibold">Complaints</h2>
      <p className="mt-2 text-sm leading-relaxed">
        The Board takes complaints about unlicensed activity, unfair or deceptive practices, and other violations. Complaint
        records are not published; only actions the Board takes appear in the discipline reports. A complaint is not
        discipline. <a className="underline" href={TN_COMPLAINT}>File a complaint</a>
      </p>

      <h2 className="mt-10 text-xl font-semibold">What is not claimed</h2>
      <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">
        <li>No count of Tennessee contractors. License numbers, qualifying-agent links, and discipline rows are different things and are never added.</li>
        <li>No Home Improvement, LLE, or LLP list was loaded. Missing here is unknown, not zero.</li>
        <li>&quot;Under $25,000 needs no license&quot; is not true everywhere: Home Improvement, LLE, LLP, and local rules can apply.</li>
        <li>No record is attached to a contractor by name. No Nashville, Memphis, Knoxville, or Chattanooga pages.</li>
        <li>No ranking, recommendation, or Trust Score.</li>
      </ul>
    </main>
  );
}
