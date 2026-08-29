import { loadContractorHubIntel } from "@/lib/home/load-intel-v2";
import { intelligenceFingerprint } from "@/lib/intelligence/fingerprint";
import {
  floridaRoofingCredentialDefinition,
  INTELLIGENCE_TRADE_BUCKETS,
  OCCUPATION_NON_EQUIVALENCE,
} from "@/lib/intelligence/occupations";
import {
  EVIDENCE_STATES,
  getLiveStates,
  type EvidenceState,
  verifyPathFor,
} from "@/lib/states/config";
import {
  CONTRACTOR_HOME_INTEL_VERSION,
  type ContractorHomeIntel,
  type CoverageRow,
  type FeaturedStory,
  type GeoState,
  type RegulatoryClass,
  type ResearchDepth,
  type TraceMetric,
} from "./types";

const RETRIEVED = "2026-08-28";
const CONFIG_AS_OF = "product config on INTEL-003 production SHA 929e18c";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function researchDepth(state: EvidenceState): ResearchDepth {
  if (state.depth === "full_journey") return "enhanced_intelligence";
  if (state.depth === "specialty_verify") return "specialty_verify";
  if (state.pilot || state.slug === "ca") return "partial_pilot";
  return "statewide_verify";
}

function regulatoryClass(state: EvidenceState): RegulatoryClass {
  if (state.depth === "specialty_verify") return "specialty_only";
  if (state.slug === "ca") return "partial_extract";
  if (state.slug === "wa") return "statewide_registration";
  return "statewide_license";
}

function statewideGc(state: EvidenceState): boolean {
  return state.depth !== "specialty_verify";
}

function canVerify(state: EvidenceState): string {
  if (state.slug === "fl") return "Name/license Verify plus Florida Intelligence OS (state + selected county).";
  if (state.depth === "specialty_verify") return `Name/license Verify for ${state.scopeHint}.`;
  if (state.slug === "ca") return "Name/license Verify against CSLB high-impact county extracts.";
  return `Name/license Verify against the ${state.boardShortLabel} extract.`;
}

function cannotInfer(state: EvidenceState): string {
  const bits = ["License address is not service area", "Active credential is not endorsement"];
  if (!statewideGc(state)) bits.push("No statewide general-contractor license in this source");
  if (state.slug !== "fl") bits.push("No Intelligence OS state/county page on this hub yet");
  return bits.join(". ") + ".";
}

function geoFrom(state: EvidenceState): GeoState {
  const depth = researchDepth(state);
  return {
    code: state.code,
    name: state.name,
    boardShort: state.boardShortLabel,
    boardLabel: state.boardLabel,
    boardUrl: state.boardUrl,
    depth,
    regulatoryClass: regulatoryClass(state),
    statewideGc: statewideGc(state),
    scopeHint: state.scopeHint,
    coverageNote: state.coverageNote,
    canVerify: canVerify(state),
    cannotInfer: cannotInfer(state),
    href: state.slug === "fl" ? "/florida" : verifyPathFor(state),
    hrefLabel: state.slug === "fl" ? "Explore Florida Intelligence" : `${state.name} Verify`,
  };
}

function depthLabel(d: ResearchDepth): string {
  switch (d) {
    case "enhanced_intelligence":
      return "Enhanced Intelligence";
    case "statewide_verify":
      return "Statewide Verify";
    case "specialty_verify":
      return "Specialty Verify";
    case "partial_pilot":
      return "Partial / Pilot";
    default:
      return "Not yet researched";
  }
}

export function buildContractorHomeIntel(generatedAt = "2026-08-28T00:00:00.000Z"): ContractorHomeIntel {
  const live = getLiveStates();
  const wisconsin = EVIDENCE_STATES.wi;
  const geo = live.map(geoFrom);
  const specialty = geo.filter((s) => s.regulatoryClass === "specialty_only");
  const statewideBoard = geo.filter((s) => s.regulatoryClass !== "specialty_only");
  const enhanced = geo.filter((s) => s.depth === "enhanced_intelligence");
  const noStatewideGc = geo.filter((s) => !s.statewideGc);
  const roofingCodes = INTELLIGENCE_TRADE_BUCKETS.roofing;
  const residentialCodes = INTELLIGENCE_TRADE_BUCKETS.residential;

  const stateOfRecord: TraceMetric[] = [
    {
      id: "live-states",
      label: "Live researched states",
      display: fmt(live.length),
      value: live.length,
      grain: "product-configured live EvidenceState rows",
      definition: "Count of states currently live in ContractorTrustHub Verify/config. Not a census of U.S. contractor licenses.",
      method: "getLiveStates() from lib/states/config.ts",
      payloadKey: "coverage.liveStates",
      officialAsOf: CONFIG_AS_OF,
      retrievedAt: RETRIEVED,
      includedStates: live.map((s) => s.code),
      limitations: [`${wisconsin.name} is configured but not live.`, "Live ≠ every U.S. state.", "States are not interchangeable licensing systems."],
      components: live.map((s) => ({
        label: `${s.name} (${s.badge})`,
        value: s.scopeHint,
        payloadKey: `coverage.states.${s.code}`,
      })),
      sourceIds: ["state-config"],
    },
    {
      id: "enhanced-intel",
      label: "States with enhanced Intelligence OS research",
      display: fmt(enhanced.length),
      value: enhanced.length,
      grain: "states with full_journey Intelligence OS pages",
      definition: "Florida currently has state and selected-county Intelligence OS pages. Other live states are Verify-first.",
      method: "States where depth = full_journey",
      payloadKey: "coverage.enhancedIntelligence",
      officialAsOf: CONFIG_AS_OF,
      retrievedAt: RETRIEVED,
      includedStates: enhanced.map((s) => s.code),
      limitations: ["Enhanced research depth is TrustHub coverage, not contractor quality."],
      components: enhanced.map((s) => ({
        label: s.name,
        value: "/florida",
        payloadKey: "coverage.enhancedIntelligence.FL",
      })),
      sourceIds: ["state-config", "florida-intel-003"],
    },
    {
      id: "specialty-only",
      label: "Live states with specialty-only statewide regulation (no statewide GC class)",
      display: fmt(noStatewideGc.length),
      value: noStatewideGc.length,
      grain: "live EvidenceState rows with specialty_verify depth",
      definition: "States in this product whose official statewide source does not license general contractors as a class.",
      method: "depth === specialty_verify",
      payloadKey: "coverage.specialtyOnly",
      officialAsOf: CONFIG_AS_OF,
      retrievedAt: RETRIEVED,
      includedStates: noStatewideGc.map((s) => s.code),
      limitations: [
        "Specialty-only is a regulatory-structure fact, not weaker/stronger consumer protection.",
        "Local or municipal GC rules may exist outside these statewide sources.",
      ],
      components: noStatewideGc.map((s) => ({
        label: s.name,
        value: s.scopeHint,
        payloadKey: `coverage.specialtyOnly.${s.code}`,
      })),
      sourceIds: ["state-config"],
    },
    {
      id: "statewide-boards",
      label: "Live states with a statewide contractor board or registration system in this product",
      display: fmt(statewideBoard.length),
      value: statewideBoard.length,
      grain: "live EvidenceState rows that are not specialty_only",
      definition: "Count of live states whose configured source is a statewide license or registration system. Not a count of contractors.",
      method: "live states excluding specialty_verify",
      payloadKey: "coverage.statewideBoards",
      officialAsOf: CONFIG_AS_OF,
      retrievedAt: RETRIEVED,
      includedStates: statewideBoard.map((s) => s.code),
      limitations: [
        "California coverage in this hub is high-impact county extracts, not every CSLB file.",
        "Washington is L&I contractor registration, not a Florida-style CILB license.",
        "Do not sum these states into a national contractor total.",
      ],
      components: statewideBoard.map((s) => ({
        label: s.name,
        value: s.boardShort,
        payloadKey: `coverage.statewideBoards.${s.code}`,
      })),
      sourceIds: ["state-config"],
    },
  ];

  const scale = loadContractorHubIntel();
  const families = scale.regulatoryEvidence.byEvidenceFamily;
  const actionTotal = scale.regulatoryEvidence.totalActionRows;
  const floridaEnforcement = families
    .filter((f) => f.sourceSystem === "fl_dbpr" || f.sourceSystem === "fl_dfs")
    .reduce((s, f) => s + f.rows, 0);
  const tradeActive = scale.tradeFamilies.families.reduce((s, f) => s + f.activeCurrentRows, 0);
  const liveActive = scale.publicCoverage.activeCurrentCredentialRecords;

  const findings: FeaturedStory[] = [
    {
      storyId: "enforcement-source-concentration",
      storyType: "MARKET_FINDING",
      title: "Indexed enforcement records are concentrated in Florida sources",
      summary: `${fmt(floridaEnforcement)} of ${fmt(actionTotal)} indexed regulatory and enforcement records currently come from Florida DBPR and DFS families. That reflects deeper structured Florida datasets in this hub — not that Florida contractors are worse.`,
      chart: {
        caption:
          "Indexed regulatory evidence by source family. Families are different legal processes and are not equivalent severity.",
        series: families.map((f) => ({
          label: f.label,
          value: f.rows,
          note: f.sourceSystem,
          states: f.sourceSystem.startsWith("fl") ? ["FL"] : f.sourceSystem.startsWith("nj") ? ["NJ"] : ["AZ"],
        })),
        unit: "count",
        max: actionTotal,
      },
      whyItMatters:
        "Consumers comparing states should know this corpus is Florida-heavy because Florida publishes more structured enforcement files here, not because we scored states.",
      doesNotMean: [
        "Florida contractors are worse, riskier, or less trustworthy.",
        "These families can be added into one risk or guilt score.",
      ],
      sourceIds: ["contractor-hub-intel-v2", "discipline_actions"],
      officialAsOf: scale.generatedAt.slice(0, 10),
      retrievedAt: scale.generatedAt.slice(0, 10),
      payloadKeys: ["regulatoryEvidence.byEvidenceFamily", "regulatoryEvidence.totalActionRows"],
    },
    {
      storyId: "mapped-trade-share",
      storyType: "MARKET_FINDING",
      title: "Mapped trade families account for most live active/current credentials we can classify",
      summary: `${fmt(tradeActive)} of ${fmt(liveActive)} active/current credentials in the live public cohort sit in documented occupation-code families (general/building, residential, roofing, electrical, plumbing, HVAC/mechanical, pool/spa). The remainder are other published classes, not “unknown contractors.”`,
      chart: {
        caption:
          "Active/current credential rows by mapped occupation-code family in the live public cohort. Not a national trade census.",
        series: scale.tradeFamilies.families
          .filter((f) => f.activeCurrentRows > 0)
          .map((f) => ({
            label: f.label,
            value: f.activeCurrentRows,
            note: f.contributingSources.join(", "),
            states: f.contributingSources,
          })),
        unit: "count",
        max: liveActive,
      },
      whyItMatters:
        "If you are hiring a roofer, plumber, or HVAC contractor, the research graph already has explicit class maps — they are not the same license in every state.",
      doesNotMean: [
        "These families are a complete U.S. trade census.",
        "Occupation codes mean the same legal scope in every state.",
      ],
      sourceIds: ["contractor-hub-intel-v2", "trade-families"],
      officialAsOf: scale.generatedAt.slice(0, 10),
      retrievedAt: scale.generatedAt.slice(0, 10),
      payloadKeys: ["tradeFamilies.families", "publicCoverage.activeCurrentCredentialRecords"],
    },
    {
      storyId: "not-one-system",
      storyType: "GAP",
      title: "Contractor licensing records are state-specific",
      summary: `The evidence available for a contractor depends on where they operate. Among ${fmt(live.length)} live researched states, ${fmt(statewideBoard.length)} have a statewide contractor board or registration system in this product, and ${fmt(specialty.length)} (${specialty.map((s) => s.code).join(", ")}) have no statewide general-contractor class.`,
      chart: {
        caption: "Live researched states by statewide regulatory structure in this product. Not a contractor census.",
        series: [
          {
            label: "Statewide license or registration system",
            value: statewideBoard.length,
            note: statewideBoard.map((s) => s.code).join(", "),
            states: statewideBoard.map((s) => s.code),
          },
          {
            label: "Specialty-only (no statewide GC class)",
            value: specialty.length,
            note: specialty.map((s) => s.code).join(", "),
            states: specialty.map((s) => s.code),
          },
        ],
        unit: "count",
        max: live.length,
      },
      whyItMatters:
        "A Texas specialty lookup is not a Florida CILB license. Search results only cover the official source configured for that state.",
      doesNotMean: [
        "One structure is safer or more trusted.",
        "A national licensed-contractor total.",
      ],
      sourceIds: ["state-config"],
      officialAsOf: CONFIG_AS_OF,
      retrievedAt: RETRIEVED,
      payloadKeys: ["coverage.statewideBoards", "coverage.specialtyOnly", "coverage.liveStates"],
    },
  ];

  const evidenceDepth: CoverageRow[] = [
    {
      family: "Credential identity",
      display: `${fmt(live.length)} live state extracts`,
      status: "partial",
      method: "State-configured official license/registration extracts.",
      limitations: ["Grain is the credential/registration row, not a company census."],
    },
    {
      family: "Status",
      display: "Published board status where the extract includes it",
      status: "partial",
      method: "Status fields as published by each board extract.",
      limitations: ["Status vocabularies are not interchangeable across states."],
    },
    {
      family: "Trade / classification",
      display: "State-specific occupation/class codes",
      status: "partial",
      method: "Board class codes; Florida buckets documented in INTELLIGENCE_TRADE_BUCKETS.",
      limitations: ["Roofing, GC, HVAC, plumbing do not mean the same license in every state."],
    },
    {
      family: "Discipline / regulatory history",
      display: "Florida families researched; other states vary",
      status: "limited",
      method: "Florida licensed discipline, ULA, Recovery Fund, DFS stop-work as observations.",
      limitations: ["Absence of a row is not a clean history. Observations are not violation totals."],
    },
    {
      family: "Corporate / entity relationship",
      display: "Florida Sunbiz high-confidence links only",
      status: "limited",
      method: "Florida entity links where confidence is high. Other SOS registries are not invented.",
      limitations: ["Unknown ownership is not independent ownership."],
    },
    {
      family: "Qualifier relationship",
      display: "Florida qualifier graph where published",
      status: "limited",
      method: "Florida qualifying-business relationships in the Intelligence OS.",
      limitations: ["Not a national qualifier directory."],
    },
    {
      family: "State-level intelligence",
      display: "Florida /florida Intelligence OS",
      status: "enhanced_in_selected_geographies",
      method: "INTEL-003 Florida state payload.",
      limitations: ["Other live states do not have Intelligence OS state pages."],
    },
    {
      family: "County-level intelligence",
      display: "Broward and Palm Beach County Intelligence; other Florida counties vary",
      status: "enhanced_in_selected_geographies",
      method: "INTEL-003 county payloads. HQ/base mailing county is not service area.",
      limitations: [
        "HQ/base county is not service area. Pending local data is not zero.",
        "Permit coverage is not treated as equivalent across counties.",
      ],
    },
    {
      family: "Permit / local evidence",
      display: "Not a national permit census",
      status: "limited",
      method: "Selected Florida local research only.",
      limitations: ["Missing local export ≠ zero local activity."],
    },
    {
      family: "Public contacts",
      display: "As published on board extracts",
      status: "partial",
      method: "Public contact fields when present in the source.",
      limitations: ["Contacts are not a service-territory map."],
    },
  ];

  const draft: Omit<ContractorHomeIntel, "payloadFingerprint"> = {
    contractVersion: CONTRACTOR_HOME_INTEL_VERSION,
    generatedAt,
    score: null,
    ranking: null,
    changeCapability: {
      status: "UNSUPPORTED",
      reason: "No immutable cross-state historical snapshots are approved for a What Changed module.",
    },
    stateOfRecord,
    findings,
    evidenceDepth,
    gaps: [
      "There is no uniform national contractor-license system. Do not add unlike state datasets into one contractor total.",
      "Some states do not license general contractors statewide. Local rules may still apply.",
      "A state credential is not automatically a contractor company.",
      "An active credential is not an endorsement.",
      "License address / HQ / base county is not service area.",
      "No result in a state database is not automatically illegal activity — coverage and class rules differ.",
      "State regulatory systems are not interchangeable.",
      "Local permit data is incomplete nationally. Missing export is not zero activity.",
      "Discipline coverage differs by state. Absence of discipline is not a clean history.",
      "Entity links exist only where confidently connected. Unknown ownership is not independence.",
      "Insurance/bond fields are only as complete as the publishing source.",
      `${wisconsin.name} is configured (${wisconsin.scopeHint}) but not live in Verify.`,
    ],
    geography: geo,
    tradeAxis: [
      {
        label: "General / building",
        note: "Statewide GC class exists in some researched states (e.g. Florida CILB, Oregon CCB) and not in others (Texas, New Jersey, Kentucky).",
        href: "/verify",
      },
      {
        label: "Roofing",
        note: `Florida roofing credentials use ${roofingCodes.join(" + ")} (${floridaRoofingCredentialDefinition()}). ${OCCUPATION_NON_EQUIVALENCE.RR_is_not_roofing.code} is ${OCCUPATION_NON_EQUIVALENCE.RR_is_not_roofing.officialName}, not roofing. Other states use different boards/codes.`,
        href: "/verify?state=fl",
      },
      {
        label: "HVAC / plumbing / electrical",
        note: "Often specialty-board sources. Texas TDLR/TSBPE and Kentucky DHBC are specialty-only in this product.",
        href: "/verify?state=tx",
      },
      {
        label: "Residential vs commercial class",
        note: `Florida residential class uses ${residentialCodes.join(" + ")}. That is not a national residential-contractor definition.`,
        href: "/florida",
      },
    ],
    ask: [
      {
        id: "why-differ",
        question: "Why does contractor licensing differ by state?",
        answer: `The United States has no single contractor-license system. This hub currently researches ${fmt(live.length)} live states. ${fmt(statewideBoard.length)} have a statewide board or registration system in this product (${statewideBoard.map((s) => s.code).join(", ")}); ${fmt(specialty.length)} are specialty-only with no statewide GC class (${specialty.map((s) => s.code).join(", ")}).`,
        href: "#findings",
        hrefLabel: "Licensing-structure story",
      },
      {
        id: "statewide-gc",
        question: "Does every state license general contractors?",
        answer: `No. In this product ${fmt(noStatewideGc.length)} live states have no statewide GC class: ${noStatewideGc.map((s) => `${s.name} (${s.scopeHint})`).join("; ")}. That is a source-structure fact, not a quality ranking, and it does not mean every builder there is unlicensed.`,
        href: "#states",
        hrefLabel: "State explorer",
      },
      {
        id: "active-means",
        question: "What does an active contractor credential mean?",
        answer:
          "Active (or the board's equivalent published status) means the credential row is currently in that status in the extract. It does not prove workmanship, insurance beyond published fields, current jobs, service area, or that the firm is right for your project.",
        href: "#findings",
        hrefLabel: "Credential-limits story",
      },
      {
        id: "address-service",
        question: "Does a license address mean the contractor serves my county?",
        answer:
          "No. Address, headquarters, and base county are location-of-record facts. They are not operating territory unless a source explicitly proves a geographic operating relationship.",
        href: "#gaps",
        hrefLabel: "What we don't know",
      },
      {
        id: "not-found",
        question: "What if I cannot find someone in a state database?",
        answer: `No result is not automatically illegal activity. The person may be outside the board's class (for example a GC in a specialty-only state), in a county extract we do not hold, under another name, or simply not in this hub's extract. Confirm on the official board listed for that state.`,
        href: "#states",
        hrefLabel: "State coverage",
      },
      {
        id: "credential-vs-company",
        question: "What is the difference between a credential and a contractor company?",
        answer:
          "A credential is a source row (license/registration). A company is a resolved business identity. One company may hold several credentials; some credentials are people or qualifiers. Florida entity links exist only at high confidence. Do not treat credential counts as company counts.",
        href: "#record",
        hrefLabel: "State of the record",
      },
      {
        id: "before-contract",
        question: "How should I verify someone before signing a contract?",
        answer:
          "Start with the official credential and status, then review class/trade, any public regulatory observations, entity/qualifier links where connected, and the actual quote/contract. Florida has deeper Intelligence OS pages. Tools such as Scope Builder and Quote Analyzer come after that evidence — they are not rankings.",
        href: "#use",
        hrefLabel: "Use the research",
      },
    ],
    tools: [
      { id: "verify", label: "Verify a contractor", href: "/verify", note: "Name or license search across live states. Not a ranking." },
      { id: "florida", label: "Florida Contractor Intelligence", href: "/florida", note: "Enhanced state Intelligence OS. Unchanged in this task except Ask roofing copy." },
      { id: "scope", label: "Scope Builder", href: "/tools/scope-builder", note: "Project scoping. Not a contractor score." },
      { id: "quote", label: "Quote Analyzer", href: "/tools/quote-analyzer", note: "Read a quote against a checklist." },
      { id: "bids", label: "Compare Bids", href: "/tools/compare-bids", note: "Compare offers, not a winner ranking." },
      { id: "contract", label: "Contract Analyzer", href: "/tools/contract-analyzer", note: "Educational contract review." },
      { id: "permit", label: "Permit Planner", href: "/tools/permit-planner", note: "Educational permit planning. Not a permit database." },
      {
        id: "saved-research",
        label: "Saved Research",
        href: "/projects",
        note: "Opens Projects. Watch and Home Passport remain available and unchanged.",
      },
      { id: "passport", label: "Home Passport", href: "/passport", note: "Household research workspace. Unchanged." },
      { id: "guides", label: "Guides", href: "/guides", note: "Educational guides." },
      { id: "methodology", label: "Methodology", href: "/methodology", note: "How evidence is assembled." },
    ],
    journey: [
      { step: "Official state source", status: "connected" },
      { step: "Credential / registration", status: "partial" },
      { step: "Trade / classification", status: "partial" },
      { step: "Holder / qualifier", status: "partial" },
      { step: "Business/entity relation", status: "where_acquired" },
      { step: "Regulatory observations", status: "where_acquired" },
      { step: "Local permit/enforcement", status: "where_acquired" },
      { step: "Public contractor research / profile", status: "partial" },
    ],
    sources: live.map((s) => ({
      id: s.licenseSource,
      state: s.code,
      agency: s.boardLabel,
      dataset: s.licenseSources?.join(" + ") ?? s.licenseSource,
      officialAsOf: CONFIG_AS_OF,
      retrievedAt: RETRIEVED,
      grain: "credential / registration row in the configured extract",
      coverage: s.coverageNote,
      limitation: s.pilot ? "Pilot / partial product surface. Confirm on the official board." : "Extract freshness varies. Confirm on the official board before you hire.",
      url: s.boardUrl,
    })),
    limitations: [
      "This homepage is not a national contractor census, marketplace, or ranking.",
      "Public credential evidence is not the economics or quality of a specific bid.",
    ],
    doesNotInfer: [
      "No Trust Score, Research Score, or contractor quality score.",
      "No best/top/safer contractor.",
      "No national licensed-contractor total.",
      "No service area from address or HQ.",
    ],
  };

  return { ...draft, payloadFingerprint: intelligenceFingerprint(draft) };
}

export function getContractorHomeIntel(): ContractorHomeIntel {
  return buildContractorHomeIntel();
}

export function researchDepthLabel(depth: ResearchDepth): string {
  return depthLabel(depth);
}

export function liveStateCount(): number {
  return getLiveStates().length;
}

export function specialtyOnlyCodes(): string[] {
  return getLiveStates()
    .filter((s) => s.depth === "specialty_verify")
    .map((s) => s.code);
}
