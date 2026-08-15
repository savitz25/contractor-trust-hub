import Link from "next/link";
import { getLiveStateCount } from "@/lib/states/config";

/**
 * Primary path chooser after the hero — two clear intents + Florida browse.
 */
export function IntentRouter() {
  const liveCount = getLiveStateCount();

  const intents = [
    {
      id: "verify",
      href: "/#search",
      title: "I already have a name or license",
      bestWhen: "Best when you know who you're checking.",
      bullets: [
        `${liveCount} live state${liveCount === 1 ? "" : "s"} - same list as Verify tabs`,
        "Open a Trust Report with honest coverage limits",
      ],
      cta: "Search contractors",
      accent: true,
    },
    {
      id: "plan",
      href: "/plan/start",
      title: "I'm planning a project",
      bestWhen: "Best when you're deciding where the work is and what tools apply.",
      bullets: [
        "Choose your state first",
        "Florida: plan + studios; other live states: Verify",
      ],
      cta: "Start planning",
      accent: true,
    },
    {
      id: "research",
      href: "/#research",
      title: "Browse Florida by trade",
      bestWhen: "Best when you want to explore Florida by county and trade.",
      bullets: ["Roofing, GC, A/C, plumbing listings", "Other states use Verify search"],
      cta: "Browse Florida",
      accent: false,
    },
  ] as const;

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
            Pick the path that matches your situation. You can move between tools anytime.
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
                  <li key={b}>- {b}</li>
                ))}
              </ul>
              <p className="mt-auto pt-4 text-sm font-semibold text-[var(--navy)] group-hover:underline">
                {card.cta}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
