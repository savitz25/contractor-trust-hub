/**
 * INTEL-002 — Four-level evidence & attribution standard.
 * There is no universal matching rule. Standards are per source family.
 * Shared qualifier ≠ guilt. Fail closed.
 */

import type { AttributionClass, PublicationState, SourceAttributionRule } from "./types";

export const ATTRIBUTION_CLASSES: Record<
  AttributionClass,
  { meaning: string; publicDefault: boolean }
> = {
  CONFIRMED: {
    meaning:
      "Source contains a deterministic identifier or relationship sufficient to establish attribution (exact license number with occupation, exact Florida entity document number, exact FEIN, or a direct source cross-reference).",
    publicDefault: true,
  },
  HIGH_CONFIDENCE: {
    meaning:
      "Multiple independent attributes establish a very strong relationship but no deterministic cross-reference exists. Requires unique match after ambiguity suppression.",
    publicDefault: false,
  },
  REVIEW_REQUIRED: {
    meaning:
      "A potential relationship exists but is not sufficiently certain for public attribution.",
    publicDefault: false,
  },
  UNRESOLVED: {
    meaning: "No reliable attribution can presently be made. Retain internally.",
    publicDefault: false,
  },
};

/** Product maps some stored identity_state values onto the four-level class. */
export function normalizeIdentityState(raw: string | null | undefined): AttributionClass | null {
  const s = (raw || "").trim().toUpperCase();
  if (!s) return null;
  if (s === "CONFIRMED" || s === "EXACT") return "CONFIRMED";
  if (s === "HIGH_CONFIDENCE" || s === "HIGH CONFIDENCE") return "HIGH_CONFIDENCE";
  if (s === "REVIEW_REQUIRED" || s === "REVIEW REQUIRED") return "REVIEW_REQUIRED";
  if (s === "UNRESOLVED" || s === "INTERNAL") return "UNRESOLVED";
  return "UNRESOLVED";
}

export const SOURCE_ATTRIBUTION_RULES: SourceAttributionRule[] = [
  {
    sourceFamily: "fl_dbpr_licensing",
    confirmed:
      "external_key composed from official alternate_license_number or occupation_code+license_number. Unique (source_system, external_key).",
    highConfidence: "Not used. License keys are deterministic.",
    reviewRequired: "Occupation present but no license number (should be staged as QB, not a license).",
    unresolved: "Row skipped when no key and not a QB.",
    publicEligible: ["CONFIRMED"],
    inheritAcrossSharedQualifier: false,
  },
  {
    sourceFamily: "fl_dbpr_discipline",
    confirmed:
      "Official license type + license number resolves to exactly one licenses.external_key (occupation prefix + number). Stored examples use identity_method official_type_plus_external_key.",
    highConfidence:
      "Not sufficient for public adverse attribution. Do not treat numeric core-only matches as CONFIRMED — 16,088 numeric cores collide across occupations.",
    reviewRequired:
      "Numeric core matches more than one occupation, or type text does not uniquely select an occupation, or name+address corroboration without unique license key.",
    unresolved: "License number not found on a current credential, or missing identifiers.",
    publicEligible: ["CONFIRMED"],
    inheritAcrossSharedQualifier: false,
  },
  {
    sourceFamily: "fl_dbpr_unlicensed_activity",
    confirmed:
      "Only if the ULA row contains a deterministic identifier that matches a licensed credential AND independent evidence shows it is the same actor. Default is that ULA is NOT attached to a licensed contractor.",
    highConfidence: "Not used for public attachment to a licensed profile.",
    reviewRequired: "Name/address similarity to a licensed contractor.",
    unresolved:
      "ULA extract has no license number. Current load: identity_method=NO_OFFICIAL_IDENTITY_IDENTIFIER.",
    publicEligible: ["CONFIRMED"],
    inheritAcrossSharedQualifier: false,
  },
  {
    sourceFamily: "fl_dbpr_recovery_fund",
    confirmed:
      "Same as licensed discipline: unique occupation+license number. Distinguish claim vs award vs payment vs final disposition from source fields; do not infer.",
    highConfidence: "Not public for adverse attribution.",
    reviewRequired: "License number present but occupation collision or incomplete type.",
    unresolved: "No matching credential.",
    publicEligible: ["CONFIRMED"],
    inheritAcrossSharedQualifier: false,
  },
  {
    sourceFamily: "fl_dfs_stop_work",
    confirmed:
      "Exact FEIN, official employer identifier, or exact contractor license number on the source row. Current DFS extract has none of these.",
    highConfidence: "Prohibited. Automatic name/location linkage is not allowed.",
    reviewRequired: "Manual review queue only; never automatic.",
    unresolved:
      "Default. identity_method=NO_OFFICIAL_IDENTITY_IDENTIFIER. publication_state=INTERNAL.",
    publicEligible: ["CONFIRMED"],
    inheritAcrossSharedQualifier: false,
  },
  {
    sourceFamily: "fl_sunbiz",
    confirmed:
      "Exact Florida document number present on both sides, or exact FEI on both sides with unique match. DBPR construction extract does not carry Sunbiz document numbers, so CONFIRMED is currently unavailable for auto-links.",
    highConfidence:
      "Unique exact_name_address (0.98) or unique exact_name_zip5 (0.95) after ambiguity suppression (two document numbers at the same score → no link).",
    reviewRequired:
      "exact_name_city (0.92) or officer_name_zip (0.90). Same name in the same city is not a legal-entity identification.",
    unresolved: "No unique name/address candidate.",
    publicEligible: ["CONFIRMED", "HIGH_CONFIDENCE"],
    inheritAcrossSharedQualifier: false,
  },
  {
    sourceFamily: "fl_qualifier_relationships",
    confirmed:
      "Source states that this license qualifies this business (not currently in the DBPR licensee extract as a structured edge).",
    highConfidence: "Not defined until a structured qualifier file exists.",
    reviewRequired: "Inferred from matching DBA name across credentials.",
    unresolved: "No qualifier graph row.",
    publicEligible: ["CONFIRMED"],
    inheritAcrossSharedQualifier: false,
  },
];

export const SUNBIZ_METHOD_CLASS: Record<
  string,
  { attribution: AttributionClass; confidence: number; publicLegalEntity: boolean }
> = {
  exact_name_address: {
    attribution: "HIGH_CONFIDENCE",
    confidence: 0.98,
    publicLegalEntity: true,
  },
  exact_name_zip5: {
    attribution: "HIGH_CONFIDENCE",
    confidence: 0.95,
    publicLegalEntity: true,
  },
  exact_name_city: {
    attribution: "REVIEW_REQUIRED",
    confidence: 0.92,
    publicLegalEntity: false,
  },
  officer_name_zip: {
    attribution: "REVIEW_REQUIRED",
    confidence: 0.9,
    publicLegalEntity: false,
  },
};

/** Public Sunbiz legal-entity display. City-only links stay internal. */
export const PUBLIC_SUNBIZ_MIN_CONFIDENCE = 0.95;

/** Adverse regulatory evidence: CONFIRMED + publication_state PUBLIC only. */
export const PUBLIC_ADVERSE_ATTRIBUTION: AttributionClass[] = ["CONFIRMED"];

/**
 * Fail closed for Florida regulatory rows: NULL publication_state is INTERNAL.
 * Other states keep legacy contractor_id linkage until they grow a publication gate.
 */
export const PUBLIC_FL_DISCIPLINE_PREDICATE = `(d.source_system NOT IN ('fl_dbpr', 'fl_dfs') OR COALESCE(d.publication_state, 'INTERNAL') = 'PUBLIC')`;

export function publicDisciplineExistsSql(contractorIdExpr: string): string {
  return `EXISTS (
    SELECT 1 FROM discipline_actions d
    WHERE d.contractor_id = ${contractorIdExpr}
      AND ${PUBLIC_FL_DISCIPLINE_PREDICATE}
  )`;
}

export function publicPublicationState(
  attribution: AttributionClass,
  sourceFamily: SourceAttributionRule["sourceFamily"]
): PublicationState {
  const rule = SOURCE_ATTRIBUTION_RULES.find((r) => r.sourceFamily === sourceFamily);
  if (!rule) return "INTERNAL";
  return rule.publicEligible.includes(attribution) ? "PUBLIC" : "INTERNAL";
}

export function mayPublishAdverse(opts: {
  attribution: AttributionClass | null;
  publicationState: string | null;
}): boolean {
  if (opts.publicationState !== "PUBLIC") return false;
  return opts.attribution === "CONFIRMED";
}

/**
 * A qualifier shared by Business A and Business B is investigative context.
 * Regulatory events of A must not be copied onto B.
 */
export const SHARED_QUALIFIER_IS_NOT_ATTRIBUTION = true;
