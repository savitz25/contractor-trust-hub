import type { Metadata } from "next";
import Link from "next/link";
import { WaCoverageStrip } from "@/components/washington/WaCoverageStrip";
import { WaGeoMethodNote } from "@/components/washington/WaGeoMethodNote";
import { WaLargestMarkets } from "@/components/washington/WaLargestMarkets";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { SearchForm } from "@/components/search/SearchForm";
import { WA_TOP_COUNTY_SLUGS, WA_TOP_MARKET_SLUGS } from "@/lib/washington/geo-copy";
import { WASHINGTON_PROJECTS } from "@/lib/washington/projects";
import { getWashingtonDiscoveryStats } from "@/lib/washington/stats";
import { discoveryPath, getDiscoveryState } from "@/lib/discovery/config";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import { countCitiesBatch, countCountiesBatch, countTradesBatch } from "@/lib/discovery/queries";

const PUBLIC = "washington";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const state = getDiscoveryState(PUBLIC)!;
  return discoveryMetadata({
    state,
    title: "Washington Contractor Research — Browse by City, County & Project",
    description:
      "Explore Washington L&I contractor licenses by city, derived county, type, or project. Official contractor-license extract — not a marketplace.",
  });
}

export default async function WashingtonLandingPage() {
  const state = getDiscoveryState(PUBLIC)!;
  let stats = { contractors: 0, licenses: 0, waMailing: 0 };
  let counties: Awaited<ReturnType<typeof countCountiesBatch>> = [];
  let cities: Awaited<ReturnType<typeof countCitiesBatch>> = [];
  let trades: Awaited<ReturnType<typeof countTradesBatch>> = [];
  try {
    [stats, counties, cities, trades] = await Promise.all([
      getWashingtonDiscoveryStats(),
      countCountiesBatch(PUBLIC),
      countCitiesBatch(PUBLIC),
      countTradesBatch(PUBLIC),
    ]);
  } catch (err) {
    console.error(
      "[washington] discovery stats unavailable:",
      err instanceof Error ? err.message : err
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Washington" },
        ]}
      />

      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Explore + Verify · {state.shortName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Washington contractor research
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
          {state.blurb}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Active contractors in browse", value: stats.contractors },
            { label: "Active L&I licenses", value: stats.licenses },
            { label: "Active with a WA mailing address", value: stats.waMailing },
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
          <WaCoverageStrip />
          <WaGeoMethodNote />
        </div>

        <div className="mt-6 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="mb-3 text-sm font-medium text-[var(--text)]">
            Already have a name or license number?
          </p>
          <SearchForm size="default" stateSlug="wa" />
        </div>
      </header>

      <div className="mt-10">
        <WaLargestMarkets cities={cities} counties={counties} />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Browse by project
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
          Statewide lists. Use a city or county card above to keep the same project in one market.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {WASHINGTON_PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/washington/projects/${p.slug}`}
                className="inline-flex min-h-10 items-center rounded-full border border-cyan-200 bg-cyan-50 px-3.5 text-sm font-medium text-cyan-950 no-underline hover:border-cyan-300"
              >
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 space-y-12">
        <FacetGrid
          title="More counties"
          subtitle="Additional ZIP5-derived counties and the out-of-state mailing list. Not an official L&I county field. Sparse compared with the markets above."
          facets={counties.filter((c) => !(WA_TOP_COUNTY_SLUGS as readonly string[]).includes(c.slug))}
          hrefFor={(slug) => discoveryPath(state, { countySlug: slug })}
          emptyLabel="No additional county counts right now."
        />
        <FacetGrid
          title="More cities"
          subtitle="Active mailing-city pages outside the densest ten. Each page matches that city and mailing state Washington only."
          facets={cities.filter((c) => !(WA_TOP_MARKET_SLUGS as readonly string[]).includes(c.slug))}
          hrefFor={(slug) => discoveryPath(state, { countySlug: slug })}
          emptyLabel="No additional city counts right now."
        />
        <FacetGrid
          title="Browse by type / specialty family"
          subtitle="Published L&I types (CC, EC, PC, LC) and named construction specialties. Official codes stay visible on each list."
          facets={trades}
          hrefFor={(slug) => discoveryPath(state, { tradeSlug: slug })}
        />
      </div>

      <div className="mt-12 space-y-4">
        <DiscoveryDisclaimer
          confirmLabel="the official Washington L&I contractor verify site"
          verifyHref="/verify?state=wa"
        />
        <p className="text-sm text-[var(--muted)]">
          Washington full-journey v1 is explore + verify. It does not include Cost Studios, permit
          intelligence, or Florida-depth planning.{" "}
          <Link href="/verify?state=wa" className="text-[var(--accent)]">
            Open Washington Verify
          </Link>
          {" · "}
          <Link href="/oregon" className="text-[var(--accent)]">
            Oregon explore
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
