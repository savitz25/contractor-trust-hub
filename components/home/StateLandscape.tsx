import Link from "next/link";
import {
  getLiveStateCount,
  getLiveStates,
  verifyPathFor,
  type EvidenceState,
} from "@/lib/states/config";

const accentBySlug: Record<string, string> = {
  fl: "border-[var(--accent)]/50 bg-[var(--accent-soft)]",
  tx: "border-[var(--border)] bg-white",
  nj: "border-violet-200 bg-violet-50/80",
  or: "border-emerald-200 bg-emerald-50/80",
  wa: "border-teal-200 bg-teal-50/80",
  ca: "border-amber-200 bg-amber-50/80",
  az: "border-sky-200 bg-sky-50/80",
  la: "border-rose-200 bg-rose-50/80",
  ms: "border-indigo-200 bg-indigo-50/80",
  ky: "border-amber-200 bg-amber-50/80",
};

function pathsFor(s: EvidenceState): { href: string; label: string }[] {
  const verifyHref = verifyPathFor(s);
  if (s.slug === "ca") {
    return [
      { href: "/california", label: "California research" },
      { href: verifyHref, label: "Verify" },
    ];
  }
  if (s.browseEnabled || s.depth === "full_journey") {
    return [
      { href: verifyHref, label: "Verify" },
      { href: "/plan/start", label: "Plan" },
      { href: "/florida", label: "Explore" },
    ];
  }
  return [{ href: verifyHref, label: `${s.name} Verify` }];
}

/**
 * Multi-state coverage grid — every live state from config (same set as Verify tabs).
 */
export function StateLandscape() {
  const live = getLiveStates();
  const count = getLiveStateCount();

  const states = live.map((s) => ({
    id: s.slug,
    name: s.name,
    badge: s.badge,
    scopeLine: s.scopeHint,
    summary: s.coverageNote,
    href: verifyPathFor(s),
    paths: pathsFor(s),
    accent: accentBySlug[s.slug] || "border-[var(--border)] bg-white",
  }));

  return (
    <section
      id="states"
      aria-labelledby="states-heading"
      className="border-b border-[var(--border)] bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Coverage across the U.S.
          </p>
          <h2
            id="states-heading"
            className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text)] sm:text-xl"
          >
            Licensing works differently in every state
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            <strong className="font-medium text-[var(--text)]">Florida</strong> is the full
            journey (verify, plan, browse). Other states are{" "}
            <strong className="font-medium text-[var(--text)]">name and license Verify</strong>{" "}
            with board-specific scope and honest limits.
          </p>
        </div>

        <ul className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:mt-6 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
          {states.map((s) => (
            <li
              key={s.id}
              className={`flex min-w-[min(100%,17.5rem)] shrink-0 snap-start flex-col rounded-2xl border px-4 py-4 shadow-[var(--shadow-sm)] sm:min-w-0 sm:px-5 sm:py-5 ${s.accent}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-[var(--text)]">{s.name}</p>
                <span className="rounded-full border border-[var(--border)] bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--navy)]">
                  {s.badge}
                </span>
              </div>
              {s.scopeLine ? (
                <p className="mt-1.5 text-xs font-medium leading-snug text-[var(--navy)] sm:text-[13px]">
                  {s.scopeLine}
                </p>
              ) : null}
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
                {s.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.paths.map((p) => (
                  <Link
                    key={p.href + p.label}
                    href={p.href}
                    className="inline-flex min-h-9 items-center rounded-xl border border-[var(--navy)]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline hover:border-[var(--navy)]/35"
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
          Confirm critical details on the official board before you hire. Extract freshness
          varies by state.
        </p>
      </div>
    </section>
  );
}
