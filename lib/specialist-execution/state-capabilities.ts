import { getStateBySlug, licenseSourcesFor, type EvidenceState } from "@/lib/states/config";

export type ContractorResearchFamily =
  | "home_improvement"
  | "general"
  | "building"
  | "roofing"
  | "hvac"
  | "mechanical"
  | "plumbing"
  | "electrical"
  | "residential"
  | "pool_spa"
  | "solar"
  | "underground"
  | "specialty"
  | "alarm"
  | "telecom"
  | "locksmith"
  | "hearth";

export type TradeCapability = {
  id: ContractorResearchFamily;
  label: string;
  occupationCodes: string[];
  publicationLevel: "PUBLIC_PROFILE" | "VERIFY_ONLY" | "INTERNAL_ONLY";
  limitation: string;
};

export type StateExecutionCapability = {
  state: EvidenceState;
  executable: boolean;
  sourceSystems: string[];
  geography: Array<"state" | "county" | "city">;
  trades: TradeCapability[];
  generalClassAvailable: boolean;
  verifyDestination: string;
};

const FL_TRADES: TradeCapability[] = [
  ["general", "General contractor", ["CGC", "RG"]],
  ["building", "Building contractor", ["CBC", "RB"]],
  ["roofing", "Roofing", ["CCC", "RC"]],
  ["hvac", "HVAC / air conditioning", ["CAC", "RA"]],
  ["mechanical", "Mechanical", ["CMC", "RM"]],
  ["plumbing", "Plumbing", ["CFC", "RF"]],
  ["residential", "Residential contractor", ["CRC", "RR"]],
  ["pool_spa", "Pool / spa", ["CPC", "RP"]],
  ["solar", "Solar", ["CVC", "RV"]],
  ["underground", "Underground utility", ["CUC", "RU"]],
  ["specialty", "Specialty structures", ["SCC", "RX"]],
].map(([id, label, occupationCodes]) => ({
  id: id as ContractorResearchFamily,
  label: label as string,
  occupationCodes: occupationCodes as string[],
  publicationLevel: "PUBLIC_PROFILE" as const,
  limitation: "Florida DBPR/CILB source-native construction credential class.",
}));

const NJ_TRADES: TradeCapability[] = [
  ["home_improvement", "Home Improvement Contractor", ["HIC"], "HIC registration is not a statewide General contractor license."],
  ["electrical", "Electrical contractor", ["ELE"], "NJ DCA electrical credential class; not a general contractor credential."],
  ["plumbing", "Master plumber", ["PLB"], "NJ DCA master-plumber credential class."],
  ["hvac", "Master HVACR contractor", ["HVAC"], "NJ DCA Master HVACR credential class."],
  ["mechanical", "HVAC / mechanical", ["HVAC"], "The accepted source supports Master HVACR; it is not a universal mechanical-contractor class."],
  ["alarm", "Alarm contractor", ["ALM"], "NJ DCA alarm credential class."],
  ["telecom", "Telecom contractor", ["TEL"], "NJ DCA telecom credential class."],
  ["locksmith", "Locksmith", ["LCK"], "NJ DCA locksmith credential class."],
  ["hearth", "Master hearth specialist", ["HRT"], "NJ DCA Master Hearth Specialist credential class."],
].map(([id, label, occupationCodes, limitation]) => ({
  id: id as ContractorResearchFamily,
  label: label as string,
  occupationCodes: occupationCodes as string[],
  publicationLevel: "PUBLIC_PROFILE" as const,
  limitation: limitation as string,
}));

function configuredState(slug: string): EvidenceState {
  const state = getStateBySlug(slug);
  if (!state) throw new Error(`missing_state_config:${slug}`);
  return state;
}

export const CONTRACTOR_STATE_CAPABILITIES: Record<"FL" | "NJ", StateExecutionCapability> = {
  FL: {
    state: configuredState("fl"),
    executable: true,
    sourceSystems: licenseSourcesFor(configuredState("fl")),
    geography: ["state", "county", "city"],
    trades: FL_TRADES,
    generalClassAvailable: true,
    verifyDestination: "/verify",
  },
  NJ: {
    state: configuredState("nj"),
    executable: true,
    sourceSystems: licenseSourcesFor(configuredState("nj")),
    geography: ["state", "county", "city"],
    trades: NJ_TRADES,
    generalClassAvailable: false,
    verifyDestination: "/verify?state=nj",
  },
};

export function getExecutionCapability(stateCode: string): StateExecutionCapability | null {
  return CONTRACTOR_STATE_CAPABILITIES[stateCode.toUpperCase() as "FL" | "NJ"] ?? null;
}

export function getTradeCapability(
  stateCode: "FL" | "NJ",
  rawTrade: string | null
): TradeCapability | null {
  if (!rawTrade) return null;
  const normalized = rawTrade.toLowerCase().replace(/[\s/-]+/g, "_");
  const alias =
    normalized === "hic" || normalized === "home_improvement_contractor" || normalized === "home_improvement_contractors"
      ? "home_improvement"
      : normalized === "electrician" || normalized === "electricians"
        ? "electrical"
        : normalized === "plumber" || normalized === "plumbers"
          ? "plumbing"
          : normalized === "hvacr" || normalized === "hvac_contractors"
            ? "hvac"
            : normalized;
  return CONTRACTOR_STATE_CAPABILITIES[stateCode].trades.find((trade) => trade.id === alias) ?? null;
}

export function publicCapabilityMatrix() {
  return Object.values(CONTRACTOR_STATE_CAPABILITIES).map((capability) => ({
    state: capability.state.code,
    stateName: capability.state.name,
    sourceSystems: capability.sourceSystems,
    board: capability.state.boardLabel,
    productDepth: capability.state.depth,
    supportedTradeFamilies: capability.trades.map((trade) => ({
      id: trade.id,
      label: trade.label,
      sourceNativeClasses: trade.occupationCodes,
      publicationLevel: trade.publicationLevel,
    })),
    statusSupport: ["active_current", "expired", "all"],
    geographySupport: capability.geography,
    generalClassAvailable: capability.generalClassAvailable,
    verifyDestination: capability.verifyDestination,
    limitation: capability.state.coverageNote,
  }));
}
