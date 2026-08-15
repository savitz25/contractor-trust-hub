import Link from "next/link";
import { OREGON_PROJECTS } from "@/lib/oregon/projects";

const TOP_COUNTIES = [
  { slug: "multnomah", name: "Multnomah" },
  { slug: "clackamas", name: "Clackamas" },
  { slug: "washington", name: "Washington" },
  { slug: "marion", name: "Marion" },
  { slug: "deschutes", name: "Deschutes" },
  { slug: "lane", name: "Lane" },
] as const;

export function OregonExploreTeaser() {
  return (
    <section className="mt-8 rounded-3xl border border-emerald-200/80 bg-emerald-50/40 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
        Oregon · Explore + Verify
      </p>
      <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">Browse Oregon CCB licenses</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Statewide active licenses by official CCB county and project type. Bond/insurance as
        published. Not Florida-depth (no Cost Studios in this v1).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TOP_COUNTIES.map((c) => (
          <Link
            key={c.slug}
            href={`/oregon/${c.slug}`}
            className="inline-flex min-h-9 items-center rounded-full border border-emerald-200 bg-white px-3 text-xs font-medium text-emerald-950 no-underline"
          >
            {c.name}
          </Link>
        ))}
        {OREGON_PROJECTS.slice(0, 6).map((p) => (
          <Link
            key={p.slug}
            href={`/oregon/projects/${p.slug}`}
            className="inline-flex min-h-9 items-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--navy)] no-underline"
          >
            {p.label}
          </Link>
        ))}
      </div>
      <p className="mt-4">
        <Link href="/oregon" className="text-sm font-semibold text-[var(--navy)]">
          Open Oregon explorer
        </Link>
      </p>
    </section>
  );
}
