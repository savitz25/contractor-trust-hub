/**
 * State-aware Trust Report / Verify language.
 * Avoid hard-coding Florida-only source labels on multi-state profiles.
 */

import type { EvidenceState } from "./config";
import { getStateBySlug } from "./config";

export type EvidenceStateSlug = "fl" | "tx" | "nj" | "or" | "wa" | "ca" | "az" | "la" | "ms" | "ky" | "wi";

export function evidenceSlugFromHomeState(
  homeState: string | null | undefined,
  preferred?: string | null
): EvidenceStateSlug {
  const hs = (homeState || "").toUpperCase();
  if (hs === "TX") return "tx";
  if (hs === "NJ") return "nj";
  if (hs === "OR") return "or";
  if (hs === "WA") return "wa";
  if (hs === "CA") return "ca";
  if (hs === "AZ") return "az";
  if (hs === "LA") return "la";
  if (hs === "MS") return "ms";
  if (hs === "KY") return "ky";
  if (hs === "WI") return "wi";
  if (hs === "FL") return "fl";
  const p = (preferred || "").toLowerCase();
  if (p === "oregon") return "or";
  if (p === "california") return "ca";
  if (p === "arizona") return "az";
  if (p === "washington") return "wa";
  if (p === "louisiana") return "la";
  if (p === "mississippi") return "ms";
  if (p === "kentucky") return "ky";
  if (p === "wisconsin") return "wi";
  if (
    p === "tx" ||
    p === "nj" ||
    p === "fl" ||
    p === "or" ||
    p === "wa" ||
    p === "ca" ||
    p === "az" ||
    p === "la" ||
    p === "ms" ||
    p === "ky" ||
    p === "wi"
  )
    return p;
  return "fl";
}

export function credentialNoun(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "registration / license";
  if (slug === "tx") return "specialty license";
  if (slug === "or") return "CCB license";
  if (slug === "ca") return "CSLB license";
  if (slug === "az") return "ROC license";
  if (slug === "wa") return "L&I license";
  if (slug === "la") return "LSLBC license";
  if (slug === "ms") return "MSBOC license";
  if (slug === "ky") return "DHBC specialty license";
  if (slug === "wi") return "DSPS dwelling / trade credential";
  return "license";
}

export function boardShortLabel(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "New Jersey DCA extract";
  if (slug === "tx") return "Texas TDLR / TSBPE";
  if (slug === "or") return "Oregon CCB";
  if (slug === "wa") return "Washington L&I";
  if (slug === "ca") return "California CSLB";
  if (slug === "az") return "Arizona ROC";
  if (slug === "la") return "Louisiana LSLBC";
  if (slug === "ms") return "Mississippi MSBOC";
  if (slug === "ky") return "Kentucky DHBC";
  if (slug === "wi") return "Wisconsin DSPS";
  return "Florida DBPR";
}

export function entityRegistryShortLabel(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "NJ business entity records (high-confidence only)";
  if (slug === "tx") return "Texas SOS entity data (not fully linked yet)";
  if (slug === "or") return "Oregon SOS entity data (not yet linked)";
  if (slug === "wa") return "Washington SOS entity data (not yet linked)";
  if (slug === "ca") return "California SOS entity data (not yet linked)";
  if (slug === "az") return "Arizona ACC entity data (not yet linked)";
  if (slug === "la") return "Louisiana SOS (not yet linked)";
  if (slug === "ms") return "Mississippi SOS (not yet linked)";
  if (slug === "ky") return "Kentucky SOS (not yet linked)";
  if (slug === "wi") return "Wisconsin DFI (not yet linked)";
  return "Florida Sunbiz";
}

export function sourceExtractLabel(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "New Jersey registration extract";
  if (slug === "tx") return "TDLR specialty + TSBPE plumbing extract";
  if (slug === "or") return "Oregon CCB Active Licenses extract";
  if (slug === "wa") return "Washington L&I contractor extract";
  if (slug === "ca") return "CSLB public list extract (high-impact counties)";
  if (slug === "az") return "Arizona ROC current active posting list";
  if (slug === "la") return "Louisiana LSLBC public contractor roster";
  if (slug === "ms") return "Mississippi MSBOC public contractor list";
  if (slug === "ky") return "Kentucky DHBC specialty list";
  if (slug === "wi") return "Wisconsin DSPS / LicensE extract";
  return "Florida DBPR extract";
}

export function trustReportTitleSuffix(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "New Jersey Contractor Trust Report";
  if (slug === "tx") return "Texas Contractor Trust Report";
  if (slug === "or") return "Oregon Contractor Trust Report";
  if (slug === "wa") return "Washington Contractor Trust Report";
  if (slug === "ca") return "California Contractor Trust Report";
  if (slug === "az") return "Arizona Contractor Trust Report";
  if (slug === "la") return "Louisiana Contractor Trust Report";
  if (slug === "ms") return "Mississippi Contractor Trust Report";
  if (slug === "ky") return "Kentucky Contractor Trust Report";
  if (slug === "wi") return "Wisconsin Contractor Trust Report";
  return "Florida Contractor Trust Report";
}

export function pilotBadge(slug: EvidenceStateSlug): string | null {
  if (slug === "nj") return "New Jersey HIC + specialty (no statewide GC)";
  if (slug === "tx") return "Texas specialty trades";
  if (slug === "or") return "Oregon CCB statewide";
  if (slug === "wa") return "Washington L&I statewide";
  if (slug === "ca") return "California CSLB (high-impact counties)";
  if (slug === "az") return "Arizona ROC statewide (current active list)";
  if (slug === "la") return "Louisiana LSLBC statewide";
  if (slug === "ms") return "Mississippi MSBOC statewide";
  if (slug === "ky") return "Kentucky DHBC specialty (no statewide GC)";
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
  if (slug === "az") {
    return [
      "ROC license number, business name, and Active status from the current posting list",
      "Class code, class detail, and residential / commercial / dual category when published",
      "City / address and issued / expiration dates when present",
      "Qualifying party name when published (not a full personnel roster)",
      "ROC disciplinary actions when linked from the official disciplinary CSV",
    ];
  }
  if (slug === "wa") {
    return [
      "Washington L&I contractor license number and business name from the official extract",
      "Status and trade / specialty class when published",
      "City / state when present",
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
  if (slug === "la") {
    return [
      "Louisiana LSLBC official public Request Roster (when linked)",
      "Published credential type: commercial, residential, home improvement, or mold",
      "Active status as published on the roster export",
      "Parish / city / mailing location when present",
    ];
  }
  if (slug === "ms") {
    return [
      "Mississippi MSBOC official public list (when linked)",
      "Published type: commercial or residential",
      "Official class suffix (MC / SC) when on the license number",
      "Published status and city / mailing location when present",
    ];
  }
  if (slug === "ky") {
    return [
      "Kentucky DHBC specialty contractor credentials when linked",
      "Electrical (Contractor Electrician-Business), HVAC (Master HVAC Contractor), and plumbing (Master Plumber)",
      "Published status and issued / expiration dates when present",
      "Not a statewide general contractor directory",
    ];
  }
  if (slug === "wi") {
    return [
      "Wisconsin DSPS / LicensE dwelling and trade credentials when linked",
      "Dwelling Contractor is a 1–2 family permit credential, not a commercial GC",
      "Electrical Contractor and HVAC Contractor when present",
      "Published status and dates when the extract includes them",
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
      "Every California county (current extract is high-impact counties only; not a full statewide board dump)",
      "Live bond / COI / workers’ comp certificate validity",
      "SOS entity auto-links or full permit history",
      "Florida-depth planning, studios, or passport journey",
    ];
  }
  if (slug === "az") {
    return [
      "Full historical inactive archive beyond disciplinary + current active lists",
      "Full case narrative / findings text (disciplinary CSV is status-word level)",
      "Live bond / insurance certificate validity",
      "ACC entity auto-links or Florida-depth planning journey",
    ];
  }
  if (slug === "wa") {
    return [
      "Florida-depth planning, studios, or passport journey",
      "Live bond / insurance certificate validity",
      "Automatic SOS entity linkage",
      "Reviews, rankings, or “safe to hire” determinations",
    ];
  }
  if (slug === "la") {
    return [
      "Expired / inactive archive (this official roster export is Active only)",
      "Trade classifications and qualifying parties (not on the roster CSV)",
      "Bond or insurance (not published on this export)",
      "Complaints or board discipline (not in this extract)",
      "Louisiana SOS entity linking",
      "Reviews, rankings, or “safe to hire” determinations",
    ];
  }
  if (slug === "ms") {
    return [
      "Full specialty classification list (only when published on the extract)",
      "Qualifying party (only when published on the extract)",
      "Bond or insurance (not published on the list view)",
      "Complaints or board discipline (not in this extract)",
      "Mississippi SOS entity linking",
      "Reviews, rankings, or “safe to hire” determinations",
    ];
  }
  if (slug === "ky") {
    return [
      "Statewide general contractor directory (Kentucky has no statewide GC license)",
      "Bond or insurance (not published on the DHBC list view)",
      "Complaints or board discipline (not in this extract)",
      "Apprentice / journeyman / inspector credentials",
      "City/county-only builder cards (Louisville Metro and others)",
      "Reviews, rankings, or “safe to hire” determinations",
    ];
  }
  if (slug === "wi") {
    return [
      "Statewide commercial general contractor directory (Wisconsin has no such license)",
      "Bond or insurance (not published on Phase 0 sources)",
      "Structured discipline archive (LicensE orders are a separate lookup)",
      "Apprentice / journeyman / inspector credentials",
      "Wisconsin DFI entity linking",
      "Reviews, rankings, or “safe to hire” determinations",
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
  if (slug === "az") return "ROC disciplinary actions";
  return "Caution & regulatory history";
}

export function disciplineSectionBlurb(slug: EvidenceStateSlug): string {
  if (slug === "nj") {
    return "Public discipline flags from DCA Standard Files bulk extracts when present. Flags do not include case detail — not a determination of guilt or a quality score. Confirm on the official DCA / MyLicense site.";
  }
  if (slug === "tx") {
    return "Regulatory history from TDLR-linked extracts when present. Factual records only.";
  }
  if (slug === "az") {
    return "Public disciplinary actions from the official ROC posting-list CSV when linked. Rows typically list Suspended or Revoked with a case number — not full case narrative. Confirm current standing on the official ROC contractor search.";
  }
  if (slug === "ky") {
    return "Kentucky DHBC discipline is not in this extract. Confirm standing on the official DHBC licensee search. No bond or insurance is published on the list view.";
  }
  if (slug === "wi") {
    return "Wisconsin DSPS discipline is not in this extract. Confirm orders on the official LicensE public orders search. An API disciplinary indicator, if present later, is a pointer — not a case file.";
  }
  return "Board discipline from Florida extracts linked to this contractor. Separate from insurance, permits, or reviews — factual records only.";
}

export function entitySectionTitle(slug: EvidenceStateSlug): string {
  if (slug === "nj") return "Business entity (high-confidence)";
  if (slug === "tx") return "Business entity";
  if (slug === "ky") return "Business entity";
  if (slug === "wi") return "Business entity";
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
  if (slug === "ky") {
    return (
      s?.coverageNote ||
      "Kentucky does not issue a statewide general contractor license. DHBC specialty trades only. Confirm on the official DHBC search."
    );
  }
  if (slug === "wi") {
    return (
      s?.coverageNote ||
      "Wisconsin does not issue a statewide commercial general contractor license. DSPS dwelling + trade credentials only. Confirm on the official LicensE lookup."
    );
  }
  if (slug === "or" || slug === "wa" || slug === "ca" || slug === "az" || slug === "la" || slug === "ms") {
    return (
      s?.coverageNote ||
      "Statewide contractor licensing from the official public extract. Confirm on the official board lookup."
    );
  }
  return "Educational research from Florida public records — not a marketplace or endorsement.";
}
