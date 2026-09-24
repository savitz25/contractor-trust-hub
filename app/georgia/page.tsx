import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-meta";
import {
  GA_CND_PAGE,
  GA_GOALS_LOOKUP,
  GA_RGC_FAQ,
  GA_ROSTER_FORM,
  GA_SOS_HOME,
  GEORGIA_INTELLIGENCE_GATE,
} from "@/lib/georgia-intelligence/publication";
import { GA_CEASE_AND_DESIST, GA_CREDENTIAL_CLASSES, GA_GENERATED_AT, GA_RETRIEVED_AT } from "@/lib/georgia-intelligence/snapshot";

export const metadata: Metadata = pageMetadata({
  title: GEORGIA_INTELLIGENCE_GATE.title,
  description: GEORGIA_INTELLIGENCE_GATE.description,
  path: GEORGIA_INTELLIGENCE_GATE.path,
});

export default function GeorgiaContractorPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Georgia · statewide</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Georgia contractor licensing</h1>
      <p className="mt-4 text-sm leading-relaxed">
        Statewide credentials are issued by the Georgia Secretary of State, Professional Licensing Boards Division, through GOALS.
        This page does not say how many contractors work in Georgia. License rosters were not purchased. Cease-and-desist orders are a separate evidence grain and are not attached to a license record.
      </p>
      <p className="mt-2 text-xs text-slate-600">
        Page generated {GA_GENERATED_AT.slice(0, 10)}. Cease-and-desist list retrieved {GA_RETRIEVED_AT}. The public order list does not print an order date, so source_as_of for each order is unknown.
      </p>
      <p className="mt-4 flex flex-wrap gap-3 text-sm">
        <a className="underline" href={GA_GOALS_LOOKUP}>Official license lookup</a>
        <a className="underline" href={GA_SOS_HOME}>Residential and general contractor board</a>
        <a className="underline" href={GA_CND_PAGE}>Source cease-and-desist page</a>
      </p>

      <h2 className="mt-10 text-xl font-semibold">Credential classes</h2>
      <ul className="mt-4 space-y-4">
        {GA_CREDENTIAL_CLASSES.map((row) => (
          <li key={row.id} className="rounded-xl border border-[var(--border)] p-4">
            <p className="font-semibold">{row.label}</p>
            <p className="mt-1 text-sm">{row.board}</p>
            <p className="mt-1 text-sm">Grain: {row.grain}</p>
            <p className="mt-1 text-sm">Coverage: {row.coverage}. {row.note}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-semibold">What is not claimed</h2>
      <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">
        <li>No bulk license file is loaded. Coverage of each class above is NOT_ACQUIRED.</li>
        <li>Paid SOS rosters exist (text file: license number, name, city, state, ZIP, county, issue date, expiration date). The 2025 request form prices an all-rosters package, including GOALS professions, at $3,000 by check or money order. That package was not purchased.</li>
        <li>The board FAQ discusses liability insurance and workers&apos; compensation requirements. A requirement is not evidence that a business currently holds insurance. Current compliance status is NOT_ACQUIRED. <a className="underline" href={GA_RGC_FAQ}>Board FAQ</a>.</li>
        <li>County permits, municipal registration, and corporate filings are out of scope.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">Cease-and-desist orders ({GA_CEASE_AND_DESIST.length})</h2>
      <p className="mt-2 text-sm leading-relaxed">
        These are board-published unlicensed-practice orders. None includes a license number. They are not matched to a ContractorTrustHub profile. A similar name is not a join.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {GA_CEASE_AND_DESIST.map((row) => (
          <li key={row.id} className="border-b border-[var(--border)] py-2">
            <span className="font-medium">{row.respondent}</span>
            {row.dba ? ` · ${row.dba}` : ""} · {row.location} · {row.practiceCategory} · order date unknown
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-600">
        Roster ordering instructions: <a className="underline" href={GA_ROSTER_FORM}>{GA_ROSTER_FORM}</a>
      </p>
    </main>
  );
}
