import type { Metadata } from "next";
import Link from "next/link";
import { AzCoverageStrip } from "@/components/arizona/AzCoverageStrip";
import { AzGeoMethodNote } from "@/components/arizona/AzGeoMethodNote";
import { AzLargestMarkets } from "@/components/arizona/AzLargestMarkets";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { SearchForm } from "@/components/search/SearchForm";
import { AZ_TOP_MARKET_SLUGS } from "@/lib/arizona/geo-copy";
import { ARIZONA_PROJECTS } from "@/lib/arizona/projects";
import { getArizonaDiscoveryStats } from "@/lib/arizona/stats";
import { discoveryPath, getDiscoveryState } from "@/lib/discovery/config";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import { countCitiesBatch, countCountiesBatch, countTradesBatch } from "@/lib/discovery/queries";

const PUBLIC = "arizona";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const state = getDiscoveryState(PUBLIC)!;
  return discoveryMetadata({
    state,
    title: "Arizona Contractor Research — Browse by County, City & Project",
    description:
      "Explore Arizona ROC current contractor licenses by county, major city, trade, or project type. Official posting list evidence — not a marketplace.",
  });
}

export default async function ArizonaLandingPage() {
  const state = getDiscoveryState(PUBLIC)!;
  let stats = { contractors: 0, licenses: 0, disciplineLinked: 0 };
  let counties: Awaited<ReturnType<typeof countCountiesBatch>> = [];
  let cities: Awaited<ReturnType<typeof countCitiesBatch>> = [];
  let trades: Awaited<ReturnType<typeof countTradesBatch>> = [];
  try {
    [stats, counties, cities, trades] = await Promise.all([
      getArizonaDiscoveryStats(),
      countCountiesBatch(PUBLIC),
      countCitiesBatch(PUBLIC),
      countTradesBatch(PUBLIC),
    ]);
  } catch (err) {
    console.error(
      "[arizona] discovery stats unavailable:",
      err instanceof Error ? err.message : err
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Arizona" },
        ]}
      />

      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Explore + Verify · {state.shortName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Arizona contractor research
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
          {state.blurb}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Active contractors in browse", value: stats.contractors },
            { label: "Active ROC licenses", value: stats.licenses },
            { label: "Profiles with linked discipline", value: stats.disciplineLinked },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3"
            >
              <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">
                {s.value > 0 ? s.value.toLocaleString() : "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid max-w-3xl gap-3">
          <AzCoverageStrip />
          <AzGeoMethodNote />
        </div>

        <div className="mt-6 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="mb-3 text-sm font-medium text-[var(--text)]">
            Already have a name or license number?
          </p>
          <SearchForm size="default" stateSlug="az" />
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Browse by project
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {ARIZONA_PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/arizona/projects/${p.slug}`}
                className="inline-flex min-h-10 items-center rounded-full border border-amber-200 bg-amber-50 px-3.5 text-sm font-medium text-amber-950 no-underline hover:border-amber-300"
              >
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 space-y-12">
        <AzLargestMarkets cities={cities} />
        <FacetGrid
          title="Browse by county"
          subtitle="Derived from mailing city on the ROC list — not an official ROC county field. Sorted by active-license density."
          facets={counties}
          hrefFor={(slug) => discoveryPath(state, { countySlug: slug })}
          emptyLabel="County counts unavailable right now."
        />
        <FacetGrid
          title="More cities"
          subtitle="Active mailing-city pages outside the top ten. Each page matches that city only."
          facets={cities.filter((c) => !(AZ_TOP_MARKET_SLUGS as readonly string[]).includes(c.slug))}
          hrefFor={(slug) => discoveryPath(state, { countySlug: slug })}
          emptyLabel="No additional city counts right now."
        />
        <FacetGrid
          title="Browse by trade / class family"
          subtitle="Published ROC class groups. Official codes stay visible on each list."
          facets={trades}
          hrefFor={(slug) => discoveryPath(state, { tradeSlug: slug })}
        />
      </div>

      <div className="mt-12 space-y-4">
        <DiscoveryDisclaimer
          confirmLabel="the official Arizona ROC contractor search"
          verifyHref="/verify?state=az"
        />
        <p className="text-sm text-[var(--muted)]">
          Arizona full-journey v1 is explore + verify. It does not include Cost Studios, permit
          intelligence, or Florida-depth planning.{" "}
          <Link href="/verify?state=az" className="text-[var(--accent)]">
            Open Arizona Verify
          </Link>
          {" · "}
          <Link href="/florida" className="text-[var(--accent)]">
            Florida browse
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
