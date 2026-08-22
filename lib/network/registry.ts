/**
 * Ask Network V2 — checked-in canonical registry (copied locally).
 */

export const ASK_NETWORK_CONTRACT_VERSION = "2026.08.18-network-v2";

export type NetworkHubId =
  | "ask"
  | "move"
  | "lender"
  | "insurance"
  | "contractor"
  | "senior"
  | "investor";

export type SpecialistHubId = Exclude<NetworkHubId, "ask">;

export const NETWORK_HUB_IDS = [
  "ask",
  "move",
  "lender",
  "insurance",
  "contractor",
  "senior",
  "investor",
] as const satisfies readonly NetworkHubId[];

export const SPECIALIST_HUB_IDS = [
  "move",
  "lender",
  "insurance",
  "contractor",
  "senior",
  "investor",
] as const satisfies readonly SpecialistHubId[];

export const CANONICAL_ORIGINS = {
  ask: "https://www.asktrusthub.com",
  move: "https://www.movetrusthub.com",
  lender: "https://www.lendertrusthub.com",
  insurance: "https://www.insurancetrusthub.com",
  contractor: "https://www.contractortrusthub.com",
  senior: "https://www.seniortrusthub.com",
  investor: "https://www.investortrusthub.com",
} as const satisfies Record<NetworkHubId, string>;

export const NETWORK_PUBLIC_NAMES = {
  ask: "Ask Trust Hub",
  move: "Move Trust Hub",
  lender: "Lender Trust Hub",
  insurance: "Insurance Trust Hub",
  contractor: "Contractor Trust Hub",
  senior: "SeniorTrustHub",
  investor: "InvestorTrustHub",
} as const satisfies Record<NetworkHubId, string>;

export type NetworkRole = "parent" | "specialist";

export type NetworkRegistryEntry = {
  id: NetworkHubId;
  name: string;
  url: string;
  role: NetworkRole;
  switcherLabel: string;
};

export const NETWORK_REGISTRY: Record<NetworkHubId, NetworkRegistryEntry> = {
  ask: {
    id: "ask",
    name: NETWORK_PUBLIC_NAMES.ask,
    url: CANONICAL_ORIGINS.ask,
    role: "parent",
    switcherLabel: "Parent research & standards layer",
  },
  move: {
    id: "move",
    name: NETWORK_PUBLIC_NAMES.move,
    url: CANONICAL_ORIGINS.move,
    role: "specialist",
    switcherLabel: "FMCSA / SAFER mover research",
  },
  lender: {
    id: "lender",
    name: NETWORK_PUBLIC_NAMES.lender,
    url: CANONICAL_ORIGINS.lender,
    role: "specialist",
    switcherLabel: "NMLS / CFPB / FDIC financing research",
  },
  insurance: {
    id: "insurance",
    name: NETWORK_PUBLIC_NAMES.insurance,
    url: CANONICAL_ORIGINS.insurance,
    role: "specialist",
    switcherLabel: "State DOI / NAIC coverage research",
  },
  contractor: {
    id: "contractor",
    name: NETWORK_PUBLIC_NAMES.contractor,
    url: CANONICAL_ORIGINS.contractor,
    role: "specialist",
    switcherLabel: "State licensing-board contractor research",
  },
  senior: {
    id: "senior",
    name: NETWORK_PUBLIC_NAMES.senior,
    url: CANONICAL_ORIGINS.senior,
    role: "specialist",
    switcherLabel: "CMS / supported state senior-care research",
  },
  investor: {
    id: "investor",
    name: NETWORK_PUBLIC_NAMES.investor,
    url: CANONICAL_ORIGINS.investor,
    role: "specialist",
    switcherLabel: "SEC / IARD investment-firm research",
  },
};

export const CURRENT_NETWORK_HUB_ID: NetworkHubId = "contractor";

export function specialistEntries(): NetworkRegistryEntry[] {
  return SPECIALIST_HUB_IDS.map((id) => NETWORK_REGISTRY[id]);
}

export function switcherEntries(): NetworkRegistryEntry[] {
  return NETWORK_HUB_IDS.map((id) => NETWORK_REGISTRY[id]);
}

export function isNetworkHubId(value: string): value is NetworkHubId {
  return (NETWORK_HUB_IDS as readonly string[]).includes(value);
}

export function isSpecialistHubId(value: string): value is SpecialistHubId {
  return (SPECIALIST_HUB_IDS as readonly string[]).includes(value);
}
