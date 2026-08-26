/**
 * Official DBPR related-license relationship types.
 * Canonical values are assigned only after the regulator string is enumerated.
 * Do not invent types.
 */

export type QualifierRelationshipCanonical =
  | "primary_qualifying_agent"
  | "secondary_qualifying_agent"
  | "financially_responsible_officer"
  | "listed_business_name"
  | "other_regulator_defined"
  | "unmapped";

export const DBPR_RELATIONSHIP_TYPE_MAP: Record<
  string,
  { canonical: QualifierRelationshipCanonical; notes: string }
> = {
  "primary qualifying agent for business": {
    canonical: "primary_qualifying_agent",
    notes: "Observed on Construction Business Information related-license pages.",
  },
  "primary qualifying agent": {
    canonical: "primary_qualifying_agent",
    notes: "Short form; portal search name-type column uses 'Primary'.",
  },
  primary: {
    canonical: "primary_qualifying_agent",
    notes: "Portal search result name-type column.",
  },
  "second qualifying agent for business": {
    canonical: "secondary_qualifying_agent",
    notes: "Enumerated from DBPR related-license search license-type list / statute language.",
  },
  "secondary qualifying agent for business": {
    canonical: "secondary_qualifying_agent",
    notes: "Synonym if the portal emits this string.",
  },
  "secondary qualifying agent": {
    canonical: "secondary_qualifying_agent",
    notes: "Short form.",
  },
  secondary: {
    canonical: "secondary_qualifying_agent",
    notes: "Portal search name-type column, if present.",
  },
  "financially responsible officer": {
    canonical: "financially_responsible_officer",
    notes: "FRO is not a trade qualifier.",
  },
  "financial responsible officer": {
    canonical: "financially_responsible_officer",
    notes: "DBPR occupation label spelling.",
  },
  "financial officer - business": {
    canonical: "financially_responsible_officer",
    notes: "Observed on Construction Business Information related-license pages. Not a trade qualifier.",
  },
  "financial officer": {
    canonical: "financially_responsible_officer",
    notes: "Short form of Financial Officer - Business.",
  },
  dba: {
    canonical: "listed_business_name",
    notes: "Portal search name-type. Not a qualifying-agent role.",
  },
  individual: {
    canonical: "listed_business_name",
    notes: "CILB: INDIVIDUAL appears when there is no business entity name.",
  },
};

export function canonicalRelationshipType(raw: string | null | undefined): QualifierRelationshipCanonical {
  const key = (raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return "unmapped";
  return DBPR_RELATIONSHIP_TYPE_MAP[key]?.canonical ?? "other_regulator_defined";
}

/** listed_business_name is a name association, not a Primary/Secondary QA role. */
export const LISTED_NAME_IS_NOT_QUALIFYING_AGENT = true;

export const ADVERSE_HISTORY_DOES_NOT_INHERIT_ACROSS_QUALIFIER_EDGES = true;
