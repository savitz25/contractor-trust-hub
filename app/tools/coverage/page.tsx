import type { Metadata } from "next";
import Link from "next/link";
import { allCoverageMatrix } from "@/lib/property/coverage";
import { pageMetadata } from "@/lib/seo/page-meta";
import {
  getLiveStateCount,
  getLiveStates,
  liveStatesPlainList,
  verifyPathFor,
  type EvidenceState,
} from "@/lib/states/config";

export const metadata: Metadata = pageMetadata({
  title: "Where we have coverage",
  description:
    "Which states Contractor Trust Hub can search today, what each includes, and honest limits. Extracts can lag official boards — not a nationwide directory.",
  path: "/tools/coverage",
});

/** Static consumer page — no live DB ops probes. */
export const dynamic = "force-static";

function depthExplainer(state: EvidenceState): { includes: string[]; doesNot: string[] } {
  switch (state.depth) {
    case "full_journey":
      return {
        includes: [
          "License lookup by name or number",
          "Trust Report with license, entity (when linked), and discipline in our extract",
          "County / trade browse and project planning tools (Florida)",
        ],
        doesNot: [
          "A complete list of every contractor who ever worked in the state",
          "Live insurance certificates or a guarantee the official board has not changed",
        ],
      };
    case "specialty_verify":
      return {
        includes: [
          "Specialty or trade credentials we load from the official extract",
          "Trust Report for records we have on file",
        ],
        doesNot: [
          "A statewide general contractor license directory (this state does not issue one the way some states do)",
          "Every local-only builder who never appears on the specialty board extract",
        ],
      };
    case "pilot":
      return {
        includes: [
          "Verify search and Trust Report depth for credentials in our current extract",
        ],
        doesNot: [
          "Full Florida-style planning, permit history, and browse",
          "Every board or registration that exists in the state",
        ],
      };
    case "verify":
    default:
      return {
        includes: [
          "License or registration lookup from the official extract we load",
          "Trust Report for published status and related fields when present",
        ],
        doesNot: [
          "Every contractor who works in the state but is only licensed locally",
          "Real-time board status the moment it changes (extracts can lag)",
        ],
      };
  }
}

export default function CoveragePage() {
  const live = getLiveStates();
  const liveCount = getLiveStateCount();
  const list = liveStatesPlainList();
  const permitPartial = allCoverageMatrix().filter(
    (m) => m.level === "partial" || m.level === "full"
  );
  const permitNotYet = allCoverageMatrix().filter(
    (m) => m.level === "jurisdiction_unsupported"
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Honest coverage
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
        Where we have coverage
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
        Contractor Trust Hub is independent research from official public records — not a
        marketplace and not a ranking. Today you can Verify in{" "}
        <strong className="font-semibold text-[var(--text)]">{liveCount} live states</strong> (
        {list}). We do <strong className="font-semibold text-[var(--text)]">not</strong> cover all
        contractors nationwide.
      </p>

      <ul className="mt-5 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-4 text-sm leading-relaxed text-[var(--muted)]">
        <li>
          <strong className="text-[var(--text)]">Extracts can lag.</strong> Boards update daily;
          our published extracts may be older. Always re-check the official board the day you hire.
        </li>
        <li>
          <strong className="text-[var(--text)]">Absence is not clearance.</strong> Missing
          discipline, entity, or permit rows means we do not have them in this extract — not that
          the history is clean.
        </li>
        <li>
          <strong className="text-[var(--text)]">No paid placement.</strong> Order and filters are
          for browsing evidence, not “best contractor” scores.
        </li>
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/verify"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--navy)] px-4 text-sm font-semibold text-white no-underline hover:brightness-110"
        >
          Open Verify
        </Link>
        <Link
          href="/methodology"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--navy)] no-underline hover:border-[var(--navy)]/25"
        >
          How we collect evidence
        </Link>
        <Link
          href="/#states"
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-[var(--muted)] no-underline hover:text-[var(--text)]"
        >
          Homepage state tiles
        </Link>
      </div>

      <section className="mt-10" aria-labelledby="live-states-heading">
        <h2
          id="live-states-heading"
          className="text-lg font-semibold tracking-tight text-[var(--text)]"
        >
          Live states for Verify
        </h2>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          Same list as Verify and the homepage — from our live product config, not a marketing
          claim.
        </p>
        <ul className="mt-5 space-y-4">
          {live.map((state) => {
            const bits = depthExplainer(state);
            return (
              <li
                key={state.slug}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 sm:px-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="text-base font-semibold text-[var(--text)]">{state.name}</h3>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
                    {state.badge}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{state.boardShortLabel}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {state.coverageNote}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      What you can do here
                    </p>
                    <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-[var(--text)]">
                      {bits.includes.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      What this is not
                    </p>
                    <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-[var(--muted)]">
                      {bits.doesNot.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="mt-3">
                  <Link
                    href={verifyPathFor(state)}
                    className="text-sm font-semibold text-[var(--navy)] no-underline hover:underline"
                  >
                    Verify in {state.name}
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="permits-heading">
        <h2
          id="permits-heading"
          className="text-lg font-semibold tracking-tight text-[var(--text)]"
        >
          Florida property / permit research
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Separate from multi-state Verify: looking up a Florida address for permit history is{" "}
          <strong className="font-semibold text-[var(--text)]">progressive and incomplete</strong>.
          Empty results are common and do <em>not</em> prove a clean permit history. Always confirm
          with the local building department when it matters.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Counties with <strong className="text-[var(--text)]">partial</strong> extracts today:
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {permitPartial.map((m) => (
            <li
              key={m.countySlug}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--text)]"
            >
              {m.county}
            </li>
          ))}
        </ul>
        {permitNotYet.length > 0 ? (
          <>
            <p className="mt-4 text-sm text-[var(--muted)]">
              Examples of counties <strong className="text-[var(--text)]">not yet connected</strong>{" "}
              for address permit research (not a complete list of gaps):
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {permitNotYet.map((m) => (
                <li
                  key={m.countySlug}
                  className="rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                >
                  {m.county}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="mt-4">
          <Link
            href="/property"
            className="text-sm font-semibold text-[var(--navy)] no-underline hover:underline"
          >
            Check a Florida address
          </Link>
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-[var(--border)] bg-white px-4 py-5 sm:px-5">
        <h2 className="text-base font-semibold text-[var(--text)]">Before you hire</h2>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
          <li>Use Verify to pull the evidence we have for a name or license number.</li>
          <li>Open the Trust Report, then confirm status on the official board site.</li>
          <li>
            Read{" "}
            <Link href="/methodology" className="font-medium text-[var(--navy)]">
              how we collect and link evidence
            </Link>
            , and our{" "}
            <Link href="/disclaimer" className="font-medium text-[var(--navy)]">
              disclaimer
            </Link>
            .
          </li>
        </ul>
      </section>
    </main>
  );
}
