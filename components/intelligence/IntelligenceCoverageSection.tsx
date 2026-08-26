import type { IntelligenceCoverageItem } from "@/lib/intelligence/florida-snapshot";

export function IntelligenceCoverageSection({ items }: { items: IntelligenceCoverageItem[] }) {
  const included = items.filter((i) => i.status === "included");
  const expanding = items.filter((i) => i.status === "expanding");

  if (included.length === 0 && expanding.length === 0) return null;

  return (
    <section id="research-depth" aria-labelledby="depth-heading" className="scroll-mt-24">
      <h2 id="depth-heading" className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
        Current research depth
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
        Coverage describes what Trust Hub has researched — not whether a contractor is higher
        quality. <span className="font-medium text-[var(--text)]">Statewide Research</span> is the
        current Florida default. Enhanced local research will appear only after additional county
        evidence is ingested.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text)]">
            What Florida research currently includes
          </h3>
          <ul className="mt-3 space-y-3">
            {included.map((i) => (
              <li key={i.id}>
                <p className="text-sm font-medium text-[var(--text)]">{i.label}</p>
                <p className="text-xs leading-relaxed text-[var(--muted)]">{i.note}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text)]">
            What is being expanded
          </h3>
          <ul className="mt-3 space-y-3">
            {expanding.map((i) => (
              <li key={i.id}>
                <p className="text-sm font-medium text-[var(--text)]">{i.label}</p>
                <p className="text-xs leading-relaxed text-[var(--muted)]">{i.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
