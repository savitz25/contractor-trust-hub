import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  formatDate,
  formatDateTime,
  matchMethodLabel,
  statusLabel,
} from "@/lib/contractors/format";
import { getOccupationInfo } from "@/lib/contractors/occupations";
import {
  buildEvidencePillars,
  buildHiringGuidance,
  findDiscrepancies,
  matchConfidenceLine,
  type EvidenceTone,
} from "@/lib/contractors/trust-report";
import type { ContractorDetail } from "@/lib/contractors/types";
import type { EvidenceState } from "@/lib/states/config";
import {
  disciplineSectionBlurb,
  disciplineSectionTitle,
  evidenceSlugFromHomeState,
} from "@/lib/states/evidence-copy";
import {
  getNjCredentialInfo,
  njCredentialPlainLabel,
} from "@/lib/states/nj-credentials";
import {
  getTxTradeInfo,
  txTradeOfficialSuffix,
  txTradePlainLabel,
} from "@/lib/states/tx-trades";
import { getOrCcbTypeInfo, orCcbDisplayLabel, OR_CCB_SEARCH_URL } from "@/lib/states/or-ccb";

const toneRing: Record<EvidenceTone, string> = {
  good: "border-emerald-200 bg-emerald-50/80",
  warn: "border-amber-200 bg-amber-50/90",
  bad: "border-rose-200 bg-rose-50/90",
  neutral: "border-[var(--border)] bg-[var(--panel)]",
};

const toneDot: Record<EvidenceTone, string> = {
  good: "bg-emerald-600",
  warn: "bg-amber-500",
  bad: "bg-rose-600",
  neutral: "bg-slate-400",
};

const toneText: Record<EvidenceTone, string> = {
  good: "text-emerald-900",
  warn: "text-amber-950",
  bad: "text-rose-900",
  neutral: "text-[var(--muted)]",
};

export function EvidenceSummary({ contractor }: { contractor: ContractorDetail }) {
  const pillars = buildEvidencePillars(contractor);
  const entity = contractor.entities[0];
  const conf = matchConfidenceLine(entity);
  const isTx = (contractor.homeState || "").toUpperCase() === "TX";

  return (
    <section aria-labelledby="evidence-summary-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
        <div>
          <h2
            id="evidence-summary-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
          >
            Evidence at a glance
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isTx
              ? "Three checks from the TDLR specialty extract — not a score or ranking."
              : (contractor.homeState || "").toUpperCase() === "OR"
                ? "Three checks from the Oregon CCB Active Licenses extract — not a score or ranking."
              : "Three checks from official extracts — not a score or ranking."}
          </p>
        </div>
        {conf && !isTx ? (
          <p className="w-fit max-w-full rounded-full border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium leading-snug text-[var(--accent)]">
            {conf}
          </p>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
        {pillars.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border px-3.5 py-3 sm:px-4 sm:py-4 ${toneRing[p.tone]}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${toneDot[p.tone]}`}
                aria-hidden
              />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {p.label}
              </p>
            </div>
            <p className={`mt-1.5 text-[15px] font-semibold leading-snug sm:text-base ${toneText[p.tone]}`}>
              {p.statusLine}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{p.detail}</p>
            {p.lastVerifiedAt ? (
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                In our data {formatDateTime(p.lastVerifiedAt)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function HiringGuidance({ contractor }: { contractor: ContractorDetail }) {
  const points = buildHiringGuidance(contractor);
  return (
    <section
      id="hiring"
      className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:scroll-mt-28 sm:p-6"
      aria-labelledby="hiring-guidance-heading"
    >
      <h2
        id="hiring-guidance-heading"
        className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
      >
        What should I know before hiring?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        Plain-language notes from the evidence on this page. Educational only — not advice to hire
        or avoid anyone.
      </p>
      <ul className="mt-4 space-y-3.5 sm:mt-5 sm:space-y-4">
        {points.map((p) => (
          <li key={p.id} className="flex gap-3 text-sm leading-relaxed">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[p.tone]}`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {p.label}
              </p>
              <p className="mt-0.5 text-[var(--text)]">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Decision tools
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={`/tools/quote-analyzer?name=${encodeURIComponent(contractor.displayName)}&contractor=${encodeURIComponent(contractor.slug)}`}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
          >
            Analyze a quote from this contractor
          </a>
          <a
            href="/tools/pre-hire-checklist"
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
          >
            Pre-hire checklist
          </a>
          <a
            href="/tools/scope-builder"
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
          >
            Build project scope
          </a>
        </div>
      </div>
    </section>
  );
}

export function DiscrepanciesSection({ contractor }: { contractor: ContractorDetail }) {
  const items = findDiscrepancies(contractor);
  if (items.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/60 p-4 sm:p-6"
      aria-labelledby="discrepancies-heading"
    >
      <h2
        id="discrepancies-heading"
        className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
      >
        Notes comparing DBPR and Sunbiz
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        These differences are common in public records and are not automatic red flags. We show
        them so you can double-check details before you hire.
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((d) => (
          <li
            key={d.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-[var(--text)]">{d.title}</p>
              <span
                className={
                  d.severity === "attention"
                    ? "rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900 ring-1 ring-inset ring-amber-200"
                    : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 ring-1 ring-inset ring-slate-200"
                }
              >
                {d.severity === "attention" ? "Worth confirming" : "FYI"}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{d.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LicensesSection({ licenses }: { licenses: ContractorDetail["licenses"] }) {
  if (licenses.length === 0) {
    return (
      <section
        id="licenses"
        className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          License evidence
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)]">
          No licenses on file for this profile in current extracts.
        </p>
      </section>
    );
  }

  return (
    <section
      id="licenses"
      className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        License evidence
      </h2>
      <div className="mt-4 space-y-4">
        {licenses.map((lic) => {
          const src = (lic.sourceSystem || "").toLowerCase();
          const isTsbpe = src === "tx_tsbpe";
          const isOr = src === "or_ccb" || lic.state === "OR";
          const isTx =
            src === "tx_tdlr" || isTsbpe || lic.state === "TX";
          const isNj =
            (lic.sourceSystem || "").toLowerCase() === "nj_dca" || lic.state === "NJ";
          const occ = getOccupationInfo(lic.occupationCode);
          const txTrade = isTx ? getTxTradeInfo(lic.occupationCode) : null;
          const njCred = isNj ? getNjCredentialInfo(lic.occupationCode) : null;
          const orType = isOr ? getOrCcbTypeInfo(lic.occupationCode) : null;
          const label = isTx
            ? txTradePlainLabel(lic.occupationCode)
            : isNj
              ? njCredentialPlainLabel(lic.occupationCode)
              : isOr
                ? orCcbDisplayLabel(lic.occupationCode)
              : occ.label;
          const officialSuffix = isTx ? txTradeOfficialSuffix(lic.occupationCode) : null;
          return (
            <article
              key={lic.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 sm:p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-all font-mono text-sm font-semibold tracking-wide text-[var(--accent)] sm:text-base">
                  {lic.externalKey}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {lic.sourceSystem ? (
                    <span className="rounded-full border border-[var(--border)] bg-white px-2 py-0.5 font-mono text-[10px] text-[var(--muted)]">
                      {lic.sourceSystem}
                    </span>
                  ) : null}
                  <StatusBadge
                    status={lic.statusNormalized}
                    label={`${isNj ? "Registration" : "License"}: ${statusLabel(lic.statusNormalized)}`}
                  />
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold leading-snug text-[var(--text)] sm:text-[15px]">
                {label}
              </p>
              {isTx ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex rounded-full border border-[var(--navy)]/15 bg-[var(--navy)]/[0.04] px-2 py-0.5 text-[11px] font-medium text-[var(--navy)]">
                    {txTrade?.chip ?? "Specialty"} · {isTsbpe ? "TSBPE" : "TDLR"}
                  </span>
                  {officialSuffix ? (
                    <span className="text-xs text-[var(--muted)]">
                      Official: {officialSuffix}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {isNj && njCred ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-950">
                    {njCred.chip} · NJ extract
                  </span>
                </div>
              ) : null}
              {isOr && orType ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-950">
                    {orType.chip} · CCB
                  </span>
                </div>
              ) : null}
              {isNj && njCred ? (
                <div className="mt-3 rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-900/80">
                    What this credential allows / does not imply
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">{njCred.allows}</p>
                  <p className="mt-2 border-t border-violet-200/70 pt-2 text-sm leading-relaxed text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]/90">Does not imply: </span>
                    {njCred.doesNotImply}
                  </p>
                </div>
              ) : isOr ? (
                <div className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900/70">
                    Oregon CCB — statewide contractor license
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
                    {orType?.scopeNote ??
                      "Published CCB Active Licenses row. Confirm current status on the official CCB search."}
                  </p>
                  {lic.secondaryStatus ? (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
                      {lic.secondaryStatus}
                    </p>
                  ) : null}
                  <p className="mt-2 border-t border-emerald-200/70 pt-2 text-sm leading-relaxed text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]/90">Good to know: </span>
                    Bond and insurance amounts are as published in the extract — not a live
                    certificate check.{" "}
                    <a
                      href={OR_CCB_SEARCH_URL}
                      className="font-medium text-[var(--navy)] underline-offset-2 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official CCB search
                    </a>
                    .
                  </p>
                </div>
              ) : !isTx ? (
                <div className="mt-3 rounded-lg border border-[var(--border)]/80 bg-[var(--bg)]/50 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    What this class typically covers
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">{occ.allows}</p>
                  <p className="mt-2 border-t border-[var(--border)]/60 pt-2 text-sm leading-relaxed text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]/90">Good to know: </span>
                    {occ.notes}
                  </p>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-sky-200/80 bg-sky-50/60 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-900/70">
                    Specialty trade — not a general contractor license
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
                    {txTrade?.scopeNote ??
                      (isTsbpe
                        ? "This is a TSBPE plumbing credential. Texas does not issue a statewide general contractor license."
                        : "This is a TDLR specialty trade license. Texas does not issue a statewide general contractor credential for this search.")}
                  </p>
                  <p className="mt-2 border-t border-sky-200/70 pt-2 text-sm leading-relaxed text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]/90">Good to know: </span>
                    Confirm current status on the official {isTsbpe ? "TSBPE" : "TDLR"} license
                    search before hiring. Most local builder registrations are outside this extract.
                  </p>
                </div>
              )}
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--muted)]">Original licensure</dt>
                  <dd className="text-[var(--text)]">{formatDate(lic.originalLicensureDate)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Effective</dt>
                  <dd className="text-[var(--text)]">{formatDate(lic.effectiveDate)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Expiration</dt>
                  <dd className="text-[var(--text)]">{formatDate(lic.expirationDate)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Board / source</dt>
                  <dd className="text-[var(--text)]">
                    {lic.boardNumber ||
                      (isNj
                        ? "NJ DCA"
                        : isOr
                          ? "CCB"
                          : isTsbpe
                            ? "TSBPE"
                            : isTx
                              ? "TDLR"
                              : "CILB / DBPR")}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[var(--muted)]">Address / county on file</dt>
                  <dd className="text-[var(--text)]">
                    {[lic.addressLine1, lic.city, lic.state, lic.postalCode, lic.countyName]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[var(--muted)]">Source / last verified</dt>
                  <dd className="break-words text-[var(--text)]">
                    {isNj
                      ? "New Jersey registration extract"
                      : isOr
                        ? "Oregon CCB"
                      : isTsbpe
                        ? "Texas TSBPE"
                        : isTx
                          ? "Texas TDLR"
                        : "Florida DBPR"}{" "}
                    ({lic.sourceSystem}) · {formatDateTime(lic.lastVerifiedAt)}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function EntitySection({
  entities,
  state,
}: {
  entities: ContractorDetail["entities"];
  state: EvidenceState;
}) {
  if (entities.length === 0) {
    return (
      <section
        id="entity"
        className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-6"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Business / entity signals ({state.entityRegistryLabel.split("(")[0].trim()})
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          No high-confidence Sunbiz link for this contractor yet. We only link exact name/geo
          matches — we do not invent entity links.
        </p>
      </section>
    );
  }

  return (
    <section
      id="entity"
      className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Business / entity signals
      </h2>
      <div className="mt-4 space-y-4">
        {entities.map((ent) => (
          <article
            key={ent.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--text)]">{ent.legalName}</p>
                <p className="mt-1 font-mono text-sm text-[var(--accent)]">
                  Doc {ent.externalKey}
                </p>
              </div>
              <StatusBadge
                status={ent.status}
                label={`Entity: ${statusLabel(ent.status)}`}
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {matchConfidenceLine(ent) || matchMethodLabel(ent.matchMethod)}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted)]">Entity type</dt>
                <dd className="text-[var(--text)]">{ent.entityType || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Formation date</dt>
                <dd className="text-[var(--text)]">{formatDate(ent.formationDate)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--muted)]">Principal address</dt>
                <dd className="text-[var(--text)]">
                  {[ent.principalAddress, ent.city, ent.state, ent.postalCode]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--muted)]">Registered agent</dt>
                <dd className="text-[var(--text)]">{ent.registeredAgentName || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--muted)]">Match quality</dt>
                <dd className="text-[var(--text)]">
                  {matchMethodLabel(ent.matchMethod)}
                  {ent.matchConfidence != null
                    ? ` · confidence ${ent.matchConfidence.toFixed(2)}`
                    : ""}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--muted)]">Source / last verified</dt>
                <dd className="text-[var(--text)]">
                  {state.entityRegistryLabel} ({ent.sourceSystem}) ·{" "}
                  {formatDateTime(ent.lastVerifiedAt)}
                </dd>
              </div>
            </dl>
            {ent.officers.length > 0 && (
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Officers / managers (as published)
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {ent.officers.slice(0, 8).map((o, i) => (
                    <li key={`${o.name}-${i}`} className="text-[var(--text)]">
                      <span className="text-[var(--muted)]">{o.title || "—"}</span>
                      {" · "}
                      {o.name || "—"}
                      {o.city ? ` · ${o.city}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function DisciplineSection({
  discipline,
  homeState,
}: {
  discipline: ContractorDetail["discipline"];
  homeState?: string | null;
}) {
  const hasActions = discipline.length > 0;
  const slug = evidenceSlugFromHomeState(homeState);
  const title = disciplineSectionTitle(slug);
  const blurb = disciplineSectionBlurb(slug);
  const recordWord = slug === "nj" ? "Enforcement" : "Discipline";

  return (
    <section
      id="caution"
      className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
      aria-labelledby="discipline-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="discipline-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
          >
            {title}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{blurb}</p>
        </div>
        <span
          className={
            hasActions
              ? "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200"
              : "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200"
          }
        >
          {hasActions
            ? `${recordWord} records identified (${discipline.length})`
            : `No ${recordWord.toLowerCase()} records identified in current extracts`}
        </span>
      </div>

      {!hasActions ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-4">
          <p className="text-sm font-medium text-emerald-900">
            No {recordWord.toLowerCase()} records identified in current extracts
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {slug === "nj" ? (
              <>
                Our New Jersey Standard Files extract does not currently attach a public discipline
                flag to this profile. That is{" "}
                <strong className="font-medium text-[var(--text)]">not</strong> a certificate of
                clean history: the bulk file is a flag only (no full case history), and records may
                exist outside these extracts or after our last load. Re-check official DCA /
                MyLicense tools before hiring.
              </>
            ) : (
              <>
                Our Florida board discipline files do not currently attach an action to this profile.
                That is <strong className="font-medium text-[var(--text)]">not</strong> a certificate
                of clean history: records may exist outside these extracts, under another name, or
                after our last load. Re-check the official DBPR board before hiring.
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            What this means: absence in our extract ≠ cleared. Worth confirming on the official
            source the day you hire.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
            {slug === "nj" ? (
              <>
                The following rows are public discipline flags from the DCA Standard Files bulk
                extract. They do not include case narrative or disposition dates in this feed. We
                describe records factually — we do not score severity or recommend hire/avoid.
              </>
            ) : (
              <>
                The following records appear in board extracts. Each row includes date and source
                fields when present. We describe records factually — we do not score severity or
                recommend hire/avoid.
              </>
            )}
          </p>
          <ul className="mt-4 space-y-3">
            {discipline.map((d) => {
              const when = formatDate(d.dispositionDate || d.enteredDate);
              const headline =
                d.disposition || d.classification || d.violationCode || "Board action";
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-[var(--text)]">{headline}</p>
                    <p className="shrink-0 text-xs tabular-nums text-[var(--muted)]">{when}</p>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    {d.classification && d.classification !== headline && (
                      <div>
                        <dt className="text-[var(--muted)]">Classification</dt>
                        <dd className="text-[var(--text)]">{d.classification}</dd>
                      </div>
                    )}
                    {d.licenseType && (
                      <div>
                        <dt className="text-[var(--muted)]">License type (as filed)</dt>
                        <dd className="text-[var(--text)]">{d.licenseType}</dd>
                      </div>
                    )}
                    {d.complaintNumber && (
                      <div>
                        <dt className="text-[var(--muted)]">Complaint / case</dt>
                        <dd className="font-mono text-[var(--accent)]">{d.complaintNumber}</dd>
                      </div>
                    )}
                    {d.violationCode && (
                      <div>
                        <dt className="text-[var(--muted)]">Violation code</dt>
                        <dd className="text-[var(--text)]">{d.violationCode}</dd>
                      </div>
                    )}
                  </dl>
                  {d.disciplineDescription && (
                    <p className="mt-3 leading-relaxed text-[var(--muted)]">
                      {d.disciplineDescription}
                    </p>
                  )}
                  <p className="mt-3 border-t border-[var(--border)]/80 pt-2 text-xs text-[var(--muted)]">
                    Source: {d.sourceDataset || "Florida board discipline extract"}
                    {d.lastVerifiedAt
                      ? ` · in our data ${formatDateTime(d.lastVerifiedAt)}`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export function SourcesFooter({
  contractor,
  state,
}: {
  contractor: ContractorDetail;
  state: EvidenceState;
}) {
  const lic = contractor.licenses[0];
  const ent = contractor.entities[0];
  const hs = (contractor.homeState || "").toUpperCase();
  const isTx = state.slug === "tx" || hs === "TX";
  const isNj = state.slug === "nj" || hs === "NJ";
  const isOr = state.slug === "or" || hs === "OR";

  return (
    <aside className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/50 px-4 py-5 text-sm leading-relaxed text-[var(--muted)] sm:px-5">
      <h2 className="text-sm font-semibold text-[var(--text)]">Sources &amp; last verified</h2>
      <p className="mt-2 text-xs text-[var(--muted)]">
        “Last verified” means present in our successful ingest of the public extract — not a live
        check at page load. Official boards remain authoritative.
      </p>
      <ul className="mt-4 space-y-3">
        <li>
          <span className="font-medium text-[var(--text)]">
            {isNj
              ? "Registration / credential (NJ extract)"
              : isOr
                ? "License (Oregon CCB)"
              : isTx
                ? "License (TDLR)"
                : "License (DBPR)"}
          </span>
          <br />
          <a href={state.boardUrl} target="_blank" rel="noreferrer">
            {state.boardLabel}
          </a>
          <br />
          <span className="text-xs">
            Source system:{" "}
            {lic?.sourceSystem ||
              state.licenseSource ||
              (isNj ? "nj_dca" : isOr ? "or_ccb" : isTx ? "tx_tdlr" : "fl_dbpr")}
            {lic?.lastVerifiedAt
              ? ` · in our data ${formatDateTime(lic.lastVerifiedAt)}`
              : " · timestamp not on file"}
          </span>
        </li>
        {isOr ? (
          <li>
            <span className="font-medium text-[var(--text)]">Coverage note</span>
            <br />
            Oregon CCB Active Licenses extract. Bond and insurance fields are as published — not a
            live certificate check. Confirm current status on the official CCB search.
          </li>
        ) : isTx ? (
          <li>
            <span className="font-medium text-[var(--text)]">Coverage note</span>
            <br />
            Texas has no statewide general contractor license. This profile reflects selected TDLR
            specialty trades and/or TSBPE plumbing. City/county GC registration is not fully
            covered.
          </li>
        ) : isNj ? (
          <li>
            <span className="font-medium text-[var(--text)]">Coverage note</span>
            <br />
            New Jersey verification pilot — registration and public-record extracts only. Not
            Florida-depth (no full permit history or planning journey in this pilot). Coverage
            differs by state.
          </li>
        ) : (
          <>
            <li>
              <span className="font-medium text-[var(--text)]">Business entity (Sunbiz)</span>
              <br />
              <a href={state.entityRegistryUrl} target="_blank" rel="noreferrer">
                {state.entityRegistryLabel}
              </a>
              <br />
              <span className="text-xs">
                {ent
                  ? `Linked at high confidence · in our data ${formatDateTime(ent.lastVerifiedAt)}`
                  : "No high-confidence link on this profile (exact name/geo required)"}
              </span>
            </li>
            <li>
              <span className="font-medium text-[var(--text)]">Discipline</span>
              <br />
              Florida board discipline extracts when linked in our load
              {contractor.discipline[0]?.lastVerifiedAt
                ? ` · latest row in our data ${formatDateTime(contractor.discipline[0].lastVerifiedAt)}`
                : ""}
            </li>
          </>
        )}
      </ul>
      <p className="mt-4">
        {isOr
          ? "Always confirm current status on the official Oregon CCB search before hiring."
          : isTx
          ? "Always confirm current status on the official TDLR or TSBPE search before hiring."
          : isNj
            ? "Always confirm current status on official New Jersey DCA / board tools before hiring."
            : "Always confirm current status on the official board and corporate registry before hiring."}{" "}
        Educational research only — not a consumer reporting agency, not paid rankings.{" "}
        <Link href="/methodology" className="text-[var(--accent)]">
          Methodology
        </Link>
        {" · "}
        <Link href="/disclaimer" className="text-[var(--accent)]">
          Disclaimer
        </Link>
      </p>
    </aside>
  );
}
