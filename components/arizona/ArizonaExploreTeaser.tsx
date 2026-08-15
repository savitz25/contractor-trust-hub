import Link from "next/link";
import { AZ_MAJOR_CITIES } from "@/lib/arizona/geos";
import { AZ_TOP_MARKET_SLUGS } from "@/lib/arizona/geo-copy";
import { ARIZONA_PROJECTS } from "@/lib/arizona/projects";

const TOP_CITIES = AZ_MAJOR_CITIES.filter((c) =>
  (AZ_TOP_MARKET_SLUGS as readonly string[]).includes(c.slug)
);

export function ArizonaExploreTeaser() {
  return (
    <section className="mt-8 rounded-3xl border border-amber-200/80 bg-amber-50/40 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
        Arizona · Explore + Verify
      </p>
      <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">Browse Arizona ROC licenses</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Statewide current posting list by county, major city, trade, or project. Not Florida-depth
        (no Cost Studios or permit intelligence in this v1).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TOP_CITIES.map((c) => (
          <Link
            key={c.slug}
            href={`/arizona/${c.slug}`}
            className="inline-flex min-h-9 items-center rounded-full border border-amber-200 bg-white px-3 text-xs font-medium text-amber-950 no-underline"
          >
            {c.name}
          </Link>
        ))}
        {ARIZONA_PROJECTS.slice(0, 6).map((p) => (
          <Link
            key={p.slug}
            href={`/arizona/projects/${p.slug}`}
            className="inline-flex min-h-9 items-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--navy)] no-underline"
          >
            {p.label}
          </Link>
        ))}
      </div>
      <p className="mt-4">
        <Link href="/arizona" className="text-sm font-semibold text-[var(--navy)]">
          Open Arizona explorer
        </Link>
      </p>
    </section>
  );
}
