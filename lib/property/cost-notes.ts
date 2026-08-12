/**
 * Localized cost context foundation — conservative notes only.
 * No hyperlocal precision without data.
 */

import type { CoverageLevel } from "./types";

export function localCostContextNote(input: {
  county: string | null;
  coverage?: CoverageLevel;
}): string {
  if (!input.county) {
    return "Planning ranges remain Florida conceptual statewide bands until county context is set.";
  }
  // Conservative qualitative notes — not multipliers
  const coastal = [
    "Miami-Dade",
    "Broward",
    "Palm Beach",
    "Monroe",
    "Collier",
    "Lee",
    "Sarasota",
    "Pinellas",
    "Duval",
    "Volusia",
    "Brevard",
  ];
  const isCoastal = coastal.some(
    (c) => c.toLowerCase() === input.county!.toLowerCase()
  );
  if (isCoastal) {
    return `${input.county}: coastal Florida markets often see wind-mitigation, impact products, and insurance-driven scope that can push work toward the higher end of conceptual bands. Ranges remain conceptual — not a local bid index.`;
  }
  return `${input.county}: use statewide conceptual planning bands. County context helps matching and permit planning; it does not produce a hyperlocal price index in Stage 3.`;
}
