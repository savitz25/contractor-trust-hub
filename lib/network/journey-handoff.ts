/**
 * Network V2.1 — bounded inbound journey context for Contractor.
 * Query keys only. Never persist or forward PII.
 */

export type JourneySrc =
  | "ask"
  | "move"
  | "lender"
  | "insurance"
  | "contractor"
  | "senior"
  | "investor";

export type JourneyKind =
  | "relocate"
  | "purchase"
  | "coverage"
  | "contractor"
  | "senior_care"
  | "unknown";

export type JourneyIntent = "buy" | "rent" | "refi" | "unknown";

export type NetworkJourneyContext = {
  src?: JourneySrc;
  journey?: JourneyKind;
  intent?: JourneyIntent;
  state?: string;
};

const SRC = new Set<JourneySrc>([
  "ask",
  "move",
  "lender",
  "insurance",
  "contractor",
  "senior",
  "investor",
]);
const JOURNEY = new Set<JourneyKind>([
  "relocate",
  "purchase",
  "coverage",
  "contractor",
  "senior_care",
  "unknown",
]);
const INTENT = new Set<JourneyIntent>(["buy", "rent", "refi", "unknown"]);

const FORBIDDEN = new Set([
  "name",
  "email",
  "phone",
  "ssn",
  "address",
  "street",
  "member",
  "holdings",
  "diagnosis",
]);

function first(
  v: string | string[] | undefined
): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t || undefined;
}

export function parseNetworkJourney(
  searchParams:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | null
    | undefined
): NetworkJourneyContext {
  const get = (key: string): string | undefined => {
    if (!searchParams) return undefined;
    if (searchParams instanceof URLSearchParams) return first(searchParams.get(key) ?? undefined);
    return first(searchParams[key]);
  };

  const srcRaw = get("src")?.toLowerCase() as JourneySrc | undefined;
  const journeyRaw = get("journey")?.toLowerCase() as JourneyKind | undefined;
  const intentRaw = get("intent")?.toLowerCase() as JourneyIntent | undefined;
  const stateRaw = get("state");
  const state =
    stateRaw && /^[A-Za-z]{2}$/.test(stateRaw)
      ? stateRaw.toUpperCase()
      : stateRaw && /^[a-z-]{2,32}$/i.test(stateRaw)
        ? stateRaw.toLowerCase()
        : undefined;

  return {
    src: srcRaw && SRC.has(srcRaw) ? srcRaw : undefined,
    journey: journeyRaw && JOURNEY.has(journeyRaw) ? journeyRaw : undefined,
    intent: intentRaw && INTENT.has(intentRaw) ? intentRaw : undefined,
    state,
  };
}

export function hasNetworkJourney(ctx: NetworkJourneyContext): boolean {
  return Boolean(ctx.src || ctx.journey || (ctx.intent && ctx.intent !== "unknown"));
}

export function buildSafeHandoffUrl(
  origin: string,
  path: string,
  ctx: NetworkJourneyContext,
  extras?: { journey?: JourneyKind; intent?: JourneyIntent }
): string {
  const p = new URLSearchParams();
  p.set("src", "contractor");
  const journey = extras?.journey ?? ctx.journey;
  const intent = extras?.intent ?? ctx.intent;
  if (journey) p.set("journey", journey);
  if (ctx.state) p.set("state", ctx.state);
  if (intent && intent !== "unknown") p.set("intent", intent);
  const q = p.toString();
  const pathPart = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${pathPart}${q ? `?${q}` : ""}`;
}

export type JourneyCta = {
  href: string;
  label: string;
  destination_hub: "insurance" | "move";
  journey_id: string;
  context_type: string;
};

export type JourneyModule = {
  eyebrow: string;
  heading: string;
  body: string;
  primary: JourneyCta;
  secondary?: JourneyCta;
  surface:
    | "contractor_plan_completion"
    | "contractor_home_next_step"
    | "contractor_trust_report_next_step";
};

function analyticsSurface(
  surface: "home" | "plan" | "trust-report"
): JourneyModule["surface"] {
  if (surface === "plan") return "contractor_plan_completion";
  if (surface === "trust-report") return "contractor_trust_report_next_step";
  return "contractor_home_next_step";
}

export function resolveContractorJourneyModule(
  ctx: NetworkJourneyContext,
  surface: "home" | "plan" | "trust-report"
): JourneyModule | null {
  const insurance = buildSafeHandoffUrl(
    "https://www.insurancetrusthub.com",
    "/destinations",
    ctx,
    { journey: "coverage" }
  );
  const move = buildSafeHandoffUrl("https://www.movetrusthub.com", "/", ctx, {
    journey: "relocate",
  });

  const coverageRelevant =
    ctx.journey === "coverage" ||
    ctx.journey === "purchase" ||
    ctx.src === "insurance" ||
    surface === "plan";
  const moveRelevant = ctx.journey === "relocate" || ctx.src === "move";

  if (surface === "trust-report" && !hasNetworkJourney(ctx)) return null;

  if (surface === "home" && !hasNetworkJourney(ctx) && !coverageRelevant) return null;

  if (moveRelevant && surface !== "trust-report") {
    return {
      surface: analyticsSurface(surface),
      eyebrow: "Part of the Ask Trust Hub research network",
      heading: "Preparing a move around this project?",
      body: "Only when the work is pre-move, post-move, or move-in preparation. License verification stays the main task here.",
      primary: {
        href: move,
        label: "Plan the move",
        destination_hub: "move",
        journey_id: "relocate",
        context_type: "home_project",
      },
      secondary: coverageRelevant
        ? {
            href: insurance,
            label: "Research insurance",
            destination_hub: "insurance",
            journey_id: "coverage",
            context_type: "home_project",
          }
        : undefined,
    };
  }

  if (coverageRelevant) {
    return {
      surface: analyticsSurface(surface),
      eyebrow: "Part of the Ask Trust Hub research network",
      heading: "Check how your project may affect coverage",
      body: "Major property work can change homeowners or related coverage questions. This is educational research — not a claim decision and not a statement that anything is covered.",
      primary: {
        href: insurance,
        label: "Research insurance",
        destination_hub: "insurance",
        journey_id: "coverage",
        context_type: "home_project",
      },
    };
  }

  if (surface === "trust-report") return null;
  return null;
}

export function journeyQueryHasPii(
  searchParams: Record<string, string | string[] | undefined>
): boolean {
  return Object.keys(searchParams).some((k) => FORBIDDEN.has(k.toLowerCase()));
}
