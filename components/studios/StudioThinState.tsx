import Link from "next/link";
import type { PlanMatchResult } from "@/lib/plan/types";
import { classifyThinState } from "@/lib/studios/fit-notes";

type Props = {
  match: PlanMatchResult;
  studioSlug: string;
};

export function StudioThinState({ match, studioSlug }: Props) {
  const kind = classifyThinState(match);

  if (kind === "ok") return null;

  const copy: Record<
    Exclude<ReturnType<typeof classifyThinState>, "ok">,
    { title: string; body: string; standard: string }
  > = {
    empty: {
      title: "No qualifying active licenses matched this scope",
      body:
        match.emptyReason ||
        "We did not find contractors with relevant active license classes for this project type and location in our current extract.",
      standard:
        "Standard: active/current status + trade-relevant occupation codes + location evidence when provided. We do not pad with unrelated licenses.",
    },
    statewide_only: {
      title: "No strong local matches — statewide primary classes only",
      body: "ZIP, city, or county did not yield enough local specialty licenses. Results use the same license classes statewide, not weaker unrelated trades.",
      standard:
        "Standard: same primary occupation codes; location tier marked as statewide (weaker than ZIP/city/county).",
    },
    secondary_only: {
      title: "Only secondary / related license classes matched locally",
      body: "Primary specialty coverage was empty or very thin nearby. Cards disclose secondary class matches — review Trust Reports carefully.",
      standard:
        "Standard: secondary classes only after primary local coverage is thin; never presented as primary specialty.",
    },
    thin_local: {
      title: "Limited local specialty coverage",
      body: "A small number of local matches met the evidence bar. Broader results may appear with location tier disclosed on each card.",
      standard:
        "Standard: prefer local primary licenses; expand carefully with disclosed location and class tiers.",
    },
  };

  const c = copy[kind];

  return (
    <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-4 sm:px-5">
      <p className="text-sm font-semibold text-amber-950">{c.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-amber-950/90">{c.body}</p>
      <p className="mt-2 text-xs leading-relaxed text-amber-900/80">{c.standard}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/studios/${studioSlug}`}
          className="rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
        >
          Adjust scope
        </Link>
        <Link
          href="/verify"
          className="rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
        >
          Verify a specific name
        </Link>
        <Link
          href="/florida"
          className="rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
        >
          Browse Florida by county
        </Link>
        <Link
          href="/studios"
          className="rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] no-underline"
        >
          Open a different studio
        </Link>
      </div>
    </div>
  );
}
