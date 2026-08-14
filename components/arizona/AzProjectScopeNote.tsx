import Link from "next/link";
import type { AzProjectDef } from "@/lib/arizona/projects";

export function AzProjectScopeNote({
  project,
  usedSecondary,
}: {
  project: AzProjectDef;
  usedSecondary?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4 sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        How this list was matched
      </p>
      <p className="mt-2 text-sm font-semibold leading-snug text-[var(--text)]">
        {project.matchHeadline}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
        Official ROC class: <span className="font-mono text-[var(--text)]">{project.officialLabel}</span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{project.matchNote}</p>
      {usedSecondary ? (
        <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-sm text-amber-950">
          Primary classes were thin in this view, so related published classes were added. That is a
          coverage choice — not a quality ranking.
        </p>
      ) : null}
      {project.alsoNeeded.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Also often needed
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {project.alsoNeeded.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/arizona/${item.slug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-950 no-underline"
                  title={item.note}
                >
                  {item.label}
                  <span className="ml-1.5 hidden font-normal text-amber-900/70 sm:inline">
                    · {item.note}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Optional related specialties when that work is in the contract — not a hiring list.
          </p>
        </div>
      ) : null}
    </section>
  );
}
