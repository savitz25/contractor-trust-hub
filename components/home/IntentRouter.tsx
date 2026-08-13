import Link from "next/link";

const intents = [
  {
    id: "verify",
    href: "/#search",
    title: "Verify a contractor",
    bestWhen: "Best when you already have a name, license, or registration number.",
    bullets: [
      "Seven live states — FL full depth; others Verify-first",
      "Open a Trust Report with honest coverage limits",
    ],
    cta: "Search contractors",
    accent: true,
  },
  {
    id: "plan",
    href: "/plan",
    title: "Plan a project",
    bestWhen: "Best when you're deciding Florida scope and cost.",
    bullets: ["Kitchen, bath, roofing calculators", "Florida planning tools — then verify"],
    cta: "Start planning",
    accent: true,
  },
  {
    id: "research",
    href: "/#research",
    title: "Research / browse",
    bestWhen: "Best when you want to explore Florida by county and trade.",
    bullets: ["Roofing, GC, A/C, plumbing listings", "Florida discovery — other states use Verify"],
    cta: "Browse Florida",
    accent: false,
  },
] as const;

/**
 * Primary 3-path chooser — the homepage front door after the hero.
 */
export function IntentRouter() {
  return (
    <section
      id="start"
      aria-labelledby="intent-heading"
      className="border-b border-[var(--border)] bg-[var(--bg)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="max-w-2xl">
          <h2
            id="intent-heading"
            className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl"
          >
            Where do you want to start?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Pick the path that matches your situation. You can move between tools anytime — this is
            research tooling, not a hiring marketplace.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
          {intents.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              data-entry-path={card.id}
              className={`group flex flex-col rounded-2xl border px-5 py-5 no-underline shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)] sm:min-h-[220px] sm:px-6 sm:py-6 ${
                card.accent
                  ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] hover:border-[var(--accent)]"
                  : "border-[var(--border)] bg-white hover:border-[var(--navy)]/25"
              }`}
            >
              <p className="text-base font-semibold text-[var(--text)] sm:text-lg">{card.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{card.bestWhen}</p>
              <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
                {card.bullets.map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
              <p className="mt-auto pt-4 text-sm font-semibold text-[var(--navy)] group-hover:underline">
                {card.cta} →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
