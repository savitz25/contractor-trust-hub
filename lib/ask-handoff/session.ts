import type { ContractorAskSearchContext } from "./allowlist";
import { parseContractorAskHandoff, serializeContractorAskHandoff } from "./parse";

export const CONTRACTOR_ASK_SESSION_KEY = "cth:ask-search-handoff";

export function persistContractorAskHandoff(ctx: ContractorAskSearchContext | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      window.sessionStorage.removeItem(CONTRACTOR_ASK_SESSION_KEY);
      return;
    }
    window.sessionStorage.setItem(CONTRACTOR_ASK_SESSION_KEY, serializeContractorAskHandoff(ctx));
  } catch {
    /* private mode */
  }
}

export function readContractorAskHandoff(): ContractorAskSearchContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CONTRACTOR_ASK_SESSION_KEY);
    return raw ? parseContractorAskHandoff(raw) : null;
  } catch {
    return null;
  }
}

export function analyticsFromContractorAsk(
  ctx: ContractorAskSearchContext,
  extra?: { handoff_type?: "entity" | "view_more"; match_precision?: string }
) {
  return {
    source: "ask" as const,
    handoff_type: extra?.handoff_type,
    entity_type: ctx.entityType,
    category: ctx.category,
    state: ctx.state,
    county: ctx.county,
    city: ctx.city,
    zip: ctx.zip,
    match_precision: extra?.match_precision,
  };
}

export function trackAskSearchHandoff(
  payload: ReturnType<typeof analyticsFromContractorAsk>
): void {
  if (typeof window === "undefined") return;
  const forbidden = new Set(["email", "phone", "name", "query", "ssn"]);
  for (const key of Object.keys(payload)) {
    if (forbidden.has(key.toLowerCase())) return;
  }
  try {
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: Array<Record<string, unknown>>;
    };
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (v == null || v === "") continue;
      clean[k] = String(v).slice(0, 64);
    }
    w.gtag?.("event", "ask_search_handoff", clean);
    w.dataLayer?.push({ event: "ask_search_handoff", ...clean });
  } catch {
    /* non-fatal */
  }
}
