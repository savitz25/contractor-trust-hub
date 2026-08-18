/**
 * Network V2.1.1 — journey_handoff_click (Contractor).
 * Best-effort gtag/dataLayer. Never blocks navigation. Allowlisted fields only.
 */

export type JourneyHubId =
  | "ask"
  | "move"
  | "lender"
  | "insurance"
  | "contractor"
  | "senior"
  | "investor";

const HUBS = new Set<JourneyHubId>([
  "ask",
  "move",
  "lender",
  "insurance",
  "contractor",
  "senior",
  "investor",
]);

const FORBIDDEN = new Set([
  "name",
  "email",
  "phone",
  "address",
  "ssn",
  "account",
  "member",
  "diagnosis",
  "holdings",
  "href",
  "url",
]);

export type ContractorJourneyHandoff = {
  destination_hub: JourneyHubId;
  surface:
    | "contractor_plan_completion"
    | "contractor_home_next_step"
    | "contractor_trust_report_next_step";
  journey_id: string;
  context_type: string;
};

export function destinationHubFromHref(href: string): JourneyHubId | null {
  try {
    const host = new URL(href, "https://www.contractortrusthub.com").hostname
      .replace(/^www\./, "")
      .toLowerCase();
    if (host === "movetrusthub.com") return "move";
    if (host === "insurancetrusthub.com") return "insurance";
    if (host === "lendertrusthub.com") return "lender";
    if (host === "asktrusthub.com") return "ask";
    if (host === "seniortrusthub.com") return "senior";
    if (host === "investortrusthub.com") return "investor";
    if (host === "contractortrusthub.com") return "contractor";
    return null;
  } catch {
    return null;
  }
}

export function trackJourneyHandoff(params: ContractorJourneyHandoff): void {
  if (typeof window === "undefined") return;
  if (!HUBS.has(params.destination_hub)) return;
  const payload: Record<string, string> = {
    source_hub: "contractor",
    destination_hub: params.destination_hub,
    from_hub: "contractor",
    to_hub: params.destination_hub,
    surface: params.surface,
    journey_id: params.journey_id,
    context_type: params.context_type,
  };
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN.has(key)) return;
  }
  try {
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: Array<Record<string, unknown>>;
    };
    w.gtag?.("event", "journey_handoff_click", payload);
    w.dataLayer?.push({ event: "journey_handoff_click", ...payload });
  } catch {
    /* non-fatal */
  }
}

export function isForbiddenAnalyticsKey(key: string): boolean {
  return FORBIDDEN.has(key.toLowerCase());
}
