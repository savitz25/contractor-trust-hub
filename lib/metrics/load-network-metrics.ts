import manifest from "@/data/home/contractor-network-metrics-v1.json";
import {
  CONTRACTOR_NETWORK_METRICS_VERSION,
  type ContractorNetworkMetricsV1,
} from "./contractor-network-metrics-v1";

export function loadContractorNetworkMetrics(): ContractorNetworkMetricsV1 {
  const snap = manifest as ContractorNetworkMetricsV1;
  if (snap.schemaVersion !== CONTRACTOR_NETWORK_METRICS_VERSION) {
    throw new Error(`Unexpected network metrics version: ${snap.schemaVersion}`);
  }
  return snap;
}
