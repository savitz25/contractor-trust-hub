import type { Metadata } from "next";
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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Florida · DBPR + Sunbiz
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
        Verify a Florida contractor
      </h1>
      <p className="mt-3 max-w-2xl text-[var(--muted)]">
        Search by license number or business name. Results show license status, county, and
        linked entity status when a high-confidence Sunbiz match exists.
      </p>

      <div className="mt-8 max-w-3xl">
        <SearchForm defaultQuery={q} autoFocus={!q} />
      </div>

      {error && (
        <div className="mt-8 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {q.length > 0 && q.length < 2 && (
        <p className="mt-8 text-sm text-[var(--muted)]">Enter at least 2 characters.</p>
      )}

      {q.length >= 2 && !error && (
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Results
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {results.length} match{results.length === 1 ? "" : "es"}
              {mode === "license" ? " · license search" : " · name search"}
            </p>
          </div>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/40 px-5 py-8 text-sm text-[var(--muted)]">
              No licensed Florida contractors matched{" "}
              <span className="text-[var(--text)]">&ldquo;{q}&rdquo;</span>. Try a full license
              id (e.g. CBC015082) or fewer words from the company name.
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
        <section className="mt-12 grid gap-4 sm:grid-cols-3">
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
              d: "Status, license type, county, and Sunbiz entity status when confidently linked.",
            },
          ].map((card) => (
            <div
              key={card.t}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4"
            >
              <p className="text-sm font-semibold text-[var(--text)]">{card.t}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{card.d}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
