import Link from "next/link";
import type { IntelligenceEducationModule } from "@/lib/intelligence/education";

export function IntelligenceEducationSection({
  modules,
}: {
  modules: IntelligenceEducationModule[];
}) {
  return (
    <section id="education" aria-labelledby="education-heading" className="scroll-mt-24">
      <h2 id="education-heading" className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
        Florida contractor education
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        Florida-specific licensing concepts. Educational only — not legal advice, not a
        recommendation, and not a substitute for confirming current status with DBPR and the local
        building department.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {modules.map((m) => (
          <li key={m.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">{m.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{m.summary}</p>
            {m.href ? (
              <p className="mt-3">
                <Link href={m.href} className="text-sm font-medium text-[var(--navy)]">
                  Read more
                </Link>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
