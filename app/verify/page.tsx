import type { Metadata } from "next";
import Link from "next/link";
import { EmptyResults } from "@/components/search/EmptyResults";
import { NjCoverageBanner } from "@/components/search/NjCoverageBanner";
import { ResultCard } from "@/components/search/ResultCard";
import { SearchForm } from "@/components/search/SearchForm";
import { ArizonaCoverageBanner } from "@/components/search/ArizonaCoverageBanner";
import { WashingtonCoverageBanner } from "@/components/search/WashingtonCoverageBanner";
import { CaliforniaCoverageBanner } from "@/components/search/CaliforniaCoverageBanner";
import { OregonCoverageBanner } from "@/components/search/OregonCoverageBanner";
import { TexasCoverageBanner } from "@/components/search/TexasCoverageBanner";
import { LouisianaCoverageBanner } from "@/components/search/LouisianaCoverageBanner";
import { MississippiCoverageBanner } from "@/components/search/MississippiCoverageBanner";
import { KentuckyCoverageBanner } from "@/components/search/KentuckyCoverageBanner";
import { LegalNotice } from "@/components/trust/LegalNotice";
import { VerifyWorkChips } from "@/components/verify/VerifyWorkChips";
import { searchContractors } from "@/lib/contractors/queries";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { verifyMetadata } from "@/lib/seo/verify-meta";
import { getLiveStates, getStateBySlug } from "@/lib/states/config";
import { TX_COVERED_TRADES_PLAIN } from "@/lib/states/tx-trades";
import { parseWorkIntent, verifyPathWithWork } from "@/lib/verify/work-intents";
import { parseContractorAskHandoff } from "@/lib/ask-handoff/parse";
import { AskSearchContextBanner } from "@/components/ask-handoff/AskSearchContextBanner";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function resolveVerifyState(raw: string | undefined) {
  const slug = (raw || "fl").toLowerCase();
  const state = getStateBySlug(slug);
  if (state?.live) return state;
  return getStateBySlug("fl")!;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const state = resolveVerifyState(firstParam(sp.state));
  return verifyMetadata(state.slug, firstParam(sp.q), firstParam(sp.work));
}

export default async function VerifyPage({ searchParams }: Props) {
  const sp = await searchParams;
  const state = resolveVerifyState(firstParam(sp.state));
  const isTx = state.slug === "tx";
  const isNj = state.slug === "nj";
  const isOr = state.slug === "or";
  const isCa = state.slug === "ca";
  const isAz = state.slug === "az";
  const isWa = state.slug === "wa";
  const isLa = state.slug === "la";
  const isMs = state.slug === "ms";
  const isKy = state.slug === "ky";
  const isSpecialty = isTx || isNj || isOr || isCa || isAz || isWa || isLa || isMs || isKy;
  const q = (firstParam(sp.q) || "").trim();
  const intentRaw = firstParam(sp.intent);
  const intent = intentRaw === "have" || intentRaw === "research" ? intentRaw : null;
  const work = parseWorkIntent(firstParam(sp.work));
  let results: Awaited<ReturnType<typeof searchContractors>>["results"] = [];
  let mode: "license" | "name" = "name";
  let error: string | null = null;

  if (q.length >= 2 || work) {
    try {
      const res = await searchContractors(q, { stateSlug: state.slug, work });
      results = res.results;
      mode = res.mode;
    } catch (e) {
      const { dbUserFacingError } = await import("@/lib/db");
      error = dbUserFacingError(e);
      console.error(
        `[verify] search failed state=${state.slug} qLen=${q.length} work=${work || "-"}:`,
        error
      );
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
          : isAz
            ? "Arizona · ROC statewide licenses"
            : isWa
              ? "Washington · L&I statewide licenses"
              : isLa
                ? "Louisiana · LSLBC statewide licenses"
                : isMs
                  ? "Mississippi · MSBOC statewide licenses"
                  : isKy
                    ? "Kentucky · DHBC specialty trades"
            : "Florida · DBPR + Sunbiz";

  const heading = isNj
    ? "Verify a New Jersey HIC or specialty contractor"
    : isTx
      ? "Verify a Texas specialty contractor"
      : isOr
        ? "Verify an Oregon contractor"
        : isCa
          ? "Verify a California contractor"
          : isAz
            ? "Verify an Arizona contractor"
            : isWa
              ? "Verify a Washington contractor"
              : isLa
                ? "Verify a Louisiana contractor"
                : isMs
                  ? "Verify a Mississippi contractor"
                  : isKy
                    ? "Verify a Kentucky specialty contractor"
            : "Verify a Florida contractor";

  const lead = isNj
    ? "Search by registration number or company name. New Jersey has no single statewide GC license — coverage is HIC registration plus available specialty boards from official DCA extracts."
    : isTx
      ? "Search TDLR specialty licenses or TSBPE plumbing by number or business / owner name. You’ll see the trade type in plain language, license status, and county when available."
      : isOr
        ? "Search CCB active licenses by number or business name. Result cards show type, status, location, and published bond/insurance signals — then open a Trust Report."
        : isCa
          ? "Search CSLB licenses by number or business name from official public list extracts for high-impact counties. Always confirm on Instant License Check."
          : isAz
            ? "Search ROC licenses by number or business name from the official current active posting list. Result cards show status, class, and residential/commercial/dual category when published."
            : isWa
              ? "Search Washington L&I contractor licenses by number or business name. Always confirm on L&I Verify."
              : isLa
                ? "Search LSLBC licenses by number or business name. Result cards show published type, Active status, and parish — then open a Trust Report."
                : isMs
                  ? "Search MSBOC licenses by number or business name. Result cards show commercial / residential type, published status, and MC / SC when on the number."
                  : isKy
                    ? "Search DHBC electrical, HVAC, and plumbing contractor credentials by number or name. Kentucky has no statewide GC license — a miss does not mean unlicensed."
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
            d: "Plain-language trade type (air conditioning, electrical, ...), status, county when available — then a Trust Report.",
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
          : isAz
            ? [
                {
                  t: "ROC license number",
                  d: "Arizona ROC numbers from cards or contracts are most precise (leading zeros are fine).",
                },
                {
                  t: "Business name",
                  d: "Matches business and DBA names in the ROC current active posting list.",
                },
                {
                  t: "What you’ll see",
                  d: "Status, class code/detail, residential/commercial/dual category, location — then a Trust Report. Confirm on ROC search.",
                },
              ]
            : isWa
              ? [
                  {
                    t: "L&I license number",
                    d: "Washington L&I contractor numbers from cards or invoices are most precise.",
                  },
                  {
                    t: "Business name",
                    d: "Matches business names in the Washington L&I contractor extract.",
                  },
                  {
                    t: "What you’ll see",
                    d: "Status, trade class when published, location — then a Trust Report. Confirm on L&I Verify.",
                  },
                ]
            : isLa
              ? [
                  {
                    t: "LSLBC license number",
                    d: "Louisiana license numbers from cards or contracts are most precise.",
                  },
                  {
                    t: "Business name",
                    d: "Matches business names in the official LSLBC public roster.",
                  },
                  {
                    t: "What you’ll see",
                    d: "Published type, Active status, parish — then a Trust Report. Confirm on the official lookup.",
                  },
                ]
              : isMs
                ? [
                    {
                      t: "MSBOC license number",
                      d: "Mississippi numbers such as 22954-MC are most precise.",
                    },
                    {
                      t: "Business name",
                      d: "Matches business names in the official MSBOC exported list.",
                    },
                    {
                      t: "What you’ll see",
                      d: "Commercial / residential type, published status, and MC / SC when on the number.",
                    },
                  ]
                : isKy
                  ? [
                      {
                        t: "DHBC license number",
                        d: "Electrical (CE...), HVAC (HM...), and plumbing (M...) numbers from cards or invoices are most precise.",
                      },
                      {
                        t: "Name or DBA",
                        d: "Matches licensee and DBA names on the official DHBC contractor-type list.",
                      },
                      {
                        t: "What you’ll see",
                        d: "Published specialty type, Active status, and dates — then a Trust Report. Not a statewide GC directory.",
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
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          {
            name: heading,
            path: state.slug === "fl" ? "/verify" : `/verify?state=${state.slug}`,
          },
        ]}
      />
      <AskSearchContextBanner ctx={parseContractorAskHandoff(sp)} />
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
          className="mt-4 flex flex-wrap gap-2 sm:mt-5"
          role="tablist"
          aria-label="Verify state"
        >
          {liveStates.map((s) => {
            const active = s.slug === state.slug;
            const href = verifyPathWithWork(s.slug, { q, work, intent });
            const subtitle =
              s.slug === "tx"
                ? "Specialty trades"
                : s.slug === "nj"
                  ? "Verify pilot"
                : s.slug === "or"
                  ? "CCB statewide"
                  : s.slug === "ca"
                    ? "CSLB counties"
                    : s.slug === "az"
                      ? "ROC statewide"
                      : s.slug === "wa"
                        ? "L&I statewide"
                        : s.slug === "la"
                          ? "LSLBC statewide"
                          : s.slug === "ms"
                            ? "MSBOC statewide"
                            : s.slug === "ky"
                              ? "DHBC specialty"
                  : s.slug === "fl"
                    ? "Full journey"
                    : null;
            return (
              <Link
                key={s.slug}
                href={href}
                role="tab"
                aria-selected={active}
                className={`inline-flex min-h-11 shrink-0 flex-col justify-center rounded-2xl border px-3.5 py-2 no-underline transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:min-h-10 sm:rounded-full sm:py-1.5 ${
                  active ? "control-selected" : "control-off"
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
      {isAz ? (
        <div className="mt-4 max-w-3xl sm:mt-5">
          <ArizonaCoverageBanner showFloridaLink={!q} />
        </div>
      ) : null}
      {isWa ? (
        <div className="mt-4 max-w-3xl sm:mt-5">
          <WashingtonCoverageBanner showFloridaLink={!q} />
        </div>
      ) : null}
      {isLa ? (
        <div className="mt-4 max-w-3xl sm:mt-5">
          <LouisianaCoverageBanner showFloridaLink={!q} />
        </div>
      ) : null}
      {isMs ? (
        <div className="mt-4 max-w-3xl sm:mt-5">
          <MississippiCoverageBanner showFloridaLink={!q} />
        </div>
      ) : null}
      {isKy ? (
        <div className="mt-4 max-w-3xl sm:mt-5">
          <KentuckyCoverageBanner showFloridaLink={!q} />
        </div>
      ) : null}

      <div className="mt-5 max-w-3xl sm:mt-7">
        <VerifyWorkChips stateSlug={state.slug} activeWork={work} q={q} intent={intent} />
        <SearchForm
          defaultQuery={q}
          autoFocus={!q && !work}
          intent={intent}
          stateSlug={state.slug}
          workIntent={work}
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
                  : isAz
                    ? "Arizona ROC current active posting list. Confirm on official ROC contractor search. Missing ≠ unlicensed."
                    : isWa
                      ? "Washington L&I contractor extract. Confirm on official L&I Verify. Missing ≠ unlicensed."
                      : isLa
                        ? "Louisiana LSLBC official public roster. Confirm on the official lookup. Missing ≠ unlicensed."
                        : isMs
                          ? "Mississippi MSBOC official exported list. Confirm on the official board lookup. Missing ≠ unlicensed."
                          : isKy
                            ? "Kentucky DHBC specialty trades only — electrical, HVAC, plumbing contractors. No statewide GC. Missing ≠ unlicensed."
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
            {state.slug === "fl" ? (
              <>
                You can still{" "}
                <Link href="/#research" className="font-medium text-rose-950 underline">
                  browse Florida by county and trade
                </Link>{" "}
                or try again shortly.
              </>
            ) : (
              <>
                Try again in a moment, or{" "}
                <Link href="/tools/coverage" className="font-medium text-rose-950 underline">
                  see where we cover
                </Link>
                .{" "}
                <Link href="/verify" className="font-medium underline">
                  Florida Verify
                </Link>{" "}
                is a separate path when your project is in Florida.
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

      {(q.length >= 2 || work) && !error ? (
        <section className="mt-7 sm:mt-10" aria-live="polite">
          <div className="mb-3 flex flex-col gap-0.5 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Results
            </h2>
            <p className="text-xs text-[var(--muted)] sm:text-sm">
              {results.length === 0
                ? "No matches"
                : `${results.length} match${results.length === 1 ? "" : "es"}`}
              {mode === "license" ? " · license search" : work ? " · type-assisted search" : " · name search"}
              {isTx ? " · TDLR + TSBPE" : ""}
              {isNj ? " · NJ pilot" : ""}
              {isOr ? " · CCB" : ""}
              {isCa ? " · CSLB" : ""}
              {isAz ? " · ROC" : ""}
              {isWa ? " · L&I" : ""}
              {isLa ? " · LSLBC" : ""}
              {isMs ? " · MSBOC" : ""}
              {isKy ? " · DHBC" : ""}
              {results.length >= 25 ? " · first 25" : ""}
            </p>
          </div>

          {results.length === 0 ? (
            <EmptyResults query={q || work || ""} mode={mode} stateSlug={state.slug} />
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
              {isAz ? (
                <div className="pt-2 sm:pt-3">
                  <ArizonaCoverageBanner compact showFloridaLink={false} />
                </div>
              ) : null}
              {isWa ? (
                <div className="pt-2 sm:pt-3">
                  <WashingtonCoverageBanner compact showFloridaLink={false} />
                </div>
              ) : null}
              {isLa ? (
                <div className="pt-2 sm:pt-3">
                  <LouisianaCoverageBanner compact showFloridaLink={false} />
                </div>
              ) : null}
              {isMs ? (
                <div className="pt-2 sm:pt-3">
                  <MississippiCoverageBanner compact showFloridaLink={false} />
                </div>
              ) : null}
              {isKy ? (
                <div className="pt-2 sm:pt-3">
                  <KentuckyCoverageBanner compact showFloridaLink={false} />
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {!q && !work ? (
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
