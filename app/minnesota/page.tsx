import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import {
  MINNESOTA_INTELLIGENCE_GATE,
  MN_COMPLAINT,
  MN_ENFORCEMENT,
  MN_IMS,
  MN_LOOKUP,
  MN_RESIDENTIAL,
} from "@/lib/minnesota-intelligence/publication";
import { assertMinnesotaSnapshot } from "@/lib/minnesota-intelligence/snapshot";
import { findMnCredential, mnEventsForCredential, mnLabel } from "@/lib/minnesota-intelligence/lookup";
import events from "@/lib/minnesota-intelligence/events.json";

export const metadata: Metadata = pageMetadata({
  title: MINNESOTA_INTELLIGENCE_GATE.title,
  description: MINNESOTA_INTELLIGENCE_GATE.description,
  path: MINNESOTA_INTELLIGENCE_GATE.path,
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type MnEvent = (typeof events)[number];
type ClassRow = { subtype: string; kind: string; grain: string; rows: number; issuedPerDliStatement: number };

const fmt = (n: number) => n.toLocaleString("en-US");
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const KIND: Record<string, string> = {
  license: "license",
  registration: "registration",
  bond: "bond",
  certification: "certification",
  exemption: "certificate of exemption",
  sponsor_approval: "sponsor approval",
};

function ClassTable({ rows, caption }: { rows: ClassRow[]; caption: string }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="text-left text-xs font-semibold uppercase text-slate-600">{caption}</caption>
        <thead className="text-xs uppercase text-slate-600">
          <tr>
            <th className="py-2 pr-3">DLI credential (as printed)</th>
            <th className="py-2 pr-3">Kind</th>
            <th className="py-2 pr-3">Rows in export</th>
            <th className="py-2">Status &quot;Issued&quot;</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.subtype} className="border-t border-[var(--border)]">
              <td className="py-2 pr-3">{r.subtype}</td>
              <td className="py-2 pr-3">{KIND[r.kind] ?? r.kind}</td>
              <td className="py-2 pr-3">{fmt(r.rows)}</td>
              <td className="py-2">{fmt(r.issuedPerDliStatement)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventTable({ rows, synopsis }: { rows: MnEvent[]; synopsis: boolean }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-600">
          <tr>
            <th className="py-2 pr-3">Date</th>
            <th className="py-2 pr-3">Respondent (as published)</th>
            <th className="py-2 pr-3">Action</th>
            <th className="py-2 pr-3">Credential numbers printed</th>
            <th className="py-2">DLI file</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t border-[var(--border)] align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{e.actionDate}</td>
              <td className="py-2 pr-3">
                {e.respondent}
                {synopsis ? <span className="mt-1 block text-xs text-slate-600">{e.synopsis}</span> : null}
              </td>
              <td className="py-2 pr-3">{e.actionType}</td>
              <td className="py-2 pr-3">{e.credentialNumbersPrinted.join(", ") || "none printed"}</td>
              <td className="py-2 whitespace-nowrap">{e.fileNumbers.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MinnesotaContractorPage({ searchParams }: Props) {
  const params = await searchParams;
  const s = assertMinnesotaSnapshot();
  const x = s.statewide_export;
  const b = s.business_credentials;
  const p = s.person_credentials;
  const rc = s.residential_contractors;
  const d = s.enforcement;
  const query = one(params.credential || params.license).trim().slice(0, 20);
  const found = query ? await findMnCredential(query) : null;
  const label = found ? mnLabel(found.k) : null;
  const foundEvents = found ? mnEventsForCredential(found.n) : [];
  const recent = [...events].reverse();
  const zip = x.files["MNDLILicRegCertExport.zip"];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Minnesota · statewide</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Minnesota construction credentials</h1>
      <p className="mt-4 text-sm leading-relaxed">
        The Minnesota Department of Labor and Industry (DLI) issues construction licenses, bonds, certifications, and
        registrations through its Construction Codes and Licensing Division. Some belong to a business and some to an
        individual; they are different credentials with different numbers. This page keeps every kind separate. It does
        not count Minnesota contractors and is not a ranking or Trust Score.
      </p>
      <p className="mt-2 text-xs text-slate-600">
        Page generated {s.generated_at.slice(0, 10)}. DLI export downloaded {x.retrievedAt.slice(0, 16).replace("T", " ")} UTC;
        DLI says the export is updated nightly and prints no as-of date (the file inside the zip is stamped{" "}
        {zip.memberDateTime.slice(0, 10)}). Enforcement actions keep their own dates. DLI&apos;s lookup is the live check.
      </p>

      <h2 id="credentials" className="mt-10 text-xl font-semibold">
        DLI statewide export ({fmt(x.rows)} credential numbers)
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        &quot;{x.dliStatement}&quot; The export has {fmt(x.busPers.Business)} business rows and {fmt(x.busPers.Personal)}{" "}
        individual rows across {fmt(x.types.length)} credential types. Each row is one credential number, not one contractor:
        a business can hold several, and a person&apos;s trade license is not a business. Status is kept as DLI prints it,
        including its mixed capitalization (
        {Object.entries(x.statusGroupedCaseInsensitive).map(([k, v]) => `${k} ${fmt(v)}`).join(" · ")}, grouped without regard
        to case). Only &quot;Issued&quot; is described by DLI as current. <a className="underline" href={MN_LOOKUP}>DLI lookup</a> ·{" "}
        <a className="underline" href={MN_IMS}>iMS</a>
      </p>

      <form id="credential-lookup" method="get" action="/minnesota#credential-lookup" className="mt-4 flex flex-wrap gap-2">
        <label htmlFor="mn-credential" className="sr-only">
          Minnesota DLI credential number
        </label>
        <input
          id="mn-credential"
          name="credential"
          defaultValue={query}
          maxLength={20}
          placeholder="Credential number, e.g. BC123456"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">
          Look up
        </button>
      </form>
      {query ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] p-4 text-sm" data-testid="mn-credential-lookup">
          {found && label ? (
            <>
              <p className="font-semibold">
                {found.g === "B" ? `${found.name}${found.dba ? ` (DBA ${found.dba})` : ""} · ` : ""}
                {label.subtype} {found.n}
              </p>
              <p className="mt-1">
                {label.type} · {KIND[label.kind] ?? label.kind} held by {found.g === "B" ? "a business" : "an individual"}
              </p>
              <p className="mt-1">
                Status as printed: {found.s}
                {found.o ? ` · issued ${found.o}` : ""}
                {found.e ? ` · expires ${found.e}` : ""}
                {found.rp ? " · renewal in progress" : ""}
              </p>
              {found.g === "B" ? (
                <p className="mt-1">
                  Address of record: {[found.city, found.st].filter(Boolean).join(", ") || "not printed"} (not a service area)
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-600">
                  Individual credential: the name and address are not republished here. Confirm the holder on DLI&apos;s lookup.
                </p>
              )}
              <p className="mt-1">DLI enforcement flag on this credential: {found.ea ? "yes" : "no"}</p>
              <p className="mt-1">
                Residential contractor enforcement actions printing this exact number (2024 - 2026 YTD):{" "}
                {foundEvents.length ? foundEvents.map((e) => `${e.actionDate} ${e.actionType}`).join("; ") : "none"}
              </p>
            </>
          ) : (
            <p>
              No credential {query} is in the downloaded export. That does not mean the person or business is unlicensed:
              check the number&apos;s form and confirm on DLI&apos;s lookup, which changes nightly.
            </p>
          )}
        </div>
      ) : null}

      <h2 id="residential" className="mt-10 text-xl font-semibold">Residential contractors</h2>
      <p className="mt-2 text-sm leading-relaxed">{rc.rule}</p>
      <ClassTable rows={rc.businessClasses} caption="Business credentials" />
      <ClassTable rows={rc.qualifyingPersons} caption="Qualifying persons (individuals)" />
      <p className="mt-2 text-sm">
        <a className="underline" href={MN_RESIDENTIAL}>DLI residential contractor licensing</a>
      </p>

      <h2 id="electrical" className="mt-10 text-xl font-semibold">Electrical</h2>
      <p className="mt-2 text-sm leading-relaxed">
        An electrical contractor license is held by a business; a master or journeyworker electrician license is held by a
        person. They are listed apart and never added. A registered unlicensed individual is a registration, not a license.
      </p>
      <ClassTable rows={s.electrical.businessClasses} caption="Business credentials" />
      <ClassTable rows={s.electrical.personClasses} caption="Individual credentials" />

      <h2 id="plumbing" className="mt-10 text-xl font-semibold">Plumbing</h2>
      <p className="mt-2 text-sm leading-relaxed">
        A plumbing contractor license is held by a business; a master or journeyworker plumber license is held by a person.
        Backflow and medical gas credentials are certifications, and a pipelaying bond is a bond.
      </p>
      <ClassTable rows={s.plumbing.businessClasses} caption="Business credentials" />
      <ClassTable rows={s.plumbing.personClasses} caption="Individual credentials" />

      <h2 id="bonds" className="mt-10 text-xl font-semibold">Bonds and registrations</h2>
      <p className="mt-2 text-sm leading-relaxed">{s.bonds_and_registrations.rule}</p>
      <ClassTable rows={s.bonds_and_registrations.bonds} caption="Bonds" />
      <ClassTable rows={s.bonds_and_registrations.contractorRegistration} caption="Contractor Registration" />
      <p className="mt-3 text-sm leading-relaxed">{s.other_ccld_credentials.note}</p>

      <h2 id="enforcement" className="mt-10 text-xl font-semibold">Residential contractor enforcement ({fmt(d.rows)} actions)</h2>
      <p className="mt-2 text-sm leading-relaxed">
        From DLI&apos;s residential building contractor enforcement action lists for 2024, 2025, and 2026 to date, {d.firstActionDate}{" "}
        through {d.lastActionDate} (PARTIAL): {Object.entries(d.actionTypes).map(([k, v]) => `${k} ${fmt(v)}`).join(" · ")}. DLI
        notes: &quot;{d.disclaimerPrinted}&quot; {fmt(d.rowsWithCredentialNumberPrinted)} actions print a credential number;{" "}
        {fmt(d.rowsAttachedByExactCredentialNumber)} of those match a number in the export exactly and show in the lookup above.
        The other {fmt(d.rowsWithoutCredentialNumber)} print no number, often because the respondent was unlicensed, and stay
        standalone. Nothing is matched by name. Earlier years, other trade enforcement, and full order text were not loaded.{" "}
        <a className="underline" href={MN_ENFORCEMENT}>DLI enforcement lists</a>
      </p>
      <EventTable rows={recent.slice(0, 30)} synopsis />
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">Show all {fmt(d.rows)} actions</summary>
        <EventTable rows={recent} synopsis={false} />
      </details>

      <h2 id="complaints" className="mt-10 text-xl font-semibold">Complaints</h2>
      <p className="mt-2 text-sm leading-relaxed">
        DLI takes complaints about residential contractors and about unlicensed work. Complaint records are not published
        and none were loaded. A complaint is not a finding, and a consent order is not a finding of fact.{" "}
        <a className="underline" href={MN_COMPLAINT}>File a complaint with DLI</a>
      </p>

      <h2 className="mt-10 text-xl font-semibold">Limitations</h2>
      <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">
        <li>No count of Minnesota contractors or construction professionals. Business credentials, individual credentials, bonds, certifications, registrations, and enforcement actions are different things and are never added.</li>
        <li>Individual credentials resolve by exact number only; names, phones, emails, and street addresses from the export are not republished.</li>
        <li>A bond is not an identity, a quality signal, or insurance. An expiration date in the future does not make a credential current.</li>
        <li>No record is attached to a credential by name. No Minneapolis, St. Paul, Rochester, or Duluth pages; city and county permits are not covered.</li>
        <li>No ranking, recommendation, or Trust Score.</li>
      </ul>
      <p className="mt-4 text-xs text-slate-600">
        {fmt(b.rows)} business rows · {fmt(p.rows)} individual rows · credential numbers resolve exactly as DLI prints them.
      </p>
    </main>
  );
}
