import Link from "next/link";
import type { PlanMatchResult } from "@/lib/plan/types";
import { classifyThinState } from "@/lib/studios/fit-notes";

type Props = {
  match: PlanMatchResult;
  studioSlug: string;
};

export function StudioThinState({ match, studioSlug }: Props) {
  const kind = classifyThinState(match);
  const isRoofing = studioSlug === "roofing";
  const isKitchen = studioSlug === "kitchen";
  const isBathroom = studioSlug === "bathroom";

  if (kind === "ok") return null;

  const copy: Record<
    Exclude<ReturnType<typeof classifyThinState>, "ok">,
    { title: string; body: string; standard: string }
  > = {
    empty: {
      title: isRoofing
        ? "Limited local licensed roofing coverage for this scope"
        : isKitchen
          ? "Limited local licensed remodel coverage for this kitchen scope"
          : isBathroom
            ? "Limited local licensed remodel coverage for this bathroom scope"
            : "No qualifying active licenses matched this scope",
      body: isRoofing
        ? match.emptyReason ||
          "We did not find active CCC/RR roofing licenses for this location in our extract. We do not pad with unrelated trades."
        : isKitchen
          ? match.emptyReason ||
            "We did not find active CGC/CBC/CRC licenses for this location in our extract. We do not invent matches for kitchen remodels."
          : isBathroom
            ? match.emptyReason ||
              "We did not find active CFC/CRC/CBC licenses for this location in our extract. We do not invent matches for bathroom remodels."
            : match.emptyReason ||
              "We did not find contractors with relevant active license classes for this project type and location in our current extract.",
      standard: isRoofing
        ? "Roofing standard: active/current CCC or RR first; CGC only if primary is thin. Location ZIP → city → county → statewide."
        : isKitchen
          ? "Kitchen standard: active/current CGC, CBC, or CRC first; CFC secondary when local primary is thin."
          : isBathroom
            ? "Bathroom standard: active/current CFC, CRC, or CBC first; CGC secondary when local primary is thin."
            : "Standard: active/current status + trade-relevant occupation codes + location evidence when provided. We do not pad with unrelated licenses.",
    },
    statewide_only: {
      title: isRoofing
        ? "No strong local roofing licenses — statewide CCC/RR only"
        : isKitchen
          ? "No strong local remodel licenses — statewide GC classes only"
          : isBathroom
            ? "No strong local bath remodel licenses — statewide CFC/CRC/CBC only"
            : "No strong local matches — statewide primary classes only",
      body: isRoofing
        ? "Local ZIP/city/county did not yield enough active roofing specialty licenses. Statewide results still use CCC/RR (and disclosed CGC only if configured secondary)."
        : isKitchen
          ? "Local coverage was thin for CGC/CBC/CRC. Statewide results use the same remodel license classes — not unrelated trades."
          : isBathroom
            ? "Local coverage was thin for CFC/CRC/CBC. Statewide results use the same bath remodel license classes — not unrelated trades."
            : "ZIP, city, or county did not yield enough local specialty licenses. Results use the same license classes statewide, not weaker unrelated trades.",
      standard:
        "Standard: same primary occupation codes; location tier marked as statewide (weaker than ZIP/city/county).",
    },
    secondary_only: {
      title: isRoofing
        ? "Only secondary (CGC) matches nearby — not roofing specialty"
        : isKitchen
          ? "Only secondary (e.g. plumbing specialty) matches nearby"
          : isBathroom
            ? "Only secondary (CGC) matches nearby — not primary bath remodel classes"
            : "Only secondary / related license classes matched locally",
      body: isRoofing
        ? "Local CCC/RR coverage was empty or very thin. Cards that show CGC are secondary fallbacks — review Trust Reports carefully before hiring for roof work."
        : isKitchen
          ? "Local general/residential remodel coverage was thin. Secondary classes (such as CFC) are disclosed — a plumber alone may not cover full kitchen GC scope."
          : isBathroom
            ? "Local CFC/CRC/CBC coverage was thin. Secondary CGC is disclosed — review Trust Reports carefully for wet-area and plumbing scope."
            : "Primary specialty coverage was empty or very thin nearby. Cards disclose secondary class matches — review Trust Reports carefully.",
      standard:
        "Standard: secondary classes only after primary local coverage is thin; never presented as primary specialty.",
    },
    thin_local: {
      title: isRoofing
        ? "Limited local licensed roofing coverage"
        : isKitchen
          ? "Limited local kitchen remodel coverage"
          : isBathroom
            ? "Limited local bathroom remodel coverage"
            : "Limited local specialty coverage",
      body: isRoofing
        ? "Only a small number of local CCC/RR matches met the evidence bar. Broader results may appear with location tier disclosed on each card."
        : isKitchen
          ? "Only a small number of local CGC/CBC/CRC matches met the evidence bar. Broader results may appear with location tier disclosed on each card."
          : isBathroom
            ? "Only a small number of local CFC/CRC/CBC matches met the evidence bar. Broader results may appear with location tier disclosed on each card."
            : "A small number of local matches met the evidence bar. Broader results may appear with location tier disclosed on each card.",
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
