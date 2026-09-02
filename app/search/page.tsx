import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DiscoverySearchForm } from "@/components/search/DiscoverySearchForm";
import { planContractorSearch } from "@/lib/search/contractor-discovery";
import {
  contractorRequestErrorResponse,
  contractorUnsupportedElectricalResponse,
  executeContractorSpecialistQuery,
  type ContractorCapabilityResponse,
  type ContractorExecutionResponse,
  type ContractorExecutionRequest,
} from "@/lib/specialist-execution/contractor-v2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Find and research contractors", description: "Research source-backed contractor credential cohorts by trade and recorded regulatory geography.", alternates: { canonical: "/search" }, robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ q?: string; page?: string; confirmStatewide?: string }> };
type BackendResponse = { resultState: "BACKEND_UNAVAILABLE"; queryInterpretation: Record<string, unknown>; limitations: string[] };
type SearchResponse = ContractorExecutionResponse | ContractorCapabilityResponse | ReturnType<typeof contractorRequestErrorResponse> | BackendResponse;

function choiceHref(choice: ContractorCapabilityResponse["capabilityChoices"][number]) {
  const request = choice.request;
  if (!request) return choice.destination ?? "/verify";
  const parts = [request.trade ? String(request.trade).replaceAll("_", " ") : "contractors", request.state === "NJ" ? "in New Jersey" : request.state === "FL" ? "in Florida" : `in ${request.state ?? ""}`];
  return `/search?q=${encodeURIComponent(parts.join(" ").trim())}${request.confirmStatewide ? "&confirmStatewide=true" : ""}`;
}

function geographyLabel(response: SearchResponse): string {
  const interpretation = response.queryInterpretation as Record<string, unknown>;
  const geo = interpretation.geography as { meaning?: string } | null | undefined;
  return geo?.meaning ?? "Recorded credential geography; not service territory or current availability.";
}

async function execute(request: ContractorExecutionRequest): Promise<SearchResponse> {
  try {
    return await executeContractorSpecialistQuery(request);
  } catch (error) {
    if (error instanceof Error && error.message === "unsupported_florida_electrical_source") return contractorUnsupportedElectricalResponse(request);
    const code = error instanceof Error ? error.message : "execution_failed";
    if (/^(invalid_|unsupported_|clarification_)/.test(code)) return contractorRequestErrorResponse(error, request);
    console.error("[contractor-search] execution failed", code);
    return { resultState: "BACKEND_UNAVAILABLE", queryInterpretation: {}, limitations: ["Contractor credential research is temporarily unavailable. Your query was not broadened or replaced."] };
  }
}

export default async function ContractorSearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const plan = planContractorSearch(query);
  if (plan.mode === "verify") redirect(plan.verifyHref);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  let response: SearchResponse | null = null;
  if (plan.mode === "discovery") response = await execute({ ...plan.request, page, confirmStatewide: params.confirmStatewide === "true" });
  const rows = response && "rows" in response ? response.rows : [];
  const total = response && "total" in response ? response.total : 0;
  const pagination = response && "pagination" in response ? response.pagination : null;
  const choices = response && "capabilityChoices" in response ? response.capabilityChoices : [];

  return (
    <main className="th-shell py-10 sm:py-14">
      <header className="max-w-4xl">
        <p className="cth-intel-eyebrow">Find / research contractors</p>
        <h1>Contractor discovery research</h1>
        <p className="mt-2 text-[var(--muted)]">Search source-backed credential records by trade and supported recorded geography. Results are neutral research—not rankings or proof that a contractor serves an area.</p>
      </header>
      <div className="mt-6 max-w-5xl"><DiscoverySearchForm initialQuery={query} compact /></div>

      {plan.mode === "empty" ? <section className="mt-10 rounded-2xl border border-[var(--border)] bg-white p-6"><h2>Try a trade and place</h2><p className="mt-2 text-[var(--muted)]">Examples: roofers in Broward County, home improvement contractors in New Jersey, or HVAC contractors in Florida.</p></section> : null}
      {plan.mode === "clarification" ? <section className="mt-10 rounded-2xl border border-[var(--border)] bg-white p-6"><p className="cth-intel-eyebrow">Clarification needed</p><h2>Are you researching a contractor category or verifying a known business?</h2><div className="mt-4 flex flex-wrap gap-3"><Link className="cth-intel-btn cth-intel-btn--primary" href="/search">Research by trade and place</Link><Link className="cth-intel-btn cth-intel-btn--secondary" href={`/verify?q=${encodeURIComponent(query)}`}>Verify this name</Link></div></section> : null}

      {response ? (
        <section className="mt-10" aria-live="polite">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">{response.resultState.replaceAll("_", " ")}</p>
            <h2 className="mt-1">{response.resultState === "SUPPORTED_RESULTS" ? `${total.toLocaleString("en-US")} matching credential records` : response.resultState === "ZERO_MATCHING_ROWS" ? "No records match this supported intersection" : response.resultState === "BACKEND_UNAVAILABLE" ? "Contractor research is temporarily unavailable" : "A more precise research choice is needed"}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{geographyLabel(response)}</p>
            {response.limitations?.[0] ? <p className="mt-2 text-sm text-[var(--muted)]">{response.limitations[0]}</p> : null}
          </div>

          {choices.length ? <div className="mt-5"><h3>Available research paths</h3><div className="mt-3 flex flex-wrap gap-2">{choices.map((choice) => <Link key={choice.id} href={choiceHref(choice)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium no-underline hover:border-[var(--navy)]/40">{choice.label}</Link>)}</div></div> : null}

          {rows.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{rows.map((row) => (
            <article key={`${row.credentialNumber}:${row.destination}`} className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--navy)]">{row.trade}</p>
              <h3 className="mt-1 break-words">{row.name}</h3>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="font-medium">Credential</dt><dd className="break-all">{row.credentialNumber}</dd>
                <dt className="font-medium">Status</dt><dd>{row.status ?? "Not reported"}</dd>
                <dt className="font-medium">Recorded place</dt><dd>{[row.recordedGeography.city, row.recordedGeography.county, row.recordedGeography.state].filter(Boolean).join(", ") || "Not reported"}</dd>
                <dt className="font-medium">Source</dt><dd>{row.source.label}{row.source.observedAt ? ` · ${row.source.observedAt.slice(0, 10)}` : ""}</dd>
              </dl>
              <p className="mt-4 text-sm text-[var(--muted)]">{row.whyShown}</p>
              <div className="mt-4 flex flex-wrap gap-3"><Link href={row.destination} className="font-semibold text-[var(--navy)]">Open Trust Report</Link>{row.destinations.find((item) => item.type === "CONTRACTORTRUSTHUB_VERIFY") ? <Link href={row.destinations.find((item) => item.type === "CONTRACTORTRUSTHUB_VERIFY")!.url} className="font-medium">Verify credential</Link> : null}</div>
            </article>
          ))}</div> : null}

          {pagination && total > 0 ? <nav className="mt-8 flex items-center justify-between" aria-label="Search result pages"><span className="text-sm text-[var(--muted)]">Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2">{pagination.page > 1 ? <Link className="rounded-lg border px-4 py-2" href={`/search?q=${encodeURIComponent(query)}&page=${pagination.page - 1}`}>Previous</Link> : null}{pagination.hasNextPage ? <Link className="rounded-lg border px-4 py-2" href={`/search?q=${encodeURIComponent(query)}&page=${pagination.page + 1}`}>Next</Link> : null}</div></nav> : null}
        </section>
      ) : null}
      <aside className="mt-12 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">Have an exact company or credential? <Link href="/verify" className="font-semibold text-[var(--navy)]">Use Verify</Link>. Recorded regulatory geography does not establish service territory or current availability.</aside>
    </main>
  );
}
