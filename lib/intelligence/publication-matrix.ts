/**
 * INTEL-002 Gate A (identity) × Gate B (disposition) publication matrix.
 * publication_state is not a synonym for identity confidence.
 */

import type { AttributionClass, PublicationState } from "./types";

export type DispositionClass =
  | "complaint"
  | "allegation"
  | "investigation"
  | "filing"
  | "notice"
  | "administrative_action"
  | "final_order"
  | "fine"
  | "costs"
  | "restitution"
  | "suspension"
  | "revocation"
  | "probation"
  | "other_final"
  | "unknown";

export type DispositionFinality = "final" | "non_final" | "unknown";

export type SourceFamilyKey =
  | "fl_dbpr_discipline"
  | "fl_dbpr_recovery_fund"
  | "fl_dbpr_unlicensed_activity"
  | "fl_dfs_stop_work";

export type PublicationDecision = {
  publicationState: PublicationState;
  publicEligible: boolean;
  reason: string;
};

const FINAL_DISPOSITIONS = new Set<DispositionClass>([
  "final_order",
  "fine",
  "costs",
  "restitution",
  "suspension",
  "revocation",
  "probation",
  "other_final",
]);

export function finalityOf(cls: DispositionClass): DispositionFinality {
  if (cls === "unknown") return "unknown";
  return FINAL_DISPOSITIONS.has(cls) ? "final" : "non_final";
}

/** Classify a DBPR discipline row from published fields. Does not infer missing finals. */
export function classifyDisposition(opts: {
  disposition?: string | null;
  disciplineDescription?: string | null;
  classification?: string | null;
}): { classes: DispositionClass[]; finality: DispositionFinality } {
  const blob = `${opts.disposition || ""} ${opts.disciplineDescription || ""}`.toLowerCase();
  const classes: DispositionClass[] = [];
  if (/final order/.test(blob)) classes.push("final_order");
  if (/\bfine\b/.test(blob)) classes.push("fine");
  if (/\bcosts?\b/.test(blob)) classes.push("costs");
  if (/restitution/.test(blob)) classes.push("restitution");
  if (/revok/.test(blob)) classes.push("revocation");
  if (/suspen/.test(blob)) classes.push("suspension");
  if (/probation/.test(blob)) classes.push("probation");
  if (/complaint/.test(blob) && classes.length === 0) classes.push("complaint");
  if (/investigat/.test(blob)) classes.push("investigation");
  if (/alleg/.test(blob)) classes.push("allegation");
  if (!classes.length) {
    const disp = (opts.disposition || "").trim();
    if (disp) classes.push("administrative_action");
    else classes.push("unknown");
  }
  const fin = classes.some((c) => FINAL_DISPOSITIONS.has(c))
    ? "final"
    : classes.every((c) => c === "unknown")
      ? "unknown"
      : "non_final";
  return { classes, finality: fin };
}

/**
 * Two-gate decision. Never publishes on identity alone.
 * Conservative default: even CONFIRMED+final stays INTERNAL until an explicit
 * publication job sets PUBLIC after validation.
 */
export function publicationDecision(opts: {
  identity: AttributionClass | null;
  finality: DispositionFinality;
  sourceFamily: SourceFamilyKey;
  numericCoreOnly?: boolean;
  allowPublicAfterValidation?: boolean;
}): PublicationDecision {
  if (opts.numericCoreOnly) {
    return {
      publicationState: "INTERNAL",
      publicEligible: false,
      reason: "NUMERIC_CORE_ONLY_NEVER_PUBLIC",
    };
  }
  if (!opts.identity || opts.identity === "UNRESOLVED") {
    return {
      publicationState: "INTERNAL",
      publicEligible: false,
      reason: "IDENTITY_UNRESOLVED",
    };
  }
  if (opts.identity === "REVIEW_REQUIRED" || opts.identity === "HIGH_CONFIDENCE") {
    return {
      publicationState: "INTERNAL",
      publicEligible: false,
      reason: "IDENTITY_NOT_CONFIRMED",
    };
  }
  if (opts.sourceFamily === "fl_dbpr_unlicensed_activity" || opts.sourceFamily === "fl_dfs_stop_work") {
    return {
      publicationState: "INTERNAL",
      publicEligible: false,
      reason: "SOURCE_FAMILY_DEFAULT_INTERNAL",
    };
  }
  if (opts.finality !== "final") {
    return {
      publicationState: "INTERNAL",
      publicEligible: false,
      reason: "NON_FINAL_OR_UNKNOWN_DISPOSITION",
    };
  }
  if (opts.allowPublicAfterValidation) {
    return {
      publicationState: "PUBLIC",
      publicEligible: true,
      reason: "CONFIRMED_IDENTITY_AND_FINAL_OUTCOME_VALIDATED",
    };
  }
  return {
    publicationState: "INTERNAL",
    publicEligible: true,
    reason: "CONFIRMED_IDENTITY_AND_FINAL_OUTCOME_PENDING_VALIDATION",
  };
}

export const PUBLICATION_MATRIX: Record<
  SourceFamilyKey,
  { identityForPublic: AttributionClass[]; finalRequired: boolean; defaultPublic: boolean }
> = {
  fl_dbpr_discipline: {
    identityForPublic: ["CONFIRMED"],
    finalRequired: true,
    defaultPublic: false,
  },
  fl_dbpr_recovery_fund: {
    identityForPublic: ["CONFIRMED"],
    finalRequired: true,
    defaultPublic: false,
  },
  fl_dbpr_unlicensed_activity: {
    identityForPublic: ["CONFIRMED"],
    finalRequired: true,
    defaultPublic: false,
  },
  fl_dfs_stop_work: {
    identityForPublic: ["CONFIRMED"],
    finalRequired: true,
    defaultPublic: false,
  },
};

/** Map official license-type phrase → occupation code. Empty if unknown/ambiguous. */
export const LICENSE_TYPE_TO_OCCUPATION: Record<string, string> = {
  "certified air conditioning contractor": "CAC",
  "certified building contractor": "CBC",
  "certified roofing contractor": "CCC",
  "certified plumbing contractor": "CFC",
  "certified general contractor": "CGC",
  "certified mechanical contractor": "CMC",
  "certified pool/spa contractor": "CPC",
  "certified pool spa contractor": "CPC",
  "certified residential contractor": "CRC",
  "certified sheet metal contractor": "CSC",
  "certified utility & excavation contractor": "CUC",
  "certified utility and excavation contractor": "CUC",
  "certified solar contractor": "CVC",
  "certified specialty contractor": "SCC",
  "certified pollutant storage contractor": "PCC",
  "registered air conditioning contractor": "RA",
  "registered building contractor": "RB",
  "registered roofing contractor": "RC",
  "registered plumbing contractor": "RF",
  "registered general contractor": "RG",
  "registered mechanical contractor": "RM",
  "registered pool/spa contractor": "RP",
  "registered residential contractor": "RR",
  "registered sheet metal contractor": "RS",
  "registered underground utility excavator": "RU",
  "registered solar contractor": "RV",
  "registered specialty contractor": "RX",
  "construction financially officer": "FRO",
  "financially responsible officer": "FRO",
  "financial responsible officer": "FRO",
};

export function occupationFromLicenseType(raw: string | null | undefined): string | null {
  const key = (raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  if (LICENSE_TYPE_TO_OCCUPATION[key]) return LICENSE_TYPE_TO_OCCUPATION[key];
  for (const [phrase, code] of Object.entries(LICENSE_TYPE_TO_OCCUPATION)) {
    if (key.includes(phrase)) return code;
  }
  return null;
}

/**
 * Identity gate: full occupation + license identifier.
 * Numeric core alone never CONFIRMED.
 */
export function identityFromLicenseFields(opts: {
  licenseType?: string | null;
  licenseNumberRaw?: string | null;
  matchingExternalKeys: string[];
}): AttributionClass {
  const occ = occupationFromLicenseType(opts.licenseType);
  const raw = (opts.licenseNumberRaw || "").replace(/\s+/g, "");
  if (!raw) return "UNRESOLVED";
  if (!occ) {
    return opts.matchingExternalKeys.length === 1 ? "REVIEW_REQUIRED" : "UNRESOLVED";
  }
  if (opts.matchingExternalKeys.length === 1) return "CONFIRMED";
  if (opts.matchingExternalKeys.length > 1) return "REVIEW_REQUIRED";
  return "UNRESOLVED";
}

export function numericCoreOnlyMatch(opts: {
  licenseType?: string | null;
  matchingExternalKeys: string[];
}): boolean {
  return !occupationFromLicenseType(opts.licenseType) && opts.matchingExternalKeys.length >= 1;
}
