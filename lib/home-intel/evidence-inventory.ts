import { loadContractorNetworkMetrics } from '@/lib/metrics/load-network-metrics';
import type { HomepageEvidenceItem } from '@/lib/metrics/accepted-homepage-evidence';
export type { HomepageEvidenceFamily, HomepageEvidenceItem } from '@/lib/metrics/accepted-homepage-evidence';
const network = loadContractorNetworkMetrics();
if (!network.homepageEvidence) throw new Error('Generated homepage evidence missing');
export const HOMEPAGE_EVIDENCE_INVENTORY: HomepageEvidenceItem[] = network.homepageEvidence;
export const HOMEPAGE_EVIDENCE_FAMILIES = ["License / registration", "Regulatory / enforcement", "Permit / construction / work history", "Financial responsibility", "Business evidence", "Public research surfaces"] as const;
export function homepageEvidenceByFamily() {
 return HOMEPAGE_EVIDENCE_FAMILIES.map(family => ({family,items:HOMEPAGE_EVIDENCE_INVENTORY.filter(item=>item.family===family)}));
}
