import Link from "next/link";
import { SearchForm } from "@/components/search/SearchForm";
import { CoverageChip } from "@/components/intelligence/CoverageChip";
import { IntelligenceCategoryExplorer } from "@/components/intelligence/IntelligenceCategoryExplorer";
import { IntelligenceEducationSection } from "@/components/intelligence/IntelligenceEducationSection";
import { formatAsOf, formatIntelNumber } from "@/components/intelligence/format";
import { publicCountyMetrics } from "@/lib/intelligence/county-payload";
import type { CountyMoveLikePayload } from "@/lib/intelligence/county-payload";
import { MarketCompare, WhatWeDontKnow } from "@/components/intelligence/IntelligenceOsSections";
import { buildCompareRows, standsOutStatements } from "@/lib/intelligence/os-layer";

export function CountyIntelligence({ payload }: { payload: CountyMoveLikePayload }) {
  const countyLabel = `${payload.countyName} County`;
  const publicMetrics = publicCountyMetrics(payload);
  const asOf = formatAsOf(payload.asOf);
  const contributing = payload.evidenceSources.filter((s) => s.contribution === "contributing");
  const pending = payload.evidenceSources.filter((s) => s.contribution === "requested_pending");
  const tasks = [
    { href: "#contractors", label: "Find contractors", hint: `Browse ${countyLabel} mailing-county credentials` },
    { href: "/verify", label: "Research a contractor", hint: "Name or full license number" },
    { href: "/verify", label: "Check a license", hint: "Full DBPR license identity" },
    { href: "/compare", label: "Compare contractors", hint: "Side-by-side research" },
  ];

  return (
    <div className="mt-4 space-y-12 sm:space-y-14">
      <header className="border-b border-[var(--border)] pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <CoverageChip level={payload.coverageLevel} href="#county-research" />
          <span className="text-xs text-[var(--muted)]">Evidence depth, not contractor quality</span>
        </div>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {payload.countySlug === "broward"
            ? "Broward Contractor Intelligence"
            : `Research ${countyLabel} contractors`}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
          {payload.heroIntro}
        </p>
        <div className="mt-6 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <SearchForm
            size="default"
            stateSlug="fl"
            intent="research"
            label="Search a contractor"
            placeholder="Full license number or company name"
          />
        </div>
        <nav aria-label={`${countyLabel} contractor tasks`} className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {tasks.map((t) => (
              <li key={t.href + t.label}>
                <Link
                  href={t.href}
                  title={t.hint}
                  className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] no-underline shadow-[var(--shadow-sm)] hover:border-[var(--navy)]/25"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section id="county-research" aria-labelledby="snapshot-heading" className="scroll-mt-24">
        <h2 id="snapshot-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          {countyLabel} research snapshot
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Only READY public metrics appear as numbers. Local permit and local credential datasets
          are pending — missing export is not zero events. {payload.addressFieldSemantics}
        </p>
        {payload.timedOut ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
            Live county research counts are temporarily unavailable. Browse links still work. We do
            not display zeros for a failed snapshot.
          </p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicMetrics.map((m) => (
              <li
                key={m.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4 shadow-[var(--shadow-sm)]"
              >
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {formatIntelNumber(m.value, payload.timedOut)}
                </p>
                <p className="mt-1 text-sm font-medium">{m.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{m.disclosure}</p>
              </li>
            ))}
          </ul>
        )}
        {asOf ? (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Credential extract as of {asOf}. Not a live DBPR session.
          </p>
        ) : null}
      </section>
      {(() => {
        const roofing = payload.categories.find((c) => c.slug === "roofers")?.tracked ?? null;
        const general = payload.categories.find((c) => c.slug === "general-contractors")?.tracked ?? null;
        const countyTracked = payload.metrics.find((m) => m.id === "county_credentials")?.value ?? null;
        const countyActive = payload.metrics.find((m) => m.id === "county_active_credentials")?.value ?? null;
        const rows = buildCompareRows({
          floridaTracked: payload.floridaBaseline.tracked,
          floridaActive: payload.floridaBaseline.active,
          floridaRoofing: payload.floridaBaseline.roofing,
          floridaGeneral: payload.floridaBaseline.general,
          counties: [
            {
              id: payload.countySlug,
              label: countyLabel,
              href: payload.canonicalPath,
              tracked: countyTracked,
              active: countyActive,
              roofing,
              general,
              researchDepth: payload.coverageLevel,
            },
          ],
        });
        return <MarketCompare rows={rows} statements={standsOutStatements(rows)} />;
      })()}

      {payload.categories.length > 0 ? (
        <IntelligenceCategoryExplorer categories={payload.categories} timedOut={payload.timedOut} />
      ) : null}

      <section id="jurisdictions" aria-labelledby="jurisdictions-heading" className="scroll-mt-24">
        <h2 id="jurisdictions-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Mapped local jurisdictions
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          {payload.jurisdictions.disclosure}
        </p>
        {payload.jurisdictions.datasetPresent && payload.jurisdictions.totalMapped != null ? (
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <span className="font-medium tabular-nums">{payload.jurisdictions.totalMapped}</span>{" "}
              permitting jurisdictions mapped (metadata).
            </li>
            <li>
              Unincorporated / county AHJ:{" "}
              <span className="tabular-nums">{payload.jurisdictions.unincorporatedCount}</span>
              {" · "}Municipalities:{" "}
              <span className="tabular-nums">{payload.jurisdictions.municipalCount}</span>
            </li>
            <li>
              Jurisdictions with permit or local-credential activity loaded:{" "}
              {payload.jurisdictions.actualDataCoverageCount
                ? `${payload.jurisdictions.actualDataCoverageCount} (unincorporated/county-issued evidence — not municipal histories)`
                : "none yet"}
              .
            </li>
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Jurisdiction metadata is temporarily unavailable. We do not display zeros for a failed
            query.
          </p>
        )}
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
          {payload.jurisdictionDisclosures.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>

      <section id="regulatory" aria-labelledby="regulatory-heading" className="scroll-mt-24">
        <h2 id="regulatory-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Regulatory &amp; Enforcement History
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Florida regulatory records associated with contractors in this county research population
          are statewide DBPR/DFS events tied to a credential whose mailing county is {countyLabel}.
          That is not “{payload.countyName} enforcement actions.” A complaint is not a finding. An
          investigation is not a final disposition. No public county-level count is currently
          published.
        </p>
      </section>

      <WhatWeDontKnow />
      <section id="permits" aria-labelledby="permits-heading" className="scroll-mt-24">
        <h2 id="permits-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Local permit research
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          {payload.modules.find((m) => m.id === "permits")?.readiness === "READY" ? (
            <>
              Public permit numbers on this page are confirmed Miami-Dade County-issued records
              linked to Florida contractor credentials. The source is issued-only and rolling
              (~2 years). It is not an open/pending census and not the permit history of all 34
              municipalities. M/MBLD rows are associated county reviews, not municipal building
              permits. Issued is not final. Recorded permit valuation is not revenue. REVIEW_REQUIRED
              and UNRESOLVED rows are not public contractor activity.
            </>
          ) : (
            <>
              Local permit research is being expanded
              {payload.evidenceSources.find((s) => s.id === "pending_permits")?.requestId
                ? ` (request ${payload.evidenceSources.find((s) => s.id === "pending_permits")?.requestId})`
                : ""}
              . Missing export is not zero events. Last-3-year, open, pending, and final counts are
              not published.
            </>
          )}
        </p>
      </section>

      <section id="local-credentials" aria-labelledby="local-cred-heading" className="scroll-mt-24">
        <h2 id="local-cred-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Local credential research
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Local credential / certification export pending
          {payload.evidenceSources.find((s) => s.id === "pending_local_credentials")?.requestId
            ? ` (request ${payload.evidenceSources.find((s) => s.id === "pending_local_credentials")?.requestId})`
            : ""}
          . Missing export is not zero events. Future statuses stay distinct:{" "}
          {payload.localCredentialStatuses.join(", ")}. A state credential is not local
          authorization.
        </p>
      </section>

      <section id="research-depth" aria-labelledby="depth-heading" className="scroll-mt-24">
        <h2 id="depth-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Current research depth
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Coverage is {payload.coverageLabel}. Enhanced Local Research is documented and not
          activated — operating geography and local exports are not proven. Research depth is not
          contractor quality.
        </p>
        <ul className="mt-4 space-y-2">
          {payload.modules.map((m) => (
            <li key={m.id} className="flex gap-3 text-sm leading-relaxed">
              <span className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {m.readiness === "READY" ? "In graph" : m.readiness === "INTERNAL_ONLY" ? "Internal" : "Not yet"}
              </span>
              <span>
                <span className="font-medium">{m.label}.</span> {m.note}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section id="sources" aria-labelledby="sources-heading" className="scroll-mt-24">
        <h2 id="sources-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Sources
        </h2>
        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide">Contributing now</h3>
        <ul className="mt-3 space-y-3">
          {contributing.map((s) => (
            <li key={s.id} className="rounded-2xl border border-[var(--border)] px-4 py-4">
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-xs text-[var(--muted)]">{s.agency}</p>
              <p className="mt-2 text-sm">{s.whatItContains}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">{s.limitation}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide">Requested / pending</h3>
        <p className="mt-2 text-xs text-[var(--muted)]">A pending source is not yet contributing evidence.</p>
        <ul className="mt-3 space-y-3">
          {pending.map((s) => (
            <li key={s.id} className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4">
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-xs text-[var(--muted)]">{s.agency}</p>
              {s.requestId ? (
                <p className="mt-1 text-xs font-medium">Request {s.requestId}</p>
              ) : null}
              <p className="mt-2 text-sm">{s.whatItContains}</p>
            </li>
          ))}
        </ul>
      </section>

      <IntelligenceEducationSection modules={payload.education} />

      <section id="continue" aria-labelledby="continue-heading" className="scroll-mt-24">
        <h2 id="continue-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Continue research
        </h2>
        <ul className="mt-4 space-y-3 text-sm">
          {payload.discoveryLinks.map((l) => (
            <li key={l.href + l.label}>
              <Link href={l.href} className="text-[var(--accent)] hover:underline">
                {l.label}
              </Link>
              <p className="mt-1 text-xs text-[var(--muted)]">{l.semantics}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-[var(--muted)]">
        Intelligence aggregation {payload.version}
        {payload.generatedAt
          ? ` · generated ${payload.generatedAt.slice(0, 16).replace("T", " ")} UTC`
          : ""}
        . Canonical route {payload.canonicalPath}.
      </p>
    </div>
  );
}
