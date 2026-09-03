import { loadContractorNetworkMetrics } from "@/lib/metrics/load-network-metrics";
import { projectIntelV2FromNetworkMetrics } from "@/lib/metrics/project-intel-v2";
import { formatIntelCount, type ContractorHubIntelV2 } from "@/lib/home/intel-v2";

export function loadContractorHubIntel(): ContractorHubIntelV2 {
  return projectIntelV2FromNetworkMetrics(loadContractorNetworkMetrics());
}

export { formatIntelCount };
