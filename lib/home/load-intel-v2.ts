import intel from "@/data/home/contractor-hub-intel-v2.json";
import {
  CONTRACTOR_HUB_INTEL_VERSION,
  formatIntelCount,
  type ContractorHubIntelV2,
} from "@/lib/home/intel-v2";

export function loadContractorHubIntel(): ContractorHubIntelV2 {
  const snap = intel as ContractorHubIntelV2;
  if (snap.schemaVersion !== CONTRACTOR_HUB_INTEL_VERSION) {
    throw new Error(`Unexpected homepage intel version: ${snap.schemaVersion}`);
  }
  return snap;
}

export { formatIntelCount };
