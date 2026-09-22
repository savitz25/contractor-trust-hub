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

export const CONTRACTOR_STATE_CAPABILITIES: Record<"FL" | "NJ" | "TX", StateExecutionCapability> = {
  FL: {
    state: configuredState("fl"),
    executable: true,
    sourceSystems: licenseSourcesFor(configuredState("fl")),
    geography: ["state", "county", "city"],
    trades: FL_TRADES,
    generalClassAvailable: true,
    verifyDestination: "/verify",
  },
  TX: {
    state: {...configuredState("tx"),boardLabel:"Texas Department of Licensing and Regulation",boardShortLabel:"TDLR",boardUrl:"https://www.tdlr.texas.gov/LicenseSearch/"}, executable:true, sourceSystems:["tx_tdlr"], geography:["state"],
    trades:[{id:"hvac",label:"A/C Contractor (Texas TDLR)",occupationCodes:["TAC"],publicationLevel:"PUBLIC_PROFILE",limitation:"Existing Texas TDLR A/C Contractor mapping. Indexed status is derived from expiration, not a live authority check. Recorded city fields are not populated in this cohort."}],
    generalClassAvailable:false,verifyDestination:"/verify?state=tx",
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
  return CONTRACTOR_STATE_CAPABILITIES[stateCode.toUpperCase() as "FL" | "NJ" | "TX"] ?? null;
}

/**
 * POST-R1-CON-LOCAL-001: pure trade-word -> canonical-family-id alias resolution, split out of
 * getTradeCapability() so callers that need the resolved alias itself (not just whether a
 * TradeCapability row exists for it) can use the SAME resolution -- e.g. the Florida electrical
 * special-case in contractor-v2.ts used to compare against the raw, un-aliased input string, so
 * "electrician"/"electricians" (aliased here to "electrical") never matched it and fell through to
 * a generic UNSUPPORTED_TRADE_CAPABILITY instead of the existing, more useful
 * unsupported_florida_electrical_source response with broadened alternatives.
 * Added "roofer"/"roofers" -> "roofing" and "general contractor"(s) -> "general": both are
 * consumer-intent trade words with an existing, source-backed FL trade family that previously had
 * no alias, so a direct "roofer"/"general contractor" request fell through to
 * UNSUPPORTED_TRADE_CAPABILITY even though FL_TRADES already supports "roofing" and "general".
 * Bare "contractor"/"contractors" is intentionally NOT aliased to any single family -- that
 * ambiguity is the existing, correct CLARIFICATION_REQUIRED narrowing behavior (see
 * semanticCapabilityResult's trade_or_identifier_required branch), not a bug.
 */
export function resolveTradeAlias(rawTrade: string | null): string | null {
  if (!rawTrade) return null;
  const normalized = rawTrade.toLowerCase().replace(/[\s/-]+/g, "_");
  if (normalized === "hic" || normalized === "home_improvement_contractor" || normalized === "home_improvement_contractors") return "home_improvement";
  if (normalized === "electrician" || normalized === "electricians") return "electrical";
  if (normalized === "plumber" || normalized === "plumbers") return "plumbing";
  if (normalized === "hvacr" || normalized === "hvac_contractors") return "hvac";
  if (normalized === "roofer" || normalized === "roofers") return "roofing";
  if (normalized === "general_contractor" || normalized === "general_contractors" || normalized === "general_contracting") return "general";
  return normalized;
}

export function getTradeCapability(
  stateCode: "FL" | "NJ" | "TX",
  rawTrade: string | null
): TradeCapability | null {
  const alias = resolveTradeAlias(rawTrade);
  if (!alias) return null;
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
