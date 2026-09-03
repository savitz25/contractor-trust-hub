export type NjAttachInput = {
  matchStatus?: string | null;
  officialId?: string | null;
  isNameOnly?: boolean;
  family?: string | null;
};

export type NjAttachResult = { status: "EXACT" } | { status: "WITHHELD"; reason: string };

export function attachNjContractorEvidence(input: NjAttachInput): NjAttachResult {
  if (input.isNameOnly) return { status: "WITHHELD", reason: "name_only" };
  const family = String(input.family || "").toUpperCase();
  if (family.includes("PERMIT") || family.includes("CONSTRUCTION_SOURCE")) {
    return { status: "WITHHELD", reason: "market_only_no_contractor_field" };
  }
  const status = String(input.matchStatus || "").toUpperCase();
  if (status.includes("REVIEW") || status.includes("UNRESOLVED") || status === "NAME_ONLY") {
    return { status: "WITHHELD", reason: "unresolved_or_review" };
  }
  if (status === "EXACT" && input.officialId) return { status: "EXACT" };
  return { status: "WITHHELD", reason: "not_exact" };
}
