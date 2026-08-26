import Link from "next/link";
import type { IntelligenceCategory } from "@/lib/intelligence/florida-snapshot";
import { formatIntelNumber } from "./format";

export function IntelligenceCategoryExplorer({
  categories,
  timedOut,
}: {
  categories: IntelligenceCategory[];
  timedOut: boolean;
}) {
  const maxTracked = Math.max(1, ...categories.map((c) => c.tracked));

  return (
    <section id="categories" aria-labelledby="categories-heading" className="scroll-mt-24">
      <h2 id="categories-heading" className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
        Contractor category intelligence
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        Each category combines the certified and registered CILB classes that belong together.
        Registered residential (RR) is residential, not roofing. Counts are credentials, not
        companies. Open a category to browse discovery results.
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {categories.map((c) => {
          const width = timedOut ? 0 : Math.round((c.tracked / maxTracked) * 100);
          const certified = c.splits.filter((s) => s.kind === "certified_trade");
          const registered = c.splits.filter((s) => s.kind === "registered_trade");
          return (
            <li key={c.id}>
              <Link
                href={c.href}
                className="block min-h-12 rounded-2xl border border-[var(--border)] bg-white p-4 no-underline shadow-[var(--shadow-sm)] transition hover:border-[var(--navy)]/20 hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-semibold text-[var(--text)]">{c.label}</p>
                  <span className="shrink-0 text-xs font-medium text-[var(--muted)]">Browse</span>
                </div>
                <p className="mt-2 text-sm tabular-nums text-[var(--text)]">
                  {formatIntelNumber(timedOut ? null : c.tracked, timedOut)} credentials tracked
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {formatIntelNumber(timedOut ? null : c.active, timedOut)} active
                  </span>
                </p>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--navy-soft)]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-[var(--navy)]"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
                  Certified:{" "}
                  {certified
                    .map(
                      (s) =>
                        `${s.code} ${formatIntelNumber(timedOut ? null : s.tracked, timedOut)}`
                    )
                    .join(" · ") || "—"}
                  <br />
                  Registered:{" "}
                  {registered
                    .map(
                      (s) =>
                        `${s.code} ${formatIntelNumber(timedOut ? null : s.tracked, timedOut)}`
                    )
                    .join(" · ") || "—"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
