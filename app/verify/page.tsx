import type { Metadata } from "next";
import Link from "next/link";
import { EmptyResults } from "@/components/search/EmptyResults";
import { ResultCard } from "@/components/search/ResultCard";
import { SearchForm } from "@/components/search/SearchForm";
import { searchContractors } from "@/lib/contractors/queries";

export const metadata: Metadata = {
  title: "Verify a Florida contractor",
  description:
    "Search Florida contractor licenses by name or license number. Official DBPR and Sunbiz evidence.",
  alternates: { canonical: "/verify" },
  openGraph: {
    title: "Verify a Florida contractor",
    description:
      "Search Florida contractor licenses by name or license number. Official DBPR and Sunbiz evidence.",
    url: "/verify",
    type: "website",
  },
};

type Props = {
  searchParams: Promise<{ q?: string; intent?: string }>;
};

export default async function VerifyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const intent = sp.intent === "have" || sp.intent === "research" ? sp.intent : null;
  let results: Awaited<ReturnType<typeof searchContractors>>["results"] = [];
  let mode: "license" | "name" = "name";
  let error: string | null = null;

  if (q.length >= 2) {
    try {
      const res = await searchContractors(q, { stateSlug: "fl" });
      results = res.results;
      mode = res.mode;
    } catch (e) {
      error =
        e instanceof Error
          ? e.message
          : "Search is temporarily unavailable. Check DATABASE_URL configuration.";
    }
  }

  const intentBlurb =
    intent === "have"
      ? "Confirming someone you’re already talking to — license id is most precise when you have it."
      : intent === "research"
        ? "Researching by name — try distinctive words from the company; drop LLC / Inc if needed."
        : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Florida · DBPR + Sunbiz
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
        Verify a Florida contractor
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        Search by license number or business name. Result cards show license status, entity
        status, and location first — then open a full Trust Report.
      </p>
      {intentBlurb && (
        <p className="mt-2 max-w-2xl text-sm text-[var(--accent)]/90">{intentBlurb}</p>
      )}

      <div className="mt-7 max-w-3xl sm:mt-8">
        <SearchForm defaultQuery={q} autoFocus={!q} intent={intent} />
        <p className="mt-2.5 text-xs leading-relaxed text-[var(--muted)]">
          Name search ignores common legal endings (LLC, Inc, Corp). Entity links stay
          high-confidence only.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm leading-relaxed text-rose-100"
        >
          <p className="font-medium text-rose-50">Search unavailable</p>
          <p className="mt-1 text-rose-100/90">{error}</p>
          <p className="mt-2 text-xs text-rose-100/70">
            Production needs <code className="rounded bg-black/20 px-1">DATABASE_URL</code> set to
            the Supabase Session pooler URI in Vercel.
          </p>
        </div>
      )}

      {q.length > 0 && q.length < 2 && (
        <div className="mt-8 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Enter at least 2 characters to search.
        </div>
      )}

      {q.length >= 2 && !error && (
        <section className="mt-9 sm:mt-10" aria-live="polite">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Results
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {results.length === 0
                ? "No matches"
                : `${results.length} match${results.length === 1 ? "" : "es"}`}
              {mode === "license" ? " · license search" : " · name search"}
              {results.length >= 25 ? " · showing first 25" : ""}
            </p>
          </div>

          {results.length === 0 ? (
            <EmptyResults query={q} mode={mode} />
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <ResultCard key={r.id} result={r} />
              ))}
              {results.length >= 25 && (
                <p className="pt-2 text-center text-sm text-[var(--muted)]">
                  Showing the first 25 matches. Add more of the company name or a license number to
                  narrow results.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {!q && (
        <section className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4">
          {[
            {
              t: "License number",
              d: "Most precise. Full ids like CBC015082 — spaces or dashes are fine.",
            },
            {
              t: "Company name",
              d: "Matches display, legal, and DBA fields. LLC / Inc endings are optional.",
            },
            {
              t: "What you’ll see",
              d: "License status, entity status, and location on every card — then a Trust Report.",
            },
          ].map((card) => (
            <div
              key={card.t}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5"
            >
              <p className="text-sm font-semibold text-[var(--text)]">{card.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{card.d}</p>
            </div>
          ))}
          <div className="sm:col-span-3">
            <p className="text-xs text-[var(--muted)]">
              Coming from the homepage?{" "}
              <Link href="/#search" className="text-[var(--accent)]">
                Back to the main search
              </Link>
              .
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
