import type { AskContractorCategory } from "./trades";

export type DiscoveryServiceArea =
  | { kind: "city"; city: string; state: string }
  | { kind: "county"; county: string; state: string }
  | { kind: "state"; state: string };

export type NetworkDiscoveryEntity = {
  network_entity_id: string;
  hub: "contractor";
  source_entity_id: string;
  entity_type: "contractor";
  display_name: string;
  legal_name?: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
  categories?: AskContractorCategory[];
  service_areas?: DiscoveryServiceArea[];
  regulatory_status_summary?: string;
  trust_report_available: boolean;
  canonical_profile_url: string;
  canonical_search_url?: string;
  search_terms?: string[];
  discovery_status: "active";
  source_version?: string;
  updated_at?: string;
};

export type ContractorSourceRow = {
  id: string;
  slug: string;
  displayName: string;
  legalName: string | null;
  occupationCodes: string[];
  licenseStatuses: string[];
  licenseStates: string[];
  licenseCities: string[];
  licenseCounties: string[];
  sourceSystems: string[];
  homeState: string | null;
  /** License mailing/physical state when present (not flattened into service area). */
  physicalState: string | null;
  primaryCity: string | null;
  primaryCounty: string | null;
  postalCode: string | null;
  licenseCount: number;
};

export type PilotExportManifest = {
  schema_version: "ask-network-discovery-v1";
  hub: "contractor";
  generated_at: string;
  source_version: string;
  source_path: string;
  pilot_label: "PILOT / NOT YET CONSUMED BY ASK PRODUCTION";
  amendment: "ASK-SEARCH-CONTRACTOR-001" | "ASK-SEARCH-CONTRACTOR-001.1";
  cohort_algorithm?: string;
  entity_count: number;
  fingerprint: string;
  content_fingerprint: string;
  eligibility: {
    considered: number;
    eligible: number;
    ineligible: number;
    pilot_selected: number;
  };
  category_breakdown: Record<string, number>;
  geography: { states: Record<string, number>; with_county: number; with_city: number };
  query_readiness?: Record<string, unknown>;
  identity: {
    source_ids: number;
    network_ids: number;
    duplicate_network_ids: number;
    multi_license_companies: number;
    identity_collisions: number;
  };
  entities: NetworkDiscoveryEntity[];
};
