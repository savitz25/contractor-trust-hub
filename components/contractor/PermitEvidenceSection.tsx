import Link from "next/link";
import { getConfirmedDbprPermitEvidence } from "@/lib/contractors/permit-evidence";
import type { ContractorDetail } from "@/lib/contractors/types";

/**
 * EA-CT-002: smallest useful permit/work evidence module. Public permit/work records linked to a
 * contractor's license only by an exact, already-confirmed license-number match — no name-only or
 * address-only attachment, no permit-volume-as-quality framing, no service-territory claim from a
 * worksite address, and no permit record ever converted into a "0 permits" or "no work performed"
 * finding.
 */
export async function PermitEvidenceSection({ contractor }: { contractor: ContractorDetail }) {
  const evidence = await getConfirmedDbprPermitEvidence(contractor.id);

  return (
    <section
      id="permit-evidence"
      className="scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Public permit / work records
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Public permit/work records linked to this contractor license by an exact license-number
            match. A permit record is not an endorsement, and more or fewer permits on file is not a
            quality signal.{" "}
            <Link href="/tools/coverage" className="font-medium text-[var(--navy)]">
              Where we cover
            </Link>
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            evidence.status === "available"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]"
          }`}
        >
          {evidence.status === "available" ? "Confirmed license match" : "Not linked"}
        </span>
      </div>

      {evidence.status === "unavailable" ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)]/50 px-4 py-4">
          <p className="text-sm font-medium text-[var(--text)]">
            No confirmed public permit records are currently linked to this license
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            This is not a finding that the contractor has performed no work, and it is not a finding
            about license standing. Coverage is currently limited to Miami-Dade County, FL building
            permits with an exact contractor-license match on the permit record — a contractor may
            have permit history outside this coverage, or the source may not have published a
            matching record.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs text-[var(--muted)]">
            {evidence.totalCount} confirmed record{evidence.totalCount === 1 ? "" : "s"}
            {evidence.hasMore ? ` — showing the ${evidence.rows.length} most recent` : ""} ·{" "}
            {evidence.sourceLabel}
            {evidence.retrievedAt ? ` · retrieved ${evidence.retrievedAt.slice(0, 10)}` : ""}
          </p>
          <ul className="mt-4 space-y-3">
            {evidence.rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-[var(--text)]">
                    {row.workDescription || row.permitType || "Permit"}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {row.statusLabel}
                  </span>
                </div>
                <dl className="mt-2 grid gap-1 text-xs text-[var(--muted)] sm:grid-cols-2">
                  <div>
                    <dt className="inline">Permit number: </dt>
                    <dd className="inline font-medium text-[var(--text)]">
                      {row.permitNumber || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Jurisdiction: </dt>
                    <dd className="inline text-[var(--text)]">{row.jurisdictionLabel}</dd>
                  </div>
                  {row.applicationDate ? (
                    <div>
                      <dt className="inline">Applied: </dt>
                      <dd className="inline text-[var(--text)]">{row.applicationDate}</dd>
                    </div>
                  ) : null}
                  {row.issueDate ? (
                    <div>
                      <dt className="inline">Issued: </dt>
                      <dd className="inline text-[var(--text)]">{row.issueDate}</dd>
                    </div>
                  ) : null}
                  {row.finalDate ? (
                    <div>
                      <dt className="inline">Completed: </dt>
                      <dd className="inline text-[var(--text)]">{row.finalDate}</dd>
                    </div>
                  ) : null}
                  <div className="sm:col-span-2">
                    <dt className="inline">Worksite: </dt>
                    <dd className="inline text-[var(--text)]">
                      {row.worksiteAddress || "Not published in source record"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">License on record: </dt>
                    <dd className="inline font-mono text-[var(--text)]">{row.licenseExternalKey}</dd>
                  </div>
                  {row.sourceUrl ? (
                    <div>
                      <Link href={row.sourceUrl} className="font-medium text-[var(--navy)]">
                        Source dataset ↗
                      </Link>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-[var(--muted)]">
            Worksite location is the public permit address on file, not a confirmed service territory.
            A permit record does not confirm work was completed as scoped, and the absence of a permit
            here does not mean work was performed without one.
          </p>
        </>
      )}
    </section>
  );
}
