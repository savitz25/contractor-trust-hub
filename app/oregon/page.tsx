import type { Metadata } from "next";
import Link from "next/link";
import { OrCoverageStrip } from "@/components/oregon/OrCoverageStrip";
import { OrOutOfStateNote } from "@/components/oregon/OrOutOfStateNote";
import { Breadcrumbs } from "@/components/discovery/Breadcrumbs";
import { DiscoveryDisclaimer } from "@/components/discovery/DiscoveryDisclaimer";
import { FacetGrid } from "@/components/discovery/FacetGrid";
import { SearchForm } from "@/components/search/SearchForm";
import { OREGON_PROJECTS } from "@/lib/oregon/projects";
import { getOregonDiscoveryStats } from "@/lib/oregon/stats";
import { discoveryPath, getDiscoveryState } from "@/lib/discovery/config";
import { discoveryMetadata } from "@/lib/discovery/metadata";
import { countCountiesBatch, countTradesBatch } from "@/lib/discovery/queries";

const PUBLIC = "oregon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const state = getDiscoveryState(PUBLIC)!;
  return discoveryMetadata({
    state,
    title: "Oregon Contractor Research — Browse by County & Project",
    description:
      "Explore Oregon CCB active contractor licenses by official county and project type. Bond and insurance as published — not a marketplace.",
  });
}

export default async function OregonLandingPage() {
  const state = getDiscoveryState(PUBLIC)!;
  let stats = { contractors: 0, licenses: 0, withBondListed: 0 };
  let counties: Awaited<ReturnType<typeof countCountiesBatch>> = [];
  let trades: Awaited<ReturnType<typeof countTradesBatch>> = [];
  try {
    [stats, counties, trades] = await Promise.all([
      getOregonDiscoveryStats(),
      countCountiesBatch(PUBLIC),
      countTradesBatch(PUBLIC),
    ]);
  } catch (err) {
    console.error(
      "[oregon] discovery stats unavailable:",
      err instanceof Error ? err.message : err
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Oregon" },
        ]}
      />

      <header className="mt-4 border-b border-[var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Explore + Verify · {state.shortName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          Oregon contractor research
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
          {state.blurb}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Active CCB contractors in browse", value: stats.contractors },
            { label: "Active CCB licenses", value: stats.licenses },
            { label: "Rows with bond listed", value: stats.withBondListed },
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

        <div className="mt-6 max-w-3xl">
          <OrCoverageStrip />
        </div>

        <div className="mt-6 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <p className="mb-3 text-sm font-medium text-[var(--text)]">
            Already have a name or CCB number?
          </p>
          <SearchForm size="default" stateSlug="or" />
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Browse by project
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
          Each project list names the published CCB type it uses. Roofing, HVAC, plumbing, and
          electrical have no separate type code on this extract.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {OREGON_PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/oregon/projects/${p.slug}`}
                className="inline-flex min-h-10 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-medium text-emerald-950 no-underline hover:border-emerald-300"
              >
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 space-y-12">
        <FacetGrid
          title="Browse by county"
          subtitle="Official CCB county field. Sorted by active-license density. “Out of state” means mailing address, not jobsite."
          facets={counties.map((c) =>
            c.slug === "out-of-state"
              ? { ...c, label: "Out of state (mailing address)" }
              : c
          )}
          hrefFor={(slug) => discoveryPath(state, { countySlug: slug })}
          emptyLabel="County counts unavailable right now."
        />
        {counties.some((c) => c.slug === "out-of-state" && c.count > 0) ? (
          <OrOutOfStateNote />
        ) : null}
        <FacetGrid
          title="Browse by endorsement family"
          subtitle="Published CCB license types. Residential specialty (RSC) does not name the trade on this extract."
          facets={trades}
          hrefFor={(slug) => discoveryPath(state, { tradeSlug: slug })}
        />
      </div>

      <div className="mt-12 space-y-4">
        <DiscoveryDisclaimer
          confirmLabel="the official Oregon CCB search"
          verifyHref="/verify?state=or"
        />
        <p className="text-sm text-[var(--muted)]">
          Oregon full-journey v1 is explore + verify. It does not include Cost Studios, permit
          intelligence, or Florida-depth planning.{" "}
          <Link href="/verify?state=or" className="text-[var(--accent)]">
            Open Oregon Verify
          </Link>
          {" · "}
          <Link href="/arizona" className="text-[var(--accent)]">
            Arizona explore
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
