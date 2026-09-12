import {
  extractGeographyRequirement,
  stateName,
  type GeographyRequirement,
} from "./geography";
import { TRADE_ONTOLOGY, normalizeAskText, phraseInText } from "./ontology";
import { getStateBySlug } from "../states/config";
import { CONTRACTOR_STATE_NAMES } from "../search/state-names";
import { getExecutionCapability } from "../specialist-execution/state-capabilities";
import { askHref, type AskUrlOverrides } from "./url";
import {
  RECOVERY_SOURCES,
  isOfficialRecoveryDestination,
  type RecoverySourceId,
} from "./recovery-sources";

export type RecoveryAction = {
  kind: "INTERNAL_RESEARCH" | "INTERNAL_VERIFY" | "OFFICIAL_SOURCE" | "CLARIFY";
  label: string;
  destination: string;
  reason: string;
  establishes: string;
  cannotEstablish: string;
  sourceId?: RecoverySourceId;
};
export type ContractorRecovery = {
  requestedTask:
    | "VERIFY_GUIDANCE"
    | "REGULATORY_EXPLANATION"
    | "TRANSACTION"
    | "UNSUPPORTED_JURISDICTION_RESEARCH";
  originalQuery: string;
  requestedTrade: string | null;
  requestedState: string | null;
  requestedGeography: GeographyRequirement | null;
  locationLabel: string;
  capabilityState:
    | "GUIDANCE_AVAILABLE"
    | "SOURCE_BACKED_EXPLANATION"
    | "TRANSACTION_NOT_SUPPORTED"
    | "COHORT_UNAVAILABLE"
    | "NEEDS_CLARIFICATION";
  title: string;
  answer: string;
  steps: string[];
  limitations: string[];
  actions: RecoveryAction[];
  sourceIds: RecoverySourceId[];
};
const credential =
  /\b(?:(?:CCC|CBC|CGC|CAC|CMC|CFC|CRC|CPC|CVC|CUC|SCC|RC|RB|RG|RA|RM|RF|RR|RP|RV|RU|RX)\s*-?\s*\d{5,10}|13VH\d{8})\b/i;
const company = /\b(?:llc|inc|corp|corporation|company|holdings)\b/i;
const clarify = (label: string): RecoveryAction => ({
  kind: "CLARIFY",
  label,
  destination: "#ask-q",
  reason: "Keep the original question available for editing.",
  establishes: "The trade and project jurisdiction to research.",
  cannotEstablish: "No provider retrieval or regulatory finding has occurred.",
});
function official(id: RecoverySourceId, label: string): RecoveryAction {
  const s = RECOVERY_SOURCES[id];
  if (!isOfficialRecoveryDestination(s.url))
    throw new Error("invalid_recovery_destination");
  return {
    kind: "OFFICIAL_SOURCE",
    label,
    destination: s.url,
    reason: s.title,
    establishes: s.purpose,
    cannotEstablish: s.limitation,
    sourceId: id,
  };
}
function verify(state: string): RecoveryAction {
  return {
    kind: "INTERNAL_VERIFY",
    label: `Verify a ${stateName(state)} credential in ContractorTrustHub`,
    destination: `/verify?state=${state.toLowerCase()}`,
    reason:
      "Use the existing indexed identity/credential lookup for this state.",
    establishes:
      "A match to a supported published source record and its source-native class/status.",
    cannotEstablish:
      "A live regulator check, complete state coverage, workmanship or availability.",
  };
}
function requestedState(q: string): string | null {
  const hits = new Set(
    Object.entries(CONTRACTOR_STATE_NAMES)
      .filter(([name]) =>
        new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i").test(q),
      )
      .map(([, code]) => code),
  );
  const code = q
    .match(/(?:^|[ ,])(FL|TX|CA|AK|NJ|NY|IL)(?:[?.]|$)/i)?.[1]
    .toUpperCase();
  if (code) hits.add(code);
  return hits.size === 1 ? [...hits][0] : null;
}
/** Classifies non-cohort tasks; the existing identity, quality and state-specific operations keep precedence. */
export function interpretRecovery(
  raw: string,
  overrides: AskUrlOverrides = {},
): ContractorRecovery | null {
  if (
    !raw.trim() ||
    raw.length > 180 ||
    /[\u0000-\u001f]/.test(raw) ||
    credential.test(raw) ||
    company.test(raw) ||
    // Existing NY public-work and IL roofing interpreters retain their identifier/coverage contracts.
    /\b(?:new york|illinois|NY|IL)\b/i.test(raw) ||
    /\b(?:best|top|cheapest|safest|fastest)\b/i.test(raw)
  )
    return null;
  const q = raw.trim(),
    text = normalizeAskText(q);
  const guidance =
    /\b(?:how|where)\b.*\b(?:verify|check)\b|^(?:please\s+)?(?:check|verify)\b/i.test(
      q,
    );
  const transaction =
    /^(?:please\s+)?(?:(?:can|could|will)\s+you\s+)?(?:hire|book|schedule|dispatch|send\s+me)\b|^(?:i\s+)?need\b.*\b(?:today|tomorrow|someone|somebody|roofer|plumber|electrician|contractor)\b/i.test(
      q,
    );
  const researchQuery = q
    .replace(
      /^(?:please\s+)?(?:(?:can|could|will)\s+you\s+)?(?:(?:i\s+)?need|hire|book|schedule|dispatch|send\s+me)\s+(?:(?:a|an|someone|somebody)\s+)?/i,
      "",
    )
    .replace(/\b(?:for\s+)?(?:today|tomorrow|asap|right now)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const geography = extractGeographyRequirement(
    transaction ? researchQuery : q,
  );
  const namedState = requestedState(q),
    state = namedState ?? geography?.requestedState ?? null;
  const trades = TRADE_ONTOLOGY.filter((t) =>
    t.phrases.some((p) => phraseInText(text, p)),
  );
  const selectedTrade =
    overrides.trade && overrides.trade !== "-"
      ? TRADE_ONTOLOGY.find((t) => t.id === overrides.trade)
      : undefined;
  const trade =
    overrides.trade === "-"
      ? null
      : (selectedTrade?.id ??
        trades.at(0)?.id ??
        (/\belevators?\b/i.test(q) ? "elevator" : null));
  const policy =
    state === "TX" &&
    trades.at(0)?.id === "general" &&
    /^(?:does|do|who|is|are|must|what|which)\b/i.test(q) &&
    /\blicens(?:e[ds]?|ing)\b/i.test(q);
  const unsupported =
    state &&
    !getExecutionCapability(state) &&
    !["NY", "IL"].includes(state) &&
    /\b(?:contractors?|roofers?|plumbers?|electricians?|elevators?)\b/i.test(q);
  if (!guidance && !transaction && !policy && !unsupported) return null;
  const r: ContractorRecovery = {
    requestedTask: guidance
      ? "VERIFY_GUIDANCE"
      : policy
        ? "REGULATORY_EXPLANATION"
        : transaction
          ? "TRANSACTION"
          : "UNSUPPORTED_JURISDICTION_RESEARCH",
    originalQuery: q,
    requestedTrade: trade,
    requestedState: state,
    requestedGeography: geography,
    locationLabel:
      geography?.requestedState === state
        ? geography.normalizedPlace
        : state
          ? stateName(state)
          : (geography?.normalizedPlace ?? "Jurisdiction not specified"),
    capabilityState: "NEEDS_CLARIFICATION",
    title: "Choose the relevant research path",
    answer:
      "Specify the trade and project jurisdiction so we can identify a relevant research path. No other state was substituted.",
    steps: [],
    limitations: [
      "A recovery action is not a completed provider verification or a finding that no contractors exist.",
    ],
    actions: [],
    sourceIds: [],
  };
  if (policy && overrides.trade && overrides.trade !== "general") {
    r.title = "Clarify the trade for this policy question";
    r.answer =
      "The question asks about general-contractor licensing, but the selected trade filter asks about another trade. Change the question or remove that filter; specialty credentials do not answer general-contractor policy.";
    r.actions = [clarify("Edit the question or trade filter")];
  } else if (policy) {
    r.capabilityState = "SOURCE_BACKED_EXPLANATION";
    r.title = "Texas general-contractor licensing";
    r.answer =
      "Texas does not require a statewide general-contractor license. This is different from trade-specific licensing, such as air-conditioning or electrical credentials. Local registration and permit requirements may still apply. Requirements may depend on trade and local jurisdiction; confirm with the relevant authority.";
    r.actions = [
      official("texasGc", "Official Texas GC guidance — City of Austin"),
    ];
    r.limitations.push(
      "The supporting City of Austin page explains the state-license distinction. Its registration instructions apply to Austin, not every Texas municipality. Texas TAC/HVAC records were not searched.",
    );
  } else if (transaction && !guidance) {
    r.capabilityState = "TRANSACTION_NOT_SUPPORTED";
    r.title = "Research before you contact a contractor";
    r.answer =
      "ContractorTrustHub does not hire, dispatch, schedule, or guarantee contractor availability.";
    if (trade && geography) {
      r.answer +=
        " You can research credential records for the requested trade and place before contacting providers.";
      r.actions = [
        {
          kind: "INTERNAL_RESEARCH",
          label: "Research these credential records",
          destination: askHref(researchQuery, { ...overrides, page: "1" }),
          reason:
            "You are choosing credential research, not booking or availability.",
          establishes:
            "The existing research path applies its trade, recorded-geography and source-capability rules. Unresolved local scope still requires a choice.",
          cannotEstablish:
            "Availability today or tomorrow, a booking, quote, response time or service territory.",
        },
      ];
    } else
      r.answer +=
        " What kind of contractor do you need, and where is the project?";
    r.actions.push(clarify("Edit the trade or project location"));
  } else if (guidance) {
    r.title = "How to check a contractor credential";
    r.steps = [
      "Enter the company name or credential number in the relevant lookup.",
      "Match the exact regulatory identity; similarly named businesses may be different.",
      "Review the source-native credential class, status and source date.",
      "Confirm the current record with the issuing agency when needed.",
    ];
    if (state === "FL") {
      r.capabilityState = "GUIDANCE_AVAILABLE";
      r.answer =
        "ContractorTrustHub can research supported indexed Florida credential records. Match the credential class and identity before interpreting its status. Florida boards and trade coverage differ; one construction extract does not cover every trade.";
      r.actions =
        trade === "electrical"
          ? [official("florida", "Official Florida DBPR license search")]
          : [
              verify("FL"),
              official("florida", "Official Florida DBPR license search"),
            ];
      if (trade === "electrical")
        r.limitations.push(
          "The Florida construction cohort does not establish electrical-board coverage; select the electrical credential type in the official search.",
        );
    } else if (state === "CA") {
      r.capabilityState = "GUIDANCE_AVAILABLE";
      r.answer =
        "Use the supported California indexed identity lookup, then confirm the credential with CSLB. ContractorTrustHub coverage is partial; an indexed miss is not proof of an invalid or unlicensed business.";
      r.actions = [
        verify("CA"),
        official("california", "Official California CSLB license search"),
      ];
    } else if (state === "TX") {
      r.capabilityState = "GUIDANCE_AVAILABLE";
      r.answer =
        "Texas verification depends on the trade. The internal lookup covers supported indexed specialty records; TDLR is not a statewide general-contractor registry and does not cover every issuing board.";
      r.actions = [verify("TX")];
      if (!trade || ["hvac", "electrical"].includes(trade))
        r.actions.push(
          official(
            "texas",
            "Official Texas TDLR active specialty-license search",
          ),
        );
      r.limitations.push(
        "For other trades or a general-contractor question, identify the relevant board or local authority rather than treating a specialty match as general-contractor licensing.",
      );
    } else if (state && getStateBySlug(state.toLowerCase())?.live) {
      r.capabilityState = "GUIDANCE_AVAILABLE";
      r.answer =
        "Use the supported indexed identity lookup for this jurisdiction. Review its source coverage and confirm the credential with its issuing agency; an indexed miss is not a licensing finding.";
      r.actions = [verify(state)];
    }
  } else {
    r.capabilityState = "COHORT_UNAVAILABLE";
    r.title = "The requested credential cohort is unavailable";
    r.answer = `We cannot apply this ${r.locationLabel} filter for the requested ${trade ?? "contractor"} research in the current ContractorTrustHub research corpus. No broader or other-state cohort was substituted.`;
    if (state === "CA") {
      r.actions = [
        verify("CA"),
        official("california", "Official California CSLB license search"),
      ];
      r.limitations.push(
        "The California Verify action is a separate name/credential lookup, not a Los Angeles cohort or consent to statewide discovery.",
      );
    }
  }
  if (state === "AK" && trade === "elevator" && !transaction) {
    r.answer =
      "The current ContractorTrustHub corpus does not provide this Alaska elevator-contractor cohort. Alaska Mechanical Inspection publishes the relevant elevator equipment requirements and inspection contact, with Anchorage responsibility described separately.";
    r.actions = [
      official(
        "alaskaElevator",
        "Official Alaska elevator requirements and inspection contacts",
      ),
    ];
    r.limitations.push(
      "Equipment inspection and a Certificate of Operation are not contractor business-license or individual-qualification verification.",
    );
  }
  if (!r.actions.length)
    r.actions = [clarify("Specify the trade and jurisdiction")];
  if (overrides.evidence || overrides.status || overrides.sort)
    r.limitations.push(
      "Your selected filters are retained in research actions; guidance and official links do not establish that those filters matched a provider.",
    );
  r.sourceIds = [
    ...new Set(r.actions.flatMap((a) => (a.sourceId ? [a.sourceId] : []))),
  ];
  return r;
}
