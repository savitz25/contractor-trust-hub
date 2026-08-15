import Link from "next/link";

const steps = [
  { n: "1", label: "Plan scope", href: "/tools/scope-builder" },
  { n: "2", label: "Analyze quote", href: "/tools/quote-analyzer" },
  { n: "3", label: "Compare bids", href: "/tools/compare-bids" },
  { n: "4", label: "Verify contractor", href: "/verify" },
  { n: "5", label: "Checklist", href: "/tools/pre-hire-checklist" },
] as const;

export function DecisionJourney({ current }: { current?: string }) {
  return (
    <nav
      aria-label="Decision journey"
      className="flex flex-wrap gap-1.5 text-[11px] font-semibold sm:gap-2"
    >
      {steps.map((s, i) => {
        const on = current === s.href;
        return (
          <span key={s.href} className="inline-flex items-center gap-1.5">
            {i > 0 ? (
              <span className="hidden text-[var(--muted)] sm:inline" aria-hidden>
                /
              </span>
            ) : null}
            <Link
              href={s.href}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 no-underline ${
                on ? "control-selected" : "control-off"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  on ? "bg-white/20 text-white" : "bg-[var(--navy)] text-white"
                }`}
              >
                {s.n}
              </span>
              {s.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
