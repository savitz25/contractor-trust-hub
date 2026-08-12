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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="evidence-summary-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
          >
            Evidence summary
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            License status · Entity status · Discipline status
          </p>
        </div>
        {conf && (
          <p className="rounded-full border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
            {conf}
          </p>
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {pillars.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border px-4 py-4 ${toneRing[p.tone]}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${toneDot[p.tone]}`}
                aria-hidden
              />
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {p.label}
              </p>
            </div>
            <p className={`mt-2 text-sm font-semibold leading-snug ${toneText[p.tone]}`}>
              {p.statusLine}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{p.detail}</p>
            {p.lastVerifiedAt && (
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                Verified in our data {formatDateTime(p.lastVerifiedAt)}
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
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:p-6"
      aria-labelledby="hiring-guidance-heading"
    >
      <h2
        id="hiring-guidance-heading"
        className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
      >
        What should I know before hiring?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        Plain-language notes from the evidence on this page. Educational research only — not a
        recommendation to hire or avoid anyone.
      </p>
      <ul className="mt-5 space-y-3">
        {points.map((p) => (
          <li key={p.id} className="flex gap-3 text-sm leading-relaxed">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[p.tone]}`}
              aria-hidden
            />
            <span className="text-[var(--text)]">{p.text}</span>
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
      className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 sm:p-6"
      aria-labelledby="discrepancies-heading"
    >
      <h2
        id="discrepancies-heading"
        className="text-sm font-semibold uppercase tracking-wider text-amber-100/90"
      >
        Differences between DBPR and Sunbiz
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        These are not automatic red flags. Public records can differ for legitimate reasons. We
        surface them so you can verify before you hire.
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((d) => (
          <li
            key={d.id}
            className="rounded-xl border border-amber-500/20 bg-[var(--bg)]/40 px-4 py-3"
          >
            <p className="text-sm font-medium text-[var(--text)]">{d.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{d.detail}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-amber-200/70">
              {d.severity === "attention" ? "Worth confirming" : "Informational"}
            </p>
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
                  What this license class typically allows
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">{occ.allows}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{occ.notes}</p>
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
    <aside className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/50 px-5 py-5 text-sm leading-relaxed text-[var(--muted)]">
      <h2 className="text-sm font-semibold text-[var(--text)]">Sources & verification</h2>
      <ul className="mt-3 space-y-2">
        <li>
          License evidence:{" "}
          <a href={state.boardUrl} target="_blank" rel="noreferrer">
            {state.boardLabel}
          </a>
          {lic?.lastVerifiedAt ? ` · last verified in our data ${formatDateTime(lic.lastVerifiedAt)}` : ""}
        </li>
        <li>
          Business entity:{" "}
          <a href={state.entityRegistryUrl} target="_blank" rel="noreferrer">
            {state.entityRegistryLabel}
          </a>
          {ent?.lastVerifiedAt
            ? ` · last verified in our data ${formatDateTime(ent.lastVerifiedAt)}`
            : " · no high-confidence link on this profile"}
        </li>
        <li>
          Discipline: Florida board discipline extracts linked to this contractor when available.
        </li>
      </ul>
      <p className="mt-4">
        Always confirm current status on the official board and corporate registry before hiring.
        Contractor Trust Hub is independent research tooling, not a licensing authority, and does
        not sell leads or rank contractors for payment.
      </p>
    </aside>
  );
}
