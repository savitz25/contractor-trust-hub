/**
 * State-aware Trust Report / Verify language.
 * Avoid hard-coding Florida-only source labels on multi-state profiles.
 */

import type { EvidenceState } from "./config";
import { getStateBySlug } from "./config";

export type EvidenceStateSlug = "fl" | "tx" | "nj" | "or" | "ca";

export function evidenceSlugFromHomeState(
  homeState: string | null | undefined,
  preferred?: string | null
): EvidenceStateSlug {
  const hs = (homeState || "").toUpperCase();
  if (hs === "TX") return "tx";
  if (hs === "NJ") return "nj";
  if (hs === "OR") return "or";
  if (hs === "CA") return "ca";
  if (hs === "FL") return "fl";
  const p = (preferred || "").toLowerCase();
  if (p === "oregon") return "or";
  if (p === "california") return "ca";
  if (p === "tx" || p === "nj" || p === "fl" || p === "or" || p === "ca") return p;
  return "fl";
}

export function credentialNoun(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "registration / license";
  if (slug === "tx") return "specialty license";
  if (slug === "or") return "CCB license";
  if (slug === "ca") return "CSLB license";
  return "license";
}

export function boardShortLabel(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "New Jersey DCA extract";
  if (slug === "tx") return "Texas TDLR / TSBPE";
  if (slug === "or") return "Oregon CCB";
  if (slug === "ca") return "California CSLB";
  return "Florida DBPR";
}

export function entityRegistryShortLabel(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "NJ business entity records (high-confidence only)";
  if (slug === "tx") return "Texas SOS entity data (not fully linked yet)";
  if (slug === "or") return "Oregon SOS entity data (not yet linked)";
  if (slug === "ca") return "California SOS entity data (not yet linked)";
  return "Florida Sunbiz";
}

export function sourceExtractLabel(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "New Jersey registration extract";
  if (slug === "tx") return "TDLR specialty + TSBPE plumbing extract";
  if (slug === "or") return "Oregon CCB Active Licenses extract";
  if (slug === "ca") return "CSLB public list extract (high-impact counties)";
  return "Florida DBPR extract";
}

export function trustReportTitleSuffix(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "New Jersey Contractor Trust Report";
  if (slug === "tx") return "Texas Contractor Trust Report";
  if (slug === "or") return "Oregon Contractor Trust Report";
  if (slug === "ca") return "California Contractor Trust Report";
  return "Florida Contractor Trust Report";
}

export function pilotBadge(slug: EvidenceStateSlug): string | null {
  if (slug === "nj") return "New Jersey HIC + specialty (no statewide GC)";
  if (slug === "tx") return "Texas specialty trades";
  if (slug === "or") return "Oregon CCB statewide";
  if (slug === "ca") return "California CSLB (high-impact counties)";
  return null;
}

export function checkedItems(slug: EvidenceStateSlug): string[] {
  if (slug === "nj") {
    return [
      "Home Improvement Contractor (HIC) registration when linked",
      "Specialty board credentials (electrical, telecom, alarm, locksmith, plumbing, HVACR, hearth) when present",
      "Business entity linkage only when high-confidence match rules pass",
      "Public discipline flags from DCA Standard Files when the bulk flag is Y",
      "Source attribution and extract freshness on this profile",
      "Not a statewide general contractor directory (NJ has no single GC license)",
    ];
  }
  if (slug === "tx") {
    return [
      "TDLR specialty trade license extract (when linked)",
      "TSBPE plumbing credentials (Responsible Master Plumber and Master when loaded)",
      "Trade type in plain language from the board class",
      "County / location fields when present in the open extract",
    ];
  }
  if (slug === "ca") {
    return [
      "CSLB license number, business name, and status from public list extracts",
      "Primary classification (+ multi-class codes when published)",
      "City / county / ZIP and phone when present",
      "Bond and workers’ comp fields as published (not live COI checks)",
      "County coverage limited to high-impact counties in the current download set",
    ];
  }
  if (slug === "or") {
    return [
      "Oregon CCB Active Licenses extract (when linked)",
      "License type / endorsement as published",
      "Bond and liability insurance fields as published (not a live COI)",
      "Workers’ comp Exempt/Nonexempt flag as published",
      "County / city when present",
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
      "Full New Jersey permit history (not in Stage 8A Verify depth)",
      "Active insurance / COI validity (request & verify with carrier)",
      "Municipal-only trade cards not in the state extract",
      "Florida-specific lien, payment, or studio cost models",
      "Reviews, rankings, or “safe to hire” determinations",
    ];
  }
  if (slug === "tx") {
    return [
      "Statewide general contractor directory (Texas has no statewide GC license)",
      "City/county-only builder registration",
      "Reviews, ratings, or private financials",
    ];
  }
  if (slug === "or") {
    return [
      "Inactive / revoked historical archive (this feed is active licenses)",
      "Live bond or insurance certificate validity",
      "Oregon SOS entity linking",
      "Reviews, rankings, or “safe to hire” determinations",
    ];
  }
  if (slug === "ca") {
    return [
      "Every California county (current extract is high-impact counties only; Riverside may be missing)",
      "Live bond / COI / workers’ comp certificate validity",
      "SOS entity auto-links or full permit history",
      "Florida-depth planning, studios, or passport journey",
    ];
  }
  return [
    "Active insurance / COI validity (request & verify)",
    "Workers' comp policy status (use official portals)",
    "Complete statewide permit history",
    "Reviews, ratings, or private financials",
  ];
}

/** Credential / enforcement section headings by state */
export function disciplineSectionTitle(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "Enforcement / public actions";
  if (slug === "tx") return "Caution & regulatory history";
  return "Caution & regulatory history";
}

export function disciplineSectionBlurb(slug: EvidenceStateSlug): string {
  if (slug === "nj") {
    return "Public discipline flags from DCA Standard Files bulk extracts when present. Flags do not include case detail — not a determination of guilt or a quality score. Confirm on the official DCA / MyLicense site.";
  }
  if (slug === "tx") {
    return "Regulatory history from TDLR-linked extracts when present. Factual records only.";
  }
  return "Board discipline from Florida extracts linked to this contractor. Separate from insurance, permits, or reviews — factual records only.";
}

export function entitySectionTitle(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "Business entity (high-confidence)";
  if (slug === "tx") return "Business entity";
  return "Business entity (Sunbiz)";
}

export function consumerNote(slug: EvidenceStateSlug, state?: EvidenceState | null): string {
  const s = state || getStateBySlug(slug);
  if (slug === "nj") {
    return (
      s?.coverageNote ||
      "New Jersey verification pilot — official registration extracts and high-confidence entity/enforcement links when available. Coverage differs from Florida’s full planning and protection journey."
    );
  }
  if (slug === "tx") {
    return (
      s?.coverageNote ||
      "Texas coverage is selected TDLR specialty trades plus TSBPE plumbing — not a statewide general contractor directory."
    );
  }
  if (slug === "or") {
    return (
      s?.coverageNote ||
      "Oregon CCB statewide contractor licensing from the official Active Licenses extract. Confirm on the official CCB site."
    );
  }
  return "Educational research from Florida public records — not a marketplace or endorsement.";
}
