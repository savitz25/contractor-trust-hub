import type { Metadata } from "next";
import { AskForm } from "@/components/ask/AskForm";
import { AskResults } from "@/components/ask/AskResults";
import { interpretAskQuery } from "@/lib/ask/interpret";
import { buildContractorResearchQuery, parseAskOverrides } from "@/lib/ask/plan";
import { executeContractorResearchQuery } from "@/lib/ask/execute";
import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";
import { pageMetadata } from "@/lib/seo/page-meta";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; geo?: string; trade?: string; status?: string; evidence?: string; sort?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  return pageMetadata({
    title: q ? `Ask: ${q.slice(0, 60)}` : "Ask ContractorTrustHub",
    description: "Structured contractor research questions over indexed licensing records. Not a ranking.",
    path: "/ask",
    noIndex: true,
  });
}

export default async function AskPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const intel = loadContractorHubIntel();
  const interpreted = interpretAskQuery(q, intel);
  const plan = buildContractorResearchQuery(interpreted, parseAskOverrides({
    geo: sp.geo,
    trade: sp.trade,
    status: sp.status,
    evidence: sp.evidence,
    sort: sp.sort,
    page: sp.page,
  }));
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
      <p className="cth-intel-eyebrow">Ask ContractorTrustHub</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--navy)]">Structured contractor research</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        We interpret your question, then query indexed licensing records. This is not a generic web search and not an AI that invents license facts.
      </p>
      <div className="mt-6">
        <AskForm initialQuery={q || undefined} compact />
      </div>
      {q ? (
        <div className="mt-10">
          <AskResults interpreted={interpreted} plan={plan} execution={execution} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-[var(--muted)]">Enter a question to run a deterministic research query.</p>
      )}
    </main>
  );
}
