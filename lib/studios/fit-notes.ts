/**
 * Rule-based fit notes for studio contractor cards.
 * Evidence only — no ranking, endorsement, or performance claims.
 */

import type { PlanMatchedContractor, PlanMatchResult } from "@/lib/plan/types";
import { occupationLabel } from "@/lib/states/config";

export type FitSignals = {
  /** Primary one-line fit note for the card. */
  fitNote: string;
  /** Compact chips: license class, status, location, entity. */
  signals: Array<{ label: string; tone: "good" | "warn" | "neutral" }>;
  licenseTier: "primary" | "secondary" | "unknown";
  locationTier: PlanMatchedContractor["locationTier"];
};

export function buildFitSignals(
  c: PlanMatchedContractor,
  primaryCodes: string[]
): FitSignals {
  const code = (c.occupationCode || "").toUpperCase();
  const isPrimary = code ? primaryCodes.map((x) => x.toUpperCase()).includes(code) : false;
  const licenseTier: FitSignals["licenseTier"] = !code
    ? "unknown"
    : isPrimary
      ? "primary"
      : "secondary";

  const status = (c.licenseStatus || "").toLowerCase();
  const active = status === "active" || status === "current";

  const signals: FitSignals["signals"] = [];

  if (code) {
    signals.push({
      label: isPrimary
        ? `Primary class ${code}`
        : `Secondary class ${code}`,
      tone: isPrimary ? "good" : "warn",
    });
  }

  signals.push({
    label: active ? "Active / current" : status ? `Status: ${status}` : "Status unknown",
    tone: active ? "good" : status ? "warn" : "neutral",
  });

  const locLabel =
    c.locationTier === "zip"
      ? "ZIP match"
      : c.locationTier === "city"
        ? "City match"
        : c.locationTier === "county"
          ? "County match"
          : "Statewide";
  signals.push({
    label: locLabel,
    tone: c.locationTier === "state" ? "warn" : "good",
  });

  if (c.entityStatus) {
    const es = c.entityStatus.toLowerCase();
    signals.push({
      label:
        es === "active" || es === "current"
          ? "Sunbiz linked (active)"
          : `Sunbiz linked (${c.entityStatus})`,
      tone: es === "active" || es === "current" ? "good" : "warn",
    });
  } else {
    signals.push({ label: "No high-confidence Sunbiz link", tone: "neutral" });
  }

  // Single plain-language fit note (evidence only)
  let fitNote: string;
  if (isPrimary && active && c.locationTier !== "state") {
    fitNote = `Primary ${code || "license"} class for this project type · ${locLabel.toLowerCase()} · active in board extract`;
  } else if (isPrimary && active && c.locationTier === "state") {
    fitNote = `Primary ${code || "license"} class for this project type · statewide listing (weaker than local match) · active in board extract`;
  } else if (!isPrimary && active) {
    fitNote = `Active ${code || "related"} license (secondary for this scope) · matched because local primary specialty coverage is limited or unavailable · ${locLabel.toLowerCase()}`;
  } else if (isPrimary) {
    fitNote = `${occupationLabel(c.occupationCode)} (${code}) is a primary class for this scope · review license status carefully on the Trust Report`;
  } else {
    fitNote =
      c.matchReasons[0] ||
      "Matched on license class and location evidence only — not a ranking or endorsement";
  }

  return { fitNote, signals, licenseTier, locationTier: c.locationTier };
}

export function matchCoverageSummary(match: PlanMatchResult): {
  scopeLine: string;
  headline: string;
  coverageKind: "local" | "mixed" | "statewide" | "empty" | "secondary_heavy";
} {
  const n = match.contractors.length;
  if (n === 0) {
    return {
      coverageKind: "empty",
      headline: "No qualifying active licenses matched this scope in our extract",
      scopeLine:
        "We only show contractors with relevant license classes and location evidence — we do not pad results.",
    };
  }

  const local = match.localCount ?? match.contractors.filter((c) => c.locationTier !== "state").length;
  const secondary = match.contractors.filter((c) =>
    (c.matchReasons || []).some((r) => /secondary|related/i.test(r))
  ).length;

  if (match.locationScope === "statewide" || local === 0) {
    return {
      coverageKind: "statewide",
      headline: "Showing statewide matches for this license class",
      scopeLine:
        "Local ZIP/city/county coverage was thin or empty. Results use the same license classes — not unrelated trades.",
    };
  }

  if (secondary > local * 0.5 && secondary > 0) {
    return {
      coverageKind: "secondary_heavy",
      headline: "Many matches use related (secondary) license classes",
      scopeLine:
        "Primary specialty coverage was limited nearby. Secondary classes are disclosed on each card.",
    };
  }

  if (match.thinResult || local < 3) {
    return {
      coverageKind: "mixed",
      headline: "Limited local coverage — mixed local and broader results",
      scopeLine: `Showing contractors matched on license class + location evidence · ${local} local / ${n} total`,
    };
  }

  return {
    coverageKind: "local",
    headline: "Showing contractors matched on license class + location evidence for this scope",
    scopeLine: `Coverage: local · ${n} contractor${n === 1 ? "" : "s"} with relevant active licenses`,
  };
}

export type ThinStateKind =
  | "empty"
  | "statewide_only"
  | "secondary_only"
  | "thin_local"
  | "ok";

export function classifyThinState(match: PlanMatchResult): ThinStateKind {
  if (match.contractors.length === 0) return "empty";
  const local =
    match.localCount ?? match.contractors.filter((c) => c.locationTier !== "state").length;
  if (local === 0) return "statewide_only";
  const allSecondary = match.contractors.every((c) =>
    (c.matchReasons || []).some((r) => /secondary|related/i.test(r))
  );
  if (allSecondary) return "secondary_only";
  if (match.thinResult || local < 3) return "thin_local";
  return "ok";
}
