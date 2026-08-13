import Link from "next/link";
import { getLiveStates, STATE_SCOPE_UI } from "@/lib/states/config";

const accentBySlug: Record<string, string> = {
  fl: "border-[var(--accent)]/50 bg-[var(--accent-soft)]",
  tx: "border-[var(--border)] bg-white",
  nj: "border-violet-200 bg-violet-50/80",
  or: "border-emerald-200 bg-emerald-50/80",
  wa: "border-teal-200 bg-teal-50/80",
  ca: "border-amber-200 bg-amber-50/80",
  az: "border-sky-200 bg-sky-50/80",
};

/**
 * Multi-state evidence network map — FL full journey + Verify-first peers.
 */
export function StateLandscape() {
  const states = getLiveStates().map((s) => {
    const scope = STATE_SCOPE_UI[s.slug] || {
      badge: s.pilot ? "Verify" : "Live",
      summary: s.coverageNote || "Official public-record verify.",
      verifyHint: "Verify",
    };
    const verifyHref = s.slug === "fl" ? "/verify" : `/verify?state=${s.slug}`;
    const paths =
      s.slug === "fl"
        ? [
            { href: "/verify", label: "Verify" },
            { href: "/plan", label: "Plan" },
            { href: "/#research", label: "Browse" },
          ]
        : [{ href: verifyHref, label: `${s.name} Verify` }];

    return {
      id: s.slug,
      name: s.name,
      badge: scope.badge,
      summary: scope.summary,
      href: verifyHref,
      paths,
      accent: accentBySlug[s.slug] || "border-[var(--border)] bg-white",
    };
  });

  return (
    <section
      id="states"
      aria-labelledby="states-heading"
      className="border-b border-[var(--border)] bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Multi-state evidence network
          </p>
          <h2
            id="states-heading"
            className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text)] sm:text-xl"
          >
            Where we have evidence today
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            <strong className="font-medium text-[var(--text)]">Florida</strong> is the full
            product journey. Other states are{" "}
            <strong className="font-medium text-[var(--text)]">Verify-first</strong> with honest
            board scope — not “all contractors nationwide,” not a marketplace.
          </p>
        </div>

        {/* Mobile: horizontal snap strip; sm+: responsive grid */}
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
              <p className="mt-2 flex-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
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
          Always confirm critical details on the official board before you hire. Coverage and
          extract freshness differ by state.
        </p>
      </div>
    </section>
  );
}
