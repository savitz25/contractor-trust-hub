import type { Metadata } from "next";
import { StateIndexContent } from "@/components/state-index/state-index-content";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildGeorgiaContractorJsonLd } from "@/lib/georgia-intelligence/jsonld";
import {
  GA_CND_PAGE,
  GA_GOALS_LOOKUP,
  GA_SOS_HOME,
  GEORGIA_INTELLIGENCE_GATE,
} from "@/lib/georgia-intelligence/publication";
import { GA_CREDENTIAL_CLASSES, GA_GENERATED_AT, GA_RETRIEVED_AT } from "@/lib/georgia-intelligence/snapshot";
import { pageMetadata } from "@/lib/seo/page-meta";

export const metadata: Metadata = pageMetadata({
  title: GEORGIA_INTELLIGENCE_GATE.title,
  description: GEORGIA_INTELLIGENCE_GATE.description,
  path: GEORGIA_INTELLIGENCE_GATE.path,
});

const heading = GEORGIA_INTELLIGENCE_GATE.title.replace(/ \| ContractorTrustHub$/, "");
const residential = GA_CREDENTIAL_CLASSES.filter((row) => row.board.includes("Residential and Commercial"));
const trades = GA_CREDENTIAL_CLASSES.filter((row) => row.board.includes("Construction Industry"));

export default function GeorgiaContractorPage() {
  return (
    <>
      <JsonLd data={buildGeorgiaContractorJsonLd()} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Georgia · statewide</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">{heading}</h1>
        <p className="mt-4 text-sm leading-relaxed">
          Statewide credentials are issued by the Georgia Secretary of State, Professional Licensing Boards Division,
          through GOALS. Page generated {GA_GENERATED_AT.slice(0, 10)}. Cease-and-desist list retrieved {GA_RETRIEVED_AT}.
        </p>
        <StateIndexContent slug="georgia" />

        <h2 className="mt-10 text-xl font-semibold">Credential classes</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">Class</th>
                <th className="py-2 pr-3">Board</th>
              </tr>
            </thead>
            <tbody>
              {GA_CREDENTIAL_CLASSES.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="py-2 pr-3">{row.board}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-xl font-semibold">Residential and commercial credentials</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {residential.map((row) => (
            <li key={row.id}>{row.label}</li>
          ))}
        </ul>

        <h2 className="mt-10 text-xl font-semibold">Construction trade credentials</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {trades.map((row) => (
            <li key={row.id}>{row.label}</li>
          ))}
        </ul>

        <h2 className="mt-10 text-xl font-semibold">Official sources</h2>
        <p className="mt-4 flex flex-wrap gap-3 text-sm">
          <a className="underline" href={GA_GOALS_LOOKUP}>
            Official license lookup
          </a>
          <a className="underline" href={GA_SOS_HOME}>
            Residential and general contractor board
          </a>
          <a className="underline" href={GA_CND_PAGE}>
            Source cease-and-desist page
          </a>
        </p>
      </main>
    </>
  );
}
