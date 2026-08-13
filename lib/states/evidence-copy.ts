/**
 * State-aware Trust Report / Verify language.
 * Avoid hard-coding Florida-only source labels on multi-state profiles.
 */

import type { EvidenceState } from "./config";
import { getStateBySlug } from "./config";

export type EvidenceStateSlug = "fl" | "tx" | "nj";

export function evidenceSlugFromHomeState(
  homeState: string | null | undefined,
  preferred?: string | null
): EvidenceStateSlug {
  const hs = (homeState || "").toUpperCase();
  if (hs === "TX") return "tx";
  if (hs === "NJ") return "nj";
  if (hs === "FL") return "fl";
  const p = (preferred || "").toLowerCase();
  if (p === "tx" || p === "nj" || p === "fl") return p;
  return "fl";
}

export function credentialNoun(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "registration / license";
  if (slug === "tx") return "specialty license";
  return "license";
}

export function boardShortLabel(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "New Jersey DCA extract";
  if (slug === "tx") return "Texas TDLR";
  return "Florida DBPR";
}

export function entityRegistryShortLabel(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "NJ business entity records (high-confidence only)";
  if (slug === "tx") return "Texas SOS entity data (not fully linked yet)";
  return "Florida Sunbiz";
}

export function sourceExtractLabel(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "New Jersey registration extract";
  if (slug === "tx") return "TDLR specialty extract";
  return "Florida DBPR extract";
}

export function trustReportTitleSuffix(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "New Jersey Contractor Trust Report";
  if (slug === "tx") return "Texas Contractor Trust Report";
  return "Florida Contractor Trust Report";
}

export function pilotBadge(slug: EvidenceStateSlug): string | null {
  if (slug === "nj") return "New Jersey verification pilot";
  if (slug === "tx") return "Texas specialty trades";
  return null;
}

export function checkedItems(slug: EvidenceStateSlug): string[] {
  if (slug === "nj") {
    return [
      "NJ home-improvement / contractor registration extract (when linked)",
      "Business entity linkage only when high-confidence name/geo match",
      "Enforcement / discipline rows when present in our extract",
      "Source attribution and extract freshness on this profile",
    ];
  }
  if (slug === "tx") {
    return [
      "TDLR specialty trade license extract (when linked)",
      "Trade type in plain language from TDLR license class",
      "Discipline rows when linked in our extracts",
      "County / location fields when present in the open extract",
    ];
  }
  return [
    "Florida DBPR construction license extract (when linked)",
    "High-confidence Sunbiz entity link (strict match only)",
    "Board discipline rows linked in our extracts",
    "Related-entity pattern rules on this profile",
  ];
}

export function notCheckedItems(slug: EvidenceStateSlug): string[] {
  if (slug === "nj") {
    return [
      "Full New Jersey permit history (not in Stage 7 pilot)",
      "Active insurance / COI validity (request & verify)",
      "Municipal-only trade cards not in the state extract",
      "Reviews, rankings, or “safe to hire” determinations",
    ];
  }
  if (slug === "tx") {
    return [
      "Statewide general contractor directory (Texas has no statewide GC license)",
      "TSBPE plumbing (not fully covered yet)",
      "City/county-only builder registration",
      "Reviews, ratings, or private financials",
    ];
  }
  return [
    "Active insurance / COI validity (request & verify)",
    "Workers' comp policy status (use official portals)",
    "Complete statewide permit history",
    "Reviews, ratings, or private financials",
  ];
}

export function consumerNote(slug: EvidenceStateSlug, state?: EvidenceState | null): string {
  const s = state || getStateBySlug(slug);
  if (slug === "nj") {
    return (
      s?.coverageNote ||
      "New Jersey verification pilot — official registration extracts only. Coverage differs from Florida’s full planning and protection journey."
    );
  }
  if (slug === "tx") {
    return (
      s?.coverageNote ||
      "Texas coverage is selected TDLR specialty trades only — not a statewide general contractor directory."
    );
  }
  return "Educational research from Florida public records — not a marketplace or endorsement.";
}
