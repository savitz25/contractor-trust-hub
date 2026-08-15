import { formatDate, formatDateTime, matchMethodLabel } from "@/lib/contractors/format";
import {
  sunbizHubHref,
  type EntityLineage,
} from "@/lib/contractors/entity-lineage";
import { StatusBadge } from "@/components/ui/StatusBadge";

/**
 * Florida-only: high-confidence Sunbiz entity + principals + related entities
 * by exact officer-name association. Hidden when lineage is empty (caller).
 */
export function EntityLineageSection({ lineage }: { lineage: EntityLineage }) {
  const dense = lineage.related.length > 2 || lineage.primary.officers.length > 4;
  const relatedCount = lineage.related.length;

  return (
    <section
      id="entity-lineage"
      className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:scroll-mt-28 sm:p-6"
      aria-labelledby="entity-lineage-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="entity-lineage-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
          >
            Related entities &amp; principals
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            Public Sunbiz records as published in our extract.{" "}
            <strong className="font-semibold text-[var(--text)]">
              Appears in public records as...
            </strong>{" "}
            — not an accusation, ranking, or “phoenix score.” Confirm on official Sunbiz before
            you rely on this.
          </p>
        </div>
        <a
          href={sunbizHubHref()}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
        >
          Official Sunbiz
        </a>
      </div>

      <details className="mt-4 group" open={!dense}>
        <summary className="cursor-pointer list-none rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-semibold text-[var(--navy)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>
              {relatedCount > 0
                ? `Show lineage · ${relatedCount} related entit${relatedCount === 1 ? "y" : "ies"}`
                : "Show linked entity & principals"}
            </span>
            <span className="text-xs font-normal text-[var(--muted)] group-open:hidden">
              Expand
            </span>
            <span className="hidden text-xs font-normal text-[var(--muted)] group-open:inline">
              Collapse
            </span>
          </span>
        </summary>

        <div className="mt-4 space-y-4">
          {/* Primary linked entity */}
          <article className="rounded-xl border border-[var(--border)] bg-white px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Linked entity on this Trust Report
            </p>
            <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--text)]">{lineage.primary.legalName}</p>
                <p className="mt-0.5 font-mono text-sm text-[var(--accent)]">
                  Doc {lineage.primary.documentNumber}
                </p>
              </div>
              <StatusBadge
                status={lineage.primary.status}
                label={`Entity: ${lineage.primary.statusLabel}`}
              />
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {lineage.primary.entityType ? (
                <div>
                  <dt className="text-xs text-[var(--muted)]">Filing type</dt>
                  <dd className="text-[var(--text)]">{lineage.primary.entityType}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-[var(--muted)]">Formation (extract)</dt>
                <dd className="text-[var(--text)]">
                  {formatDate(lineage.primary.formationDate)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--muted)]">Why this entity is linked</dt>
                <dd className="text-[var(--text)]">
                  {matchMethodLabel(lineage.primary.matchMethod)}
                  {lineage.primary.matchConfidence != null
                    ? ` · confidence ${lineage.primary.matchConfidence.toFixed(2)}`
                    : ""}
                  {" · high-confidence contractor↔Sunbiz link only"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--muted)]">Source freshness</dt>
                <dd className="text-[var(--text)]">
                  Florida Sunbiz extract · {formatDateTime(lineage.primary.lastVerifiedAt)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm">
              <a
                href={lineage.primary.sunbizSearchHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
              >
                Look up on Sunbiz (use document number)
              </a>
            </p>

            {lineage.primary.officers.length > 0 ? (
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Officers / principals (as published)
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {lineage.primary.officers.map((o) => (
                    <li key={o.key} className="text-[var(--text)]">
                      <span className="text-[var(--muted)]">{o.title || "Principal"}</span>
                      {" · "}
                      {o.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </article>

          {/* Related entities */}
          {lineage.related.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Other entities sharing principal names in our extract
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                Associated by <strong className="font-medium text-[var(--text)]">exact</strong>{" "}
                officer/principal name key after normalization. Inactive or dissolved status is
                shown when published — absence of a related entity here is not a clean history.
              </p>
              <ul className="mt-3 space-y-2.5">
                {lineage.related.map((rel) => (
                  <li
                    key={rel.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 px-3.5 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--text)]">{rel.legalName}</p>
                        <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                          Doc {rel.documentNumber}
                          {rel.entityType ? ` · ${rel.entityType}` : ""}
                          {rel.formationDate
                            ? ` · formed ${formatDate(rel.formationDate)}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge
                        status={rel.status}
                        label={rel.statusLabel}
                      />
                    </div>
                    {rel.matchedOfficerNames.length > 0 ? (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Appears in public records with principal name
                        {rel.matchedOfficerNames.length > 1 ? "s" : ""}:{" "}
                        <span className="text-[var(--text)]">
                          {rel.matchedOfficerNames.join("; ")}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Also high-confidence linked on this same contractor profile.
                      </p>
                    )}
                    <p className="mt-1.5 text-xs">
                      <a
                        href={rel.sunbizSearchHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--navy)] no-underline hover:underline"
                      >
                        Confirm on Sunbiz
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)]/40 px-3.5 py-3 text-xs leading-relaxed text-[var(--muted)]">
            <p className="font-semibold text-[var(--text)]">Evidence notes</p>
            <p className="mt-1">{lineage.evidenceNote}</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Not a fraud score, risk rating, or advice to hire or avoid anyone</li>
              <li>We do not invent relationships — only exact principal names already in extracts</li>
              <li>Always confirm entity status and officers on official Florida Sunbiz</li>
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}
