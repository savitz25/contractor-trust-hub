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

const toneRing: Record<EvidenceTone, string> = {
  good: "border-emerald-500/30 bg-emerald-500/10",
  warn: "border-amber-500/30 bg-amber-500/10",
  bad: "border-rose-500/30 bg-rose-500/10",
  neutral: "border-[var(--border)] bg-[var(--panel)]",
};

const toneDot: Record<EvidenceTone, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-300",
  bad: "bg-rose-400",
  neutral: "bg-slate-400",
};

const toneText: Record<EvidenceTone, string> = {
  good: "text-emerald-200",
  warn: "text-amber-100",
  bad: "text-rose-200",
  neutral: "text-[var(--muted)]",
};

export function EvidenceSummary({ contractor }: { contractor: ContractorDetail }) {
  const pillars = buildEvidencePillars(contractor);
  const entity = contractor.entities[0];
  const conf = matchConfidenceLine(entity);

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
            Three checks from official extracts — not a score or ranking.
          </p>
        </div>
        {conf && (
          <p className="w-fit max-w-full rounded-full border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium leading-snug text-[var(--accent)]">
            {conf}
          </p>
        )}
      </div>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        {pillars.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border px-4 py-3.5 sm:py-4 ${toneRing[p.tone]}`}
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
            <p className={`mt-1.5 text-base font-semibold leading-snug ${toneText[p.tone]}`}>
              {p.statusLine}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{p.detail}</p>
            {p.lastVerifiedAt && (
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                In our data {formatDateTime(p.lastVerifiedAt)}
              </p>
            )}
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
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-6"
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
                    ? "rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-100/90"
                    : "rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300"
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
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Licenses
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)]">No licenses on file for this profile.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        License details
      </h2>
      <div className="mt-4 space-y-4">
        {licenses.map((lic) => {
          const occ = getOccupationInfo(lic.occupationCode);
          return (
            <article
              key={lic.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-base font-semibold tracking-wide text-[var(--accent)]">
                  {lic.externalKey}
                </p>
                <StatusBadge
                  status={lic.statusNormalized}
                  label={`License: ${statusLabel(lic.statusNormalized)}`}
                />
              </div>
              <p className="mt-2 text-sm font-medium text-[var(--text)]">{occ.label}</p>
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
                  <dt className="text-[var(--muted)]">Board</dt>
                  <dd className="text-[var(--text)]">{lic.boardNumber || "CILB / DBPR"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[var(--muted)]">Address on file</dt>
                  <dd className="text-[var(--text)]">
                    {[lic.addressLine1, lic.city, lic.state, lic.postalCode, lic.countyName]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[var(--muted)]">Source / last verified</dt>
                  <dd className="text-[var(--text)]">
                    Florida DBPR ({lic.sourceSystem}) · {formatDateTime(lic.lastVerifiedAt)}
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
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Business entity ({state.entityRegistryLabel.split("(")[0].trim()})
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          No high-confidence Sunbiz link for this contractor yet. We only link exact name/geo
          matches — we do not invent entity links.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Linked business entity
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
}: {
  discipline: ContractorDetail["discipline"];
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Discipline & regulatory actions
      </h2>
      {discipline.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          No discipline actions linked to this contractor in our current board extracts. This is
          not a certificate of clean history outside these sources.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {discipline.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[var(--text)]">
                  {d.disposition || d.classification || "Board action"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formatDate(d.dispositionDate || d.enteredDate)}
                </p>
              </div>
              {d.complaintNumber && (
                <p className="mt-1 font-mono text-xs text-[var(--accent)]">
                  Complaint {d.complaintNumber}
                </p>
              )}
              {d.disciplineDescription && (
                <p className="mt-2 leading-relaxed text-[var(--muted)]">
                  {d.disciplineDescription}
                </p>
              )}
              <p className="mt-2 text-xs text-[var(--muted)]">
                Source: {d.sourceDataset} · verified {formatDateTime(d.lastVerifiedAt)}
              </p>
            </li>
          ))}
        </ul>
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
  return (
    <aside className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/50 px-4 py-5 text-sm leading-relaxed text-[var(--muted)] sm:px-5">
      <h2 className="text-sm font-semibold text-[var(--text)]">Sources &amp; last verified</h2>
      <p className="mt-2 text-xs text-[var(--muted)]">
        “Last verified” means present in our successful ingest of the public extract — not a live
        check at page load. Official boards remain authoritative.
      </p>
      <ul className="mt-4 space-y-3">
        <li>
          <span className="font-medium text-[var(--text)]">License (DBPR)</span>
          <br />
          <a href={state.boardUrl} target="_blank" rel="noreferrer">
            {state.boardLabel}
          </a>
          <br />
          <span className="text-xs">
            Source system: {lic?.sourceSystem || state.licenseSource || "fl_dbpr"}
            {lic?.lastVerifiedAt
              ? ` · in our data ${formatDateTime(lic.lastVerifiedAt)}`
              : " · timestamp not on file"}
          </span>
        </li>
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
      </ul>
      <p className="mt-4">
        Always confirm current status on the official board and corporate registry before hiring.
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
