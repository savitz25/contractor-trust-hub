import type { Metadata } from "next";
import Link from "next/link";
import { ResultCard } from "@/components/search/ResultCard";
import { SearchForm } from "@/components/search/SearchForm";
import { searchContractors } from "@/lib/contractors/queries";

export const metadata: Metadata = {
  title: "Verify a Florida contractor",
  description:
    "Search Florida contractor licenses by name or license number. Official DBPR and Sunbiz evidence.",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function VerifyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Florida · DBPR + Sunbiz
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
        Verify a Florida contractor
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        Search by license number or business name. Results show license status, county, and
        linked entity status only when a high-confidence Sunbiz match exists.
      </p>

      <div className="mt-7 max-w-3xl sm:mt-8">
        <SearchForm defaultQuery={q} autoFocus={!q} />
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
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-5 py-9 sm:px-8">
              <p className="text-base font-medium text-[var(--text)]">
                No licensed Florida contractors matched &ldquo;{q}&rdquo;
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
                <li>
                  Try the full license id (e.g.{" "}
                  <Link href="/verify?q=CBC015082" className="text-[var(--accent)]">
                    CBC015082
                  </Link>
                  ) when you have it — most precise.
                </li>
                <li>Use fewer words from the legal or DBA name (drop LLC / Inc).</li>
                <li>Check spelling; we match official board extracts, not marketing names.</li>
              </ul>
              <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]">
                Thin “qualifying business” shells without a full license board record are hidden
                from consumer search by design.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <ResultCard key={r.id} result={r} />
              ))}
            </div>
          )}
        </section>
      )}

      {!q && (
        <section className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4">
          {[
            {
              t: "License number",
              d: "Best precision. Use the full alternate id when you have it (CBC, CGC, CCC…).",
            },
            {
              t: "Company name",
              d: "Matches display name, DBA, and licensee name fields from the board extract.",
            },
            {
              t: "What you’ll see",
              d: "Status, license type, county, and Sunbiz entity status only when confidently linked.",
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
        </section>
      )}
    </main>
  );
}
