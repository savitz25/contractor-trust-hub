import Link from "next/link";
import type { StudioHandoff } from "@/lib/studios/handoff";
import { projectFitForContractor } from "@/lib/contractors/project-fit";
import type { ContractorDetail } from "@/lib/contractors/types";

export function ProjectFitBanner({
  contractor,
  handoff,
  projectType,
}: {
  contractor: ContractorDetail;
  handoff: StudioHandoff | null;
  projectType?: string | null;
}) {
  if (!handoff && !projectType) return null;

  const fit = projectFitForContractor(contractor, projectType || handoff?.projectType);

  return (
    <section
      id="project-fit"
      className="scroll-mt-28 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-4 py-4 sm:px-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
        Project fit context
      </p>
      {handoff ? (
        <p className="mt-1 text-sm font-semibold text-[var(--text)]">
          You arrived from {handoff.studioName}
          {handoff.scaleLabel ? ` · ${handoff.scaleLabel}` : ""}
          {handoff.locationLabel ? ` · ${handoff.locationLabel}` : ""}
        </p>
      ) : (
        <p className="mt-1 text-sm font-semibold text-[var(--text)]">
          Project type context attached
        </p>
      )}
      {handoff?.answerSummary?.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
          {handoff.answerSummary.slice(0, 4).map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      ) : null}
      {fit ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2.5">
          <p className="text-sm font-medium text-[var(--text)]">{fit.headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{fit.detail}</p>
        </div>
      ) : null}
      {handoff?.resultsPath ? (
        <Link
          href={handoff.resultsPath}
          className="mt-3 inline-block text-xs font-semibold text-[var(--navy)] no-underline hover:underline"
        >
          Back to results
        </Link>
      ) : null}
    </section>
  );
}
