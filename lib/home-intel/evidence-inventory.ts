import { loadContractorNetworkMetrics } from '@/lib/metrics/load-network-metrics';
import type { HomepageEvidenceItem } from '@/lib/metrics/accepted-homepage-evidence';
export type { HomepageEvidenceFamily, HomepageEvidenceItem } from '@/lib/metrics/accepted-homepage-evidence';
import { PUBLISHED_STATE_COUNT, PUBLISHED_STATES } from '@/lib/states/published-coverage';
const network = loadContractorNetworkMetrics();
if (!network.homepageEvidence) throw new Error('Generated homepage evidence missing');
// The published-state row follows the local published-state list, not the hand-maintained manifest map.
export const HOMEPAGE_EVIDENCE_INVENTORY: HomepageEvidenceItem[] = network.homepageEvidence.map((item) =>
  item.id === "state-pages"
    ? { ...item, count: PUBLISHED_STATE_COUNT, geography: PUBLISHED_STATES.map((s) => s.code).join(" · ") }
    : item,
);
export const HOMEPAGE_EVIDENCE_FAMILIES = ["License / registration", "Regulatory / enforcement", "Permit / construction / work history", "Financial responsibility", "Business evidence", "Public research surfaces"] as const;
export function homepageEvidenceByFamily() {
 return HOMEPAGE_EVIDENCE_FAMILIES.map(family => ({family,items:HOMEPAGE_EVIDENCE_INVENTORY.filter(item=>item.family===family)}));
}
