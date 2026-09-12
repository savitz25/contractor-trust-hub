import type { Metadata } from "next";
import { AskForm } from "@/components/ask/AskForm";
import { AskResults } from "@/components/ask/AskResults";
import { interpretAskQuery } from "@/lib/ask/interpret";
import { buildContractorResearchQuery } from "@/lib/ask/plan";
import { executeContractorResearchQuery } from "@/lib/ask/execute";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";
import { pageMetadata } from "@/lib/seo/page-meta";
import { planContractorSearch } from "@/lib/search/contractor-discovery";
import { readAskRequest,researchRoute } from "@/lib/ask/request";
import { askHref } from "@/lib/ask/url";
import { redirect } from "next/navigation";
import { SearchAnalytics } from "@/components/specialist-search/SearchAnalytics";
import { searchResultCountBucket } from "@/lib/specialist-search/analytics";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string,string|string[]|undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const {query:q}=readAskRequest(sp);
  return pageMetadata({
    title: q ? `Ask: ${q.slice(0, 60)}` : "Ask ContractorTrustHub",
    description: "Structured contractor research questions over indexed licensing records. Not a ranking.",
    path: "/ask",
    noIndex: true,
  });
}

export default async function AskPage({ searchParams }: Props) {
  const sp = await searchParams;
  const {query:q,overrides,error}=readAskRequest(sp);
  if(error)return <main className="th-shell py-10"><h1>Check your search</h1><p role="alert">{error}</p><AskForm initialQuery={q} compact /></main>;
  const multiStatePlan = planContractorSearch(q,overrides);
  if(researchRoute(q,multiStatePlan)==='/search')redirect(askHref(q,overrides).replace(/^\/ask/,'/search'));
  const intel = loadContractorHubIntel();
  const interpreted = interpretAskQuery(q, intel);
  const plan = buildContractorResearchQuery(interpreted, overrides);
  const execution = q ? await executeContractorResearchQuery(plan) : {
    ok: false,
    blocked: false,
    blockMessage: null,
    contractorCount: null,
    credentialCount: null,
    evidenceSourceRows: null,
    grainLabel: "none",
    asOf: intel.generatedAt.slice(0, 10),
    snapshotFingerprint: intel.sourceFingerprint,
    results: [],
    page: 1,
    pageSize: 24,
    sqlContract: "contractors ⋈ licenses",
    evidenceJoinable: null,
    compare: null,
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="cth-intel-eyebrow">Research contractors</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--navy)]">What do you want to find out?</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Ask in normal language or enter a company or credential. Get indexed research, verification guidance, or an official next step.
      </p>
      <div className="mt-6">
        <AskForm key={q} initialQuery={q || undefined} overrides={overrides} compact />
      </div>
      {q ? (
        <div className="mt-10">
          {!plan.recovery && <SearchAnalytics dimensions={{ hub: "contractor", intent: interpreted.mode, state: plan.geography.state || undefined, classification: plan.trade.familyId || undefined, hasIdentifier: Boolean(plan.identity.identifier), hasEvidenceFilter: Boolean(plan.evidenceFamily), resultCountBucket: searchResultCountBucket(execution.contractorCount || 0), coverageState: execution.blocked ? "PARTIAL" : "KNOWN" }} hasResults={execution.results.length > 0} />}
          <AskResults interpreted={interpreted} plan={plan} execution={execution} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-[var(--muted)]">Enter a question to run a deterministic research query.</p>
      )}
    </main>
  );
}
