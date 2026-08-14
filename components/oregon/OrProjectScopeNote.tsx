import Link from "next/link";
import type { OrProjectDef } from "@/lib/oregon/projects";

export function OrProjectScopeNote({
  project,
  usedSecondary,
}: {
  project: OrProjectDef;
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
        Official CCB type: <span className="font-mono text-[var(--text)]">{project.officialLabel}</span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{project.matchNote}</p>
      {project.extractCannotProve ? (
        <p className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm leading-relaxed text-[var(--text)]">
          <span className="font-medium">This extract cannot prove: </span>
          {project.extractCannotProve}
        </p>
      ) : null}
      {usedSecondary ? (
        <p className="mt-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-950">
          Primary types were thin in this view, so related published types were added. That is a
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
                  href={`/oregon/${item.slug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-950 no-underline"
                  title={item.note}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Optional related endorsement families — not a hiring list.
          </p>
        </div>
      ) : null}
    </section>
  );
}
