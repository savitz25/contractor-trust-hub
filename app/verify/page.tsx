import type { Metadata } from "next";
import Link from "next/link";
import { EmptyResults } from "@/components/search/EmptyResults";
import { ResultCard } from "@/components/search/ResultCard";
import { SearchForm } from "@/components/search/SearchForm";
import { TexasCoverageBanner } from "@/components/search/TexasCoverageBanner";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { searchContractors } from "@/lib/contractors/queries";
import { pageMetadata } from "@/lib/seo/page-meta";
import { getLiveStates, getStateBySlug } from "@/lib/states/config";

type Props = {
  searchParams: Promise<{ q?: string; intent?: string; state?: string }>;
};

function resolveVerifyState(raw: string | undefined) {
  const slug = (raw || "fl").toLowerCase();
  const state = getStateBySlug(slug);
  if (state?.live) return state;
  return getStateBySlug("fl")!;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const state = resolveVerifyState(sp.state);
  const isTx = state.slug === "tx";
  return pageMetadata({
    title: isTx
      ? "Verify a Texas specialty contractor (TDLR)"
      : "Verify a Florida contractor",
    description: isTx
      ? "Search TDLR specialty trade licenses in Texas (electrical, A/C, and related). Not a statewide general contractor directory. Evidence only — not a marketplace."
      : "Search Florida contractor licenses by name or license number. Official DBPR status, Sunbiz entity links, and board discipline — free Trust Reports, not a marketplace.",
    path: isTx ? "/verify?state=tx" : "/verify",
  });
}

export default async function VerifyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const state = resolveVerifyState(sp.state);
  const isTx = state.slug === "tx";
  const q = (sp.q || "").trim();
  const intent = sp.intent === "have" || sp.intent === "research" ? sp.intent : null;
  let results: Awaited<ReturnType<typeof searchContractors>>["results"] = [];
  let mode: "license" | "name" = "name";
  let error: string | null = null;

  if (q.length >= 2) {
    try {
      const res = await searchContractors(q, { stateSlug: state.slug });
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

  const liveStates = getLiveStates();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        {isTx ? "Texas · TDLR specialty trades" : "Florida · DBPR + Sunbiz"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
        {isTx ? "Verify a Texas specialty contractor" : "Verify a Florida contractor"}
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        {isTx
          ? "Search TDLR specialty licenses by number or business / owner name. Results show license type, status, and county when available — then open a Trust Report."
          : "Search by license number or business name. Result cards show license status, entity status, and location first — then open a full Trust Report."}
      </p>
      {intentBlurb && (
        <p className="mt-2 max-w-2xl text-sm text-[var(--accent)]/90">{intentBlurb}</p>
      )}

      {/* State switcher */}
      {liveStates.length > 1 ? (
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Verify state">
          {liveStates.map((s) => {
            const active = s.slug === state.slug;
            const href =
              s.slug === "fl"
                ? q
                  ? `/verify?q=${encodeURIComponent(q)}`
                  : "/verify"
                : q
                  ? `/verify?state=${s.slug}&q=${encodeURIComponent(q)}`
                  : `/verify?state=${s.slug}`;
            return (
              <Link
                key={s.slug}
                href={href}
                role="tab"
                aria-selected={active}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold no-underline transition ${
                  active
                    ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--navy)] hover:border-[var(--navy)]/30"
                }`}
              >
                {s.name}
              </Link>
            );
          })}
        </div>
      ) : null}

      {isTx ? (
        <div className="mt-5 max-w-3xl">
          <TexasCoverageBanner />
        </div>
      ) : null}

      <div className="mt-7 max-w-3xl sm:mt-8">
        <SearchForm
          defaultQuery={q}
          autoFocus={!q}
          intent={intent}
          stateSlug={state.slug}
        />
        <p className="mt-2.5 text-xs leading-relaxed text-[var(--muted)]">
          {isTx
            ? "Specialty trades only (electrical, A/C, and related TDLR contractor classes). Not a statewide general contractor directory."
            : "Name search ignores common legal endings (LLC, Inc, Corp). Entity links stay high-confidence only."}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-relaxed text-rose-900"
        >
          <p className="font-medium text-rose-950">Search is temporarily unavailable</p>
          <p className="mt-1 text-rose-900/90">
            We could not reach the license database right now. Please try again in a few minutes.
          </p>
          <p className="mt-3 text-xs text-rose-800/80">
            {isTx ? (
              <>
                Texas data may still be loading into production. Florida Verify remains at{" "}
                <Link href="/verify" className="font-medium underline">
                  /verify
                </Link>
                .
              </>
            ) : (
              <>
                You can still{" "}
                <Link href="/#research" className="font-medium text-rose-950 underline">
                  browse by county and trade
                </Link>{" "}
                or return later.
              </>
            )}{" "}
            <span className="opacity-70">(Technical: {error})</span>
          </p>
        </div>
      )}

      {q.length > 0 && q.length < 2 && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
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
              {isTx ? " · TDLR specialty" : ""}
              {results.length >= 25 ? " · showing first 25" : ""}
            </p>
          </div>

          {results.length === 0 ? (
            <div className="space-y-4">
              <EmptyResults query={q} mode={mode} />
              {isTx ? (
                <TexasCoverageBanner compact />
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <ResultCard key={r.id} result={r} hideEntityWhenMissing={isTx} />
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
          {(isTx
            ? [
                {
                  t: "License number",
                  d: "TDLR numbers (e.g. 10001) or full product keys. Most precise when you have the card.",
                },
                {
                  t: "Business or owner name",
                  d: "Matches business name and owner name from the TDLR open extract.",
                },
                {
                  t: "What you’ll see",
                  d: "License type (electrical, A/C, …), status from expiration when available, and county — then a Trust Report.",
                },
              ]
            : [
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
              ]
          ).map((card) => (
            <div
              key={card.t}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5"
            >
              <p className="text-sm font-semibold text-[var(--text)]">{card.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{card.d}</p>
            </div>
          ))}
          <div className="sm:col-span-3 space-y-1">
            {!isTx ? (
              <p className="text-xs text-[var(--muted)]">
                Don&apos;t have a specific name?{" "}
                <Link href="/#research" className="text-[var(--accent)]">
                  Browse by county and trade
                </Link>
                .
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Looking for Florida DBPR construction licenses?{" "}
                <Link href="/verify" className="text-[var(--accent)]">
                  Open Florida Verify
                </Link>
                .
              </p>
            )}
            <p className="text-xs text-[var(--muted)]">
              <Link href="/#search" className="text-[var(--accent)]">
                Back to homepage search
              </Link>
            </p>
          </div>
        </section>
      )}

      <div className="mt-12">
        <LegalNotice />
      </div>
    </main>
  );
}
