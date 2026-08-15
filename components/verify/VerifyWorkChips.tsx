import Link from "next/link";
import {
  type WorkIntentId,
  verifyPathWithWork,
  workChipsForState,
} from "@/lib/verify/work-intents";

export function VerifyWorkChips({
  stateSlug,
  activeWork,
  q,
  intent,
}: {
  stateSlug: string;
  activeWork: WorkIntentId | null;
  q?: string;
  intent?: string | null;
}) {
  const chips = workChipsForState(stateSlug, q);
  if (!chips.length) return null;

  const active = chips.find((c) => c.id === activeWork) ?? null;
  const honesty = active?.honesty;

  return (
    <div className="mb-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        What kind of work?
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Work type">
        {chips.map((chip) => {
          const on = chip.id === activeWork;
          return (
            <Link
              key={chip.id}
              href={chip.href}
              aria-pressed={on}
              className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium no-underline transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                on ? "control-selected" : "control-off"
              }`}
            >
              {chip.label}
            </Link>
          );
        })}
        {activeWork ? (
          <Link
            href={verifyPathWithWork(stateSlug, { q, intent })}
            className="inline-flex min-h-10 items-center rounded-full px-3 text-xs font-medium text-[var(--muted)] no-underline hover:text-[var(--text)]"
          >
            Clear type
          </Link>
        ) : null}
      </div>
      {honesty ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{honesty}</p>
      ) : null}
    </div>
  );
}
