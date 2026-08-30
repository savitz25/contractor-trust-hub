import type { ContractorDetail } from "@/lib/contractors/types";

export type ClaimProfile = {
  id: string;
  slug: string;
  externalKey: string;
};

export function eligibleClaimProfile(contractor: ContractorDetail): ClaimProfile | null {
  if (!contractor.id || !contractor.slug || contractor.isThinProfile) return null;
  const license = contractor.licenses.find(
    (item) =>
      item.sourceSystem === "fl_dbpr" &&
      Boolean(item.externalKey.trim()) &&
      (contractor.homeState === "FL" || item.state === "FL")
  );
  if (!license) return null;
  return { id: contractor.id, slug: contractor.slug, externalKey: license.externalKey };
}
