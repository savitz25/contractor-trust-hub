import type { Metadata } from "next";
import Link from "next/link";
import { EmptyResults } from "@/components/search/EmptyResults";
import { NjCoverageBanner } from "@/components/search/NjCoverageBanner";
import { ResultCard } from "@/components/search/ResultCard";
import { SearchForm } from "@/components/search/SearchForm";
import { CaliforniaCoverageBanner } from "@/components/search/CaliforniaCoverageBanner";
import { OregonCoverageBanner } from "@/components/search/OregonCoverageBanner";
import { TexasCoverageBanner } from "@/components/search/TexasCoverageBanner";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { searchContractors } from "@/lib/contractors/queries";
import { pageMetadata } from "@/lib/seo/page-meta";
import { getLiveStates, getStateBySlug } from "@/lib/states/config";
import { TX_COVERED_TRADES_PLAIN } from "@/lib/states/tx-trades";

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
  if (state.slug === "tx") {
    return pageMetadata({
      title: "Verify a Texas specialty contractor (TDLR + TSBPE)",
      description:
        "Search Texas TDLR specialty trades and TSBPE plumbing licenses. Not a statewide general contractor directory. Evidence only — not a marketplace.",
      path: "/verify?state=tx",
    });
  }
  if (state.slug === "nj") {
    return pageMetadata({
      title: "Verify a New Jersey HIC or specialty contractor",
      description:
        "Search New Jersey Home Improvement Contractor (HIC) registrations and available specialty boards. No statewide general contractor license. Evidence only — not a marketplace.",
      path: "/verify?state=nj",
    });
  }
  if (state.slug === "or") {
    return pageMetadata({
      title: "Verify an Oregon contractor (CCB)",
      description:
        "Search Oregon Construction Contractors Board active licenses by number or business name. Bond and insurance fields as published. Evidence only — not a marketplace.",
      path: "/verify?state=or",
    });
  }
  if (state.slug === "ca") {
    return pageMetadata({
      title: "Verify a California contractor (CSLB)",
      description:
        "Search California CSLB licenses from official public list extracts for high-impact counties. Always confirm on CSLB Instant License Check. Evidence only — not a marketplace.",
      path: "/verify?state=ca",
    });
  }
  return pageMetadata({
    title: "Verify a Florida contractor",
    description:
      "Search Florida contractor licenses by name or license number. Official DBPR status, Sunbiz entity links, and board discipline — free Trust Reports, not a marketplace.",
    path: "/verify",
  });
}

export default async function VerifyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const state = resolveVerifyState(sp.state);
  const isTx = state.slug === "tx";
  const isNj = state.slug === "nj";
  const isOr = state.slug === "or";
  const isCa = state.slug === "ca";
  const isSpecialty = isTx || isNj || isOr || isCa;
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
      ? "Confirming someone you’re already talking to — registration or license id is most precise when you have it."
      : intent === "research"
        ? "Researching by name — try distinctive words from the company; drop LLC / Inc if needed."
        : null;

  const liveStates = getLiveStates();

  const kicker = isNj
    ? "New Jersey · HIC + specialty boards"
    : isTx
      ? "Texas · TDLR specialty + TSBPE plumbing"
      : isOr
        ? "Oregon · CCB statewide licenses"
        : isCa
          ? "California · CSLB high-impact counties"
          : "Florida · DBPR + Sunbiz";

  const heading = isNj
    ? "Verify a New Jersey HIC or specialty contractor"
    : isTx
      ? "Verify a Texas specialty contractor"
      : isOr
        ? "Verify an Oregon contractor"
        : isCa
          ? "Verify a California contractor"
          : "Verify a Florida contractor";

  const lead = isNj
    ? "Search by registration number or company name. New Jersey has no single statewide GC license — coverage is HIC registration plus available specialty boards from official DCA extracts."
    : isTx
      ? "Search TDLR specialty licenses or TSBPE plumbing by number or business / owner name. You’ll see the trade type in plain language, license status, and county when available."
      : isOr
        ? "Search CCB active licenses by number or business name. Result cards show type, status, location, and published bond/insurance signals — then open a Trust Report."
        : isCa
          ? "Search CSLB licenses by number or business name from official public list extracts for high-impact counties. Always confirm on Instant License Check."
          : "Search by license number or business name. Result cards show license status, entity status, and location first — then open a full Trust Report.";

  const helpCards = isNj
    ? [
        {
          t: "Registration number",
          d: "HIC or specialty board ids from invoices or contracts are most precise.",
        },
        {
          t: "Company name",
          d: "Matches business and owner names in the NJ DCA extract only.",
        },
        {
          t: "What you’ll see",
          d: "Credential type, status, location when available — then a Trust Report. Always confirm on the official DCA site.",
        },
      ]
    : isTx
      ? [
          {
            t: "License number",
            d: "TDLR numbers (e.g. 10001) are most precise when you have the card or invoice.",
          },
          {
            t: "Business or owner name",
            d: "Matches business and owner names from the TDLR open extract for specialty trades.",
          },
          {
            t: "What you’ll see",
            d: "Plain-language trade type (air conditioning, electrical, …), status, county when available — then a Trust Report.",
          },
        ]
      : isOr
        ? [
            {
              t: "CCB license number",
              d: "Oregon CCB numbers (e.g. 259513) are most precise.",
            },
            {
              t: "Business name",
              d: "Matches the CCB Active Licenses business / licensee name.",
            },
            {
              t: "What you’ll see",
              d: "License type, status, county, and bond/insurance listed signals when published — then a Trust Report.",
            },
          ]
        : isCa
          ? [
              {
                t: "CSLB license number",
                d: "Numeric CSLB license numbers from cards or invoices are most precise.",
              },
              {
                t: "Business name",
                d: "Matches the business name in the CSLB public list extract for loaded counties.",
              },
              {
                t: "What you’ll see",
                d: "Status, primary classification(s), location — then a Trust Report. Confirm on Instant License Check.",
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
        ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] sm:text-xs">
        {kicker}
      </p>
      <h1 className="mt-1.5 text-[1.65rem] font-semibold leading-tight tracking-tight text-[var(--text)] sm:mt-2 sm:text-4xl">
        {heading}
      </h1>
      <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:mt-3 sm:text-base">
        {lead}
      </p>
      {intentBlurb ? (
        <p className="mt-2 max-w-2xl text-sm text-[var(--accent)]/90">{intentBlurb}</p>
      ) : null}

      {liveStates.length > 1 ? (
        <div
          className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-5 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
          role="tablist"
          aria-label="Verify state"
        >
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
            const subtitle =
              s.slug === "tx"
                ? "Specialty trades"
                : s.slug === "nj"
                  ? "Verify pilot"
                : s.slug === "or"
                  ? "CCB statewide"
                  : s.slug === "ca"
                    ? "CSLB counties"
                  : s.slug === "fl"
                    ? "Full journey"
                    : null;
            return (
              <Link
                key={s.slug}
                href={href}
                role="tab"
                aria-selected={active}
                className={`inline-flex min-h-11 shrink-0 flex-col justify-center rounded-2xl border px-4 py-2 no-underline transition sm:min-h-10 sm:rounded-full sm:py-0 ${
                  active
                    ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--navy)] hover:border-[var(--navy)]/30"
                }`}
              >
                <span className="text-sm font-semibold leading-none">{s.name}</span>
                {subtitle ? (
                  <span
                    className={`mt-1 text-[10px] font-medium leading-none sm:hidden ${
                      active ? "text-white/75" : "text-[var(--muted)]"
                    }`}
                  >
                    {subtitle}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}

      {isTx ? (
        <div className="mt-4 max-w-3xl sm:mt-5">
          <TexasCoverageBanner showFloridaLink={!q} />
        </div>
      ) : null}
      {isNj ? (
        <div className="mt-4 max-w-3xl sm:mt-5">
          <NjCoverageBanner showFloridaLink={!q} />
        </div>
      ) : null}
      {isOr ? (
        <div className="mt-4 max-w-3xl sm:mt-5">
          <OregonCoverageBanner showFloridaLink={!q} />
        </div>
      ) : null}
      {isCa ? (
        <div className="mt-4 max-w-3xl sm:mt-5">
          <CaliforniaCoverageBanner showFloridaLink={!q} />
        </div>
      ) : null}

      <div className="mt-5 max-w-3xl sm:mt-7">
        <SearchForm
          defaultQuery={q}
          autoFocus={!q}
          intent={intent}
          stateSlug={state.slug}
        />
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)] sm:mt-2.5">
          {isTx
            ? `Specialty trades: ${TX_COVERED_TRADES_PLAIN.join(" · ").toLowerCase()}. Not a statewide general contractor directory.`
            : isNj
              ? "HIC + specialty boards when in extract. No statewide GC license. Entity links only when high-confidence — no name-only auto-joins."
              : isOr
                ? "Oregon CCB Active Licenses extract. Bond and insurance signals are as published — not a live certificate check."
                : isCa
                  ? "CSLB public list extract for high-impact counties. Confirm on Instant License Check. Missing ≠ unlicensed."
              : (
                <>
                  Name search ignores common legal endings (LLC, Inc, Corp). Entity links stay
                  high-confidence only.{" "}
                  <Link href="/guides/how-to-verify-florida-contractor" className="text-[var(--accent)]">
                    How to verify a Florida contractor
                  </Link>
                  .
                </>
              )}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-relaxed text-rose-900 sm:mt-8"
        >
          <p className="font-medium text-rose-950">Search is temporarily unavailable</p>
          <p className="mt-1 text-rose-900/90">
            We could not reach the license database right now. Please try again in a few minutes.
          </p>
          <p className="mt-3 text-xs text-rose-800/80">
            {isSpecialty ? (
              <>
                Florida Verify remains at{" "}
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
      ) : null}

      {q.length > 0 && q.length < 2 ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:mt-8">
          Enter at least 2 characters to search.
        </div>
      ) : null}

      {q.length >= 2 && !error ? (
        <section className="mt-7 sm:mt-10" aria-live="polite">
          <div className="mb-3 flex flex-col gap-0.5 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Results
            </h2>
            <p className="text-xs text-[var(--muted)] sm:text-sm">
              {results.length === 0
                ? "No matches"
                : `${results.length} match${results.length === 1 ? "" : "es"}`}
              {mode === "license" ? " · license search" : " · name search"}
              {isTx ? " · TDLR + TSBPE" : ""}
              {isNj ? " · NJ pilot" : ""}
              {isOr ? " · CCB" : ""}
              {isCa ? " · CSLB" : ""}
              {results.length >= 25 ? " · first 25" : ""}
            </p>
          </div>

          {results.length === 0 ? (
            <EmptyResults query={q} mode={mode} stateSlug={state.slug} />
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {results.map((r) => (
                <ResultCard key={r.id} result={r} hideEntityWhenMissing={isSpecialty} />
              ))}
              {results.length >= 25 ? (
                <p className="pt-1 text-center text-sm text-[var(--muted)] sm:pt-2">
                  Showing the first 25 matches. Add more of the company name or a license number to
                  narrow results.
                </p>
              ) : null}
              {isTx ? (
                <div className="pt-2 sm:pt-3">
                  <TexasCoverageBanner compact showFloridaLink={false} />
                </div>
              ) : null}
              {isNj ? (
                <div className="pt-2 sm:pt-3">
                  <NjCoverageBanner compact showFloridaLink={false} />
                </div>
              ) : null}
              {isOr ? (
                <div className="pt-2 sm:pt-3">
                  <OregonCoverageBanner compact showFloridaLink={false} />
                </div>
              ) : null}
              {isCa ? (
                <div className="pt-2 sm:pt-3">
                  <CaliforniaCoverageBanner compact showFloridaLink={false} />
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {!q ? (
        <section className="mt-8 grid gap-2.5 sm:mt-12 sm:grid-cols-3 sm:gap-4">
          {helpCards.map((card) => (
            <div
              key={card.t}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 sm:p-5"
            >
              <p className="text-sm font-semibold text-[var(--text)]">{card.t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)] sm:mt-2">{card.d}</p>
            </div>
          ))}
          <div className="space-y-1 sm:col-span-3">
            {isSpecialty ? (
              <p className="text-xs text-[var(--muted)]">
                Looking for Florida DBPR construction licenses and the full journey?{" "}
                <Link href="/verify" className="text-[var(--accent)]">
                  Open Florida Verify
                </Link>
                .
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Don&apos;t have a specific name?{" "}
                <Link href="/#research" className="text-[var(--accent)]">
                  Browse by county and trade
                </Link>
                {" · "}
                <Link href="/guides/how-to-verify-florida-contractor" className="text-[var(--accent)]">
                  How to verify
                </Link>
                .
              </p>
            )}
            <p className="text-xs text-[var(--muted)]">
              <Link href="/#search" className="text-[var(--accent)]">
                Back to homepage search
              </Link>
              {isNj ? null : (
                <>
                  {" · "}
                  <Link href="/verify?state=nj" className="text-[var(--accent)]">
                    New Jersey pilot
                  </Link>
                </>
              )}
            </p>
          </div>
        </section>
      ) : null}

      <div className="mt-10 sm:mt-12">
        <LegalNotice />
      </div>
    </main>
  );
}
