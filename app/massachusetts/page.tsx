import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import {
  MA_AG_FAIR_LABOR,
  MA_CSL_LOOKUP,
  MA_CSL_REQUIRED,
  MA_DCAMM_CERTIFIED,
  MA_DCAMM_DEBARRED,
  MA_DOL_CHECK,
  MA_DOL_DISCIPLINE,
  MA_HIC_HUB,
  MA_HIC_PROGRAM,
  MA_HIC_SEARCH,
  MASSACHUSETTS_INTELLIGENCE_GATE,
} from "@/lib/massachusetts-intelligence/publication";
import { findMaDolEvents, MASSACHUSETTS_EVENTS, MASSACHUSETTS_SNAPSHOT, type MaDolEvent } from "@/lib/massachusetts-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: MASSACHUSETTS_INTELLIGENCE_GATE.title,
  description: MASSACHUSETTS_INTELLIGENCE_GATE.description,
  path: MASSACHUSETTS_INTELLIGENCE_GATE.path,
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const fmt = (n: number) => n.toLocaleString("en-US");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function DolTable({ rows }: { rows: MaDolEvent[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-600">
          <tr>
            <th className="py-2 pr-3">Closed</th>
            <th className="py-2 pr-3">Board</th>
            <th className="py-2 pr-3">Respondent (as published)</th>
            <th className="py-2 pr-3">License no.</th>
            <th className="py-2 pr-3">Nature</th>
            <th className="py-2">Decision</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t border-[var(--border)] align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{e.closedDate}</td>
              <td className="py-2 pr-3">{e.tradeProfession}</td>
              <td className="py-2 pr-3">{e.respondent}</td>
              <td className="py-2 pr-3">{e.licenseNumber ?? "not listed"}</td>
              <td className="py-2 pr-3">{e.natureCodes}</td>
              <td className="py-2">{e.decision}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MassachusettsContractorPage({ searchParams }: Props) {
  const params = await searchParams;
  const s = MASSACHUSETTS_SNAPSHOT;
  const d = s.dol_discipline;
  const dcamm = s.dcamm_debarment;
  const ag = s.ag_fair_labor_debarment;
  const license = one(params.license).trim().slice(0, 12);
  const boards = one(params.board)
    .split(",")
    .map((b) => b.trim().toUpperCase())
    .filter((b) => ["EL", "PL", "GF", "SM"].includes(b));
  const matches = license ? findMaDolEvents(license, boards.length ? boards : undefined) : null;
  const agEvents = MASSACHUSETTS_EVENTS.ag_fair_labor_debarment;
  const agCurrent = agEvents.filter((e) => e.periodIncludesRetrievalDate);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Massachusetts · statewide</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Massachusetts contractor licensing</h1>
      <p className="mt-4 text-sm leading-relaxed">
        Massachusetts has no single contractor license. Home improvement contractors register with the state, construction
        on most homes and small buildings is supervised by a licensed construction supervisor, and electricians, plumbers,
        and gas fitters hold their own trade licenses. Public-building work adds DCAMM certification. These are separate
        credentials: a contractor may need one, several, or none of them depending on the job. This page does not say how
        many contractors work in Massachusetts. It is not a ranking or Trust Score.
      </p>
      <p className="mt-2 text-xs text-slate-600">
        Page generated {s.generated_at.slice(0, 10)}. Sources retrieved 2026-09-24. Each discipline and debarment record
        keeps its own date. Retrieval date is not a license status date.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Which credential covers what</h2>
      <ul className="mt-4 space-y-4">
        {s.credential_systems.map((c) => (
          <li key={c.id} id={c.id} className="rounded-xl border border-[var(--border)] p-4">
            <p className="font-semibold">{c.label}</p>
            <p className="mt-1 text-sm">{c.agency}</p>
            <p className="mt-1 text-sm">Covers: {c.grain}. Identifier: {c.identifier}.</p>
            <p className="mt-1 text-sm">
              Lookup: {c.lookup} (<a className="underline" href={c.lookupUrl}>official lookup</a>). Bulk roster: {c.bulk}.{" "}
              {c.bulkReason}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed">
        An HIC registration is not a Construction Supervisor License, and neither is an electrician or plumber license.{" "}
        <a className="underline" href={MA_CSL_REQUIRED}>When a CSL is required</a> ·{" "}
        <a className="underline" href={MA_HIC_PROGRAM}>HIC registration</a>. Because no HIC or CSL roster is published in bulk,
        there is no count of registered or licensed contractors here. Not found here does not mean unregistered.
      </p>

      <h2 className="mt-10 text-xl font-semibold">HIC complaints, arbitration, and the Guaranty Fund</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Homeowners file HIC complaints, arbitration requests, and Guaranty Fund claims on the{" "}
        <a className="underline" href={MA_HIC_HUB}>MA Contractor Hub</a>. The Hub&apos;s{" "}
        <a className="underline" href={MA_HIC_SEARCH}>contractor search</a> shows a contractor&apos;s registration status,
        complaints, arbitration outcomes, and Guaranty Fund payouts owed. That search is interactive and was not copied, so
        complaint, arbitration, Guaranty Fund, and HIC discipline outcomes are NOT_ACQUIRED here. A complaint is not a
        finding, arbitration is not discipline, and a Guaranty Fund payment is not a revocation.
      </p>

      <h2 id="dol" className="mt-10 text-xl font-semibold">DOL construction-trade discipline ({fmt(d.rows)} rows)</h2>
      <p className="mt-2 text-sm leading-relaxed">
        From the Division of Occupational Licensure disciplinary-action reports: electricians ({fmt(d.rowsByBoard.EL)} rows),
        plumbers and gas fitters ({fmt(d.rowsByBoard.PL + d.rowsByBoard.GF)}), and sheet metal ({fmt(d.rowsByBoard.SM)}).
        Covers report years 2021–2024 and the 2025 first-quarter file, the latest DOL had published when retrieved (PARTIAL).
        A row is one complaint and license as DOL published it; {fmt(d.distinctComplaints)} distinct complaints.{" "}
        {fmt(d.rowsWithoutLicenseNumber)} rows list no license number (often unlicensed-work cases). Most licensees are
        individuals, and a person&apos;s license is not a contractor business. Rows are not attached to any contractor
        profile. DOL notes the report leaves out child-support suspensions and summary emergency suspensions.{" "}
        <a className="underline" href={MA_DOL_DISCIPLINE}>Source</a> ·{" "}
        <a className="underline" href={MA_DOL_CHECK}>Check a DOL license</a>
      </p>

      <form id="dol-lookup" method="get" action="/massachusetts#dol-lookup" className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="ma-license" className="sr-only">DOL license number</label>
        <input
          id="ma-license"
          name="license"
          defaultValue={license}
          maxLength={12}
          placeholder="DOL license number"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
        />
        <select name="board" defaultValue={boards.join(",")} className="rounded-lg border border-[var(--border)] px-2 py-2 text-sm">
          <option value="">Any trade board</option>
          <option value="EL">Electricians</option>
          <option value="PL,GF">Plumbers and gas fitters</option>
          <option value="SM">Sheet metal</option>
        </select>
        <button type="submit" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">Find discipline rows</button>
      </form>
      {matches ? (
        <div className="mt-3 text-sm" data-testid="ma-dol-lookup">
          {matches.length ? (
            <>
              <p>
                {matches.length} discipline row{matches.length === 1 ? "" : "s"} list license {license}. Exact license-number match only; the
                same number can exist on different boards, so check the board column.
              </p>
              <DolTable rows={matches} />
            </>
          ) : (
            <p>
              No acquired DOL discipline row lists license {license}. That is not a clean record: this covers only 2021 to 2025 Q1 and only
              these boards. Verify with DOL.
            </p>
          )}
        </div>
      ) : null}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold">Show all {fmt(d.rows)} DOL discipline rows</summary>
        <DolTable rows={MASSACHUSETTS_EVENTS.dol_discipline} />
      </details>

      <h2 id="dcamm" className="mt-10 text-xl font-semibold">DCAMM suspended or debarred parties ({dcamm.rows})</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Public-contracting restrictions imposed by the Division of Capital Asset Management and Maintenance. {dcamm.scope} This is
        not an HIC or license action, and it is not DCAMM certification.{" "}
        <a className="underline" href={MA_DCAMM_DEBARRED}>Source</a> ·{" "}
        <a className="underline" href={MA_DCAMM_CERTIFIED}>DCAMM certified contractors (not acquired)</a>
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {MASSACHUSETTS_EVENTS.dcamm_debarment.map((e) => (
          <li key={e.id} className="border-b border-[var(--border)] py-2">
            <span className="font-medium">{e.party}</span> · {e.basis} · {e.extent} · ends: {e.terminationDate} · hearing: {e.hearingDate}
          </li>
        ))}
      </ul>

      <h2 id="fair-labor" className="mt-10 text-xl font-semibold">Attorney General Fair Labor debarment list ({fmt(ag.rows)} rows)</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Employers barred from public construction and public works contracts, as listed by the Attorney General&apos;s Fair Labor
        Division. The list includes past debarments back to 1979. {agCurrent.length} rows have a debarment period that includes
        2026-09-24; that is a date comparison, not a status the AG publishes. Labor debarment is separate from DCAMM debarment and
        from HIC or trade-license discipline. Names are not matched to contractor profiles.{" "}
        <a className="underline" href={MA_AG_FAIR_LABOR}>Source</a>
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {agCurrent.map((e) => (
          <li key={e.id} className="border-b border-[var(--border)] py-2">
            <span className="font-medium">{e.businessNames ?? e.employerNames}</span>
            {e.businessNames && e.employerNames ? ` · ${e.employerNames}` : ""} · {e.city ?? "city not listed"}, {e.state} ·{" "}
            {e.statute ?? "statute not listed"} · {e.debarmentBegin} to {e.debarmentEnd}
          </li>
        ))}
      </ul>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold">Show all {fmt(ag.rows)} list rows</summary>
        <ul className="mt-3 space-y-1 text-sm">
          {agEvents.map((e) => (
            <li key={e.id} className="border-b border-[var(--border)] py-1">
              {e.businessNames ?? e.employerNames}
              {e.businessNames && e.employerNames ? ` · ${e.employerNames}` : ""} · {e.city ?? "—"}, {e.state ?? "—"} · {e.statute ?? "statute not listed"} ·{" "}
              {e.debarmentBegin ?? "?"} to {e.debarmentEnd ?? "?"}
            </li>
          ))}
        </ul>
      </details>

      <h2 className="mt-10 text-xl font-semibold">What is not claimed</h2>
      <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">
        <li>No count of Massachusetts contractors, registered or licensed. The discipline and debarment counts above are records, not contractors, and are never added together.</li>
        <li>No HIC, CSL, or trade-license roster was loaded. Missing here is unknown, not zero.</li>
        <li>No record is attached to a contractor profile by name.</li>
        <li>No Boston, Worcester, or Springfield pages. City permits, local licenses, courts, liens, and property records are out of scope.</li>
        <li>No ranking, recommendation, or Trust Score.</li>
      </ul>
      <p className="mt-6 text-xs text-slate-600">
        Capability summary:{" "}
        {s.capability_matrix.map((c) => `${c.capability}: ${c.state}`).join(" · ")}
      </p>
    </main>
  );
}
