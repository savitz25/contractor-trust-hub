/** Stage 3 — Property & Permit Intelligence types. */

export type CoverageLevel =
  | "full"
  | "partial"
  | "jurisdiction_unsupported"
  | "source_unavailable";

export type PermitStatus =
  | "open"
  | "closed"
  | "expired"
  | "issued"
  | "finaled"
  | "unknown";

export type PermitMatchConfidence = "license" | "strict_name" | "none";

export type PropertyAddressInput = {
  street: string;
  unit?: string;
  city?: string;
  zip: string;
  state?: string;
};

export type PropertyPermitRecord = {
  id: string;
  permitNumber: string | null;
  description: string;
  category: string;
  status: PermitStatus;
  filedDate: string | null;
  issuedDate: string | null;
  finalDate: string | null;
  declaredValue: number | null;
  contractorName: string | null;
  contractorLicenseKey: string | null;
  /** High-confidence slug when matched; never invent */
  contractorSlug: string | null;
  matchConfidence: PermitMatchConfidence;
  sourceJurisdiction: string;
  sourceLabel: string;
  notes?: string;
};

export type PropertyResearchResult = {
  propertyId: string;
  normalizedAddress: string;
  street: string;
  unit?: string;
  city: string | null;
  zip: string;
  state: string;
  county: string | null;
  countySlug: string | null;
  coverage: CoverageLevel;
  coverageNote: string;
  checked: string[];
  notChecked: string[];
  permits: PropertyPermitRecord[];
  openCount: number;
  expiredUnresolvedCount: number;
  dataFreshness: string | null;
  resolveStatus: "resolved" | "limited" | "unresolved";
  resolveMessage: string;
};

export type PropertyContext = {
  propertyId: string;
  normalizedAddress: string;
  zip: string;
  city: string | null;
  county: string | null;
  countySlug: string | null;
  coverage: CoverageLevel;
  savedAt: string;
};

export type PermitPlannerInput = {
  projectType: string;
  zip?: string;
  city?: string;
  county?: string;
  factors: string[];
};

export type PermitCategoryAdvice = {
  id: string;
  label: string;
  likelihood: "commonly_required" | "often_required" | "sometimes" | "confirm_locally";
  detail: string;
};

export type PermitPlannerResult = {
  projectType: string;
  projectLabel: string;
  locationLabel: string;
  county: string | null;
  categories: PermitCategoryAdvice[];
  contractorQuestions: string[];
  homeownerCautions: string[];
  officialNextStep: {
    label: string;
    href: string | null;
    note: string;
  };
  disclaimer: string;
};
