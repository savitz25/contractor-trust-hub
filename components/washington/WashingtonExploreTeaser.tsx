import Link from "next/link";
import { WA_MAJOR_CITIES } from "@/lib/washington/geos";
import { WA_TOP_COUNTY_SLUGS, WA_TOP_MARKET_SLUGS } from "@/lib/washington/geo-copy";
import { WASHINGTON_PROJECTS } from "@/lib/washington/projects";

const TOP_CITIES = WA_MAJOR_CITIES.filter((c) =>
  (WA_TOP_MARKET_SLUGS as readonly string[]).includes(c.slug)
).slice(0, 5);

const COUNTY_LABELS: Record<(typeof WA_TOP_COUNTY_SLUGS)[number], string> = {
  king: "King County",
  snohomish: "Snohomish County",
  pierce: "Pierce County",
  "spokane-county": "Spokane County",
  clark: "Clark County",
};

const TOP_COUNTIES = WA_TOP_COUNTY_SLUGS.map((slug) => ({
  slug,
  name: COUNTY_LABELS[slug],
}));

export function WashingtonExploreTeaser() {
  return (
    <section className="mt-8 rounded-3xl border border-cyan-200/80 bg-cyan-50/40 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">
        Washington · Explore + Verify
      </p>
      <h3 className="mt-2 text-lg font-semibold text-[var(--text)]">Browse Washington L&I licenses</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
        Statewide contractor-license extract by city, ZIP-derived county, type, or project. Not
        Florida-depth (no Cost Studios or permit intelligence in this v1).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TOP_CITIES.map((c) => (
          <Link
            key={c.slug}
            href={`/washington/${c.slug}`}
            className="inline-flex min-h-9 items-center rounded-full border border-cyan-200 bg-white px-3 text-xs font-medium text-cyan-950 no-underline"
          >
            {c.name}
          </Link>
        ))}
        {TOP_COUNTIES.map((c) => (
          <Link
            key={c.slug}
            href={`/washington/${c.slug}`}
            className="inline-flex min-h-9 items-center rounded-full border border-cyan-200 bg-white px-3 text-xs font-medium text-cyan-950 no-underline"
          >
            {c.name}
          </Link>
        ))}
        {WASHINGTON_PROJECTS.slice(0, 4).map((p) => (
          <Link
            key={p.slug}
            href={`/washington/projects/${p.slug}`}
            className="inline-flex min-h-9 items-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--navy)] no-underline"
          >
            {p.label}
          </Link>
        ))}
      </div>
      <p className="mt-4">
        <Link href="/washington" className="text-sm font-semibold text-[var(--navy)]">
          Open Washington explorer
        </Link>
      </p>
    </section>
  );
}
