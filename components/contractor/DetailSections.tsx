import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  formatDate,
  formatDateTime,
  matchMethodLabel,
} from "@/lib/contractors/format";
import { occupationLabel } from "@/lib/states/config";
import type { ContractorDetail } from "@/lib/contractors/types";
import type { EvidenceState } from "@/lib/states/config";

export function VerificationSummary({
  contractor,
  state,
}: {
  contractor: ContractorDetail;
  state: EvidenceState;
}) {
  const primary = contractor.licenses[0];
  const entity = contractor.entities[0];
  const checks = [
    {
      label: "State license record",
      ok: contractor.licenses.length > 0,
      detail: primary
        ? `${primary.externalKey} · ${primary.statusNormalized || "status unknown"}`
        : "No license linked",
      when: primary?.lastVerifiedAt,
    },
    {
      label: "Business entity (Sunbiz)",
      ok: !!entity,
      detail: entity
        ? `${entity.legalName} · ${entity.status || "status unknown"} · doc ${entity.externalKey}`
        : "No high-confidence entity link",
      when: entity?.lastVerifiedAt,
    },
    {
      label: "Discipline scan",
      ok: true,
      detail:
        contractor.discipline.length === 0
          ? "No discipline actions linked in our extract"
          : `${contractor.discipline.length} action(s) on file`,
      when: contractor.discipline[0]?.lastVerifiedAt || primary?.lastVerifiedAt,
    },
  ];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Verification summary
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Independent checks against {state.boardLabel} and {state.entityRegistryLabel}. Not a
        substitute for the official board.
      </p>
      <ul className="mt-5 space-y-4">
        {checks.map((c) => (
          <li key={c.label} className="flex gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                c.ok
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-500/20 text-slate-400"
              }`}
              aria-hidden
            >
              {c.ok ? "✓" : "–"}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">{c.label}</p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{c.detail}</p>
              {c.when && (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Last verified in our data: {formatDateTime(c.when)}
                </p>
              )}
            </div>
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
        {licenses.map((lic) => (
          <article
            key={lic.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-base font-semibold text-[var(--accent)]">
                {lic.externalKey}
              </p>
              <StatusBadge status={lic.statusNormalized} />
            </div>
            <p className="mt-2 text-sm text-[var(--text)]">
              {occupationLabel(lic.occupationCode)}
            </p>
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
                  {lic.sourceSystem} · {formatDateTime(lic.lastVerifiedAt)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
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
          No high-confidence Sunbiz link for this contractor yet. We only link exact
          name/geo matches — we do not invent entity links.
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
              <StatusBadge status={ent.status} />
            </div>
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
                  {ent.sourceSystem} · {formatDateTime(ent.lastVerifiedAt)}
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
        <p className="mt-3 text-sm text-[var(--muted)]">
          No discipline actions linked to this contractor in our current board extracts.
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
                <p className="mt-2 text-[var(--muted)]">{d.disciplineDescription}</p>
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
